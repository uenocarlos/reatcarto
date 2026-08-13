<?php

declare(strict_types=1);

const EXPORT_COORD_PRECISION = 6;

/**
 * @param array<string, mixed> $style
 * @return array<string, scalar>
 */
function shapefile_export_properties(string $name, string $description, string $category, mixed $style): array
{
    if (is_string($style)) {
        $decoded = json_decode($style, true);
        $style = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($style)) {
        $style = [];
    }

    $properties = [
        'name' => $name,
        'description' => $description,
        'category' => $category,
    ];

    $styleKeys = [
        'icon_name',
        'icon_color',
        'custom_icon_url',
        'color',
        'opacity',
        'weight',
        'dash_style',
        'border_color',
        'border_opacity',
        'border_weight',
        'border_dash',
        'fill_color',
        'fill_opacity',
    ];
    foreach ($styleKeys as $key) {
        if (!array_key_exists($key, $style)) {
            continue;
        }
        $value = $style[$key];
        if ($value === null || is_array($value)) {
            continue;
        }
        $properties[$key] = $value;
    }

    return $properties;
}

function shapefile_round_number(mixed $value): mixed
{
    if (!is_numeric($value)) {
        return $value;
    }

    return round((float) $value, EXPORT_COORD_PRECISION);
}

function shapefile_round_coordinates(mixed $coordinates): mixed
{
    if (!is_array($coordinates)) {
        return $coordinates;
    }
    if ($coordinates !== [] && is_numeric($coordinates[0] ?? null)) {
        $rounded = [];
        foreach ($coordinates as $index => $value) {
            $rounded[] = $index < 2 ? shapefile_round_number($value) : $value;
        }

        return $rounded;
    }

    return array_map('shapefile_round_coordinates', $coordinates);
}

/**
 * @param array<string, mixed> $geometry
 * @return array<string, mixed>|null
 */
function shapefile_normalize_export_geometry(mixed $geometry): ?array
{
    if (!is_array($geometry)) {
        return null;
    }
    if (($geometry['type'] ?? '') === 'Feature') {
        $geometry = $geometry['geometry'] ?? null;
        if (!is_array($geometry)) {
            return null;
        }
    }
    $type = (string) ($geometry['type'] ?? '');
    if (!in_array($type, ['Point', 'LineString', 'Polygon'], true)) {
        return null;
    }
    $coords = $geometry['coordinates'] ?? null;
    if (!is_array($coords) || $coords === []) {
        return null;
    }

    return [
        'type' => $type,
        'coordinates' => shapefile_round_coordinates($coords),
    ];
}

/**
 * @param array<int, string> $elementIds
 * @return array<int, array<string, mixed>>
 */
function shapefile_fetch_map_elements(string $mapId, array $elementIds = []): array
{
    $sql = 'SELECT e.id, e.element_type, e.name, e.description, e.element_category, e.style,
                   ST_AsGeoJSON(e.geom)::text AS geojson
            FROM map_elements e
            WHERE e.map_id = :map_id';
    $params = ['map_id' => $mapId];

    if ($elementIds !== []) {
        $placeholders = [];
        foreach (array_values($elementIds) as $index => $id) {
            $key = 'id_' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = (string) $id;
        }
        $sql .= ' AND e.id IN (' . implode(', ', $placeholders) . ')';
    }

    $sql .= ' ORDER BY e.created_at ASC';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $rows[] = $row;
    }

    return $rows;
}

/**
 * @param array<int, array<string, mixed>> $rows
 * @return array<string, array{kind: string, features: array<int, array{geometry: array, properties: array}>}>
 */
function shapefile_group_export_rows(array $rows): array
{
    $layers = [
        'points' => ['kind' => 'Point', 'features' => []],
        'lines' => ['kind' => 'LineString', 'features' => []],
        'polygons' => ['kind' => 'Polygon', 'features' => []],
    ];

    foreach ($rows as $row) {
        $decoded = json_decode((string) ($row['geojson'] ?? ''), true);
        $geometry = shapefile_normalize_export_geometry($decoded);
        if ($geometry === null) {
            continue;
        }
        $layerId = match ($geometry['type']) {
            'Point' => 'points',
            'LineString' => 'lines',
            'Polygon' => 'polygons',
            default => null,
        };
        if ($layerId === null) {
            continue;
        }
        $layers[$layerId]['features'][] = [
            'geometry' => $geometry,
            'properties' => shapefile_export_properties(
                (string) ($row['name'] ?? ''),
                (string) ($row['description'] ?? ''),
                (string) ($row['element_category'] ?? ''),
                $row['style'] ?? []
            ),
        ];
    }

    return array_filter($layers, static fn (array $layer): bool => $layer['features'] !== []);
}

/**
 * @param array<string, mixed> $input
 * @return array{zip_path: string, filename: string, layers: array<int, string>, truncated: int}
 */
function elements_prepare_shapefile_export(array $user, array $input, ?callable $writeZip = null): array
{
    $mapId = trim((string) ($input['map_id'] ?? ''));
    $scope = (string) ($input['scope'] ?? 'whole');
    $elementIds = $input['element_ids'] ?? [];

    if ($mapId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'map_id' => 'Map id is required.',
        ]);
    }
    if (!in_array($scope, ['whole', 'selection'], true)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'scope' => 'Scope must be whole or selection.',
        ]);
    }
    if ($scope === 'selection') {
        if (!is_array($elementIds) || $elementIds === []) {
            auth_fail('validation_error', 'Validation failed.', 400, [
                'element_ids' => 'element_ids is required for selection export.',
            ]);
        }
        $elementIds = array_values(array_map('strval', $elementIds));
    } else {
        $elementIds = [];
    }

    $map = fetch_map_by_id($mapId);
    if ($map === null) {
        auth_fail('not_found', 'Map not found.', 404);
    }
    assert_map_owner($user, $map, false);

    $rows = shapefile_fetch_map_elements($mapId, $elementIds);
    $grouped = shapefile_group_export_rows($rows);
    if ($grouped === []) {
        auth_fail('validation_error', 'No elements to export.', 422, [
            'elements' => 'The selected scope has no exportable geometries.',
        ]);
    }

    $slug = shapefile_slug((string) ($map['name'] ?? 'mapa'));
    $layers = [];
    foreach ($grouped as $layerId => $layer) {
        $layers[] = [
            'name' => $slug . '-' . $layerId,
            'kind' => $layer['kind'],
            'features' => $layer['features'],
        ];
    }

    $zipPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'reatcarto_export_' . bin2hex(random_bytes(8)) . '.zip';
    $writer = $writeZip ?? static fn (string $path, array $shpLayers): int => shapefile_build_zip($path, $shpLayers);

    try {
        $truncated = (int) $writer($zipPath, $layers);
    } catch (Throwable $e) {
        @unlink($zipPath);
        error_log('gis.export.shp: ' . $e->getMessage());
        auth_fail('server_error', 'Failed to generate Shapefile.', 500);
    }

    if (!is_file($zipPath) || filesize($zipPath) === 0) {
        @unlink($zipPath);
        auth_fail('server_error', 'Failed to generate Shapefile.', 500);
    }

    $filename = $slug . '-' . gmdate('Y-m-d') . '.zip';

    return [
        'zip_path' => $zipPath,
        'filename' => $filename,
        'layers' => array_map(static fn (array $layer): string => $layer['name'], $layers),
        'truncated' => $truncated,
    ];
}

function shapefile_stream_zip(string $zipPath, string $downloadName): never
{
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    $size = filesize($zipPath);
    if ($size !== false) {
        header('Content-Length: ' . $size);
    }
    header('Cache-Control: no-store');
    readfile($zipPath);
    @unlink($zipPath);
    exit;
}

/**
 * Streams a shapefile ZIP for the given map scope. Never returns on success.
 *
 * @param array<string, mixed> $input
 */
function elements_export_shapefile(array $user, array $input, ?callable $writeZip = null): never
{
    $prepared = elements_prepare_shapefile_export($user, $input, $writeZip);
    shapefile_stream_zip($prepared['zip_path'], $prepared['filename']);
}
