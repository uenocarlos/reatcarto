<?php

declare(strict_types=1);

require_once __DIR__ . '/AuditService.php';

function assert_admin(array $user): void
{
    if (($user['role'] ?? '') !== 'admin') {
        auth_fail('forbidden', 'Administrator access required.', 403);
    }
}

/**
 * @return array<string, mixed>
 */
function serialize_admin_user(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'username' => (string) $row['username'],
        'email' => (string) $row['email'],
        'full_name' => (string) $row['full_name'],
        'organization' => (string) $row['organization'],
        'job_title' => (string) $row['job_title'],
        'phone' => (string) $row['phone'],
        'role' => (string) $row['role'],
        'status' => (string) $row['status'],
        'email_verified' => $row['email_verified_at'] !== null,
    ];
}

function admin_list_users(array $admin, ?string $q = null, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    assert_admin($admin);
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $params = [];
    $where = '1=1';
    if ($q !== null && trim($q) !== '') {
        $term = trim($q);
        if (strlen($term) > MAX_SEARCH_QUERY_LENGTH) {
            auth_fail('validation_error', 'Validation failed.', 400, ['q' => 'Search query is too long.']);
        }
        $where .= ' AND (username ILIKE :q OR email ILIKE :q OR full_name ILIKE :q OR organization ILIKE :q)';
        $params['q'] = '%' . $term . '%';
    }

    $countStmt = db()->prepare("SELECT COUNT(*) FROM users WHERE {$where}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $params['limit'] = $pageSize;
    $params['offset'] = $offset;
    $stmt = db()->prepare(
        "SELECT * FROM users WHERE {$where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();

    $users = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $users[] = serialize_admin_user($row);
    }

    return [
        'success' => true,
        'users' => $users,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 0,
        ],
    ];
}

function admin_set_user_status(array $admin, array $input): array
{
    assert_admin($admin);

    $userId = trim((string) ($input['user_id'] ?? $input['id'] ?? ''));
    $status = trim((string) ($input['status'] ?? ''));
    $reason = isset($input['reason']) ? (string) $input['reason'] : null;

    validate_admin_reason($reason);

    if ($userId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['user_id' => 'User id is required.']);
    }
    if (!in_array($status, ['activate', 'deactivate'], true)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'status' => 'Status must be activate or deactivate.',
        ]);
    }

    $target = fetch_user_by_id($userId);
    if ($target === null) {
        auth_fail('not_found', 'User not found.', 404);
    }

    $before = serialize_admin_user($target);
    $pdo = db();

    if ($status === 'deactivate') {
        if ($target['status'] !== 'deactivated') {
            if ((string) $admin['id'] === $userId) {
                auth_fail('validation_error', 'Validation failed.', 400, [
                    'user_id' => 'Administrators cannot deactivate their own account.',
                ]);
            }
            if (($target['role'] ?? '') === 'admin') {
                $otherActiveAdmins = db()->prepare(
                    'SELECT COUNT(*) FROM users WHERE role = :role AND status = :status AND id != :id'
                );
                $otherActiveAdmins->execute([
                    'role' => 'admin',
                    'status' => 'active',
                    'id' => $userId,
                ]);
                if ((int) $otherActiveAdmins->fetchColumn() === 0) {
                    auth_fail('validation_error', 'Validation failed.', 400, [
                        'user_id' => 'Cannot deactivate the last active administrator.',
                    ]);
                }
            }
        }

        if ($target['status'] === 'deactivated') {
            audit_append($admin, 'user.deactivate', 'user', $userId, $reason, $before, $before);
            Mailer::sendAdminActionNotification(
                (string) $target['email'],
                'Account deactivated',
                $reason ?? '',
                $admin,
                'user',
                $userId
            );

            return ['success' => true, 'user' => serialize_admin_user($target)];
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'UPDATE users SET status = :status, updated_at = NOW() WHERE id = :id'
            )->execute(['status' => 'deactivated', 'id' => $userId]);
            $pdo->prepare(
                'UPDATE maps SET is_published = false, updated_at = NOW() WHERE owner_id = :owner_id AND is_published = true'
            )->execute(['owner_id' => $userId]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        revoke_all_user_sessions($userId);
        $fresh = fetch_user_by_id($userId);
        $after = serialize_admin_user($fresh);
        audit_append($admin, 'user.deactivate', 'user', $userId, $reason, $before, $after);
        Mailer::sendAdminActionNotification(
            (string) $target['email'],
            'Account deactivated',
            $reason ?? '',
            $admin,
            'user',
            $userId
        );

        return ['success' => true, 'user' => $after];
    }

    // activate
    if ($target['email_verified_at'] === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'status' => 'Cannot activate account without verified email.',
        ]);
    }

    if ($target['status'] === 'active') {
        audit_append($admin, 'user.activate', 'user', $userId, $reason, $before, $before);
        Mailer::sendAdminActionNotification(
            (string) $target['email'],
            'Account activated',
            $reason ?? '',
            $admin,
            'user',
            $userId
        );

        return ['success' => true, 'user' => $before];
    }

    $pdo->prepare(
        'UPDATE users SET status = :status, updated_at = NOW() WHERE id = :id'
    )->execute(['status' => 'active', 'id' => $userId]);

    $fresh = fetch_user_by_id($userId);
    $after = serialize_admin_user($fresh);
    audit_append($admin, 'user.activate', 'user', $userId, $reason, $before, $after);
    Mailer::sendAdminActionNotification(
        (string) $target['email'],
        'Account activated',
        $reason ?? '',
        $admin,
        'user',
        $userId
    );

    return ['success' => true, 'user' => $after];
}

function admin_moderate_map(array $admin, array $input): array
{
    assert_admin($admin);

    $mapId = trim((string) ($input['map_id'] ?? $input['id'] ?? ''));
    $reason = isset($input['reason']) ? (string) $input['reason'] : null;
    validate_admin_reason($reason);

    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['map_id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }

    $before = format_map_record($map);

    if ($map['moderated_at'] !== null) {
        $current = format_map_record($map);
        audit_append($admin, 'map.moderate', 'map', $mapId, $reason, $before, $current);
        $owner = fetch_user_by_id((string) $map['owner_id']);
        if ($owner !== null) {
            Mailer::sendAdminActionNotification(
                (string) $owner['email'],
                'Map moderated',
                $reason ?? '',
                $admin,
                'map',
                $mapId
            );
        }

        return ['success' => true, 'map' => $current];
    }

    db()->prepare(
        'UPDATE maps SET moderated_at = NOW(), moderation_reason = :reason, is_published = false,
         version = version + 1, updated_at = NOW()
         WHERE id = :id'
    )->execute(['reason' => $reason, 'id' => $mapId]);

    $fresh = fetch_map_by_id($mapId);
    $after = format_map_record($fresh);
    audit_append($admin, 'map.moderate', 'map', $mapId, $reason, $before, $after);

    $owner = fetch_user_by_id((string) $map['owner_id']);
    if ($owner !== null) {
        Mailer::sendAdminActionNotification(
            (string) $owner['email'],
            'Map moderated',
            $reason ?? '',
            $admin,
            'map',
            $mapId
        );
    }

    return ['success' => true, 'map' => $after];
}

function admin_private_access(array $admin, array $input): array
{
    assert_admin($admin);

    $mapId = trim((string) ($input['map_id'] ?? $input['id'] ?? ''));
    $reason = isset($input['reason']) ? (string) $input['reason'] : null;
    validate_admin_reason($reason);

    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['map_id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }

    audit_append($admin, 'map.private_access', 'map', $mapId, $reason, null, format_map_record($map));

    $elements = elements_list_for_admin($mapId);

    return [
        'success' => true,
        'map' => format_map_record($map),
        'elements' => $elements,
    ];
}

/**
 * @return list<array<string, mixed>>
 */
function elements_list_for_admin(string $mapId): array
{
    $stmt = db()->prepare(
        'SELECT e.*, ST_AsGeoJSON(e.geom)::text AS geojson
         FROM map_elements e WHERE e.map_id = :map_id ORDER BY e.created_at ASC'
    );
    $stmt->execute(['map_id' => $mapId]);
    $elements = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $photos = photos_for_element((string) $row['id']);
        $elements[] = format_element_record($row, $photos);
    }

    return $elements;
}

function admin_private_mutate(array $admin, array $input): array
{
    assert_admin($admin);

    $action = trim((string) ($input['action'] ?? ''));
    $reason = isset($input['reason']) ? (string) $input['reason'] : null;
    validate_admin_reason($reason);

    if ($action === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['action' => 'Action is required.']);
    }

    $result = match ($action) {
        'update_map' => admin_mutate_update_map($admin, $input, $reason),
        'delete_map' => admin_mutate_delete_map($admin, $input, $reason),
        'update_element' => admin_mutate_update_element($admin, $input, $reason),
        'delete_element' => admin_mutate_delete_element($admin, $input, $reason),
        default => auth_fail('validation_error', 'Validation failed.', 400, [
            'action' => 'Unknown action.',
        ]),
    };

    return $result;
}

function admin_mutate_update_map(array $admin, array $input, string $reason): array
{
    $mapId = trim((string) ($input['map_id'] ?? ''));
    $payload = is_array($input['payload'] ?? null) ? $input['payload'] : [];
    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['map_id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }

    $before = format_map_record($map);
    $owner = fetch_user_by_id((string) $map['owner_id']);
    if ($owner === null) {
        auth_fail('not_found', 'Map owner not found.', 404);
    }

    $payload['id'] = $mapId;
    unset($payload['is_published']);

    $updated = maps_update($owner, $payload, true);
    $after = $updated['map'];
    audit_append($admin, 'map.private_mutate', 'map', $mapId, $reason, $before, $after);
    Mailer::sendAdminActionNotification(
        (string) $owner['email'],
        'Map updated by administrator',
        $reason,
        $admin,
        'map',
        $mapId
    );

    return ['success' => true, 'map' => $after];
}

function admin_mutate_delete_map(array $admin, array $input, string $reason): array
{
    $mapId = trim((string) ($input['map_id'] ?? ''));
    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['map_id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        audit_append($admin, 'map.private_mutate_delete', 'map', $mapId, $reason, null, null);

        return ['success' => true, 'deleted' => true];
    }

    $before = format_map_record($map);
    $owner = fetch_user_by_id((string) $map['owner_id']);
    photos_delete_for_map($mapId);
    videos_delete_for_map($mapId);
    db()->prepare('DELETE FROM maps WHERE id = :id')->execute(['id' => $mapId]);
    audit_append($admin, 'map.private_mutate_delete', 'map', $mapId, $reason, $before, null);

    if ($owner !== null) {
        Mailer::sendAdminActionNotification(
            (string) $owner['email'],
            'Map deleted by administrator',
            $reason,
            $admin,
            'map',
            $mapId
        );
    }

    return ['success' => true, 'deleted' => true];
}

function admin_mutate_update_element(array $admin, array $input, string $reason): array
{
    $elementId = trim((string) ($input['element_id'] ?? ''));
    $payload = is_array($input['payload'] ?? null) ? $input['payload'] : [];
    if ($elementId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['element_id' => 'Element id is required.']);
    }

    $element = fetch_element_by_id($elementId);
    if ($element === null) {
        auth_fail('not_found', 'Element not found.', 404);
    }

    $map = fetch_map_by_id((string) $element['map_id']);
    if ($map === null) {
        auth_fail('not_found', 'Element not found.', 404);
    }

    $owner = fetch_user_by_id((string) $map['owner_id']);
    if ($owner === null) {
        auth_fail('not_found', 'Map owner not found.', 404);
    }

    $photos = photos_for_element($elementId);
    $before = format_element_record($element, $photos);
    $payload['id'] = $elementId;

    try {
        $updated = elements_update($owner, $payload, true);
    } catch (AuthException $e) {
        if ($e->errorCode === 'validation_error') {
            throw $e;
        }
        throw $e;
    }

    $after = $updated['element'];
    audit_append($admin, 'element.private_mutate', 'element', $elementId, $reason, $before, $after);
    Mailer::sendAdminActionNotification(
        (string) $owner['email'],
        'Element updated by administrator',
        $reason,
        $admin,
        'element',
        $elementId
    );

    return ['success' => true, 'element' => $after];
}

function admin_mutate_delete_element(array $admin, array $input, string $reason): array
{
    $elementId = trim((string) ($input['element_id'] ?? ''));
    if ($elementId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['element_id' => 'Element id is required.']);
    }

    $element = fetch_element_by_id($elementId);
    if ($element === null) {
        audit_append($admin, 'element.private_mutate_delete', 'element', $elementId, $reason, null, null);

        return ['success' => true, 'deleted' => true];
    }

    $map = fetch_map_by_id((string) $element['map_id']);
    $owner = $map !== null ? fetch_user_by_id((string) $map['owner_id']) : null;
    $photos = photos_for_element($elementId);
    $before = format_element_record($element, $photos);

    photos_delete_for_element($elementId);
    videos_delete_for_element($elementId);
    db()->prepare('DELETE FROM map_elements WHERE id = :id')->execute(['id' => $elementId]);
    audit_append($admin, 'element.private_mutate_delete', 'element', $elementId, $reason, $before, null);

    if ($owner !== null) {
        Mailer::sendAdminActionNotification(
            (string) $owner['email'],
            'Element deleted by administrator',
            $reason,
            $admin,
            'element',
            $elementId
        );
    }

    return ['success' => true, 'deleted' => true];
}

function admin_list_audit(array $admin, ?string $q = null, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    assert_admin($admin);

    return audit_list($q, $page, $pageSize);
}
