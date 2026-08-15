<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Maps;

use Reatcarto\Tests\MapsTestCase;

final class MapsApiTest extends MapsTestCase
{
    public function testCreateAcceptsOpaqueHttpClientMutationId(): void
    {
        $user = $this->activeSessionUser();
        $cid = 'mut-1786753318061-15459cf15e4958';

        $first = maps_create($user, [
            'name' => 'Costa',
            'client_mutation_id' => $cid,
        ]);
        $second = maps_create($user, [
            'name' => 'Costa',
            'client_mutation_id' => $cid,
        ]);

        $this->assertTrue($first['success']);
        $this->assertSame($first['map']['id'], $second['map']['id']);
        $this->assertSame('Costa', $first['map']['name']);

        $stmt = db()->prepare('SELECT COUNT(*) FROM maps WHERE owner_id = :uid');
        $stmt->execute(['uid' => $user['id']]);
        $this->assertSame(1, (int) $stmt->fetchColumn());
    }
}
