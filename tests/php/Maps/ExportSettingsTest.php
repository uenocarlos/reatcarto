<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Maps;

use Reatcarto\Tests\MapsTestCase;

final class ExportSettingsTest extends MapsTestCase
{
    private function sampleExportSettings(): array
    {
        return [
            'title' => 'Field Report',
            'author' => 'Analyst',
            'legendPosition' => 'inside',
            'dpi' => 300,
        ];
    }

    public function testIt052SettingsOnlyUpdateWithoutBaseVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Export Map'])['map'];
        $versionBefore = $map['version'];
        $this->assertSame([], $map['export_settings']);

        $updated = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => $this->sampleExportSettings(),
        ])['map'];

        $this->assertSame($versionBefore, $updated['version']);
        $this->assertSame('Field Report', $updated['export_settings']['title']);
        $this->assertSame('Analyst', $updated['export_settings']['author']);
    }

    public function testIt053SettingsOnlyDeniedForNonOwner(): void
    {
        $owner = $this->activeSessionUser();
        $map = maps_create($owner, ['name' => 'Owned'])['map'];
        $other = $this->activateUser();
        $this->expectAuthException(
            fn () => maps_update($other, [
                'id' => $map['id'],
                'export_settings' => $this->sampleExportSettings(),
            ]),
            'not_found',
            404
        );
    }

    public function testIt054InvalidExportSettingsTypeRejected(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Validate'])['map'];
        $this->expectAuthException(
            fn () => maps_update($user, [
                'id' => $map['id'],
                'export_settings' => 'not-an-object',
            ]),
            'validation_error',
            400
        );
    }

    public function testIt055PublicDtoOmitsExportSettings(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Published Export'])['map'];
        maps_update($user, [
            'id' => $map['id'],
            'export_settings' => $this->sampleExportSettings(),
        ]);
        $this->createElementForMap($user, $map['id']);
        $published = maps_publish($user, ['id' => $map['id']])['map'];
        $public = public_map_get($published['public_id'])['map'];
        $this->assertArrayNotHasKey('export_settings', $public);
    }

    public function testIt047MapDeleteRemovesExportSettings(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Delete Me'])['map'];
        maps_update($user, [
            'id' => $map['id'],
            'export_settings' => $this->sampleExportSettings(),
        ]);
        $stored = maps_get($user, $map['id'])['map'];
        $this->assertSame('Field Report', $stored['export_settings']['title']);

        maps_delete($user, ['id' => $map['id'], 'base_version' => $stored['version']]);
        $this->expectAuthException(fn () => maps_get($user, $map['id']), 'not_found', 404);

        $stmt = db()->prepare('SELECT export_settings FROM maps WHERE id = :id');
        $stmt->execute(['id' => $map['id']]);
        $this->assertFalse($stmt->fetch());
    }

    public function testIt043SequentialSettingsOnlyUpdatesLastWriteWins(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'LWW'])['map'];
        maps_update($user, [
            'id' => $map['id'],
            'export_settings' => ['title' => 'First', 'author' => 'A'],
        ]);
        $updated = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => ['title' => 'Second', 'author' => 'B'],
        ])['map'];
        $this->assertSame('Second', $updated['export_settings']['title']);
        $this->assertSame('B', $updated['export_settings']['author']);
    }

    public function testListExportSettingsPayloadRejected(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'List Payload'])['map'];
        $this->expectAuthException(
            fn () => maps_update($user, [
                'id' => $map['id'],
                'export_settings' => ['unexpected-list-item'],
            ]),
            'validation_error',
            400
        );
    }

    public function testExportSettingsNormalizedAndClampedOnSave(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Normalize'])['map'];
        $updated = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => [
                'title' => '  Report  ',
                'author' => 'Analyst',
                'dpi' => 9999,
                'legendPosition' => 'right',
                'hiddenElementIds' => ['el-1', 42, '', str_repeat('x', MAX_MAP_NAME_LENGTH + 1)],
            ],
        ])['map'];

        $settings = $updated['export_settings'];
        $this->assertSame('Report', $settings['title']);
        $this->assertSame(600, $settings['dpi']);
        $this->assertSame('beside', $settings['legendPosition']);
        $this->assertSame(['el-1'], $settings['hiddenElementIds']);
    }

    public function testUt108InvalidLocationColorsFallBackToDefaultsOnSave(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Colors'])['map'];
        $updated = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => [
                'title' => 'Report',
                'author' => 'Analyst',
                'stateColor' => 'notahex',
                'municipalityColor' => '#ZZZZZZ',
            ],
        ])['map'];

        $settings = $updated['export_settings'];
        $this->assertSame('#1D4ED8', $settings['stateColor']);
        $this->assertSame('#DC2626', $settings['municipalityColor']);
    }

    public function testUt108ValidHexLocationColorsPersistOnSave(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Hex Colors'])['map'];
        $updated = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => [
                'title' => 'Report',
                'author' => 'Analyst',
                'stateColor' => '#ABCDEF',
                'municipalityColor' => '#123456',
            ],
        ])['map'];

        $settings = $updated['export_settings'];
        $this->assertSame('#ABCDEF', $settings['stateColor']);
        $this->assertSame('#123456', $settings['municipalityColor']);
    }

    public function testUt108InvalidLocationColorsDoNotRoundTripOnReSave(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Round Trip'])['map'];
        $first = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => [
                'title' => 'Report',
                'author' => 'Analyst',
                'stateColor' => 'notahex',
                'municipalityColor' => '#DC2626',
            ],
        ])['map']['export_settings'];

        $second = maps_update($user, [
            'id' => $map['id'],
            'export_settings' => $first,
        ])['map']['export_settings'];

        $this->assertSame('#1D4ED8', $second['stateColor']);
        $this->assertSame('#DC2626', $second['municipalityColor']);
    }

    public function testOversizedExportSettingsPayloadRejected(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Oversized'])['map'];
        $ids = [];
        for ($i = 0; $i < ELEMENTS_PER_MAP; $i++) {
            $ids[] = sprintf('%032x', $i);
        }
        $this->expectAuthException(
            fn () => maps_update($user, [
                'id' => $map['id'],
                'export_settings' => [
                    'title' => str_repeat('x', MAX_TEXT_LENGTH),
                    'author' => str_repeat('y', MAX_TEXT_LENGTH),
                    'technicalResponsible' => str_repeat('z', MAX_TEXT_LENGTH),
                    'hiddenElementIds' => $ids,
                    'hiddenCategoryIds' => $ids,
                ],
            ]),
            'validation_error',
            400
        );
    }
}
