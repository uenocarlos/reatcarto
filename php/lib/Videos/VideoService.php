<?php

declare(strict_types=1);

const ALLOWED_VIDEO_TYPES = [
    'video/mp4' => 'mp4',
    'video/webm' => 'webm',
];

function video_storage_path(string $storageKey): string
{
    $root = uploads_root();
    $full = $root . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $storageKey);
    $rootReal = realpath($root);
    $fullReal = realpath($full);
    if ($rootReal === false || $fullReal === false || !str_starts_with($fullReal, $rootReal)) {
        auth_fail('not_found', 'Video not found.', 404);
    }

    return $fullReal;
}

function detect_video_mime(string $path): ?string
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($path);
    if (is_string($mime) && isset(ALLOWED_VIDEO_TYPES[$mime])) {
        return $mime;
    }

    $header = file_get_contents($path, false, null, 0, 64);
    if (!is_string($header) || $header === '') {
        return null;
    }
    if (str_contains($header, 'ftyp')) {
        return 'video/mp4';
    }
    if (str_starts_with($header, "\x1a\x45\xdf\xa3")) {
        return 'video/webm';
    }

    return null;
}

/**
 * @return list<array<string, mixed>>
 */
function videos_for_element(string $elementId): array
{
    $stmt = db()->prepare(
        'SELECT id, content_type, byte_size, version, created_at
         FROM videos WHERE element_id = :element_id ORDER BY created_at ASC'
    );
    $stmt->execute(['element_id' => $elementId]);
    $videos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $videos[] = [
            'id' => (string) $row['id'],
            'content_type' => (string) $row['content_type'],
            'byte_size' => (int) $row['byte_size'],
            'version' => (int) $row['version'],
            'created_at' => (string) $row['created_at'],
            'url' => '/php/videos/get.php?id=' . urlencode((string) $row['id']),
        ];
    }

    return $videos;
}

/**
 * @return list<array<string, mixed>>
 */
function videos_for_element_public(string $elementId): array
{
    $stmt = db()->prepare(
        'SELECT id, content_type, byte_size, version, created_at
         FROM videos WHERE element_id = :element_id ORDER BY created_at ASC'
    );
    $stmt->execute(['element_id' => $elementId]);
    $videos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $videos[] = [
            'id' => (string) $row['id'],
            'content_type' => (string) $row['content_type'],
            'byte_size' => (int) $row['byte_size'],
            'version' => (int) $row['version'],
            'created_at' => (string) $row['created_at'],
            'url' => '/php/public/video.php?id=' . urlencode((string) $row['id']),
        ];
    }

    return $videos;
}

/**
 * @return array<string, mixed>|null
 */
function fetch_video_by_id(string $videoId): ?array
{
    $stmt = db()->prepare(
        'SELECT v.*, e.map_id, e.is_publicly_visible, m.owner_id, m.is_published, m.moderated_at, u.status AS owner_status
         FROM videos v
         JOIN map_elements e ON e.id = v.element_id
         JOIN maps m ON m.id = e.map_id
         JOIN users u ON u.id = m.owner_id
         WHERE v.id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $videoId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

function video_can_read(?array $user, array $video): bool
{
    if ($user !== null && (string) $video['owner_id'] === (string) $user['id']) {
        return true;
    }

    return map_is_public_eligible($video) && element_is_publicly_visible($video);
}

/**
 * @return array{videos: list<array<string, mixed>>, pagination: array<string, int>}
 */
function videos_list_for_user(array $user, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $countStmt = db()->prepare(
        'SELECT COUNT(*) FROM videos v
         JOIN map_elements e ON e.id = v.element_id
         JOIN maps m ON m.id = e.map_id
         WHERE m.owner_id = :user_id'
    );
    $countStmt->execute(['user_id' => $user['id']]);
    $total = (int) $countStmt->fetchColumn();

    $stmt = db()->prepare(
        'SELECT v.id, v.content_type, v.byte_size, v.version, v.created_at, v.element_id,
                e.name AS element_name, e.map_id, m.name AS map_name
         FROM videos v
         JOIN map_elements e ON e.id = v.element_id
         JOIN maps m ON m.id = e.map_id
         WHERE m.owner_id = :user_id
         ORDER BY v.created_at DESC
         LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':user_id', $user['id']);
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $videos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (string) $row['id'];
        $videos[] = [
            'id' => $id,
            'content_type' => (string) $row['content_type'],
            'byte_size' => (int) $row['byte_size'],
            'version' => (int) $row['version'],
            'created_at' => (string) $row['created_at'],
            'url' => '/php/videos/get.php?id=' . urlencode($id),
            'element_id' => (string) $row['element_id'],
            'element_name' => (string) $row['element_name'],
            'map_id' => (string) $row['map_id'],
            'map_name' => (string) $row['map_name'],
        ];
    }

    return [
        'videos' => $videos,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 0,
        ],
    ];
}

function videos_upload(array $user, array $files, array $input): array
{
    $elementId = (string) ($input['element_id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $element = fetch_element_by_id($elementId);
    if ($element === null) {
        auth_fail('not_found', 'Element not found.', 404);
    }
    assert_element_owner($user, $element, false);

    if (!isset($files['file']) || !is_array($files['file'])) {
        auth_fail('validation_error', 'Validation failed.', 400, ['file' => 'Video file is required.']);
    }

    $file = $files['file'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE || ($file['size'] ?? 0) === 0) {
        auth_fail('validation_error', 'Validation failed.', 400, ['file' => 'Video file is required.']);
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        auth_fail('validation_error', 'Upload failed.', 400, ['file' => 'Upload failed.']);
    }

    $countStmt = db()->prepare('SELECT COUNT(*) FROM videos WHERE element_id = :element_id');
    $countStmt->execute(['element_id' => $elementId]);
    $existing = (int) $countStmt->fetchColumn();
    if ($existing >= VIDEOS_PER_ELEMENT) {
        auth_fail('payload_too_large', 'Video limit reached.', 400, [
            'videos' => 'Maximum ' . VIDEOS_PER_ELEMENT . ' videos per element.',
            'remaining' => 0,
        ]);
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size > MAX_VIDEO_BYTES) {
        auth_fail('payload_too_large', 'Video too large.', 400, [
            'file' => 'Maximum video size is 20 MB.',
            'remaining' => VIDEOS_PER_ELEMENT - $existing,
        ]);
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_file($tmpName)) {
        auth_fail('validation_error', 'Upload failed.', 400, ['file' => 'Upload failed.']);
    }

    $mime = detect_video_mime($tmpName);
    if ($mime === null) {
        auth_fail('validation_error', 'Unsupported file type.', 400, [
            'file' => 'Allowed types: MP4, WebM.',
        ]);
    }

    $ext = ALLOWED_VIDEO_TYPES[$mime];
    $videoFileId = sprintf(
        '%s-%s.%s',
        bin2hex(random_bytes(16)),
        bin2hex(random_bytes(4)),
        $ext
    );
    $subdir = substr($videoFileId, 0, 2);
    $relativeKey = 'videos/' . $subdir . '/' . $videoFileId;
    $targetDir = uploads_root() . DIRECTORY_SEPARATOR . 'videos' . DIRECTORY_SEPARATOR . $subdir;
    if (!is_dir($targetDir) && !@mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store video.']);
    }
    $targetPath = $targetDir . DIRECTORY_SEPARATOR . $videoFileId;

    if (is_uploaded_file($tmpName)) {
        $stored = move_uploaded_file($tmpName, $targetPath);
    } else {
        $stored = copy($tmpName, $targetPath);
    }
    if (!$stored) {
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store video.']);
    }

    $stmt = db()->prepare(
        'INSERT INTO videos (element_id, storage_key, content_type, byte_size)
         VALUES (:element_id, :storage_key, :content_type, :byte_size)
         RETURNING *'
    );
    $stmt->execute([
        'element_id' => $elementId,
        'storage_key' => $relativeKey,
        'content_type' => $mime,
        'byte_size' => $size,
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $video = [
        'id' => (string) $row['id'],
        'element_id' => $elementId,
        'content_type' => $mime,
        'byte_size' => $size,
        'version' => (int) $row['version'],
        'created_at' => (string) $row['created_at'],
        'url' => '/php/videos/get.php?id=' . urlencode((string) $row['id']),
    ];
    $result = ['success' => true, 'video' => $video];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'video', $video['id'], $result);
    }

    return $result;
}

function videos_delete(array $user, array $input, bool $forceVersion = false): array
{
    $videoId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    $baseVersion = $input['base_version'] ?? null;

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $video = fetch_video_by_id($videoId);
    if ($video === null) {
        return ['success' => true, 'deleted' => true];
    }

    if ((string) $video['owner_id'] !== (string) $user['id']) {
        auth_fail('forbidden', 'You do not have access to this video.', 403);
    }

    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $video['version']) {
        json_conflict(
            'Video version conflict.',
            ['id' => $videoId, 'base_version' => (int) $baseVersion, 'op' => 'delete'],
            [
                'id' => $videoId,
                'version' => (int) $video['version'],
                'element_id' => (string) $video['element_id'],
            ],
            'update_delete'
        );
    }

    videos_unlink_file((string) $video['storage_key']);
    db()->prepare('DELETE FROM videos WHERE id = :id')->execute(['id' => $videoId]);

    $result = ['success' => true, 'deleted' => true];
    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'video', $videoId, $result);
    }

    return $result;
}

function videos_unlink_file(string $storageKey): void
{
    $path = uploads_root() . DIRECTORY_SEPARATOR . $storageKey;
    if (is_file($path)) {
        unlink($path);
    }
}

function videos_delete_for_element(string $elementId): void
{
    $stmt = db()->prepare('SELECT storage_key FROM videos WHERE element_id = :element_id');
    $stmt->execute(['element_id' => $elementId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        videos_unlink_file((string) $row['storage_key']);
    }
    db()->prepare('DELETE FROM videos WHERE element_id = :element_id')->execute(['element_id' => $elementId]);
}

function videos_delete_for_user(string $userId): void
{
    $stmt = db()->prepare(
        'SELECT v.storage_key FROM videos v
         JOIN map_elements e ON e.id = v.element_id
         JOIN maps m ON m.id = e.map_id
         WHERE m.owner_id = :user_id'
    );
    $stmt->execute(['user_id' => $userId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        videos_unlink_file((string) $row['storage_key']);
    }
}

function videos_delete_for_map(string $mapId): void
{
    $stmt = db()->prepare(
        'SELECT v.storage_key FROM videos v
         JOIN map_elements e ON e.id = v.element_id
         WHERE e.map_id = :map_id'
    );
    $stmt->execute(['map_id' => $mapId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        videos_unlink_file((string) $row['storage_key']);
    }
    db()->prepare(
        'DELETE FROM videos v USING map_elements e
         WHERE v.element_id = e.id AND e.map_id = :map_id'
    )->execute(['map_id' => $mapId]);
}

function videos_serve(?array $user, string $videoId): never
{
    videos_serve_bytes($user, $videoId, false);
}

function videos_serve_public(string $videoId): never
{
    videos_serve_bytes(null, $videoId, true);
}

function videos_serve_bytes(?array $user, string $videoId, bool $publicOnly): never
{
    if ($videoId === '') {
        auth_fail('not_found', 'Video not found.', 404);
    }

    $video = fetch_video_by_id($videoId);
    if ($video === null) {
        auth_fail('not_found', 'Video not found.', 404);
    }

    if ($publicOnly) {
        if (!map_is_public_eligible($video) || !element_is_publicly_visible($video)) {
            auth_fail('not_found', 'Video not found.', 404);
        }
    } elseif (!video_can_read($user, $video)) {
        auth_fail('forbidden', 'Access denied.', 403);
    }

    $path = video_storage_path((string) $video['storage_key']);
    if (!is_file($path)) {
        auth_fail('not_found', 'Video not found.', 404);
    }

    serve_binary_file(
        $path,
        (string) $video['content_type'],
        $publicOnly ? 'public, max-age=300' : 'private, max-age=3600',
        true
    );
}
