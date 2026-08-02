<?php

declare(strict_types=1);

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function format_public_map_summary(array $row): array
{
    return [
        'public_id' => (string) $row['public_id'],
        'name' => (string) $row['name'],
        'description' => (string) ($row['description'] ?? ''),
        'center_lat' => (float) $row['center_lat'],
        'center_lng' => (float) $row['center_lng'],
        'zoom' => (int) $row['zoom'],
        'updated_at' => (string) $row['updated_at'],
    ];
}

function public_maps_list(?string $q = null, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    if ($q !== null && mb_strlen($q) > MAX_SEARCH_QUERY_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'q' => 'Search query exceeds maximum length.',
        ]);
    }

    $params = [];
    $where = 'm.is_published = true AND m.moderated_at IS NULL AND u.status = :owner_status';
    $params['owner_status'] = 'active';

    if ($q !== null && trim($q) !== '') {
        $where .= ' AND (m.name ILIKE :q OR m.description ILIKE :q)';
        $params['q'] = '%' . trim($q) . '%';
    }

    $countStmt = db()->prepare(
        "SELECT COUNT(*) FROM maps m JOIN users u ON u.id = m.owner_id WHERE {$where}"
    );
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $params['limit'] = $pageSize;
    $params['offset'] = $offset;
    $stmt = db()->prepare(
        "SELECT m.*, u.status AS owner_status
         FROM maps m
         JOIN users u ON u.id = m.owner_id
         WHERE {$where}
         ORDER BY m.updated_at DESC
         LIMIT :limit OFFSET :offset"
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
        $maps[] = format_public_map_summary($row);
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

function public_map_get(string $publicId): array
{
    $row = fetch_public_map_row($publicId);
    if ($row === null || !map_is_public_eligible($row)) {
        auth_fail('not_found', 'Map not found.', 404);
    }

    return ['success' => true, 'map' => format_public_map_summary($row)];
}

function public_elements_list(string $publicId, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    $row = fetch_public_map_row($publicId);
    if ($row === null || !map_is_public_eligible($row)) {
        auth_fail('not_found', 'Map not found.', 404);
    }

    $mapId = (string) $row['id'];
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $countStmt = db()->prepare('SELECT COUNT(*) FROM map_elements WHERE map_id = :map_id');
    $countStmt->execute(['map_id' => $mapId]);
    $total = (int) $countStmt->fetchColumn();

    $stmt = db()->prepare(
        'SELECT e.*, ST_AsGeoJSON(e.geom)::text AS geojson
         FROM map_elements e
         WHERE e.map_id = :map_id
         ORDER BY e.created_at ASC
         LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':map_id', $mapId);
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $elements = [];
    while ($elementRow = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $photos = photos_for_element_public((string) $elementRow['id']);
        $elements[] = format_element_record($elementRow, $photos);
    }

    return [
        'success' => true,
        'elements' => $elements,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 0,
        ],
    ];
}

function public_handle_endpoint(callable $handler): never
{
    try {
        $result = $handler();
        json_response(is_array($result) ? $result : ['success' => true]);
    } catch (AuthException $e) {
        json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
    }
}
