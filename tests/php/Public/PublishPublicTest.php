<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Public;

use AuthException;
use Reatcarto\Tests\MapsTestCase;

final class PublishPublicTest extends MapsTestCase
{
    private function uploadFixture(array $user, string $elementId): array
    {
        $path = $this->makeJpegTempFile();
        $_FILES = [
            'file' => [
                'name' => 'photo.jpg',
                'type' => 'image/jpeg',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        return photos_upload($user, $_FILES, ['element_id' => $elementId])['photo'];
    }

    private function publishMap(array $user, string $mapId, bool $confirmEmpty = false): array
    {
        $payload = ['id' => $mapId];
        if ($confirmEmpty) {
            $payload['confirm_empty'] = true;
        }

        return maps_publish($user, $payload)['map'];
    }

    private function publishedMapWithElement(?array $user = null): array
    {
        $user ??= $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Public Field Map', 'description' => 'Visible work']);
        $el = $this->createElementForMap($user, $map['id']);
        $published = $this->publishMap($user, $map['id']);

        return ['user' => $user, 'map' => $published, 'element' => $el];
    }

    public function testUt106PublishMakesMapPublic(): void
    {
        $ctx = $this->publishedMapWithElement();
        $this->assertTrue($ctx['map']['is_published']);
        $result = public_map_get($ctx['map']['public_id']);
        $this->assertSame($ctx['map']['public_id'], $result['map']['public_id']);
    }

    public function testUt107UnpublishHidesFromPublic(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->publishedMapWithElement($user)['map'];
        maps_unpublish($user, ['id' => $map['id']]);
        $list = public_maps_list();
        $this->assertSame([], $list['maps']);
        $this->expectAuthException(fn () => public_map_get($map['public_id']), 'not_found', 404);
    }

    public function testUt108NewMapDefaultsPrivate(): void
    {
        $user = $this->activeSessionUser();
        $map = maps_create($user, ['name' => 'Private default'])['map'];
        $this->assertFalse($map['is_published']);
    }

    public function testUt109NonOwnerPublishForbidden(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $this->createElementForMap($owner, $map['id']);
        $other = $this->activateUser();
        register_session_for_user($other['id'], 'field');
        $this->expectAuthException(
            fn () => maps_publish($other, ['id' => $map['id']]),
            'forbidden',
            403
        );
    }

    public function testUt110InvalidNameBlocksPublish(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Valid']);
        db()->prepare('UPDATE maps SET name = :name WHERE id = :id')->execute(['name' => '   ', 'id' => $map['id']]);
        $this->expectAuthException(
            fn () => maps_publish($user, ['id' => $map['id']]),
            'validation_error',
            400
        );
    }

    public function testUt111EmptyMapRequiresConfirm(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Empty map']);
        $this->expectAuthException(
            fn () => maps_publish($user, ['id' => $map['id']]),
            'confirmation_required',
            400
        );
        $published = $this->publishMap($user, $map['id'], true);
        $this->assertTrue($published['is_published']);
    }

    public function testUt112OverlongDescriptionBlocksPublish(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Long desc']);
        $this->createElementForMap($user, $map['id']);
        db()->prepare('UPDATE maps SET description = :description WHERE id = :id')->execute([
            'description' => str_repeat('x', MAX_TEXT_LENGTH + 1),
            'id' => $map['id'],
        ]);
        $this->expectAuthException(
            fn () => maps_publish($user, ['id' => $map['id']]),
            'validation_error',
            400
        );
    }

    public function testUt066PublicPhotoWhenPublished(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $photo = $this->uploadFixture($user, $el['id']);
        $published = $this->publishMap($user, $map['id']);
        $row = fetch_photo_by_id($photo['id']);
        $this->assertNotNull($row);
        $this->assertTrue(photo_can_read(null, $row));
        $this->assertSame($published['public_id'], public_map_get($published['public_id'])['map']['public_id']);
    }

    public function testUt114PublicListOnlyPublishedActive(): void
    {
        $owner = $this->activeSessionUser();
        $pub = $this->publishedMapWithElement($owner);
        $private = $this->createMapForUser($owner, ['name' => 'Secret']);
        $this->createElementForMap($owner, $private['id']);

        $other = $this->activateUser();
        $hidden = $this->publishedMapWithElement($other);
        auth_deactivate_user($other['id']);

        $list = public_maps_list();
        $this->assertCount(1, $list['maps']);
        $this->assertSame($pub['map']['public_id'], $list['maps'][0]['public_id']);
    }

    public function testUt115SearchMatchesAndExcludesPrivate(): void
    {
        $user = $this->activeSessionUser();
        $pub = $this->publishedMapWithElement($user);
        maps_update($user, [
            'id' => $pub['map']['id'],
            'description' => 'Rio Grande survey',
            'base_version' => $pub['map']['version'],
        ]);
        $private = $this->createMapForUser($user, ['name' => 'Rio Grande private', 'description' => 'Rio Grande survey']);
        $this->createElementForMap($user, $private['id']);

        $results = public_maps_list('Rio Grande');
        $ids = array_column($results['maps'], 'public_id');
        $this->assertContains($pub['map']['public_id'], $ids);
        $this->assertNotContains($private['public_id'], $ids);
    }

    public function testUt116EmptySearchStableShape(): void
    {
        $results = public_maps_list('zzzz-no-match-' . bin2hex(random_bytes(4)));
        $this->assertSame([], $results['maps']);
        $this->assertArrayHasKey('pagination', $results);
        $this->assertSame(0, $results['pagination']['total']);
    }

    public function testUt117HostileSearchLiteralNoXss(): void
    {
        $user = $this->activeSessionUser();
        $this->publishedMapWithElement($user);
        $hostile = '<script>alert(1)</script>';
        $results = public_maps_list($hostile);
        $encoded = json_encode($results, JSON_UNESCAPED_UNICODE);
        $this->assertIsString($encoded);
        $this->assertStringNotContainsString('<script>', $encoded);
        $this->assertSame([], $results['maps']);
    }

    public function testUt118EmptyQueryReturnsDefaultPage(): void
    {
        $user = $this->activeSessionUser();
        $this->publishedMapWithElement($user);
        $results = public_maps_list('');
        $this->assertGreaterThanOrEqual(1, count($results['maps']));
    }

    public function testUt119OverlongQueryAndPageSizeCapped(): void
    {
        $this->expectAuthException(
            fn () => public_maps_list(str_repeat('q', MAX_SEARCH_QUERY_LENGTH + 1)),
            'validation_error',
            400
        );
        $results = public_maps_list(null, 1, 500);
        $this->assertSame(MAX_PAGE_SIZE, $results['pagination']['page_size']);
    }

    public function testUt122PublicMapAndElementsReadOnly(): void
    {
        $ctx = $this->publishedMapWithElement();
        $map = public_map_get($ctx['map']['public_id'])['map'];
        $this->assertArrayNotHasKey('owner_id', $map);
        $elements = public_elements_list($ctx['map']['public_id'])['elements'];
        $this->assertCount(1, $elements);
        $this->assertNotEmpty($elements[0]['geojson']);
    }

    public function testUt124UnpublishedModeratedDeleted404(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        $publicId = $ctx['map']['public_id'];

        maps_unpublish($user, ['id' => $ctx['map']['id']]);
        $this->expectAuthException(fn () => public_map_get($publicId), 'not_found', 404);

        $ctx2 = $this->publishedMapWithElement($user);
        db()->prepare('UPDATE maps SET moderated_at = NOW() WHERE id = :id')->execute(['id' => $ctx2['map']['id']]);
        $this->expectAuthException(fn () => public_map_get($ctx2['map']['public_id']), 'not_found', 404);

        $ctx3 = $this->publishedMapWithElement($user);
        maps_delete($user, ['id' => $ctx3['map']['id'], 'base_version' => $ctx3['map']['version']]);
        $this->expectAuthException(fn () => public_map_get($ctx3['map']['public_id']), 'not_found', 404);
    }

    public function testUt125MalformedPublicId404(): void
    {
        $this->expectAuthException(fn () => public_map_get('not-a-valid-id'), 'not_found', 404);
    }

    public function testUt126PublishedEmptyMap200(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->publishMap($user, $this->createMapForUser($user, ['name' => 'Empty public'])['id'], true);
        $elements = public_elements_list($map['public_id'])['elements'];
        $this->assertSame([], $elements);
    }

    public function testUt128PublicGetIdempotent(): void
    {
        $ctx = $this->publishedMapWithElement();
        $first = public_map_get($ctx['map']['public_id']);
        $second = public_map_get($ctx['map']['public_id']);
        $this->assertSame($first, $second);
    }

    public function testIt038PhotoAuthzAnonymousOnlyIfPublic(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $photo = $this->uploadFixture($user, $el['id']);
        $this->expectAuthException(fn () => photos_serve(null, $photo['id']), 'forbidden', 403);
        $this->publishMap($user, $map['id']);
        $row = fetch_photo_by_id($photo['id']);
        $this->assertTrue(photo_can_read(null, $row));
    }

    public function testIt051AnonymousPendingDeactivatedNonOwnerDenied(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $this->createElementForMap($owner, $map['id']);

        $_SESSION = [];
        $this->expectAuthException(fn () => require_active_user(), 'unauthenticated', 401);

        $pending = $this->registerUser();
        register_session_for_user($pending['id'], 'field');
        $this->expectAuthException(fn () => require_active_user(), 'account_pending', 403);

        $deactivated = $this->activateUser();
        auth_deactivate_user($deactivated['id']);
        register_session_for_user($deactivated['id'], 'field');
        $this->expectAuthException(fn () => require_active_user(), 'account_deactivated', 403);

        $other = $this->activateUser();
        register_session_for_user($other['id'], 'field');
        $this->expectAuthException(fn () => maps_publish($other, ['id' => $map['id']]), 'forbidden', 403);
    }

    public function testIt052PublishUnpublishRaceFinalState(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->createElementForMap($user, $map['id']);
        maps_publish($user, ['id' => $map['id']]);
        maps_unpublish($user, ['id' => $map['id']]);
        $row = fetch_map_by_id($map['id']);
        $this->assertFalse((bool) $row['is_published']);
        $this->assertSame(0, public_maps_list()['pagination']['total']);
    }

    public function testIt053RetryPublishIdempotent(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->createElementForMap($user, $map['id']);
        $cid = bin2hex(random_bytes(16));
        maps_publish($user, ['id' => $map['id'], 'client_mutation_id' => $cid]);
        maps_publish($user, ['id' => $map['id'], 'client_mutation_id' => $cid]);
        $list = public_maps_list();
        $matches = array_filter($list['maps'], fn ($m) => $m['public_id'] === $map['public_id']);
        $this->assertCount(1, $matches);
    }

    public function testIt054PublicLinkBeforePublish404(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->expectAuthException(fn () => public_map_get($map['public_id']), 'not_found', 404);
    }

    public function testIt055OwnerDeactivatedOrDeletedPublic404(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        auth_deactivate_user($user['id']);
        $this->expectAuthException(fn () => public_map_get($ctx['map']['public_id']), 'not_found', 404);

        $user2 = $this->activateUser();
        $ctx2 = $this->publishedMapWithElement($user2);
        register_session_for_user($user2['id'], 'field');
        maps_delete($user2, ['id' => $ctx2['map']['id'], 'base_version' => $ctx2['map']['version']]);
        $this->expectAuthException(fn () => public_map_get($ctx2['map']['public_id']), 'not_found', 404);
    }

    public function testIt057PrivateNeverInPublicList(): void
    {
        $user = $this->activeSessionUser();
        $private = $this->createMapForUser($user, ['name' => 'Hidden']);
        $this->createElementForMap($user, $private['id']);
        $list = public_maps_list();
        foreach ($list['maps'] as $item) {
            $this->assertNotSame($private['public_id'], $item['public_id']);
        }
    }

    public function testIt058UnpublishRecheck404(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        public_map_get($ctx['map']['public_id']);
        maps_unpublish($user, ['id' => $ctx['map']['id']]);
        $this->expectAuthException(fn () => public_map_get($ctx['map']['public_id']), 'not_found', 404);
    }

    public function testIt059DirectPublicRouteWithoutGallery(): void
    {
        $ctx = $this->publishedMapWithElement();
        $map = public_map_get($ctx['map']['public_id'])['map'];
        $this->assertSame($ctx['map']['name'], $map['name']);
    }

    public function testIt060ModeratedInStaleListUnavailable(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        db()->prepare('UPDATE maps SET moderated_at = NOW() WHERE id = :id')->execute(['id' => $ctx['map']['id']]);
        $this->expectAuthException(fn () => public_map_get($ctx['map']['public_id']), 'not_found', 404);
    }

    public function testIt061HundredPublicMapsPagination(): void
    {
        $user = $this->activeSessionUser();
        for ($i = 0; $i < 100; $i++) {
            $map = $this->createMapForUser($user, ['name' => "Public {$i}"]);
            $this->createElementForMap($user, $map['id'], ['name' => "El {$i}"]);
            $this->publishMap($user, $map['id']);
        }
        $page1 = public_maps_list(null, 1, 50);
        $page2 = public_maps_list(null, 2, 50);
        $this->assertCount(50, $page1['maps']);
        $this->assertCount(50, $page2['maps']);
        $this->assertSame(100, $page1['pagination']['total']);
    }

    public function testIt062DenseGeometryPaginated(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        for ($i = 0; $i < 60; $i++) {
            $this->createElementForMap($user, $map['id'], ['name' => "Point {$i}"]);
        }
        $published = $this->publishMap($user, $map['id']);
        $page1 = public_elements_list($published['public_id'], 1, 50);
        $page2 = public_elements_list($published['public_id'], 2, 50);
        $this->assertCount(50, $page1['elements']);
        $this->assertCount(10, $page2['elements']);
    }

    public function testIt063AnonymousMutateDenied(): void
    {
        $_SESSION = [];
        $this->expectAuthException(fn () => require_active_user(), 'unauthenticated', 401);
    }

    public function testIt064OwnerUpdateVisibleOnRefresh(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        elements_update($user, ['id' => $ctx['element']['id'], 'name' => 'Updated label', 'base_version' => $ctx['element']['version']]);
        $elements = public_elements_list($ctx['map']['public_id'])['elements'];
        $this->assertSame('Updated label', $elements[0]['name']);
    }

    public function testIt065ElementListChecksMapVisibility(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $this->createElementForMap($user, $map['id']);
        $this->expectAuthException(fn () => public_elements_list($map['public_id']), 'not_found', 404);
    }

    public function testIt066UnpublishDuringViewSubsequent404(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        public_elements_list($ctx['map']['public_id']);
        maps_unpublish($user, ['id' => $ctx['map']['id']]);
        $this->expectAuthException(fn () => public_elements_list($ctx['map']['public_id']), 'not_found', 404);
    }

    public function testIt094PublicMapContract(): void
    {
        $ctx = $this->publishedMapWithElement();
        public_map_get($ctx['map']['public_id']);
        maps_unpublish($ctx['user'], ['id' => $ctx['map']['id']]);
        $this->expectAuthException(fn () => public_map_get($ctx['map']['public_id']), 'not_found', 404);

        $user = $this->activeSessionUser();
        $moderated = $this->publishedMapWithElement($user);
        db()->prepare('UPDATE maps SET moderated_at = NOW() WHERE id = :id')->execute(['id' => $moderated['map']['id']]);
        $this->expectAuthException(fn () => public_map_get($moderated['map']['public_id']), 'not_found', 404);
    }

    public function testE2e008PhotoThroughPublishFlow(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $photo = $this->uploadFixture($user, $el['id']);
        $this->expectAuthException(fn () => photos_serve(null, $photo['id']), 'forbidden', 403);
        $published = $this->publishMap($user, $map['id']);
        public_map_get($published['public_id']);
        $row = fetch_photo_by_id($photo['id']);
        $this->assertTrue(photo_can_read(null, $row));
        photos_delete($user, ['id' => $photo['id']]);
        $this->expectAuthException(fn () => photos_serve(null, $photo['id']), 'not_found', 404);
    }

    public function testE2e012PublishGalleryUnpublishUnavailable(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        $list = public_maps_list();
        $this->assertNotEmpty($list['maps']);
        maps_unpublish($user, ['id' => $ctx['map']['id']]);
        $this->assertSame([], public_maps_list()['maps']);
        $this->expectAuthException(fn () => public_map_get($ctx['map']['public_id']), 'not_found', 404);
    }

    public function testE2e013GallerySearchOpenResult(): void
    {
        $user = $this->activeSessionUser();
        $ctx = $this->publishedMapWithElement($user);
        maps_update($user, [
            'id' => $ctx['map']['id'],
            'name' => 'Searchable Coast Map',
            'base_version' => $ctx['map']['version'],
        ]);
        $results = public_maps_list('Coast');
        $this->assertCount(1, $results['maps']);
        $opened = public_map_get($results['maps'][0]['public_id']);
        $this->assertSame('Searchable Coast Map', $opened['map']['name']);
    }

    public function testE2e014AnonymousInspectElementsNoMutation(): void
    {
        $ctx = $this->publishedMapWithElement();
        $before = (int) db()->query('SELECT COUNT(*) FROM map_elements')->fetchColumn();
        public_map_get($ctx['map']['public_id']);
        public_elements_list($ctx['map']['public_id']);
        public_map_get($ctx['map']['public_id']);
        $after = (int) db()->query('SELECT COUNT(*) FROM map_elements')->fetchColumn();
        $this->assertSame($before, $after);
    }
}
