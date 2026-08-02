<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Elements;

use AuthException;
use Reatcarto\Tests\MapsTestCase;

final class ElementsCrudTest extends MapsTestCase
{
    public function testUt055CreateGeometryTypes(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        foreach (['point' => $this->samplePointGeoJson(), 'line' => $this->sampleLineGeoJson(), 'polygon' => $this->samplePolygonGeoJson()] as $type => $geojson) {
            $el = $this->createElementForMap($user, $map['id'], [
                'element_type' => $type,
                'geojson' => $geojson,
                'name' => ucfirst($type),
            ]);
            $this->assertSame($type, $el['element_type']);
            $this->assertSame('terra', $el['element_category']);
            $this->assertSame($user['id'], $el['author_id']);
        }
    }

    public function testUt056UpdateIncrementsVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $updated = elements_update($user, [
            'id' => $el['id'],
            'name' => 'Updated',
            'geojson' => ['type' => 'Point', 'coordinates' => [-52.0, -32.0]],
            'base_version' => $el['version'],
        ])['element'];
        $this->assertSame(2, $updated['version']);
        $this->assertSame('Updated', $updated['name']);
    }

    public function testUt057DeleteRemovesElementAndPhotos(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $file = $this->makeJpegTempFile();
        $_FILES = [
            'file' => [
                'name' => 'a.jpg',
                'type' => 'image/jpeg',
                'tmp_name' => $file,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($file),
            ],
        ];
        $photo = photos_upload($user, $_FILES, ['element_id' => $el['id']])['photo'];
        elements_delete($user, ['id' => $el['id'], 'base_version' => $el['version']]);
        $stmt = db()->prepare('SELECT COUNT(*) FROM map_elements WHERE id = :id');
        $stmt->execute(['id' => $el['id']]);
        $this->assertSame(0, (int) $stmt->fetchColumn());
        $stmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE id = :id');
        $stmt->execute(['id' => $photo['id']]);
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    public function testUt058NonOwnerForbidden(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $el = $this->createElementForMap($owner, $map['id']);
        $other = $this->activateUser();
        $this->expectAuthException(
            fn () => elements_update($other, ['id' => $el['id'], 'name' => 'Hack']),
            'forbidden',
            403
        );
    }

    public function testUt059InvalidGeometryRejected(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $bowtie = [
            'type' => 'Polygon',
            'coordinates' => [[
                [-52.1, -32.0],
                [-52.0, -32.1],
                [-52.1, -32.1],
                [-52.0, -32.0],
                [-52.1, -32.0],
            ]],
        ];
        $this->expectAuthException(
            fn () => $this->createElementForMap($user, $map['id'], [
                'element_type' => 'polygon',
                'geojson' => $bowtie,
                'name' => 'Bad',
            ]),
            'validation_error',
            400
        );
    }

    public function testUt060MissingGeometryOrNameRejected(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->expectAuthException(
            fn () => elements_create($user, [
                'map_id' => $map['id'],
                'element_type' => 'point',
                'name' => 'No geom',
            ]),
            'validation_error',
            400
        );
        $this->expectAuthException(
            fn () => elements_create($user, [
                'map_id' => $map['id'],
                'element_type' => 'point',
                'geojson' => $this->samplePointGeoJson(),
                'name' => '',
            ]),
            'validation_error',
            400
        );
    }

    public function testUt061VertexAndMetadataLimits(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $coords = [];
        for ($i = 0; $i <= MAX_VERTICES; $i++) {
            $coords[] = [-52.1 + ($i * 0.00001), -32.035];
        }
        $this->expectAuthException(
            fn () => $this->createElementForMap($user, $map['id'], [
                'element_type' => 'line',
                'geojson' => ['type' => 'LineString', 'coordinates' => $coords],
                'name' => 'Too many',
            ]),
            'validation_error',
            400
        );
    }

    public function testUt162InvalidGeoJsonNot500(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        try {
            $this->createElementForMap($user, $map['id'], [
                'element_type' => 'point',
                'geojson' => ['type' => 'Point', 'coordinates' => 'bad'],
                'name' => 'Bad coords',
            ]);
            $this->fail('Expected validation_error');
        } catch (AuthException $e) {
            $this->assertSame('validation_error', $e->errorCode);
            $this->assertSame(400, $e->status);
        }
    }

    public function testUt163GeoJsonRoundTrip(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $geojson = $this->samplePointGeoJson();
        $el = $this->createElementForMap($user, $map['id'], ['geojson' => $geojson]);
        $stored = is_array($el['geojson']) ? $el['geojson'] : json_decode($el['geojson'], true);
        $this->assertEqualsWithDelta(-52.1, $stored['coordinates'][0], 0.000001);
        $this->assertEqualsWithDelta(-32.035, $stored['coordinates'][1], 0.000001);
    }

    public function testIt033ElementMutatorsDenied(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $el = $this->createElementForMap($owner, $map['id']);
        $other = $this->activateUser();
        $this->expectAuthException(
            fn () => elements_delete($other, ['id' => $el['id']]),
            'forbidden',
            403
        );
    }

    public function testIt034VersionConflict(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        elements_update($user, ['id' => $el['id'], 'name' => 'First', 'base_version' => 1]);
        try {
            elements_update($user, ['id' => $el['id'], 'name' => 'Second', 'base_version' => 1]);
            $this->fail('Expected ConflictException');
        } catch (\ConflictException $e) {
            $this->assertSame('conflict', $e->errorCode);
            $this->assertSame(409, $e->status);
            $this->assertSame('Second', $e->localSnapshot['payload']['name'] ?? null);
            $this->assertSame('First', $e->remoteSnapshot['name'] ?? null);
        }
    }

    public function testIt035ElementDeleteIdempotency(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $cid = sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
        elements_delete($user, ['id' => $el['id'], 'client_mutation_id' => $cid, 'base_version' => $el['version']]);
        $again = elements_delete($user, ['id' => $el['id'], 'client_mutation_id' => $cid]);
        $this->assertTrue($again['deleted']);
    }

    public function testIt036UpdateAfterDeleteConflict(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        elements_delete($user, ['id' => $el['id'], 'base_version' => $el['version']]);
        try {
            elements_update($user, ['id' => $el['id'], 'name' => 'Ghost', 'base_version' => $el['version']]);
            $this->fail('Expected ConflictException');
        } catch (\ConflictException $e) {
            $this->assertSame('delete_update', $e->kind);
        }
    }

    public function testIt037LargeElementListPagination(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        for ($i = 0; $i < 100; $i++) {
            $this->createElementForMap($user, $map['id'], ['name' => "El {$i}"]);
        }
        $page = elements_list($user, $map['id'], 1, 25);
        $this->assertCount(25, $page['elements']);
        $this->assertSame(100, $page['pagination']['total']);
    }

    public function testIt038UpdateRequiresBaseVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $this->expectAuthException(
            fn () => elements_update($user, ['id' => $el['id'], 'name' => 'No version']),
            'validation_error',
            400
        );
    }

    public function testIt039DeleteRequiresBaseVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $this->expectAuthException(
            fn () => elements_delete($user, ['id' => $el['id']]),
            'validation_error',
            400
        );
    }

    public function testE2e007ElementCrudFlow(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $point = $this->createElementForMap($user, $map['id']);
        $line = $this->createElementForMap($user, $map['id'], [
            'element_type' => 'line',
            'geojson' => $this->sampleLineGeoJson(),
            'name' => 'Line',
        ]);
        $polygon = $this->createElementForMap($user, $map['id'], [
            'element_type' => 'polygon',
            'geojson' => $this->samplePolygonGeoJson(),
            'name' => 'Poly',
        ]);
        $listed = elements_list($user, $map['id'])['elements'];
        $this->assertCount(3, $listed);
        elements_update($user, ['id' => $point['id'], 'name' => 'Edited Point', 'base_version' => 1]);
        elements_delete($user, ['id' => $polygon['id'], 'base_version' => $polygon['version']]);
        $after = elements_list($user, $map['id'])['elements'];
        $this->assertCount(2, $after);
    }
}
