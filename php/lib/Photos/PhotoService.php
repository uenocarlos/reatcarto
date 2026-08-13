<?php

declare(strict_types=1);

const ALLOWED_PHOTO_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

function uploads_root(): string
{
    $root = app_config()['uploads_root'];
    if (!is_dir($root)) {
        mkdir($root, 0775, true);
    }

    return $root;
}

function photo_storage_path(string $storageKey): string
{
    $root = uploads_root();
    $full = $root . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $storageKey);
    $rootReal = realpath($root);
    $fullReal = realpath($full);
    if ($rootReal === false || $fullReal === false || !str_starts_with($fullReal, $rootReal)) {
        auth_fail('not_found', 'Photo not found.', 404);
    }

    return $fullReal;
}

/**
 * @return list<array<string, mixed>>
 */
function photos_for_element(string $elementId): array
{
    $stmt = db()->prepare(
        'SELECT id, content_type, byte_size, version, created_at
         FROM photos WHERE element_id = :element_id ORDER BY created_at ASC'
    );
    $stmt->execute(['element_id' => $elementId]);
    $photos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $photos[] = [
            'id' => (string) $row['id'],
            'content_type' => (string) $row['content_type'],
            'byte_size' => (int) $row['byte_size'],
            'version' => (int) $row['version'],
            'created_at' => (string) $row['created_at'],
            'url' => '/php/photos/get.php?id=' . urlencode((string) $row['id']),
        ];
    }

    return $photos;
}

/**
 * @return array<string, mixed>|null
 */
function fetch_photo_by_id(string $photoId): ?array
{
    $stmt = db()->prepare(
        'SELECT p.*, e.map_id, e.is_publicly_visible, m.owner_id, m.is_published, m.moderated_at, u.status AS owner_status
         FROM photos p
         JOIN map_elements e ON e.id = p.element_id
         JOIN maps m ON m.id = e.map_id
         JOIN users u ON u.id = m.owner_id
         WHERE p.id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $photoId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

function photo_can_read(?array $user, array $photo): bool
{
    if ($user !== null && (string) $photo['owner_id'] === (string) $user['id']) {
        return true;
    }

    return map_is_public_eligible($photo) && element_is_publicly_visible($photo);
}

/**
 * @return array{photos: list<array<string, mixed>>, pagination: array<string, int>}
 */
function photos_list_for_user(array $user, int $page = 1, int $pageSize = DEFAULT_PAGE_SIZE): array
{
    $page = max(1, $page);
    $pageSize = min(MAX_PAGE_SIZE, max(1, $pageSize));
    $offset = ($page - 1) * $pageSize;

    $countStmt = db()->prepare(
        'SELECT COUNT(*) FROM photos p
         JOIN map_elements e ON e.id = p.element_id
         JOIN maps m ON m.id = e.map_id
         WHERE m.owner_id = :user_id'
    );
    $countStmt->execute(['user_id' => $user['id']]);
    $total = (int) $countStmt->fetchColumn();

    $stmt = db()->prepare(
        'SELECT p.id, p.content_type, p.byte_size, p.version, p.created_at, p.element_id,
                e.name AS element_name, e.map_id, m.name AS map_name
         FROM photos p
         JOIN map_elements e ON e.id = p.element_id
         JOIN maps m ON m.id = e.map_id
         WHERE m.owner_id = :user_id
         ORDER BY p.created_at DESC
         LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':user_id', $user['id']);
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $photos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (string) $row['id'];
        $photos[] = [
            'id' => $id,
            'content_type' => (string) $row['content_type'],
            'byte_size' => (int) $row['byte_size'],
            'version' => (int) $row['version'],
            'created_at' => (string) $row['created_at'],
            'url' => '/php/photos/get.php?id=' . urlencode($id),
            'element_id' => (string) $row['element_id'],
            'element_name' => (string) $row['element_name'],
            'map_id' => (string) $row['map_id'],
            'map_name' => (string) $row['map_name'],
        ];
    }

    return [
        'photos' => $photos,
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
            'total_pages' => $pageSize > 0 ? (int) ceil($total / $pageSize) : 0,
        ],
    ];
}

/**
 * @return list<array<string, mixed>>
 */
function photos_for_element_public(string $elementId): array
{
    $stmt = db()->prepare(
        'SELECT id, content_type, byte_size, version, created_at
         FROM photos WHERE element_id = :element_id ORDER BY created_at ASC'
    );
    $stmt->execute(['element_id' => $elementId]);
    $photos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $photos[] = [
            'id' => (string) $row['id'],
            'content_type' => (string) $row['content_type'],
            'byte_size' => (int) $row['byte_size'],
            'version' => (int) $row['version'],
            'created_at' => (string) $row['created_at'],
            'url' => '/php/public/photo.php?id=' . urlencode((string) $row['id']),
        ];
    }

    return $photos;
}

function photos_upload(array $user, array $files, array $input): array
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
        auth_fail('validation_error', 'Validation failed.', 400, ['file' => 'Photo file is required.']);
    }

    $file = $files['file'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE || ($file['size'] ?? 0) === 0) {
        auth_fail('validation_error', 'Validation failed.', 400, ['file' => 'Photo file is required.']);
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        auth_fail('validation_error', 'Upload failed.', 400, ['file' => 'Upload failed.']);
    }

    $countStmt = db()->prepare('SELECT COUNT(*) FROM photos WHERE element_id = :element_id');
    $countStmt->execute(['element_id' => $elementId]);
    $existing = (int) $countStmt->fetchColumn();
    if ($existing >= PHOTOS_PER_ELEMENT) {
        auth_fail('payload_too_large', 'Photo limit reached.', 400, [
            'photos' => 'Maximum ' . PHOTOS_PER_ELEMENT . ' photos per element.',
            'remaining' => 0,
        ]);
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size > MAX_PHOTO_BYTES) {
        auth_fail('payload_too_large', 'Photo too large.', 400, [
            'file' => 'Maximum photo size is 5 MB.',
            'remaining' => PHOTOS_PER_ELEMENT - $existing,
        ]);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    if ($mime === false || !isset(ALLOWED_PHOTO_TYPES[$mime])) {
        auth_fail('validation_error', 'Unsupported file type.', 400, [
            'file' => 'Allowed types: JPEG, PNG, WebP.',
        ]);
    }

    $ext = ALLOWED_PHOTO_TYPES[$mime];
    $photoId = sprintf(
        '%s-%s.%s',
        bin2hex(random_bytes(16)),
        bin2hex(random_bytes(4)),
        $ext
    );
    $subdir = substr($photoId, 0, 2);
    $relativeKey = $subdir . '/' . $photoId;
    $targetDir = uploads_root() . DIRECTORY_SEPARATOR . $subdir;
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0775, true);
    }
    $targetPath = $targetDir . DIRECTORY_SEPARATOR . $photoId;

    if (is_uploaded_file($file['tmp_name'])) {
        $stored = move_uploaded_file($file['tmp_name'], $targetPath);
    } else {
        $stored = copy($file['tmp_name'], $targetPath);
    }
    if (!$stored) {
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store photo.']);
    }

    $stmt = db()->prepare(
        'INSERT INTO photos (element_id, storage_key, content_type, byte_size)
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
    $photo = [
        'id' => (string) $row['id'],
        'element_id' => $elementId,
        'content_type' => $mime,
        'byte_size' => $size,
        'version' => (int) $row['version'],
        'created_at' => (string) $row['created_at'],
        'url' => '/php/photos/get.php?id=' . urlencode((string) $row['id']),
    ];
    $result = ['success' => true, 'photo' => $photo];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'photo', $photo['id'], $result);
    }

    return $result;
}

function photos_delete(array $user, array $input, bool $forceVersion = false): array
{
    $photoId = (string) ($input['id'] ?? '');
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    $baseVersion = $input['base_version'] ?? null;

    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $photo = fetch_photo_by_id($photoId);
    if ($photo === null) {
        return ['success' => true, 'deleted' => true];
    }

    if ((string) $photo['owner_id'] !== (string) $user['id']) {
        auth_fail('forbidden', 'You do not have access to this photo.', 403);
    }

    if (!$forceVersion && $baseVersion === null) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'base_version' => 'base_version is required.',
        ]);
    }
    if (!$forceVersion && (int) $baseVersion !== (int) $photo['version']) {
        json_conflict(
            'Photo version conflict.',
            ['id' => $photoId, 'base_version' => (int) $baseVersion, 'op' => 'delete'],
            [
                'id' => $photoId,
                'version' => (int) $photo['version'],
                'element_id' => (string) $photo['element_id'],
            ],
            'update_delete'
        );
    }

    photos_unlink_file((string) $photo['storage_key']);
    db()->prepare('DELETE FROM photos WHERE id = :id')->execute(['id' => $photoId]);

    $result = ['success' => true, 'deleted' => true];
    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'photo', $photoId, $result);
    }

    return $result;
}

function photos_unlink_file(string $storageKey): void
{
    $path = uploads_root() . DIRECTORY_SEPARATOR . $storageKey;
    if (is_file($path)) {
        unlink($path);
    }
}

function photos_delete_for_element(string $elementId): void
{
    $stmt = db()->prepare('SELECT storage_key FROM photos WHERE element_id = :element_id');
    $stmt->execute(['element_id' => $elementId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        photos_unlink_file((string) $row['storage_key']);
    }
    db()->prepare('DELETE FROM photos WHERE element_id = :element_id')->execute(['element_id' => $elementId]);
}

function photos_delete_for_user(string $userId): void
{
    $stmt = db()->prepare(
        'SELECT p.storage_key FROM photos p
         JOIN map_elements e ON e.id = p.element_id
         JOIN maps m ON m.id = e.map_id
         WHERE m.owner_id = :user_id'
    );
    $stmt->execute(['user_id' => $userId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        photos_unlink_file((string) $row['storage_key']);
    }
}

function photos_delete_for_map(string $mapId): void
{
    $stmt = db()->prepare(
        'SELECT p.storage_key FROM photos p
         JOIN map_elements e ON e.id = p.element_id
         WHERE e.map_id = :map_id'
    );
    $stmt->execute(['map_id' => $mapId]);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        photos_unlink_file((string) $row['storage_key']);
    }
    db()->prepare(
        'DELETE FROM photos p USING map_elements e
         WHERE p.element_id = e.id AND e.map_id = :map_id'
    )->execute(['map_id' => $mapId]);
}

function photos_serve(?array $user, string $photoId): never
{
    photos_serve_bytes($user, $photoId, false);
}

function photos_serve_public(string $photoId): never
{
    photos_serve_bytes(null, $photoId, true);
}

function photos_serve_bytes(?array $user, string $photoId, bool $publicOnly): never
{
    if ($photoId === '') {
        auth_fail('not_found', 'Photo not found.', 404);
    }

    $photo = fetch_photo_by_id($photoId);
    if ($photo === null) {
        auth_fail('not_found', 'Photo not found.', 404);
    }

    if ($publicOnly) {
        if (!map_is_public_eligible($photo) || !element_is_publicly_visible($photo)) {
            auth_fail('not_found', 'Photo not found.', 404);
        }
    } elseif (!photo_can_read($user, $photo)) {
        auth_fail('forbidden', 'Access denied.', 403);
    }

    $path = photo_storage_path((string) $photo['storage_key']);
    if (!is_file($path)) {
        auth_fail('not_found', 'Photo not found.', 404);
    }

    header('Content-Type: ' . (string) $photo['content_type']);
    header('Content-Length: ' . (string) filesize($path));
    header('Cache-Control: ' . ($publicOnly ? 'public, max-age=300' : 'private, max-age=3600'));
    readfile($path);
    exit;
}
