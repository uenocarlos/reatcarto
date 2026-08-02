<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Sync;

use Reatcarto\Tests\MapsTestCase;

final class SyncResolveTest extends MapsTestCase
{
    /**
     * @return array<string, mixed>
     */
    private function seedMapUpdateConflict(
        array $user,
        array $map,
        string $clientMutationId,
        string $localName
    ): array {
        $staleVersion = $map['version'];

        maps_update($user, [
            'id' => $map['id'],
            'name' => 'Remote Name',
            'base_version' => $staleVersion,
        ]);

        $push = sync_push($user, [
            [
                'client_mutation_id' => $clientMutationId,
                'resource_type' => 'map',
                'op' => 'update',
                'resource_id' => $map['id'],
                'base_version' => $staleVersion,
                'payload' => ['name' => $localName],
            ],
        ]);

        $this->assertSame('conflict', $push['results'][0]['status']);

        return $push['results'][0];
    }

    /**
     * @return array<string, mixed>
     */
    private function seedElementUpdateConflict(
        array $user,
        array $element,
        string $clientMutationId,
        string $localName
    ): array {
        $staleVersion = $element['version'];

        elements_update($user, [
            'id' => $element['id'],
            'name' => 'Remote Element Name',
            'base_version' => $staleVersion,
        ]);

        $push = sync_push($user, [
            [
                'client_mutation_id' => $clientMutationId,
                'resource_type' => 'element',
                'op' => 'update',
                'resource_id' => $element['id'],
                'base_version' => $staleVersion,
                'payload' => ['name' => $localName],
            ],
        ]);

        $this->assertSame('conflict', $push['results'][0]['status']);

        return $push['results'][0];
    }

    public function testRemoteChoiceReturnsOwnMap(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Original Map']);
        $mid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        $this->seedMapUpdateConflict($user, $map, $mid, 'Local Map Name');

        $result = sync_resolve($user, [
            'client_mutation_id' => $mid,
            'choice' => 'remote',
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame('map', $result['resource_type']);
        $this->assertSame('Remote Name', $result['resource']['name']);
    }

    public function testRemoteChoiceReturnsOwnElement(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id'], ['name' => 'Original Element']);
        $mid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        $this->seedElementUpdateConflict($user, $element, $mid, 'Local Element Name');

        $result = sync_resolve($user, [
            'client_mutation_id' => $mid,
            'choice' => 'remote',
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame('element', $result['resource_type']);
        $this->assertSame('Remote Element Name', $result['resource']['name']);
    }

    public function testRemoteChoiceDeniesOtherUserMap(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner, ['name' => 'Secret Map']);
        $mid = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        $this->seedMapUpdateConflict($owner, $map, $mid, 'Owner Local Name');
        $other = $this->activateUser();

        $this->expectAuthException(
            fn () => sync_resolve($other, [
                'client_mutation_id' => $mid,
                'choice' => 'remote',
            ]),
            'not_found',
            404
        );
    }

    public function testRemoteChoiceDeniesOtherUserElement(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $element = $this->createElementForMap($owner, $map['id'], ['name' => 'Secret Element']);
        $mid = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
        $this->seedElementUpdateConflict($owner, $element, $mid, 'Owner Local Name');
        $other = $this->activateUser();

        $this->expectAuthException(
            fn () => sync_resolve($other, [
                'client_mutation_id' => $mid,
                'choice' => 'remote',
            ]),
            'not_found',
            404
        );
    }

    public function testLocalChoiceAppliesMapUpdateWithStaleBaseVersion(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Original']);
        $mid = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        $this->seedMapUpdateConflict($user, $map, $mid, 'Local Name');

        $result = sync_resolve($user, [
            'client_mutation_id' => $mid,
            'choice' => 'local',
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame('map', $result['resource_type']);
        $this->assertSame('Local Name', $result['resource']['name']);
    }

    public function testLocalChoiceWithoutPriorConflictFails(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Original']);

        $this->expectAuthException(
            fn () => sync_resolve($user, [
                'client_mutation_id' => 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                'choice' => 'local',
                'resource_type' => 'map',
                'op' => 'update',
                'resource_id' => $map['id'],
                'mutation' => [
                    'resource_type' => 'map',
                    'op' => 'update',
                    'resource_id' => $map['id'],
                    'payload' => ['name' => 'Force Write'],
                ],
            ]),
            'not_found',
            404
        );
    }

    public function testResolveAfterConflictAlreadyResolvedFails(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Original']);
        $mid = '11111111-2222-3333-4444-555555555555';
        $this->seedMapUpdateConflict($user, $map, $mid, 'Local Name');

        sync_resolve($user, [
            'client_mutation_id' => $mid,
            'choice' => 'local',
        ]);

        $this->expectAuthException(
            fn () => sync_resolve($user, [
                'client_mutation_id' => $mid,
                'choice' => 'local',
            ]),
            'conflict',
            409
        );
    }
}
