<?php

declare(strict_types=1);

const AUDIT_JSON_MAX_BYTES = 32768;
const ADMIN_REASON_MAX = MAX_TEXT_LENGTH;

function validate_admin_reason(?string $reason): void
{
    $err = validate_required_text($reason, 'Reason', ADMIN_REASON_MAX);
    if ($err !== null) {
        auth_fail('validation_error', 'Validation failed.', 400, ['reason' => $err]);
    }
}

/**
 * @param array<string, mixed>|null $data
 * @return array<string, mixed>|null
 */
function audit_truncate_json(?array $data): ?array
{
    if ($data === null) {
        return null;
    }

    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($encoded === false || strlen($encoded) <= AUDIT_JSON_MAX_BYTES) {
        return $data;
    }

    $ids = [];
    foreach (['id', 'map_id', 'element_id', 'owner_id', 'public_id', 'user_id'] as $key) {
        if (isset($data[$id = $key])) {
            $ids[$key] = $data[$key];
        }
    }

    return array_merge($ids, [
        '_truncated' => true,
        '_original_bytes' => strlen($encoded),
    ]);
}

/**
 * @param array<string, mixed>|null $before
 * @param array<string, mixed>|null $after
 */
function audit_append(
    array $actor,
    string $action,
    string $targetType,
    string $targetId,
    ?string $reason = null,
    ?array $before = null,
    ?array $after = null,
): string {
    $stmt = db()->prepare(
        'INSERT INTO audit_events (actor_id, actor_role, action, target_type, target_id, reason, before_json, after_json)
         VALUES (:actor_id, :actor_role, :action, :target_type, :target_id, :reason, :before_json, :after_json)
         RETURNING id'
    );
    $stmt->execute([
        'actor_id' => $actor['id'],
        'actor_role' => (string) $actor['role'],
        'action' => $action,
        'target_type' => $targetType,
        'target_id' => $targetId,
        'reason' => $reason,
        'before_json' => $before !== null ? json_encode(audit_truncate_json($before), JSON_UNESCAPED_UNICODE) : null,
        'after_json' => $after !== null ? json_encode(audit_truncate_json($after), JSON_UNESCAPED_UNICODE) : null,
    ]);

    return (string) $stmt->fetchColumn();
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function format_audit_event(array $row): array
{
    $before = $row['before_json'];
    $after = $row['after_json'];

    return [
        'id' => (string) $row['id'],
        'actor_id' => $row['actor_id'] !== null ? (string) $row['actor_id'] : null,
        'actor_role' => (string) $row['actor_role'],
        'action' => (string) $row['action'],
        'target_type' => (string) $row['target_type'],
        'target_id' => (string) $row['target_id'],
        'reason' => $row['reason'] !== null ? (string) $row['reason'] : null,
        'before' => is_string($before) ? json_decode($before, true) : null,
        'after' => is_string($after) ? json_decode($after, true) : null,
        'created_at' => (string) $row['created_at'],
    ];
}

function audit_list(?string $q = null, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $params = [];
    $where = '1=1';
    if ($q !== null && trim($q) !== '') {
        $term = trim($q);
        if (strlen($term) > MAX_SEARCH_QUERY_LENGTH) {
            auth_fail('validation_error', 'Validation failed.', 400, [
                'q' => 'Search query is too long.',
            ]);
        }
        $where .= ' AND (action ILIKE :q OR target_type ILIKE :q OR target_id::text ILIKE :q OR reason ILIKE :q)';
        $params['q'] = '%' . $term . '%';
    }

    $countStmt = db()->prepare("SELECT COUNT(*) FROM audit_events WHERE {$where}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $params['limit'] = $pageSize;
    $params['offset'] = $offset;
    $stmt = db()->prepare(
        "SELECT * FROM audit_events WHERE {$where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();

    $events = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $events[] = format_audit_event($row);
    }

    return [
        'success' => true,
        'events' => $events,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 0,
        ],
    ];
}

function audit_count(): int
{
    return (int) db()->query('SELECT COUNT(*) FROM audit_events')->fetchColumn();
}
