<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Photos;

use Reatcarto\Tests\MapsTestCase;

final class PhotosApiTest extends MapsTestCase
{
    /**
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function uploadPhoto(array $user, string $elementId, int $sizeBytes = 1024): array
    {
        $path = $this->makeJpegTempFile($sizeBytes);
        $_FILES = [
            'file' => [
                'name' => 'photo.jpg',
                'type' => 'image/jpeg',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $result = photos_upload($user, $_FILES, ['element_id' => $elementId]);

        return [$result, $result['photo']];
    }

    public function testListReturnsOwnerPhotosWithMapContext(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Baía']);
        $element = $this->createElementForMap($user, $map['id'], ['name' => 'Farol']);
        [, $photo] = $this->uploadPhoto($user, $element['id']);

        $list = photos_list_for_user($user);
        $this->assertSame(1, $list['pagination']['total']);
        $this->assertCount(1, $list['photos']);
        $this->assertSame($photo['id'], $list['photos'][0]['id']);
        $this->assertSame('Farol', $list['photos'][0]['element_name']);
        $this->assertSame('Baía', $list['photos'][0]['map_name']);
        $this->assertSame($map['id'], $list['photos'][0]['map_id']);
        $this->assertSame($element['id'], $list['photos'][0]['element_id']);
        $this->assertSame('/php/photos/get.php?id=' . urlencode($photo['id']), $list['photos'][0]['url']);
    }

    public function testListDoesNotLeakOtherUsersPhotos(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $element = $this->createElementForMap($owner, $map['id']);
        $this->uploadPhoto($owner, $element['id']);

        $other = $this->activeSessionUser();
        $list = photos_list_for_user($other);
        $this->assertSame(0, $list['pagination']['total']);
        $this->assertSame([], $list['photos']);
    }

    public function testDeleteFromListRemovesPhoto(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        [, $photo] = $this->uploadPhoto($user, $element['id']);

        photos_delete($user, ['id' => $photo['id'], 'base_version' => $photo['version']]);

        $list = photos_list_for_user($user);
        $this->assertSame([], $list['photos']);
        $this->assertSame(0, $list['pagination']['total']);
    }
}
