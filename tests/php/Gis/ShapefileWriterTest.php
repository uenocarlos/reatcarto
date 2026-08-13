<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Gis;

use PHPUnit\Framework\TestCase;

final class ShapefileWriterTest extends TestCase
{
    public function testTruncateFieldNames(): void
    {
        $mapped = shapefile_truncate_field_names(['description', 'border_color']);
        $this->assertSame('descript', $mapped['description']);
        $this->assertSame('border_col', $mapped['border_color']);
        $this->assertLessThanOrEqual(10, strlen($mapped['description']));
        $this->assertLessThanOrEqual(10, strlen($mapped['border_color']));
    }

    public function testTruncateValues(): void
    {
        $result = shapefile_truncate_value(str_repeat('x', 300));
        $this->assertSame(254, strlen($result['value']));
        $this->assertTrue($result['truncated']);
    }

    public function testWritePointLayerProducesShpParts(): void
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'reatcarto_shp_test_' . bin2hex(random_bytes(4));
        mkdir($dir, 0775, true);
        $base = $dir . DIRECTORY_SEPARATOR . 'mapa-points';

        shapefile_write_layer($base, 'Point', [[
            'geometry' => ['type' => 'Point', 'coordinates' => [-52.1, -32.0]],
            'properties' => ['name' => 'Marco', 'description' => '', 'category' => 'terra'],
        ]]);

        foreach (['shp', 'shx', 'dbf', 'prj'] as $ext) {
            $this->assertFileExists($base . '.' . $ext);
        }
        $shp = file_get_contents($base . '.shp');
        $this->assertNotFalse($shp);
        $this->assertSame(9994, unpack('N', substr($shp, 0, 4))[1]);
        $this->assertSame(1, unpack('V', substr($shp, 32, 4))[1]);
        $this->assertStringContainsString('WGS', (string) file_get_contents($base . '.prj'));

        foreach (glob($dir . DIRECTORY_SEPARATOR . '*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }

    public function testBuildZipContainsThreeGeometrySets(): void
    {
        $zipPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'reatcarto_shp_' . bin2hex(random_bytes(4)) . '.zip';
        shapefile_build_zip($zipPath, [
            [
                'name' => 'mapa-points',
                'kind' => 'Point',
                'features' => [[
                    'geometry' => ['type' => 'Point', 'coordinates' => [-52.1, -32.0]],
                    'properties' => ['name' => 'P', 'description' => '', 'category' => 'terra'],
                ]],
            ],
            [
                'name' => 'mapa-lines',
                'kind' => 'LineString',
                'features' => [[
                    'geometry' => ['type' => 'LineString', 'coordinates' => [[-52.1, -32.0], [-52.2, -32.1]]],
                    'properties' => ['name' => 'L', 'description' => '', 'category' => 'agua'],
                ]],
            ],
            [
                'name' => 'mapa-polygons',
                'kind' => 'Polygon',
                'features' => [[
                    'geometry' => ['type' => 'Polygon', 'coordinates' => [[
                        [-52.12, -32.03],
                        [-52.08, -32.03],
                        [-52.08, -32.05],
                        [-52.12, -32.05],
                        [-52.12, -32.03],
                    ]]],
                    'properties' => ['name' => 'G', 'description' => '', 'category' => 'terra'],
                ]],
            ],
        ]);

        $this->assertFileExists($zipPath);
        $names = array_keys(shapefile_read_store_zip($zipPath));
        @unlink($zipPath);

        foreach (['mapa-points.shp', 'mapa-lines.shp', 'mapa-polygons.shp', 'mapa-points.prj'] as $expected) {
            $this->assertContains($expected, $names);
        }
    }
}
