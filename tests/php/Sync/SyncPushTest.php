<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Sync;

use AuthException;
use Reatcarto\Tests\MapsTestCase;

final class SyncPushTest extends MapsTestCase
{
    public function testIt093PushReturnsPerMutationStatus(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        $mid = '11111111-1111-1111-1111-111111111111';

        $result = sync_push($user, [
            [
                'client_mutation_id' => $mid,
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $element['id'],
                'base_version' => $element['version'],
                'payload' => ['name' => 'Synced Name'],
            ],
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame('synced', $result['results'][0]['status']);
        $this->assertSame($mid, $result['results'][0]['client_mutation_id']);
    }

    public function testIt048ReplaySameBatchIdempotent(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $mid = '22222222-2222-2222-2222-222222222222';
        $mutation = [
            'client_mutation_id' => $mid,
            'resource_type' => 'map',
            'op' => 'update',
            'resource_id' => $map['id'],
            'base_version' => $map['version'],
            'payload' => ['name' => 'Replay Map'],
        ];

        sync_push($user, [$mutation]);
        $replay = sync_push($user, [$mutation]);
        $this->assertSame('synced', $replay['results'][0]['status']);
        $count = db()->prepare('SELECT COUNT(*) FROM maps WHERE id = :id');
        $count->execute(['id' => $map['id']]);
        $this->assertSame(1, (int) $count->fetchColumn());
    }

    public function testIt046DuplicateClientMutationIdCollapses(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        $mid = '33333333-3333-3333-3333-333333333333';
        $mutation = [
            'client_mutation_id' => $mid,
            'resource_type' => 'element',
            'op' => 'update',
            'resource_id' => $element['id'],
            'base_version' => $element['version'],
            'payload' => ['name' => 'Once'],
        ];
        $first = sync_push($user, [$mutation]);
        $second = sync_push($user, [$mutation]);
        $this->assertSame('synced', $first['results'][0]['status']);
        $this->assertSame('synced', $second['results'][0]['status']);
    }

    public function testIt049RemoteDeleteVsLocalEditDeletionConflict(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        elements_delete($user, ['id' => $element['id'], 'base_version' => $element['version']]);

        $result = sync_push($user, [
            [
                'client_mutation_id' => '44444444-4444-4444-4444-444444444444',
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $element['id'],
                'base_version' => $element['version'],
                'payload' => ['name' => 'Should conflict'],
            ],
        ]);

        $this->assertSame('conflict', $result['results'][0]['status']);
        $this->assertSame('delete_update', $result['results'][0]['conflict']['kind']);
    }

    public function testIt044LargeBatchReportsProgress(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $mutations = [];
        for ($i = 0; $i < 5; $i++) {
            $el = $this->createElementForMap($user, $map['id'], ['name' => "El {$i}"]);
            $mutations[] = [
                'client_mutation_id' => sprintf('55555555-5555-5555-5555-55555555555%d', $i),
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $el['id'],
                'base_version' => $el['version'],
                'payload' => ['name' => "Updated {$i}"],
            ];
        }
        $mutations[] = [
            'client_mutation_id' => '66666666-6666-6666-6666-666666666666',
            'resource_type' => 'element',
            'op' => 'update',
            'resource_id' => '00000000-0000-0000-0000-000000000000',
            'base_version' => 1,
            'payload' => ['name' => 'Missing'],
        ];

        $result = sync_push($user, $mutations);
        $this->assertSame(count($mutations), $result['progress']['total']);
        $synced = array_filter($result['results'], fn ($r) => $r['status'] === 'synced');
        $notSynced = array_filter($result['results'], fn ($r) => $r['status'] !== 'synced');
        $this->assertCount(5, $synced);
        $this->assertCount(1, $notSynced);
    }

    public function testIt045DeactivatedMidSyncForbidden(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        db()->prepare("UPDATE users SET status = 'deactivated' WHERE id = :id")->execute(['id' => $user['id']]);
        $user['status'] = 'deactivated';

        $this->expectException(AuthException::class);
        sync_push($user, [
            [
                'client_mutation_id' => '77777777-7777-7777-7777-777777777777',
                'resource_type' => 'map',
                'op' => 'update',
                'resource_id' => $map['id'],
                'base_version' => $map['version'],
                'payload' => ['name' => 'Blocked'],
            ],
        ]);
    }

    public function testIt047PartialBatchStillReturnsResults(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);

        $result = sync_push($user, [
            [
                'client_mutation_id' => '88888888-8888-8888-8888-888888888881',
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $element['id'],
                'base_version' => $element['version'],
                'payload' => ['name' => 'Done'],
            ],
            [
                'client_mutation_id' => '88888888-8888-8888-8888-888888888882',
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $element['id'],
                'base_version' => 999,
                'payload' => ['name' => 'Conflict later'],
            ],
        ]);

        $this->assertSame('synced', $result['results'][0]['status']);
        $this->assertSame('conflict', $result['results'][1]['status']);
    }

    public function testIt050ManyPendingOpsIndividualStatuses(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $mutations = [];
        for ($i = 0; $i < 10; $i++) {
            $el = $this->createElementForMap($user, $map['id'], ['name' => "Bulk {$i}"]);
            $mutations[] = [
                'client_mutation_id' => sprintf('99999999-9999-9999-9999-99999999999%d', $i),
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $el['id'],
                'base_version' => $el['version'],
                'payload' => ['name' => "Bulk Updated {$i}"],
            ];
        }
        $result = sync_push($user, $mutations);
        $this->assertCount(10, $result['results']);
        foreach ($result['results'] as $item) {
            $this->assertContains($item['status'], ['synced', 'failed', 'conflict']);
        }
    }

    public function testSyncPushMapPublishAndUnpublish(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->createElementForMap($user, $map['id']);
        $publishMid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

        $publishResult = sync_push($user, [
            [
                'client_mutation_id' => $publishMid,
                'resource_type' => 'map',
                'op' => 'publish',
                'resource_id' => $map['id'],
                'payload' => [],
            ],
        ]);

        $this->assertSame('synced', $publishResult['results'][0]['status']);
        $this->assertTrue($publishResult['results'][0]['resource']['is_published']);

        $unpublishMid = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        $unpublishResult = sync_push($user, [
            [
                'client_mutation_id' => $unpublishMid,
                'resource_type' => 'map',
                'op' => 'unpublish',
                'resource_id' => $map['id'],
                'payload' => [],
            ],
        ]);

        $this->assertSame('synced', $unpublishResult['results'][0]['status']);
        $this->assertFalse($unpublishResult['results'][0]['resource']['is_published']);
    }

    public function testSyncPushMapPublishEmptyRequiresConfirmEmpty(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);

        $result = sync_push($user, [
            [
                'client_mutation_id' => 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                'resource_type' => 'map',
                'op' => 'publish',
                'resource_id' => $map['id'],
                'payload' => [],
            ],
        ]);

        $this->assertSame('failed', $result['results'][0]['status']);
        $this->assertSame('confirmation_required', $result['results'][0]['error']['code']);
    }

    public function testSyncPushMapPublishEmptyWithConfirmEmpty(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Empty public map']);

        $result = sync_push($user, [
            [
                'client_mutation_id' => 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
                'resource_type' => 'map',
                'op' => 'publish',
                'resource_id' => $map['id'],
                'payload' => ['confirm_empty' => true],
            ],
        ]);

        $this->assertSame('synced', $result['results'][0]['status']);
        $this->assertTrue($result['results'][0]['resource']['is_published']);
    }

    public function testSyncPushMapPublishIdempotentByClientMutationId(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->createElementForMap($user, $map['id']);
        $mid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
        $mutation = [
            'client_mutation_id' => $mid,
            'resource_type' => 'map',
            'op' => 'publish',
            'resource_id' => $map['id'],
            'payload' => [],
        ];

        sync_push($user, [$mutation]);
        $replay = sync_push($user, [$mutation]);

        $this->assertSame('synced', $replay['results'][0]['status']);
        $this->assertTrue($replay['results'][0]['resource']['is_published']);
    }

    public function testUt088IdempotentCreateOnce(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $mid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        $mutation = [
            'client_mutation_id' => $mid,
            'resource_type' => 'element',
            'op' => 'create',
            'resource_id' => null,
            'payload' => [
                'map_id' => $map['id'],
                'element_type' => 'point',
                'geojson' => $this->samplePointGeoJson(),
                'name' => 'Once Element',
                'element_category' => 'terra',
                'style' => '{}',
            ],
        ];
        sync_push($user, [$mutation]);
        sync_push($user, [$mutation]);
        $count = db()->prepare('SELECT COUNT(*) FROM map_elements WHERE map_id = :map_id');
        $count->execute(['map_id' => $map['id']]);
        $this->assertSame(1, (int) $count->fetchColumn());
    }
}
