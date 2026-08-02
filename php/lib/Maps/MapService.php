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

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function decode_export_settings_column(mixed $raw): array
{
    if ($raw === null || $raw === '') {
        return [];
    }
    if (is_array($raw)) {
        return $raw;
    }
    if (is_string($raw)) {
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    return [];
}

const MAX_EXPORT_SETTINGS_BYTES = 32768;

/**
 * @return array<string, mixed>
 */
function default_export_settings(): array
{
    return [
        'title' => '',
        'author' => '',
        'technicalResponsible' => '',
        'legendPosition' => 'inside',
        'legendRect' => null,
        'legendColumns' => 2,
        'legendFontSizePx' => 12,
        'legendSpacing' => 'normal',
        'hiddenCategoryIds' => [],
        'hiddenElementIds' => [],
        'showTags' => false,
        'basemap' => 'carto',
        'locatorCount' => 0,
        'stateCode' => null,
        'municipalityCode' => null,
        'stateColor' => '#1D4ED8',
        'municipalityColor' => '#DC2626',
        'showStateInLegend' => false,
        'showMunicipalityInLegend' => false,
        'showMunicipalMesh' => false,
        'paperSize' => 'A4',
        'orientation' => 'landscape',
        'dpi' => 300,
    ];
}

function sanitize_export_text(mixed $value): string
{
    if (!is_string($value)) {
        return '';
    }
    $stripped = preg_replace('/<[^>]*>/', '', $value);

    return trim(preg_replace('/[\x00-\x1F\x7F]/', '', $stripped ?? '') ?? '');
}

function clamp_export_int(mixed $value, int $min, int $max, int $fallback): int
{
    if ($value === null || $value === '') {
        return $fallback;
    }
    if (!is_numeric($value)) {
        return $fallback;
    }
    $n = (int) round((float) $value);

    return min($max, max($min, $n));
}

/**
 * @return list<string>
 */
function as_export_string_array(mixed $value, int $maxItems): array
{
    if (!is_array($value)) {
        return [];
    }

    $result = [];
    foreach ($value as $item) {
        if (!is_string($item) || $item === '') {
            continue;
        }
        if (strlen($item) > MAX_MAP_NAME_LENGTH) {
            continue;
        }
        $result[] = $item;
        if (count($result) >= $maxItems) {
            break;
        }
    }

    return $result;
}

/**
 * @return array{x: float, y: float, w: float, h: float}|null
 */
function normalize_export_legend_rect(mixed $raw, string $legendPosition): ?array
{
    if ($legendPosition !== 'inside' || !is_array($raw)) {
        return null;
    }

    $coords = ['x', 'y', 'w', 'h'];
    $parsed = [];
    foreach ($coords as $key) {
        if (!array_key_exists($key, $raw) || !is_numeric($raw[$key])) {
            return null;
        }
        $parsed[$key] = (float) $raw[$key];
    }

    return [
        'x' => min(1.0, max(0.0, $parsed['x'])),
        'y' => min(1.0, max(0.0, $parsed['y'])),
        'w' => min(1.0, max(0.0, $parsed['w'])),
        'h' => min(1.0, max(0.0, $parsed['h'])),
    ];
}

function normalize_export_legend_position(mixed $raw): string
{
    if ($raw === 'right') {
        return 'beside';
    }
    if (is_string($raw) && in_array($raw, ['inside', 'beside', 'below'], true)) {
        return $raw;
    }

    return 'inside';
}

function normalize_export_locator_count(mixed $raw): int
{
    if (!is_numeric($raw)) {
        return 0;
    }
    $n = (int) $raw;
    if ($n === 1 || $n === 2) {
        return $n;
    }

    return 0;
}

function normalize_export_hex_color(mixed $raw, string $fallback): string
{
    if (!is_string($raw)) {
        return $fallback;
    }
    $trimmed = trim($raw);
    if (preg_match('/^#([0-9A-Fa-f]{6})$/', $trimmed) === 1) {
        return $trimmed;
    }

    return $fallback;
}

/**
 * @param array<string, mixed> $raw
 * @return array<string, mixed>
 */
function normalize_export_settings(array $raw): array
{
    $defaults = default_export_settings();
    $legendPosition = normalize_export_legend_position($raw['legendPosition'] ?? null);
    $stateCode = isset($raw['stateCode']) && is_string($raw['stateCode']) && trim($raw['stateCode']) !== ''
        ? $raw['stateCode']
        : null;
    $municipalityCode = isset($raw['municipalityCode']) && is_string($raw['municipalityCode']) && trim($raw['municipalityCode']) !== ''
        ? $raw['municipalityCode']
        : null;
    $legendSpacing = $raw['legendSpacing'] ?? $defaults['legendSpacing'];
    $basemap = $raw['basemap'] ?? $defaults['basemap'];
    $paperSize = $raw['paperSize'] ?? $defaults['paperSize'];
    $orientation = $raw['orientation'] ?? $defaults['orientation'];

    return [
        'title' => sanitize_export_text($raw['title'] ?? $defaults['title']),
        'author' => sanitize_export_text($raw['author'] ?? $defaults['author']),
        'technicalResponsible' => sanitize_export_text($raw['technicalResponsible'] ?? $defaults['technicalResponsible']),
        'legendPosition' => $legendPosition,
        'legendRect' => normalize_export_legend_rect($raw['legendRect'] ?? null, $legendPosition),
        'legendColumns' => clamp_export_int($raw['legendColumns'] ?? null, 1, 6, $defaults['legendColumns']),
        'legendFontSizePx' => clamp_export_int($raw['legendFontSizePx'] ?? null, 8, 18, $defaults['legendFontSizePx']),
        'legendSpacing' => is_string($legendSpacing) && in_array($legendSpacing, ['compact', 'normal', 'wide'], true)
            ? $legendSpacing
            : $defaults['legendSpacing'],
        'hiddenCategoryIds' => as_export_string_array($raw['hiddenCategoryIds'] ?? null, ELEMENTS_PER_MAP),
        'hiddenElementIds' => as_export_string_array($raw['hiddenElementIds'] ?? null, ELEMENTS_PER_MAP),
        'showTags' => is_bool($raw['showTags'] ?? null) ? $raw['showTags'] : $defaults['showTags'],
        'basemap' => is_string($basemap) && in_array($basemap, ['carto', 'osm', 'satellite', 'offline'], true)
            ? $basemap
            : $defaults['basemap'],
        'locatorCount' => normalize_export_locator_count($raw['locatorCount'] ?? null),
        'stateCode' => $stateCode,
        'municipalityCode' => $municipalityCode,
        'stateColor' => normalize_export_hex_color($raw['stateColor'] ?? null, $defaults['stateColor']),
        'municipalityColor' => normalize_export_hex_color($raw['municipalityColor'] ?? null, $defaults['municipalityColor']),
        'showStateInLegend' => is_bool($raw['showStateInLegend'] ?? null) ? $raw['showStateInLegend'] : $defaults['showStateInLegend'],
        'showMunicipalityInLegend' => is_bool($raw['showMunicipalityInLegend'] ?? null) ? $raw['showMunicipalityInLegend'] : $defaults['showMunicipalityInLegend'],
        'showMunicipalMesh' => is_bool($raw['showMunicipalMesh'] ?? null) ? $raw['showMunicipalMesh'] : $defaults['showMunicipalMesh'],
        'paperSize' => is_string($paperSize) && in_array($paperSize, ['A4', 'A3', 'Letter'], true)
            ? $paperSize
            : $defaults['paperSize'],
        'orientation' => is_string($orientation) && in_array($orientation, ['landscape', 'portrait'], true)
            ? $orientation
            : $defaults['orientation'],
        'dpi' => clamp_export_int($raw['dpi'] ?? null, 72, 600, $defaults['dpi']),
    ];
}

/**
 * @return array<string, mixed>
 */
function validate_export_settings_payload(mixed $settings): array
{
    if (!is_array($settings)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'export_settings' => 'export_settings must be an object.',
        ]);
    }
    if (array_is_list($settings)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'export_settings' => 'export_settings must be an object.',
        ]);
    }

    $normalized = normalize_export_settings($settings);
    $encoded = json_encode($normalized, JSON_THROW_ON_ERROR);
    if (strlen($encoded) > MAX_EXPORT_SETTINGS_BYTES) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'export_settings' => 'export_settings exceeds maximum size.',
        ]);
    }

    return $normalized;
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
        'export_settings' => decode_export_settings_column($row['export_settings'] ?? '{}'),
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

    $geometryKeys = ['name', 'description', 'center_lat', 'center_lng', 'zoom'];
    $hasGeometryFields = false;
    foreach ($geometryKeys as $key) {
        if (array_key_exists($key, $input)) {
            $hasGeometryFields = true;
            break;
        }
    }

    $allowedSettingsOnlyKeys = ['id', 'export_settings', 'client_mutation_id'];
    $isSettingsOnly = array_key_exists('export_settings', $input)
        && !$hasGeometryFields
        && array_diff(array_keys($input), $allowedSettingsOnlyKeys) === [];

    if ($isSettingsOnly) {
        $settings = validate_export_settings_payload($input['export_settings']);
        $stmt = db()->prepare(
            'UPDATE maps SET export_settings = :export_settings::jsonb, updated_at = NOW()
             WHERE id = :id RETURNING *'
        );
        $stmt->execute([
            'id' => $mapId,
            'export_settings' => json_encode($settings, JSON_THROW_ON_ERROR),
        ]);
        $updated = format_map_record($stmt->fetch(PDO::FETCH_ASSOC));
        $result = ['success' => true, 'map' => $updated];

        if ($clientMutationId !== '') {
            client_mutation_store($user['id'], $clientMutationId, 'map', $mapId, $result);
        }

        return $result;
    }

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

    if (array_key_exists('export_settings', $input)) {
        $settings = validate_export_settings_payload($input['export_settings']);
        $fields[] = 'export_settings = :export_settings::jsonb';
        $params['export_settings'] = json_encode($settings, JSON_THROW_ON_ERROR);
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

function maps_publish(array $user, array $input): array
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

function maps_unpublish(array $user, array $input): array
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
