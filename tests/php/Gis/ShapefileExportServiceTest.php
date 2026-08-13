<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Gis;

use AuthException;
use Reatcarto\Tests\MapsTestCase;

final class ShapefileExportServiceTest extends MapsTestCase
{
    public function testExportWholeMapPointsZip(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Mapa Costeiro']);
        for ($i = 0; $i < 5; $i++) {
            $this->createElementForMap($user, $map['id'], [
                'name' => 'Ponto ' . $i,
                'element_type' => 'point',
                'geojson' => ['type' => 'Point', 'coordinates' => [-52.1 - ($i * 0.001), -32.0]],
            ]);
        }

        $prepared = elements_prepare_shapefile_export($user, [
            'map_id' => $map['id'],
            'scope' => 'whole',
        ]);

        $this->assertFileExists($prepared['zip_path']);
        $this->assertMatchesRegularExpression('/mapa-costeiro-\d{4}-\d{2}-\d{2}\.zip/', $prepared['filename']);
        $this->assertContains('mapa-costeiro-points', $prepared['layers']);

        $files = shapefile_read_store_zip($prepared['zip_path']);
        @unlink($prepared['zip_path']);

        foreach (['shp', 'shx', 'dbf', 'prj'] as $ext) {
            $this->assertArrayHasKey('mapa-costeiro-points.' . $ext, $files);
        }
    }

    public function testExportSelectionContainsOnlyChosenFeatures(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Selecao']);
        $keep = [];
        for ($i = 0; $i < 10; $i++) {
            $el = $this->createElementForMap($user, $map['id'], [
                'name' => 'P' . $i,
                'element_type' => 'point',
                'geojson' => ['type' => 'Point', 'coordinates' => [-52.1, -32.0 - ($i * 0.001)]],
            ]);
            if ($i < 2) {
                $keep[] = $el['id'];
            }
        }

        $prepared = elements_prepare_shapefile_export($user, [
            'map_id' => $map['id'],
            'scope' => 'selection',
            'element_ids' => $keep,
        ]);

        $files = shapefile_read_store_zip($prepared['zip_path']);
        @unlink($prepared['zip_path']);
        $dbf = null;
        foreach ($files as $name => $contents) {
            if (str_ends_with($name, '.dbf')) {
                $dbf = $contents;
                break;
            }
        }
        $this->assertNotNull($dbf);
        $recordCount = unpack('V', substr($dbf, 4, 4))[1];
        $this->assertSame(2, $recordCount);
    }

    public function testNonOwnerForbidden(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner, ['name' => 'Privado']);
        $this->createElementForMap($owner, $map['id']);
        $other = $this->activeSessionUser();

        try {
            elements_prepare_shapefile_export($other, [
                'map_id' => $map['id'],
                'scope' => 'whole',
            ]);
            $this->fail('Expected AuthException');
        } catch (AuthException $e) {
            $this->assertSame(403, $e->status);
            $this->assertSame('forbidden', $e->errorCode);
        }
    }

    public function testEmptyScopeReturns422(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Vazio']);

        try {
            elements_prepare_shapefile_export($user, [
                'map_id' => $map['id'],
                'scope' => 'whole',
            ]);
            $this->fail('Expected AuthException');
        } catch (AuthException $e) {
            $this->assertSame(422, $e->status);
        }
    }

    public function testMixedTypesCreateThreeShapefileSets(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Misto']);
        $this->createElementForMap($user, $map['id'], [
            'element_type' => 'point',
            'geojson' => $this->samplePointGeoJson(),
        ]);
        $this->createElementForMap($user, $map['id'], [
            'element_type' => 'line',
            'geojson' => $this->sampleLineGeoJson(),
        ]);
        $this->createElementForMap($user, $map['id'], [
            'element_type' => 'polygon',
            'geojson' => $this->samplePolygonGeoJson(),
        ]);

        $prepared = elements_prepare_shapefile_export($user, [
            'map_id' => $map['id'],
            'scope' => 'whole',
        ]);

        $this->assertCount(3, $prepared['layers']);
        $names = array_keys(shapefile_read_store_zip($prepared['zip_path']));
        @unlink($prepared['zip_path']);

        $this->assertContains('misto-points.shp', $names);
        $this->assertContains('misto-lines.shp', $names);
        $this->assertContains('misto-polygons.shp', $names);
    }

    public function testWriterFailureReturns500WithoutZipFile(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Falha']);
        $this->createElementForMap($user, $map['id']);

        try {
            elements_prepare_shapefile_export(
                $user,
                ['map_id' => $map['id'], 'scope' => 'whole'],
                static function (): int {
                    throw new \RuntimeException('ogr2ogr failed');
                }
            );
            $this->fail('Expected AuthException');
        } catch (AuthException $e) {
            $this->assertSame(500, $e->status);
            $this->assertSame('server_error', $e->errorCode);
        }
    }
}
