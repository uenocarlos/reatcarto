<?php

declare(strict_types=1);

function json_conflict(
    string $message,
    array $localSnapshot,
    array $remoteSnapshot,
    string $kind = 'update_update'
): never {
    throw new ConflictException($message, $localSnapshot, $remoteSnapshot, $kind);
}

function format_map_record(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'public_id' => (string) $row['public_id'],
        'owner_id' => (string) $row['owner_id'],
        'name' => (string) $row['name'],
        'description' => (string) ($row['description'] ?? ''),
        'center_lat' => (float) $row['center_lat'],
        'center_lng' => (float) $row['center_lng'],
        'zoom' => (int) $row['zoom'],
        'is_published' => (bool) $row['is_published'],
        'moderated_at' => $row['moderated_at'],
        'moderation_reason' => $row['moderation_reason'],
        'version' => (int) $row['version'],
        'created_at' => (string) $row['created_at'],
        'updated_at' => (string) $row['updated_at'],
    ];
}

/**
 * @return array<string, mixed>|null
 */
function fetch_map_by_id(string $mapId): ?array
{
    $stmt = db()->prepare('SELECT * FROM maps WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $mapId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

function assert_map_owner(array $user, array $map, bool $notFoundOnDeny = true): void
{
    if ((string) $map['owner_id'] !== (string) $user['id']) {
        if ($notFoundOnDeny) {
            auth_fail('not_found', 'Map not found.', 404);
        }
        auth_fail('forbidden', 'You do not have access to this map.', 403);
    }
}

function is_valid_public_id(string $publicId): bool
{
    return (bool) preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
        $publicId
    );
}

/**
 * @param array<string, mixed> $row
 */
function map_is_public_eligible(array $row): bool
{
    return (bool) ($row['is_published'] ?? false)
        && ($row['moderated_at'] ?? null) === null
        && ($row['owner_status'] ?? '') === 'active';
}

/**
 * @return array<string, mixed>|null
 */
function fetch_public_map_row(string $publicId): ?array
{
    if (!is_valid_public_id($publicId)) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT m.*, u.status AS owner_status
         FROM maps m
         JOIN users u ON u.id = m.owner_id
         WHERE m.public_id = :public_id
         LIMIT 1'
    );
    $stmt->execute(['public_id' => $publicId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

function maps_list(array $user, ?string $q = null, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $params = ['owner_id' => $user['id']];
    $where = 'owner_id = :owner_id';
    if ($q !== null && trim($q) !== '') {
        $where .= ' AND (name ILIKE :q OR description ILIKE :q)';
        $params['q'] = '%' . trim($q) . '%';
    }

    $countStmt = db()->prepare("SELECT COUNT(*) FROM maps WHERE {$where}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $params['limit'] = $pageSize;
    $params['offset'] = $offset;
    $stmt = db()->prepare(
        "SELECT * FROM maps WHERE {$where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $key => $value) {
        $stmt->bindValue(
            ':' . $key,
            $value,
            is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR
        );
    }
    $stmt->execute();
    $maps = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $maps[] = format_map_record($row);
    }

    return [
        'success' => true,
        'maps' => $maps,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 0,
        ],
    ];
}

function maps_get(array $user, string $mapId): array
{
    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map);

    return ['success' => true, 'map' => format_map_record($map)];
}

function maps_create(array $user, array $input): array
{
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['name' => 'Name is required.']);
    }
    if (mb_strlen($name) > MAX_MAP_NAME_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'name' => 'Name exceeds maximum length of ' . MAX_MAP_NAME_LENGTH . ' characters.',
        ]);
    }

    $description = trim((string) ($input['description'] ?? ''));
    if (mb_strlen($description) > MAX_TEXT_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'description' => 'Description exceeds maximum length.',
        ]);
    }

    $centerLat = $input['center_lat'] ?? -32.035;
    $centerLng = $input['center_lng'] ?? -52.1;
    $zoom = $input['zoom'] ?? 13;
    if (!is_numeric($centerLat) || !is_numeric($centerLng) || !is_numeric($zoom)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'center_lat' => 'Invalid map center or zoom.',
        ]);
    }
    $centerLat = (float) $centerLat;
    $centerLng = (float) $centerLng;
    $zoom = (int) $zoom;
    if ($centerLat < -90 || $centerLat > 90 || $centerLng < -180 || $centerLng > 180) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'center_lat' => 'Latitude must be between -90 and 90.',
            'center_lng' => 'Longitude must be between -180 and 180.',
        ]);
    }
    if ($zoom < 0 || $zoom > 22) {
        auth_fail('validation_error', 'Validation failed.', 400, ['zoom' => 'Zoom must be between 0 and 22.']);
    }

    $countStmt = db()->prepare('SELECT COUNT(*) FROM maps WHERE owner_id = :owner_id');
    $countStmt->execute(['owner_id' => $user['id']]);
    if ((int) $countStmt->fetchColumn() >= MAPS_PER_USER) {
        auth_fail('payload_too_large', 'Map limit reached.', 400, [
            'maps' => 'Maximum ' . MAPS_PER_USER . ' maps per user.',
        ]);
    }

    $stmt = db()->prepare(
        'INSERT INTO maps (owner_id, name, description, center_lat, center_lng, zoom)
         VALUES (:owner_id, :name, :description, :center_lat, :center_lng, :zoom)
         RETURNING *'
    );
    $stmt->execute([
        'owner_id' => $user['id'],
        'name' => $name,
        'description' => $description,
        'center_lat' => $centerLat,
        'center_lng' => $centerLng,
        'zoom' => $zoom,
    ]);
    $map = format_map_record($stmt->fetch(PDO::FETCH_ASSOC));
    $result = ['success' => true, 'map' => $map];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'map', $map['id'], $result);
    }

    return $result;
}

function maps_update(array $user, array $input, bool $forceVersion = false): array
{
    $mapId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map);

    $baseVersion = $input['base_version'] ?? null;
    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $map['version']) {
        json_conflict(
            'Map version conflict.',
            ['id' => $mapId, 'base_version' => (int) $baseVersion, 'payload' => $input],
            format_map_record($map)
        );
    }

    $fields = [];
    $params = ['id' => $mapId];

    if (array_key_exists('name', $input)) {
        $name = trim((string) $input['name']);
        if ($name === '') {
            auth_fail('validation_error', 'Validation failed.', 400, ['name' => 'Name is required.']);
        }
        if (mb_strlen($name) > MAX_MAP_NAME_LENGTH) {
            auth_fail('validation_error', 'Validation failed.', 400, ['name' => 'Name exceeds maximum length.']);
        }
        $fields[] = 'name = :name';
        $params['name'] = $name;
    }

    if (array_key_exists('description', $input)) {
        $description = trim((string) $input['description']);
        if (mb_strlen($description) > MAX_TEXT_LENGTH) {
            auth_fail('validation_error', 'Validation failed.', 400, [
                'description' => 'Description exceeds maximum length.',
            ]);
        }
        $fields[] = 'description = :description';
        $params['description'] = $description;
    }

    foreach (['center_lat', 'center_lng', 'zoom'] as $key) {
        if (array_key_exists($key, $input)) {
            $fields[] = "{$key} = :{$key}";
            $params[$key] = $input[$key];
        }
    }

    if ($fields === []) {
        return ['success' => true, 'map' => format_map_record($map)];
    }

    $fields[] = 'version = version + 1';
    $fields[] = 'updated_at = NOW()';
    $sql = 'UPDATE maps SET ' . implode(', ', $fields) . ' WHERE id = :id RETURNING *';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $updated = format_map_record($stmt->fetch(PDO::FETCH_ASSOC));
    $result = ['success' => true, 'map' => $updated];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
    }

    return $result;
}

function map_element_count(string $mapId): int
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM map_elements WHERE map_id = :map_id');
    $stmt->execute(['map_id' => $mapId]);

    return (int) $stmt->fetchColumn();
}

function maps_publish(array $user, array $input, bool $forceVersion = false): array
{
    $mapId = (string) ($input['id'] ?? '');
    $confirmEmpty = !empty($input['confirm_empty']);
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map, false);

    $baseVersion = $input['base_version'] ?? null;
    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $map['version']) {
        json_conflict(
            'Map version conflict.',
            ['id' => $mapId, 'base_version' => (int) $baseVersion, 'op' => 'publish'],
            format_map_record($map)
        );
    }

    $name = trim((string) $map['name']);
    if ($name === '') {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'name' => 'A valid public-facing name is required before publishing.',
        ]);
    }

    $description = (string) ($map['description'] ?? '');
    if (mb_strlen($description) > MAX_TEXT_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'description' => 'Description exceeds maximum length.',
        ]);
    }

    if (map_element_count($mapId) === 0 && !$confirmEmpty) {
        auth_fail(
            'confirmation_required',
            'This map has no elements. Confirm publishing an empty public map.',
            400,
            [
                'confirm_empty' => 'Set confirm_empty to true after reviewing public exposure.',
            ]
        );
    }

    if ((bool) $map['is_published']) {
        $result = ['success' => true, 'map' => format_map_record($map)];
        if ($clientMutationId !== '') {
            client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
        }

        return $result;
    }

    $stmt = db()->prepare(
        'UPDATE maps SET is_published = true, version = version + 1, updated_at = NOW()
         WHERE id = :id RETURNING *'
    );
    $stmt->execute(['id' => $mapId]);
    $updated = format_map_record($stmt->fetch(PDO::FETCH_ASSOC));
    $result = ['success' => true, 'map' => $updated];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
    }

    return $result;
}

function maps_unpublish(array $user, array $input, bool $forceVersion = false): array
{
    $mapId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map, false);

    $baseVersion = $input['base_version'] ?? null;
    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $map['version']) {
        json_conflict(
            'Map version conflict.',
            ['id' => $mapId, 'base_version' => (int) $baseVersion, 'op' => 'unpublish'],
            format_map_record($map)
        );
    }

    if (!(bool) $map['is_published']) {
        $result = ['success' => true, 'map' => format_map_record($map)];
        if ($clientMutationId !== '') {
            client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
        }

        return $result;
    }

    $stmt = db()->prepare(
        'UPDATE maps SET is_published = false, version = version + 1, updated_at = NOW()
         WHERE id = :id RETURNING *'
    );
    $stmt->execute(['id' => $mapId]);
    $updated = format_map_record($stmt->fetch(PDO::FETCH_ASSOC));
    $result = ['success' => true, 'map' => $updated];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
    }

    return $result;
}

function maps_delete(array $user, array $input, bool $forceVersion = false): array
{
    $mapId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $baseVersion = $input['base_version'] ?? null;

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        return ['success' => true, 'deleted' => true];
    }
    assert_map_owner($user, $map);

    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $map['version']) {
        json_conflict(
            'Map version conflict.',
            ['id' => $mapId, 'base_version' => (int) $baseVersion, 'op' => 'delete'],
            format_map_record($map),
            'update_delete'
        );
    }

    photos_delete_for_map($mapId);
    db()->prepare('DELETE FROM maps WHERE id = :id')->execute(['id' => $mapId]);

    $result = ['success' => true, 'deleted' => true];
    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
    }

    return $result;
}
