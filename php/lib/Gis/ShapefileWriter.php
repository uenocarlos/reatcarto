<?php

declare(strict_types=1);

const SHP_POINT = 1;
const SHP_POLYLINE = 3;
const SHP_POLYGON = 5;
const SHAPEFILE_VALUE_MAX = 254;
const SHAPEFILE_WGS84_PRJ = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

const SHAPEFILE_FIELD_MAP = [
    'name' => 'name',
    'description' => 'descript',
    'category' => 'category',
    'icon_name' => 'icon_name',
    'icon_color' => 'icon_color',
    'custom_icon_url' => 'custom_ico',
    'color' => 'color',
    'opacity' => 'opacity',
    'weight' => 'weight',
    'dash_style' => 'dash_style',
    'border_color' => 'border_col',
    'border_opacity' => 'border_opa',
    'border_weight' => 'border_wei',
    'border_dash' => 'border_das',
    'fill_color' => 'fill_color',
    'fill_opacity' => 'fill_opaci',
];

function shapefile_is_little_endian(): bool
{
    return unpack('v', "\x01\x00")[1] === 1;
}

function shapefile_pack_le_double(float $value): string
{
    $packed = pack('d', $value);
    return shapefile_is_little_endian() ? $packed : strrev($packed);
}

function shapefile_pack_be_int32(int $value): string
{
    return pack('N', $value & 0xFFFFFFFF);
}

function shapefile_pack_le_int32(int $value): string
{
    return pack('V', $value & 0xFFFFFFFF);
}

function shapefile_pack_le_uint16(int $value): string
{
    return pack('v', $value & 0xFFFF);
}

/**
 * @param array<int, string> $names
 * @return array<string, string>
 */
function shapefile_truncate_field_names(array $names): array
{
    $used = [];
    $result = [];
    foreach ($names as $name) {
        $source = (string) $name;
        $base = SHAPEFILE_FIELD_MAP[$source] ?? substr($source, 0, 10);
        $base = substr($base, 0, 10);
        if ($base === '') {
            $base = 'field';
        }
        $candidate = $base;
        $index = 1;
        while (isset($used[$candidate])) {
            $suffix = (string) $index;
            $candidate = substr(substr($base, 0, max(1, 10 - strlen($suffix))) . $suffix, 0, 10);
            $index++;
        }
        $used[$candidate] = true;
        $result[$source] = $candidate;
    }

    return $result;
}

/**
 * @return array{value: string, truncated: bool}
 */
function shapefile_truncate_value(mixed $value): array
{
    $str = $value === null ? '' : (string) $value;
    if (strlen($str) <= SHAPEFILE_VALUE_MAX) {
        return ['value' => $str, 'truncated' => false];
    }

    return ['value' => substr($str, 0, SHAPEFILE_VALUE_MAX), 'truncated' => true];
}

function shapefile_to_dbf_latin1(string $value): string
{
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $value);
        if ($converted !== false) {
            return $converted;
        }
    }
    if (function_exists('mb_convert_encoding')) {
        return mb_convert_encoding($value, 'ISO-8859-1', 'UTF-8');
    }

    return $value;
}

function shapefile_slug(string $name, string $fallback = 'mapa'): string
{
    $ascii = $name;
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT', $name);
        if (is_string($converted) && $converted !== '') {
            $ascii = $converted;
        }
    }
    $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $ascii));
    $slug = trim($slug, '-');
    $slug = substr($slug, 0, 80);

    return $slug !== '' ? $slug : $fallback;
}

function shapefile_dbf_field_length(string $logicalName): int
{
    return match ($logicalName) {
        'description', 'custom_icon_url' => 254,
        'name' => 80,
        default => 40,
    };
}

/**
 * @param array<int, mixed> $coordinates
 * @return array<int, array{0: float, 1: float}>
 */
function shapefile_flatten_points(array $coordinates, string $type): array
{
    if ($type === 'Point') {
        if (!isset($coordinates[0], $coordinates[1])) {
            return [];
        }

        return [[(float) $coordinates[0], (float) $coordinates[1]]];
    }

    if ($type === 'LineString') {
        $points = [];
        foreach ($coordinates as $pair) {
            if (!is_array($pair) || !isset($pair[0], $pair[1])) {
                continue;
            }
            $points[] = [(float) $pair[0], (float) $pair[1]];
        }

        return $points;
    }

    return [];
}

/**
 * @param array<int, mixed> $coordinates
 * @return array<int, array<int, array{0: float, 1: float}>>
 */
function shapefile_polygon_rings(array $coordinates): array
{
    $rings = [];
    foreach ($coordinates as $ring) {
        if (!is_array($ring)) {
            continue;
        }
        $points = [];
        foreach ($ring as $pair) {
            if (!is_array($pair) || !isset($pair[0], $pair[1])) {
                continue;
            }
            $points[] = [(float) $pair[0], (float) $pair[1]];
        }
        if (count($points) < 4) {
            continue;
        }
        $first = $points[0];
        $last = $points[count($points) - 1];
        if ($first[0] !== $last[0] || $first[1] !== $last[1]) {
            $points[] = $first;
        }
        // GeoJSON outer CCW → shapefile clockwise (reverse all rings).
        $rings[] = array_reverse($points);
    }

    return $rings;
}

/**
 * @param array<int, array{0: float, 1: float}> $points
 * @return array{0: float, 1: float, 2: float, 3: float}|null
 */
function shapefile_bbox_from_points(array $points): ?array
{
    if ($points === []) {
        return null;
    }
    $minX = $maxX = $points[0][0];
    $minY = $maxY = $points[0][1];
    foreach ($points as [$x, $y]) {
        $minX = min($minX, $x);
        $maxX = max($maxX, $x);
        $minY = min($minY, $y);
        $maxY = max($maxY, $y);
    }

    return [$minX, $minY, $maxX, $maxY];
}

function shapefile_pack_bbox(?array $bbox): string
{
    $minX = $bbox[0] ?? 0.0;
    $minY = $bbox[1] ?? 0.0;
    $maxX = $bbox[2] ?? 0.0;
    $maxY = $bbox[3] ?? 0.0;

    return shapefile_pack_le_double((float) $minX)
        . shapefile_pack_le_double((float) $minY)
        . shapefile_pack_le_double((float) $maxX)
        . shapefile_pack_le_double((float) $maxY)
        . shapefile_pack_le_double(0.0)
        . shapefile_pack_le_double(0.0)
        . shapefile_pack_le_double(0.0)
        . shapefile_pack_le_double(0.0);
}

function shapefile_file_header(int $shapeType, int $fileLengthWords, ?array $bbox): string
{
    return shapefile_pack_be_int32(9994)
        . str_repeat("\x00", 20)
        . shapefile_pack_be_int32($fileLengthWords)
        . shapefile_pack_le_int32(1000)
        . shapefile_pack_le_int32($shapeType)
        . shapefile_pack_bbox($bbox);
}

/**
 * @param array<string, mixed> $geometry
 * @return array{type: int, content: string, points: array<int, array{0: float, 1: float}>}|null
 */
function shapefile_encode_geometry(array $geometry): ?array
{
    $type = (string) ($geometry['type'] ?? '');
    $coords = $geometry['coordinates'] ?? null;
    if (!is_array($coords)) {
        return null;
    }

    if ($type === 'Point') {
        $points = shapefile_flatten_points($coords, 'Point');
        if ($points === []) {
            return null;
        }
        $content = shapefile_pack_le_int32(SHP_POINT)
            . shapefile_pack_le_double($points[0][0])
            . shapefile_pack_le_double($points[0][1]);

        return ['type' => SHP_POINT, 'content' => $content, 'points' => $points];
    }

    if ($type === 'LineString') {
        $points = shapefile_flatten_points($coords, 'LineString');
        if (count($points) < 2) {
            return null;
        }
        $bbox = shapefile_bbox_from_points($points);
        $content = shapefile_pack_le_int32(SHP_POLYLINE)
            . shapefile_pack_le_double((float) $bbox[0])
            . shapefile_pack_le_double((float) $bbox[1])
            . shapefile_pack_le_double((float) $bbox[2])
            . shapefile_pack_le_double((float) $bbox[3])
            . shapefile_pack_le_int32(1)
            . shapefile_pack_le_int32(count($points))
            . shapefile_pack_le_int32(0);
        foreach ($points as [$x, $y]) {
            $content .= shapefile_pack_le_double($x) . shapefile_pack_le_double($y);
        }

        return ['type' => SHP_POLYLINE, 'content' => $content, 'points' => $points];
    }

    if ($type === 'Polygon') {
        $rings = shapefile_polygon_rings($coords);
        if ($rings === []) {
            return null;
        }
        $allPoints = [];
        foreach ($rings as $ring) {
            foreach ($ring as $point) {
                $allPoints[] = $point;
            }
        }
        $bbox = shapefile_bbox_from_points($allPoints);
        $content = shapefile_pack_le_int32(SHP_POLYGON)
            . shapefile_pack_le_double((float) $bbox[0])
            . shapefile_pack_le_double((float) $bbox[1])
            . shapefile_pack_le_double((float) $bbox[2])
            . shapefile_pack_le_double((float) $bbox[3])
            . shapefile_pack_le_int32(count($rings))
            . shapefile_pack_le_int32(count($allPoints));
        $offset = 0;
        foreach ($rings as $ring) {
            $content .= shapefile_pack_le_int32($offset);
            $offset += count($ring);
        }
        foreach ($allPoints as [$x, $y]) {
            $content .= shapefile_pack_le_double($x) . shapefile_pack_le_double($y);
        }

        return ['type' => SHP_POLYGON, 'content' => $content, 'points' => $allPoints];
    }

    return null;
}

/**
 * @param array<int, array{geometry: array<string, mixed>, properties?: array<string, mixed>}> $features
 * @return array{truncated: int}
 */
function shapefile_write_layer(string $basePath, string $geometryKind, array $features): array
{
    $shapeType = match ($geometryKind) {
        'Point', 'points' => SHP_POINT,
        'LineString', 'lines' => SHP_POLYLINE,
        'Polygon', 'polygons' => SHP_POLYGON,
        default => 0,
    };
    if ($shapeType === 0) {
        throw new InvalidArgumentException("Unsupported shapefile geometry: {$geometryKind}");
    }

    $records = [];
    $allPoints = [];
    $truncated = 0;
    $propertyNames = ['name', 'description', 'category'];
    foreach ($features as $feature) {
        $encoded = shapefile_encode_geometry($feature['geometry'] ?? []);
        if ($encoded === null || $encoded['type'] !== $shapeType) {
            continue;
        }
        $properties = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];
        foreach (array_keys($properties) as $key) {
            if (!in_array((string) $key, $propertyNames, true)) {
                $propertyNames[] = (string) $key;
            }
        }
        foreach ($properties as $value) {
            if (shapefile_truncate_value($value)['truncated']) {
                $truncated++;
            }
        }
        $records[] = [
            'content' => $encoded['content'],
            'points' => $encoded['points'],
            'properties' => $properties,
        ];
        foreach ($encoded['points'] as $point) {
            $allPoints[] = $point;
        }
    }

    if ($records === []) {
        throw new RuntimeException('Shapefile layer has no valid geometries.');
    }

    $fieldMap = shapefile_truncate_field_names($propertyNames);
    $fields = [];
    foreach ($propertyNames as $logical) {
        $fields[] = [
            'logical' => $logical,
            'name' => $fieldMap[$logical],
            'length' => shapefile_dbf_field_length($logical),
        ];
    }

    $shpBody = '';
    $shxBody = '';
    $offsetWords = 50;
    foreach ($records as $index => $record) {
        $contentLengthWords = (int) (strlen($record['content']) / 2);
        $shpBody .= shapefile_pack_be_int32($index + 1)
            . shapefile_pack_be_int32($contentLengthWords)
            . $record['content'];
        $shxBody .= shapefile_pack_be_int32($offsetWords)
            . shapefile_pack_be_int32($contentLengthWords);
        $offsetWords += 4 + $contentLengthWords;
    }

    $bbox = shapefile_bbox_from_points($allPoints);
    $shpLengthWords = 50 + (int) (strlen($shpBody) / 2);
    $shxLengthWords = 50 + (int) (strlen($shxBody) / 2);

    file_put_contents(
        $basePath . '.shp',
        shapefile_file_header($shapeType, $shpLengthWords, $bbox) . $shpBody
    );
    file_put_contents(
        $basePath . '.shx',
        shapefile_file_header($shapeType, $shxLengthWords, $bbox) . $shxBody
    );
    shapefile_write_dbf($basePath . '.dbf', $fields, $records);
    file_put_contents($basePath . '.prj', SHAPEFILE_WGS84_PRJ);

    return ['truncated' => $truncated];
}

/**
 * @param array<int, array{logical: string, name: string, length: int}> $fields
 * @param array<int, array{properties: array<string, mixed>}> $records
 */
function shapefile_write_dbf(string $path, array $fields, array $records): void
{
    $recordLength = 1;
    foreach ($fields as $field) {
        $recordLength += $field['length'];
    }
    $headerLength = 32 + (32 * count($fields)) + 1;
    $now = getdate();

    $header = chr(0x03)
        . chr(($now['year'] - 1900) & 0xFF)
        . chr($now['mon'] & 0xFF)
        . chr($now['mday'] & 0xFF)
        . shapefile_pack_le_int32(count($records))
        . shapefile_pack_le_uint16($headerLength)
        . shapefile_pack_le_uint16($recordLength)
        . str_repeat("\x00", 20);

    foreach ($fields as $field) {
        $name = substr($field['name'], 0, 10);
        $header .= str_pad($name, 11, "\x00")
            . 'C'
            . "\x00\x00\x00\x00"
            . chr($field['length'] & 0xFF)
            . "\x00"
            . str_repeat("\x00", 14);
    }
    $header .= "\x0D";

    $body = '';
    foreach ($records as $record) {
        $row = ' ';
        $properties = $record['properties'];
        foreach ($fields as $field) {
            $raw = shapefile_truncate_value($properties[$field['logical']] ?? '')['value'];
            $encoded = shapefile_to_dbf_latin1($raw);
            if (strlen($encoded) > $field['length']) {
                $encoded = substr($encoded, 0, $field['length']);
            }
            $row .= str_pad($encoded, $field['length'], ' ', STR_PAD_RIGHT);
        }
        $body .= $row;
    }

    file_put_contents($path, $header . $body . "\x1A");
}

/**
 * Uncompressed ZIP (STORE). Avoids depending on the ZipArchive extension.
 *
 * @param array<string, string> $files name => binary contents
 */
function shapefile_write_store_zip(string $zipPath, array $files): void
{
    $now = getdate();
    $dosTime = (($now['hours'] & 0x1F) << 11) | (($now['minutes'] & 0x3F) << 5) | (intdiv((int) $now['seconds'], 2) & 0x1F);
    $dosDate = ((($now['year'] - 1980) & 0x7F) << 9) | (($now['mon'] & 0x0F) << 5) | ($now['mday'] & 0x1F);

    $local = '';
    $central = '';
    $offset = 0;

    foreach ($files as $name => $data) {
        $nameBytes = (string) $name;
        $size = strlen($data);
        $crc = crc32($data) & 0xFFFFFFFF;
        $localHeader = pack(
            'VvvvvvVVVvv',
            0x04034B50,
            20,
            0,
            0,
            $dosTime,
            $dosDate,
            $crc,
            $size,
            $size,
            strlen($nameBytes),
            0
        ) . $nameBytes;
        $local .= $localHeader . $data;
        $central .= pack(
            'VvvvvvvVVVvvvvvVV',
            0x02014B50,
            20,
            20,
            0,
            0,
            $dosTime,
            $dosDate,
            $crc,
            $size,
            $size,
            strlen($nameBytes),
            0,
            0,
            0,
            0,
            0,
            $offset
        ) . $nameBytes;
        $offset += strlen($localHeader) + $size;
    }

    $end = pack(
        'VvvvvVVv',
        0x06054B50,
        0,
        0,
        count($files),
        count($files),
        strlen($central),
        $offset,
        0
    );

    if (file_put_contents($zipPath, $local . $central . $end) === false) {
        throw new RuntimeException('Unable to write Shapefile zip.');
    }
}

/**
 * @param array<int, array{name: string, kind: string, features: array}> $layers
 */
function shapefile_build_zip(string $zipPath, array $layers): int
{
    $tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'reatcarto_shp_' . bin2hex(random_bytes(8));
    if (!mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
        throw new RuntimeException('Unable to create shapefile temp directory.');
    }

    $truncated = 0;
    try {
        $files = [];
        foreach ($layers as $layer) {
            $base = $tempDir . DIRECTORY_SEPARATOR . $layer['name'];
            $result = shapefile_write_layer($base, $layer['kind'], $layer['features']);
            $truncated += (int) ($result['truncated'] ?? 0);
            foreach (['shp', 'shx', 'dbf', 'prj'] as $ext) {
                $file = $base . '.' . $ext;
                $contents = is_file($file) ? file_get_contents($file) : false;
                if ($contents === false) {
                    throw new RuntimeException("Missing shapefile part: {$layer['name']}.{$ext}");
                }
                $files[$layer['name'] . '.' . $ext] = $contents;
            }
        }
        shapefile_write_store_zip($zipPath, $files);
    } finally {
        shapefile_remove_directory($tempDir);
    }

    return $truncated;
}

/**
 * @return array<string, string>
 */
function shapefile_read_store_zip(string $zipPath): array
{
    $data = file_get_contents($zipPath);
    if ($data === false) {
        throw new RuntimeException('Unable to read Shapefile zip.');
    }

    $files = [];
    $offset = 0;
    $length = strlen($data);
    while ($offset + 30 <= $length) {
        $signature = unpack('V', substr($data, $offset, 4))[1];
        if ($signature !== 0x04034B50) {
            break;
        }
        $header = unpack(
            'vversion/vflags/vmethod/vtime/vdate/Vcrc/Vcsize/Vusize/vnamelen/vextra',
            substr($data, $offset + 4, 26)
        );
        $name = substr($data, $offset + 30, (int) $header['namelen']);
        $payloadOffset = $offset + 30 + (int) $header['namelen'] + (int) $header['extra'];
        if ((int) $header['method'] !== 0) {
            throw new RuntimeException('Unsupported ZIP compression in shapefile archive.');
        }
        $files[$name] = substr($data, $payloadOffset, (int) $header['usize']);
        $offset = $payloadOffset + (int) $header['csize'];
    }

    return $files;
}

function shapefile_remove_directory(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $items = scandir($dir);
    if ($items === false) {
        return;
    }
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            shapefile_remove_directory($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
}
