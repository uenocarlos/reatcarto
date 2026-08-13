<?php

declare(strict_types=1);

namespace Reatcarto\Tests;

abstract class MapsTestCase extends AuthTestCase
{
    protected string $uploadsDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->uploadsDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'reatcarto_uploads_' . bin2hex(random_bytes(4));
        mkdir($this->uploadsDir, 0775, true);
        putenv('UPLOADS_ROOT=' . $this->uploadsDir);
        $_ENV['UPLOADS_ROOT'] = $this->uploadsDir;
        $GLOBALS['CONFIG'] = build_app_config();
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->uploadsDir);
        parent::tearDown();
    }

    protected function removeDirectory(string $dir): void
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
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }

    protected function activeSessionUser(): array
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');

        return $user;
    }

    protected function createMapForUser(array $user, array $overrides = []): array
    {
        register_session_for_user($user['id'], 'field');
        $result = maps_create($user, array_merge(['name' => 'Test Map'], $overrides));

        return $result['map'];
    }

    protected function samplePointGeoJson(): array
    {
        return ['type' => 'Point', 'coordinates' => [-52.1, -32.035]];
    }

    protected function sampleLineGeoJson(): array
    {
        return [
            'type' => 'LineString',
            'coordinates' => [[-52.11, -32.03], [-52.09, -32.04]],
        ];
    }

    protected function samplePolygonGeoJson(): array
    {
        return [
            'type' => 'Polygon',
            'coordinates' => [[
                [-52.12, -32.03],
                [-52.08, -32.03],
                [-52.08, -32.05],
                [-52.12, -32.05],
                [-52.12, -32.03],
            ]],
        ];
    }

    protected function createElementForMap(array $user, string $mapId, array $overrides = []): array
    {
        $payload = array_merge([
            'map_id' => $mapId,
            'element_type' => 'point',
            'geojson' => $this->samplePointGeoJson(),
            'name' => 'Point A',
            'description' => 'desc',
            'element_category' => 'terra',
            'style' => ['icon_name' => 'pin'],
        ], $overrides);
        $result = elements_create($user, $payload);

        return $result['element'];
    }

    protected function makeJpegTempFile(int $sizeBytes = 1024): string
    {
        $path = tempnam(sys_get_temp_dir(), 'photo');
        $minimalJpeg = base64_decode(
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIQAxAAAAG6Af/EABYRAQEBAAAAAAAAAAAAAAAAAAARAP/aAAgBAQABBQL/AP/EABYRAQEBAAAAAAAAAAAAAAAAAAARAP/aAAgBAwEBPwFf/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEB/9oACAECAQE/AVf/xAAWEQEBAQAAAAAAAAAAAAAAAAABEBH/2gAIAQEABj8CX//Z',
            true
        );
        $payload = ($minimalJpeg !== false ? $minimalJpeg : '') . str_repeat("\x00", max(0, $sizeBytes - 200));
        file_put_contents($path, substr($payload, 0, max(strlen($minimalJpeg ?: ''), $sizeBytes)));

        return $path;
    }
}
