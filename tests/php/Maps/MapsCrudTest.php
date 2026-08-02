<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Maps;

use AuthException;
use Reatcarto\Tests\MapsTestCase;

final class MapsCrudTest extends MapsTestCase
{
    public function testUt047CreatePrivateMapWithPublicId(): void
    {
        $user = $this->activeSessionUser();
        $result = maps_create($user, ['name' => 'Field Map']);
        $map = $result['map'];
        $this->assertFalse($map['is_published']);
        $this->assertNotEmpty($map['public_id']);
        $this->assertSame($user['id'], $map['owner_id']);
    }

    public function testUt048OwnerCrud(): void
    {
        $user = $this->activeSessionUser();
        $created = maps_create($user, ['name' => 'Original'])['map'];
        $listed = maps_list($user)['maps'];
        $this->assertCount(1, $listed);
        $fetched = maps_get($user, $created['id'])['map'];
        $this->assertSame('Original', $fetched['name']);
        $renamed = maps_update($user, [
            'id' => $created['id'],
            'name' => 'Renamed',
            'base_version' => $created['version'],
        ])['map'];
        $this->assertSame('Renamed', $renamed['name']);
        maps_delete($user, ['id' => $created['id'], 'base_version' => $renamed['version']]);
        $this->expectAuthException(fn () => maps_get($user, $created['id']), 'not_found', 404);
    }

    public function testUt049OtherUserMapDenied(): void
    {
        $owner = $this->activeSessionUser();
        $map = maps_create($owner, ['name' => 'Secret'])['map'];
        $other = $this->activateUser();
        $this->expectAuthException(fn () => maps_get($other, $map['id']), 'not_found', 404);
    }

    public function testUt050EmptyList(): void
    {
        $user = $this->activeSessionUser();
        $list = maps_list($user);
        $this->assertSame([], $list['maps']);
    }

    public function testUt051InvalidCenterZoom(): void
    {
        $user = $this->activeSessionUser();
        $this->expectAuthException(
            fn () => maps_create($user, ['name' => 'Bad', 'center_lat' => 999]),
            'validation_error',
            400
        );
    }

    public function testUt052BlankNameRejected(): void
    {
        $user = $this->activeSessionUser();
        $this->expectAuthException(fn () => maps_create($user, ['name' => '   ']), 'validation_error', 400);
    }

    public function testUt053MapLimitAndOverlongName(): void
    {
        $user = $this->activeSessionUser();
        $this->expectAuthException(
            fn () => maps_create($user, ['name' => str_repeat('x', MAX_MAP_NAME_LENGTH + 1)]),
            'validation_error',
            400
        );
        for ($i = 0; $i < MAPS_PER_USER; $i++) {
            maps_create($user, ['name' => "Map {$i}"]);
        }
        $this->expectAuthException(
            fn () => maps_create($user, ['name' => 'One too many']),
            'payload_too_large',
            400
        );
    }

    public function testIt027MutatorsDeniedForNonOwner(): void
    {
        $owner = $this->activeSessionUser();
        $map = maps_create($owner, ['name' => 'Owned'])['map'];
        $pending = $this->registerUser();
        register_session_for_user($pending['id'], 'field');
        $this->expectAuthException(fn () => require_active_user(), 'account_pending', 403);
        $other = $this->activateUser();
        $this->expectAuthException(
            fn () => maps_update($other, ['id' => $map['id'], 'name' => 'Hack']),
            'not_found',
            404
        );
    }

    public function testIt028ConcurrentRenameDeleteDeleteWins(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Race'])['map'];
        maps_delete($user, ['id' => $map['id'], 'base_version' => $map['version']]);
        $this->expectAuthException(
            fn () => maps_update($user, ['id' => $map['id'], 'name' => 'Late', 'base_version' => 1]),
            'not_found',
            404
        );
    }

    public function testIt029CreateIdempotency(): void
    {
        $user = $this->activeSessionUser();
        $cid = sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
        $first = maps_create($user, ['name' => 'Once', 'client_mutation_id' => $cid])['map'];
        $second = maps_create($user, ['name' => 'Once', 'client_mutation_id' => $cid])['map'];
        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(1, (int) db()->query('SELECT COUNT(*) FROM maps')->fetchColumn());
    }

    public function testIt031UpdateDeletedMapNotFound(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Temp'])['map'];
        maps_delete($user, ['id' => $map['id'], 'base_version' => $map['version']]);
        $this->expectAuthException(
            fn () => maps_update($user, ['id' => $map['id'], 'name' => 'Nope', 'base_version' => 1]),
            'not_found',
            404
        );
        $owned = maps_create($user, ['name' => 'Still editable'])['map'];
        $updated = maps_update($user, [
            'id' => $owned['id'],
            'name' => 'Edited',
            'base_version' => $owned['version'],
        ])['map'];
        $this->assertSame('Edited', $updated['name']);
    }

    public function testIt032ListPaginationAndIsolation(): void
    {
        $owner = $this->activeSessionUser();
        for ($i = 0; $i < 5; $i++) {
            maps_create($owner, ['name' => "Map {$i}"]);
        }
        $other = $this->activateUser();
        maps_create($other, ['name' => 'Other map']);
        $page1 = maps_list($owner, null, 1, 2);
        $this->assertCount(2, $page1['maps']);
        $this->assertSame(5, $page1['pagination']['total']);
        $names = array_column(maps_list($owner)['maps'], 'name');
        $this->assertNotContains('Other map', $names);
    }

    public function testIt034MapVersionConflict(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Conflict Map'])['map'];
        maps_update($user, ['id' => $map['id'], 'name' => 'First', 'base_version' => 1]);
        try {
            maps_update($user, ['id' => $map['id'], 'name' => 'Second', 'base_version' => 1]);
            $this->fail('Expected ConflictException');
        } catch (\ConflictException $e) {
            $this->assertSame('conflict', $e->errorCode);
            $this->assertSame(409, $e->status);
            $this->assertSame('Second', $e->localSnapshot['payload']['name'] ?? null);
            $this->assertSame('First', $e->remoteSnapshot['name'] ?? null);
        }
    }

    public function testMapUpdateRequiresBaseVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Versioned'])['map'];
        $this->expectAuthException(
            fn () => maps_update($user, ['id' => $map['id'], 'name' => 'No version']),
            'validation_error',
            400
        );
    }

    public function testMapDeleteRequiresBaseVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'To delete'])['map'];
        $this->expectAuthException(
            fn () => maps_delete($user, ['id' => $map['id']]),
            'validation_error',
            400
        );
    }

    public function testClientForceVersionIgnoredOnMapUpdate(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Protected'])['map'];
        maps_update($user, ['id' => $map['id'], 'name' => 'First', 'base_version' => 1]);

        $this->expectAuthException(
            fn () => maps_update($user, [
                'id' => $map['id'],
                'name' => 'Bypass',
                'force_version' => true,
            ]),
            'validation_error',
            400
        );

        try {
            maps_update($user, [
                'id' => $map['id'],
                'name' => 'Bypass stale',
                'base_version' => 1,
                'force_version' => true,
            ]);
            $this->fail('Expected ConflictException');
        } catch (\ConflictException $e) {
            $this->assertSame('conflict', $e->errorCode);
            $this->assertSame(409, $e->status);
        }
    }

    public function testClientForceVersionIgnoredOnMapDelete(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Protected delete'])['map'];
        maps_update($user, ['id' => $map['id'], 'name' => 'Bumped', 'base_version' => 1]);

        $this->expectAuthException(
            fn () => maps_delete($user, ['id' => $map['id'], 'force_version' => true]),
            'validation_error',
            400
        );

        try {
            maps_delete($user, [
                'id' => $map['id'],
                'base_version' => 1,
                'force_version' => true,
            ]);
            $this->fail('Expected ConflictException');
        } catch (\ConflictException $e) {
            $this->assertSame('conflict', $e->errorCode);
            $this->assertSame(409, $e->status);
        }
    }

    public function testE2e006CreateRenameDeleteFlow(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Workspace Map'])['map'];
        $this->assertFalse($map['is_published']);
        $listed = maps_list($user)['maps'];
        $this->assertCount(1, $listed);
        $renamed = maps_update($user, [
            'id' => $map['id'],
            'name' => 'Renamed Map',
            'base_version' => $map['version'],
        ])['map'];
        $this->assertSame('Renamed Map', $renamed['name']);
        maps_delete($user, ['id' => $map['id'], 'base_version' => $renamed['version']]);
        $this->assertSame([], maps_list($user)['maps']);
    }
}
