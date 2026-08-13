<?php

declare(strict_types=1);

/**
 * Interpreta flags booleanas vindas de JSON/PDO (bool, int, string).
 */
function parse_bool_input(mixed $value, bool $default = true): bool
{
    if ($value === null) {
        return $default;
    }
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (int) $value !== 0;
    }
    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if (in_array($normalized, ['1', 'true', 't', 'yes', 'y', 'sim', 'on'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'off', ''], true)) {
            return false;
        }
    }

    return $default;
}

/**
 * Elemento aparece em mapas publicados (galeria), a menos que marcado como oculto.
 *
 * @param array<string, mixed> $row
 */
function element_is_publicly_visible(array $row): bool
{
    if (!array_key_exists('is_publicly_visible', $row)) {
        return true;
    }

    return parse_bool_input($row['is_publicly_visible'], true);
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function format_element_record(array $row, array $photos = [], ?array $videos = null): array
{
    $geojson = geojson_from_row((string) $row['geojson']);
    $style = $row['style'];
    if (is_string($style)) {
        $decodedStyle = json_decode($style, true);
        $style = is_array($decodedStyle) ? $decodedStyle : [];
    }
    if ($videos === null && isset($row['id'])) {
        $videos = videos_for_element((string) $row['id']);
    }

    return [
        'id' => (string) $row['id'],
        'map_id' => (string) $row['map_id'],
        'element_type' => (string) $row['element_type'],
        'geojson' => $geojson,
        'name' => (string) $row['name'],
        'description' => (string) ($row['description'] ?? ''),
        'element_category' => (string) ($row['element_category'] ?? ''),
        'style' => $style,
        'is_publicly_visible' => element_is_publicly_visible($row),
        'author_id' => (string) $row['author_id'],
        'version' => (int) $row['version'],
        'created_at' => (string) $row['created_at'],
        'updated_at' => (string) $row['updated_at'],
        'photos' => $photos,
        'videos' => $videos ?? [],
    ];
}

/**
 * @param array<string, mixed> $row
 * @param array<int, array<string, mixed>> $photos
 * @return array<string, mixed>
 */
function format_public_element_record(array $row, array $photos = [], ?array $videos = null): array
{
    $geojson = geojson_from_row((string) $row['geojson']);
    $style = $row['style'];
    if (is_string($style)) {
        $decodedStyle = json_decode($style, true);
        $style = is_array($decodedStyle) ? $decodedStyle : [];
    }
    if (is_array($style) && array_key_exists('custom_icon_url', $style)) {
        $style['custom_icon_url'] = rewrite_public_custom_icon_url($style['custom_icon_url']);
    }
    if ($videos === null && isset($row['id'])) {
        $videos = videos_for_element_public((string) $row['id']);
    }

    $safePhotos = array_map(static function (array $p): array {
        unset($p['owner_id'], $p['element_id']);
        return $p;
    }, $photos);
    $safeVideos = array_map(static function (array $v): array {
        unset($v['owner_id'], $v['element_id']);
        return $v;
    }, $videos ?? []);

    return [
        'id' => (string) $row['id'],
        'element_type' => (string) $row['element_type'],
        'geojson' => $geojson,
        'name' => (string) $row['name'],
        'description' => (string) ($row['description'] ?? ''),
        'element_category' => (string) ($row['element_category'] ?? ''),
        'style' => $style,
        'created_at' => (string) $row['created_at'],
        'updated_at' => (string) $row['updated_at'],
        'photos' => $safePhotos,
        'videos' => $safeVideos,
    ];
}

/**
 * @return array<string, mixed>|null
 */
function fetch_element_by_id(string $elementId): ?array
{
    $stmt = db()->prepare(
        'SELECT e.*, ST_AsGeoJSON(e.geom)::text AS geojson
         FROM map_elements e WHERE e.id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $elementId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

function assert_element_owner(array $user, array $element, bool $notFoundOnDeny = false): void
{
    $map = fetch_map_by_id((string) $element['map_id']);
    if ($map === null) {
        auth_fail('not_found', 'Element not found.', 404);
    }
    if ((string) $map['owner_id'] !== (string) $user['id']) {
        if ($notFoundOnDeny) {
            auth_fail('not_found', 'Element not found.', 404);
        }
        auth_fail('forbidden', 'You do not have access to this element.', 403);
    }
}

function elements_list(
    array $user,
    string $mapId,
    int $page = 1,
    int $pageSize = DEFAULT_PAGE_SIZE
): array {
    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['map_id' => 'Map id is required.']);
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map);

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
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $photos = photos_for_element((string) $row['id']);
        $elements[] = format_element_record($row, $photos);
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

function elements_create(array $user, array $input): array
{
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $mapId = (string) ($input['map_id'] ?? '');
    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map, false);

    $elementType = (string) ($input['element_type'] ?? 'point');
    if (!in_array($elementType, ['point', 'line', 'polygon'], true)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'element_type' => 'Invalid element type.',
        ]);
    }

    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['name' => 'Name is required.']);
    }
    if (mb_strlen($name) > MAX_MAP_NAME_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, ['name' => 'Name exceeds maximum length.']);
    }

    $description = trim((string) ($input['description'] ?? ''));
    if (mb_strlen($description) > MAX_TEXT_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'description' => 'Description exceeds maximum length.',
        ]);
    }

    if (!isset($input['geojson'])) {
        auth_fail('validation_error', 'Validation failed.', 400, ['geojson' => 'Geometry is required.']);
    }

    $geojsonStr = geojson_validate_for_element($elementType, $input['geojson']);
    if (!geojson_is_valid_postgis($geojsonStr)) {
        auth_fail('validation_error', 'Invalid geometry.', 400, [
            'geojson' => 'Invalid or self-intersecting geometry.',
        ]);
    }

    $countStmt = db()->prepare('SELECT COUNT(*) FROM map_elements WHERE map_id = :map_id');
    $countStmt->execute(['map_id' => $mapId]);
    if ((int) $countStmt->fetchColumn() >= ELEMENTS_PER_MAP) {
        auth_fail('payload_too_large', 'Element limit reached.', 400, [
            'elements' => 'Maximum ' . ELEMENTS_PER_MAP . ' elements per map.',
        ]);
    }

    $category = trim((string) ($input['element_category'] ?? ''));
    $style = $input['style'] ?? '{}';
    if (is_array($style)) {
        $style = json_encode($style, JSON_UNESCAPED_UNICODE);
    }
    $isPubliclyVisible = array_key_exists('is_publicly_visible', $input)
        ? parse_bool_input($input['is_publicly_visible'], true)
        : true;

    try {
        $stmt = db()->prepare(
            'INSERT INTO map_elements (
                map_id, element_type, geom, name, description, element_category, style, is_publicly_visible, author_id
             )
             VALUES (
                :map_id,
                :element_type,
                ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326),
                :name,
                :description,
                :element_category,
                :style::jsonb,
                :is_publicly_visible,
                :author_id
             )
             RETURNING id'
        );
        $stmt->execute([
            'map_id' => $mapId,
            'element_type' => $elementType,
            'geojson' => $geojsonStr,
            'name' => $name,
            'description' => $description,
            'element_category' => $category,
            'style' => (string) $style,
            'is_publicly_visible' => $isPubliclyVisible ? 't' : 'f',
            'author_id' => $user['id'],
        ]);
    } catch (Throwable) {
        auth_fail('validation_error', 'Invalid geometry.', 400, [
            'geojson' => 'Invalid GeoJSON geometry.',
        ]);
    }

    $elementId = (string) $stmt->fetchColumn();
    $element = fetch_element_by_id($elementId);
    $formatted = format_element_record($element ?? ['id' => $elementId], []);
    $result = ['success' => true, 'element' => $formatted];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'element', $elementId, $result);
    }

    return $result;
}

function elements_update(array $user, array $input, bool $forceVersion = false): array
{
    $elementId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $element = fetch_element_by_id($elementId);
    if ($element === null) {
        json_conflict(
            'Element was deleted.',
            ['id' => $elementId, 'payload' => $input],
            ['id' => $elementId, 'deleted' => true],
            'delete_update'
        );
    }
    assert_element_owner($user, $element, false);

    $baseVersion = $input['base_version'] ?? null;
    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $element['version']) {
        $photos = photos_for_element($elementId);
        json_conflict(
            'Element version conflict.',
            ['id' => $elementId, 'base_version' => (int) $baseVersion, 'payload' => $input],
            format_element_record($element, $photos)
        );
    }

    $setParts = [];
    $params = ['id' => $elementId];

    if (array_key_exists('name', $input)) {
        $name = trim((string) $input['name']);
        if ($name === '') {
            auth_fail('validation_error', 'Validation failed.', 400, ['name' => 'Name is required.']);
        }
        $setParts[] = 'name = :name';
        $params['name'] = $name;
    }

    foreach (['description', 'element_category'] as $field) {
        if (array_key_exists($field, $input)) {
            $value = trim((string) $input[$field]);
            if (mb_strlen($value) > MAX_TEXT_LENGTH) {
                auth_fail('validation_error', 'Validation failed.', 400, [
                    $field => 'Field exceeds maximum length.',
                ]);
            }
            $setParts[] = "{$field} = :{$field}";
            $params[$field] = $value;
        }
    }

    if (array_key_exists('style', $input)) {
        $style = $input['style'];
        if (is_array($style)) {
            $style = json_encode($style, JSON_UNESCAPED_UNICODE);
        }
        $setParts[] = 'style = :style::jsonb';
        $params['style'] = (string) $style;
    }

    if (array_key_exists('is_publicly_visible', $input)) {
        $setParts[] = 'is_publicly_visible = :is_publicly_visible';
        $params['is_publicly_visible'] = parse_bool_input($input['is_publicly_visible'], true) ? 't' : 'f';
    }

    if (array_key_exists('geojson', $input)) {
        $geojsonStr = geojson_validate_for_element((string) $element['element_type'], $input['geojson']);
        if (!geojson_is_valid_postgis($geojsonStr)) {
            auth_fail('validation_error', 'Invalid geometry.', 400, [
                'geojson' => 'Invalid or self-intersecting geometry.',
            ]);
        }
        $setParts[] = 'geom = ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)';
        $params['geojson'] = $geojsonStr;
    }

    if ($setParts === []) {
        $photos = photos_for_element($elementId);
        return ['success' => true, 'element' => format_element_record($element, $photos)];
    }

    $setParts[] = 'version = version + 1';
    $setParts[] = 'updated_at = NOW()';
    $sql = 'UPDATE map_elements SET ' . implode(', ', $setParts) . ' WHERE id = :id RETURNING id';
    try {
        db()->prepare($sql)->execute($params);
    } catch (Throwable) {
        auth_fail('validation_error', 'Invalid geometry.', 400, [
            'geojson' => 'Invalid GeoJSON geometry.',
        ]);
    }

    $updated = fetch_element_by_id($elementId);
    $photos = photos_for_element($elementId);
    $result = ['success' => true, 'element' => format_element_record($updated ?? $element, $photos)];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'element', $elementId, $result);
    }

    return $result;
}

function elements_delete(array $user, array $input, bool $forceVersion = false): array
{
    $elementId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    $baseVersion = $input['base_version'] ?? null;

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $element = fetch_element_by_id($elementId);
    if ($element === null) {
        return ['success' => true, 'deleted' => true];
    }
    assert_element_owner($user, $element, false);

    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $element['version']) {
        $photos = photos_for_element($elementId);
        json_conflict(
            'Element version conflict.',
            ['id' => $elementId, 'base_version' => (int) $baseVersion, 'op' => 'delete'],
            format_element_record($element, $photos),
            'update_delete'
        );
    }

    photos_delete_for_element($elementId);
    videos_delete_for_element($elementId);
    db()->prepare('DELETE FROM map_elements WHERE id = :id')->execute(['id' => $elementId]);

    $result = ['success' => true, 'deleted' => true];
    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'element', $elementId, $result);
    }

    return $result;
}
