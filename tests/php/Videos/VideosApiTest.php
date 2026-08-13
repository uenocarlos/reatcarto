<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Videos;

use Reatcarto\Tests\MapsTestCase;

final class VideosApiTest extends MapsTestCase
{
    private function makeMp4TempFile(int $sizeBytes = 1024): string
    {
        $path = tempnam(sys_get_temp_dir(), 'video');
        $ftyp = hex2bin('000000186674797069736f6d0000020069736f6d69736f326d703431') ?: '';
        $padding = max(0, $sizeBytes - strlen($ftyp));
        file_put_contents($path, $ftyp . str_repeat("\0", $padding));

        return $path;
    }

    /**
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function uploadVideo(array $user, string $elementId, int $sizeBytes = 1024): array
    {
        $path = $this->makeMp4TempFile($sizeBytes);
        $_FILES = [
            'file' => [
                'name' => 'clip.mp4',
                'type' => 'video/mp4',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $result = videos_upload($user, $_FILES, ['element_id' => $elementId]);

        return [$result, $result['video']];
    }

    public function testUploadSuccessListsVideoWithMapContext(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user, ['name' => 'Porto']);
        $element = $this->createElementForMap($user, $map['id'], ['name' => 'Doca']);
        [, $video] = $this->uploadVideo($user, $element['id']);

        $this->assertNotEmpty($video['id']);
        $this->assertSame('video/mp4', $video['content_type']);
        $this->assertSame('/php/videos/get.php?id=' . urlencode($video['id']), $video['url']);

        $list = videos_list_for_user($user);
        $this->assertSame(1, $list['pagination']['total']);
        $this->assertSame($video['id'], $list['videos'][0]['id']);
        $this->assertSame('Doca', $list['videos'][0]['element_name']);
        $this->assertSame('Porto', $list['videos'][0]['map_name']);
        $this->assertCount(1, videos_for_element($element['id']));
    }

    public function testRejectsOversizedVideo(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);

        $this->expectAuthException(
            fn () => $this->uploadVideo($user, $element['id'], MAX_VIDEO_BYTES + 1),
            'payload_too_large',
            400
        );
        $this->assertSame([], videos_list_for_user($user)['videos']);
    }

    public function testRejectsUnsupportedType(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        $path = tempnam(sys_get_temp_dir(), 'video');
        file_put_contents($path, 'not-a-video');
        $_FILES = [
            'file' => [
                'name' => 'clip.txt',
                'type' => 'text/plain',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];

        $this->expectAuthException(
            fn () => videos_upload($user, $_FILES, ['element_id' => $element['id']]),
            'validation_error',
            400
        );
    }

    public function testNonOwnerCannotDelete(): void
    {
        $owner = $this->activeSessionUser();
        $map = $this->createMapForUser($owner);
        $element = $this->createElementForMap($owner, $map['id']);
        [, $video] = $this->uploadVideo($owner, $element['id']);

        $other = $this->activeSessionUser();
        $this->expectAuthException(
            fn () => videos_delete($other, ['id' => $video['id'], 'base_version' => $video['version']]),
            'forbidden',
            403
        );

        register_session_for_user($owner['id'], 'field');
        $this->assertCount(1, videos_list_for_user($owner)['videos']);
    }

    public function testDeleteRemovesVideoFromListAndElement(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        [, $video] = $this->uploadVideo($user, $element['id']);

        videos_delete($user, ['id' => $video['id'], 'base_version' => $video['version']]);

        $this->assertSame([], videos_list_for_user($user)['videos']);
        $this->assertSame([], videos_for_element($element['id']));
    }

    public function testFormatElementIncludesVideos(): void
    {
        $user = $this->activeSessionUser();
        $map = $this->createMapForUser($user);
        $element = $this->createElementForMap($user, $map['id']);
        [, $video] = $this->uploadVideo($user, $element['id']);

        $row = fetch_element_by_id($element['id']);
        $formatted = format_element_record($row, []);
        $this->assertCount(1, $formatted['videos']);
        $this->assertSame($video['id'], $formatted['videos'][0]['id']);
    }
}
