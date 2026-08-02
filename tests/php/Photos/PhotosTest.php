<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Photos;

use AuthException;
use Reatcarto\Tests\MapsTestCase;

final class PhotosTest extends MapsTestCase
{
    private function uploadFixture(array $user, string $elementId, int $size = 1024, string $mime = 'image/jpeg'): array
    {
        $path = $this->makeJpegTempFile($size);
        $_FILES = [
            'file' => [
                'name' => 'photo.jpg',
                'type' => $mime,
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        return photos_upload($user, $_FILES, ['element_id' => $elementId]);
    }

    public function testUt064UploadJpeg(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $result = $this->uploadFixture($user, $el['id']);
        $this->assertNotEmpty($result['photo']['id']);
        $photos = photos_for_element($el['id']);
        $this->assertCount(1, $photos);
    }

    public function testUt065DeleteRemovesPhoto(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $photo = $this->uploadFixture($user, $el['id'])['photo'];
        photos_delete($user, ['id' => $photo['id']]);
        $stmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE id = :id');
        $stmt->execute(['id' => $photo['id']]);
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    public function testUt067RejectUnsupportedType(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $path = tempnam(sys_get_temp_dir(), 'exe');
        file_put_contents($path, 'MZ');
        $_FILES = [
            'file' => [
                'name' => 'bad.exe',
                'type' => 'application/octet-stream',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];
        $this->expectAuthException(
            fn () => photos_upload($user, $_FILES, ['element_id' => $el['id']]),
            'validation_error',
            400
        );
        $this->assertSame(0, count(photos_for_element($el['id'])));
    }

    public function testUt068EmptyUploadRejected(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $_FILES = [
            'file' => [
                'name' => '',
                'type' => '',
                'tmp_name' => '',
                'error' => UPLOAD_ERR_NO_FILE,
                'size' => 0,
            ],
        ];
        $this->expectAuthException(
            fn () => photos_upload($user, $_FILES, ['element_id' => $el['id']]),
            'validation_error',
            400
        );
    }

    public function testUt069PhotoCountAndSizeLimits(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        for ($i = 0; $i < PHOTOS_PER_ELEMENT; $i++) {
            $this->uploadFixture($user, $el['id']);
        }
        $path = $this->makeJpegTempFile();
        $_FILES = [
            'file' => [
                'name' => 'extra.jpg',
                'type' => 'image/jpeg',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];
        $this->expectAuthException(
            fn () => photos_upload($user, $_FILES, ['element_id' => $el['id']]),
            'payload_too_large',
            400
        );
        $big = $this->makeJpegTempFile(MAX_PHOTO_BYTES + 1);
        $_FILES['file']['tmp_name'] = $big;
        $_FILES['file']['size'] = filesize($big);
        $this->expectAuthException(
            fn () => photos_upload($user, $_FILES, ['element_id' => $el['id']]),
            'payload_too_large',
            400
        );
    }

    public function testUt171AnonymousPhotoGetDenied(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $photo = $this->uploadFixture($user, $el['id'])['photo'];
        $this->expectAuthException(fn () => photos_serve(null, $photo['id']), 'forbidden', 403);
    }

    public function testIt039PhotoDeleteConflict(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $photo = $this->uploadFixture($user, $el['id'])['photo'];
        try {
            photos_delete($user, ['id' => $photo['id'], 'base_version' => 99]);
            $this->fail('Expected ConflictException');
        } catch (\ConflictException $e) {
            $this->assertSame('conflict', $e->errorCode);
        }
    }

    public function testIt041UploadIdempotency(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $cid = sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
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
        $first = photos_upload($user, $_FILES, ['element_id' => $el['id'], 'client_mutation_id' => $cid])['photo'];
        $second = photos_upload($user, $_FILES, ['element_id' => $el['id'], 'client_mutation_id' => $cid])['photo'];
        $this->assertSame($first['id'], $second['id']);
        $stmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE element_id = :id');
        $stmt->execute(['id' => $el['id']]);
        $this->assertSame(1, (int) $stmt->fetchColumn());
    }

    public function testIt042ElementDeletedMidUploadNoOrphan(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        elements_delete($user, ['id' => $el['id'], 'base_version' => $el['version']]);
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
        $this->expectAuthException(
            fn () => photos_upload($user, $_FILES, ['element_id' => $el['id']]),
            'not_found',
            404
        );
    }

    public function testIt040PartialUploadDoesNotPersistRow(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $path = $this->makeJpegTempFile();
        $_FILES = [
            'file' => [
                'name' => 'photo.jpg',
                'type' => 'image/jpeg',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_PARTIAL,
                'size' => filesize($path),
            ],
        ];
        $this->expectAuthException(
            fn () => photos_upload($user, $_FILES, ['element_id' => $el['id']]),
            'validation_error',
            400
        );
        $this->assertSame(0, count(photos_for_element($el['id'])));
    }

    public function testIt043ManyPhotosListed(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        for ($i = 0; $i < 5; $i++) {
            $this->uploadFixture($user, $el['id']);
        }
        $photos = photos_for_element($el['id']);
        $this->assertCount(5, $photos);
        foreach ($photos as $photo) {
            $this->assertTrue(photo_can_read($user, fetch_photo_by_id($photo['id'])));
        }
    }
}
