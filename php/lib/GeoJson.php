<?php

declare(strict_types=1);

/**
 * @return array<string, mixed>
 */
function geojson_decode(mixed $geojson): array
{
    if (is_array($geojson)) {
        return $geojson;
    }
    if (is_string($geojson)) {
        $decoded = json_decode($geojson, true);
        if (!is_array($decoded)) {
            auth_fail('validation_error', 'Invalid GeoJSON.', 400, [
                'geojson' => 'Invalid GeoJSON geometry.',
            ]);
        }

        return $decoded;
    }

    auth_fail('validation_error', 'Invalid GeoJSON.', 400, [
        'geojson' => 'Geometry is required.',
    ]);
}

function geojson_geometry_type(array $geojson): string
{
    if (isset($geojson['type']) && $geojson['type'] === 'Feature') {
        $geometry = $geojson['geometry'] ?? null;
        if (!is_array($geometry)) {
            auth_fail('validation_error', 'Invalid GeoJSON.', 400, [
                'geojson' => 'Feature geometry is required.',
            ]);
        }

        return (string) ($geometry['type'] ?? '');
    }

    return (string) ($geojson['type'] ?? '');
}

function geojson_extract_geometry(array $geojson): array
{
    if (($geojson['type'] ?? '') === 'Feature') {
        $geometry = $geojson['geometry'] ?? null;
        if (!is_array($geometry)) {
            auth_fail('validation_error', 'Invalid GeoJSON.', 400, [
                'geojson' => 'Feature geometry is required.',
            ]);
        }

        return $geometry;
    }

    return $geojson;
}

function geojson_count_vertices(array $geometry): int
{
    $type = (string) ($geometry['type'] ?? '');
    $coords = $geometry['coordinates'] ?? null;
    if (!is_array($coords)) {
        return 0;
    }

    return match ($type) {
        'Point' => 1,
        'LineString' => count($coords),
        'Polygon' => array_sum(array_map('count', $coords)),
        'MultiPoint' => count($coords),
        'MultiLineString' => array_sum(array_map('count', $coords)),
        'MultiPolygon' => array_sum(array_map(
            fn ($poly) => array_sum(array_map('count', $poly)),
            $coords
        )),
        default => 0,
    };
}

function geojson_validate_for_element(string $elementType, mixed $geojson): string
{
    $decoded = geojson_decode($geojson);
    $geometry = geojson_extract_geometry($decoded);
    $geomType = geojson_geometry_type($decoded);

    $expected = match ($elementType) {
        'point' => 'Point',
        'line' => 'LineString',
        'polygon' => 'Polygon',
        default => null,
    };

    if ($expected === null || $geomType !== $expected) {
        auth_fail('validation_error', 'Invalid geometry.', 400, [
            'geojson' => "Expected {$expected} geometry for element type {$elementType}.",
        ]);
    }

    $vertices = geojson_count_vertices($geometry);
    if ($vertices === 0) {
        auth_fail('validation_error', 'Invalid geometry.', 400, [
            'geojson' => 'Geometry coordinates are required.',
        ]);
    }

    if (in_array($elementType, ['line', 'polygon'], true) && $vertices > MAX_VERTICES) {
        auth_fail('validation_error', 'Geometry exceeds vertex limit.', 400, [
            'geojson' => 'Maximum ' . MAX_VERTICES . ' vertices allowed.',
        ]);
    }

    return json_encode($geometry, JSON_UNESCAPED_UNICODE);
}

function geojson_is_valid_postgis(string $geojsonStr): bool
{
    $stmt = db()->prepare(
        'SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)) AS valid'
    );
    try {
        $stmt->execute(['geojson' => $geojsonStr]);
        $valid = $stmt->fetchColumn();

        return $valid === true || $valid === 't' || $valid === 1 || $valid === '1';
    } catch (Throwable) {
        return false;
    }
}

/**
 * @return array<string, mixed>
 */
function geojson_from_row(string $geojsonColumn): array
{
    $decoded = json_decode($geojsonColumn, true);

    return is_array($decoded) ? $decoded : [];
}
