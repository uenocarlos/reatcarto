<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Icons;

use Reatcarto\Tests\MapsTestCase;

final class IconsApiTest extends MapsTestCase
{
    private function minimalPngBytes(): string
    {
        $decoded = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            true
        );

        return $decoded !== false ? $decoded : '';
    }

    private function makePngTempFile(int $sizeBytes = 128): string
    {
        $path = tempnam(sys_get_temp_dir(), 'icon');
        $png = $this->minimalPngBytes();
        $payload = $png . str_repeat("\0", max(0, $sizeBytes - strlen($png)));
        file_put_contents($path, substr($payload, 0, max(strlen($png), $sizeBytes)));

        return $path;
    }

    /**
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function uploadIcon(array $user, array $input = [], int $sizeBytes = 128): array
    {
        $path = $this->makePngTempFile($sizeBytes);
        $_FILES = [
            'file' => [
                'name' => 'icon.png',
                'type' => 'image/png',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $result = icons_upload($user, $_FILES, $input);

        return [$result, $result['icon']];
    }

    public function testIt001UploadSuccessListsIcon(): void
    {
        $user = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($user, ['name' => 'Farol']);

        $this->assertNotEmpty($icon['id']);
        $this->assertSame('Farol', $icon['name']);
        $this->assertSame('/php/icons/get.php?id=' . rawurlencode($icon['id']), $icon['url']);
        $this->assertSame('image/png', $icon['content_type']);

        $list = icons_list($user);
        $this->assertCount(1, $list);
        $this->assertSame($icon['id'], $list[0]['id']);
    }

    public function testIt002RejectsOversizedPng(): void
    {
        $user = $this->activeSessionUser();
        $path = $this->makePngTempFile(MAX_ICON_BYTES + 1);
        $_FILES = [
            'file' => [
                'name' => 'big.png',
                'type' => 'image/png',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $this->expectAuthException(
            fn () => icons_upload($user, $_FILES, ['name' => 'Big']),
            'payload_too_large',
            400
        );
        $this->assertSame([], icons_list($user));
    }

    public function testIt003StorageFailureLeavesNoRow(): void
    {
        $user = $this->activeSessionUser();
        // Occupy the icons/ path as a file so nested mkdir cannot store the PNG.
        $iconsPath = $this->uploadsDir . DIRECTORY_SEPARATOR . 'icons';
        file_put_contents($iconsPath, 'blocked');

        $path = $this->makePngTempFile();
        $_FILES = [
            'file' => [
                'name' => 'icon.png',
                'type' => 'image/png',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $this->expectAuthException(
            fn () => icons_upload($user, $_FILES, ['name' => 'Fail']),
            'validation_error',
            500
        );

        $stmt = db()->prepare('SELECT COUNT(*) FROM user_icons WHERE user_id = :uid');
        $stmt->execute(['uid' => $user['id']]);
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    public function testIt004UnauthenticatedUploadRejected(): void
    {
        $_SESSION = [];
        $this->expectAuthException(fn () => require_active_user(), 'unauthenticated', 401);

        $stmt = db()->query('SELECT COUNT(*) FROM user_icons');
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    public function testIt005ClientMutationIdIdempotent(): void
    {
        $user = $this->activeSessionUser();
        $cid = sprintf(
            '%s-%s-%s-%s-%s',
            bin2hex(random_bytes(4)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(6))
        );

        [, $first] = $this->uploadIcon($user, ['name' => 'Farol', 'client_mutation_id' => $cid]);
        [, $second] = $this->uploadIcon($user, ['name' => 'Farol', 'client_mutation_id' => $cid]);

        $this->assertSame($first['id'], $second['id']);
        $stmt = db()->prepare('SELECT COUNT(*) FROM user_icons WHERE user_id = :uid');
        $stmt->execute(['uid' => $user['id']]);
        $this->assertSame(1, (int) $stmt->fetchColumn());
    }

    public function testIt006CrossUserListIsolation(): void
    {
        $userA = $this->activeSessionUser();
        [, $iconA] = $this->uploadIcon($userA, ['name' => 'A']);

        $userB = $this->activeSessionUser();
        $this->uploadIcon($userB, ['name' => 'B']);

        $listA = icons_list($userA);
        $listB = icons_list($userB);
        $this->assertCount(1, $listA);
        $this->assertSame($iconA['id'], $listA[0]['id']);
        $this->assertCount(1, $listB);
        $this->assertNotSame($listA[0]['id'], $listB[0]['id']);
    }

    public function testIt007WhitespaceNameRejected(): void
    {
        $user = $this->activeSessionUser();
        $this->expectAuthException(
            fn () => $this->uploadIcon($user, ['name' => '   ']),
            'validation_error',
            400
        );
        $this->assertSame([], icons_list($user));
    }

    public function testIt008NameTooLongRejected(): void
    {
        $user = $this->activeSessionUser();
        $path = $this->makePngTempFile();
        $_FILES = [
            'file' => [
                'name' => 'icon.png',
                'type' => 'image/png',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $this->expectAuthException(
            fn () => icons_upload($user, $_FILES, ['name' => str_repeat('a', 101)]),
            'validation_error',
            400
        );
        $this->assertSame([], icons_list($user));
    }

    public function testIt009DuplicateNamesAllowed(): void
    {
        $user = $this->activeSessionUser();
        [, $one] = $this->uploadIcon($user, ['name' => 'Farol']);
        [, $two] = $this->uploadIcon($user, ['name' => 'Farol']);
        $list = icons_list($user);
        $this->assertCount(2, $list);
        $this->assertNotSame($one['id'], $two['id']);
        $this->assertSame('Farol', $one['name']);
        $this->assertSame('Farol', $two['name']);
    }

    public function testIt010ElementStylePersistsCustomIconUrl(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        [, $icon] = $this->uploadIcon($user, ['name' => 'Farol']);

        $updated = elements_update($user, [
            'id' => $el['id'],
            'base_version' => $el['version'],
            'style' => [
                'icon_name' => 'pin',
                'custom_icon_url' => $icon['url'],
            ],
        ])['element'];

        $this->assertSame($icon['url'], $updated['style']['custom_icon_url']);

        $reloaded = fetch_element_by_id($el['id']);
        $this->assertNotNull($reloaded);
        $formatted = format_element_record($reloaded, []);
        $this->assertSame($icon['url'], $formatted['style']['custom_icon_url']);
    }

    public function testIt011LargeLibraryList(): void
    {
        $user = $this->activeSessionUser();
        for ($i = 0; $i < 100; $i++) {
            $this->uploadIcon($user, ['name' => 'Icon ' . $i]);
        }
        $list = icons_list($user);
        $this->assertCount(100, $list);
    }

    public function testIt012SoftRemoveHiddenFromListButFetchable(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        [, $icon] = $this->uploadIcon($user, ['name' => 'Keep']);

        elements_update($user, [
            'id' => $el['id'],
            'base_version' => $el['version'],
            'style' => ['custom_icon_url' => $icon['url']],
        ]);

        icons_soft_remove($user, $icon['id']);
        $this->assertSame([], icons_list($user));

        $resolved = icons_resolve_serve($icon['id'], $user, false);
        $this->assertSame('image/png', $resolved['content_type']);
        $this->assertFileExists($resolved['path']);

        $row = fetch_icon_by_id($icon['id']);
        $this->assertNotNull($row);
        $this->assertNotNull($row['library_hidden_at']);
        $this->assertFileExists(icon_storage_path((string) $row['storage_key']));
    }

    public function testIt013FreshListOmitsRemoved(): void
    {
        $user = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($user, ['name' => 'Gone']);
        icons_soft_remove($user, $icon['id']);

        register_session_for_user($user['id'], 'field');
        $this->assertSame([], icons_list($user));
    }

    public function testIt014NonOwnerRemoveForbidden(): void
    {
        $userA = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($userA, ['name' => 'A']);

        $userB = $this->activeSessionUser();
        $this->expectAuthException(
            fn () => icons_soft_remove($userB, $icon['id']),
            'forbidden',
            403
        );

        register_session_for_user($userA['id'], 'field');
        $this->assertCount(1, icons_list($userA));
    }

    public function testIt015RemoveTwiceIdempotent(): void
    {
        $user = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($user, ['name' => 'Twice']);

        $first = icons_soft_remove($user, $icon['id']);
        $second = icons_soft_remove($user, $icon['id']);
        $this->assertTrue($first['removed']);
        $this->assertTrue($second['removed']);
        $this->assertSame([], icons_list($user));
    }

    public function testIt016OwnerGetResolvesPng(): void
    {
        $user = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($user, ['name' => 'Owner']);
        $resolved = icons_resolve_serve($icon['id'], $user, false);
        $this->assertSame('image/png', $resolved['content_type']);
        $this->assertGreaterThan(0, filesize($resolved['path']));
    }

    public function testIt017OtherUserWithoutReferenceDenied(): void
    {
        $userA = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($userA, ['name' => 'Private']);

        $userB = $this->activeSessionUser();
        $this->expectAuthException(
            fn () => icons_resolve_serve($icon['id'], $userB, false),
            'forbidden',
            403
        );
    }

    public function testIt018OtherUserWithReferencingElementAllowed(): void
    {
        $userA = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($userA, ['name' => 'Shared']);

        $userB = $this->activeSessionUser();
        $mapB = $this->createMapForUser($userB);
        $this->createElementForMap($userB, $mapB['id'], [
            'style' => ['custom_icon_url' => $icon['url']],
        ]);

        $resolved = icons_resolve_serve($icon['id'], $userB, false);
        $this->assertSame('image/png', $resolved['content_type']);
    }

    public function testIt019PublicGetWithoutPublicReferenceDenied(): void
    {
        $user = $this->activeSessionUser();
        [, $icon] = $this->uploadIcon($user, ['name' => 'NotPublic']);

        $this->expectAuthException(
            fn () => icons_resolve_serve($icon['id'], null, true),
            'not_found',
            404
        );
    }

    public function testIt020PublicGetWithPublicReferenceAllowedAndUrlRewrite(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        [, $icon] = $this->uploadIcon($user, ['name' => 'Public']);
        $el = $this->createElementForMap($user, $map['id'], [
            'style' => ['custom_icon_url' => $icon['url']],
        ]);

        maps_publish($user, [
            'id' => $map['id'],
            'base_version' => $map['version'],
        ]);

        $resolved = icons_resolve_serve($icon['id'], null, true);
        $this->assertSame('image/png', $resolved['content_type']);

        $row = fetch_element_by_id($el['id']);
        $this->assertNotNull($row);
        $public = format_public_element_record($row, []);
        $this->assertSame(
            '/php/public/icon.php?id=' . rawurlencode($icon['id']),
            $public['style']['custom_icon_url']
        );
    }
}
