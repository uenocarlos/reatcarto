<?php

declare(strict_types=1);

const ICON_AUTH_URL_PREFIX = '/php/icons/get.php?id=';
const ICON_PUBLIC_URL_PREFIX = '/php/public/icon.php?id=';

/**
 * @return array<string, mixed>
 */
function format_icon_record(array $row): array
{
    $id = (string) $row['id'];

    return [
        'id' => $id,
        'name' => (string) $row['name'],
        'content_type' => (string) $row['content_type'],
        'byte_size' => (int) $row['byte_size'],
        'created_at' => (string) $row['created_at'],
        'url' => ICON_AUTH_URL_PREFIX . rawurlencode($id),
    ];
}

function normalize_icon_name(mixed $name): string
{
    $trimmed = trim((string) ($name ?? ''));
    if ($trimmed === '') {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'name' => 'Icon name is required.',
        ]);
    }
    if (mb_strlen($trimmed) > MAX_ICON_NAME_LENGTH) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'name' => 'Name exceeds maximum length of ' . MAX_ICON_NAME_LENGTH . '.',
        ]);
    }

    return $trimmed;
}

function icon_authenticated_url(string $iconId): string
{
    return ICON_AUTH_URL_PREFIX . rawurlencode($iconId);
}

function icon_public_url(string $iconId): string
{
    return ICON_PUBLIC_URL_PREFIX . rawurlencode($iconId);
}

function rewrite_public_custom_icon_url(mixed $url): mixed
{
    if (!is_string($url) || $url === '') {
        return $url;
    }

    if (!str_contains($url, '/php/icons/get.php?')) {
        return $url;
    }

    $query = [];
    $queryPos = strpos($url, '?');
    if ($queryPos === false) {
        return $url;
    }
    parse_str(substr($url, $queryPos + 1), $query);
    $id = trim((string) ($query['id'] ?? ''));
    if ($id === '') {
        return $url;
    }

    return icon_public_url($id);
}

function icon_storage_path(string $storageKey): string
{
    $root = uploads_root();
    $full = $root . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $storageKey);
    $rootReal = realpath($root);
    $fullReal = realpath($full);
    if ($rootReal === false || $fullReal === false || !str_starts_with($fullReal, $rootReal)) {
        auth_fail('not_found', 'Icon not found.', 404);
    }

    return $fullReal;
}

/**
 * @return array<string, mixed>|null
 */
function fetch_icon_by_id(string $iconId): ?array
{
    if ($iconId === '') {
        return null;
    }

    $stmt = db()->prepare('SELECT * FROM user_icons WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $iconId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

/**
 * @return list<array<string, mixed>>
 */
function icons_list(array $user): array
{
    $stmt = db()->prepare(
        'SELECT id, name, content_type, byte_size, created_at
         FROM user_icons
         WHERE user_id = :user_id AND library_hidden_at IS NULL
         ORDER BY created_at DESC'
    );
    $stmt->execute(['user_id' => $user['id']]);
    $icons = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $icons[] = format_icon_record($row);
    }

    return $icons;
}

function icon_can_read(?array $user, array $icon): bool
{
    if ($user !== null && (string) $icon['user_id'] === (string) $user['id']) {
        return true;
    }

    if ($user === null) {
        return false;
    }

    return icon_has_readable_reference((string) $icon['id'], $user);
}

function icon_has_readable_reference(string $iconId, array $user): bool
{
    $authUrl = icon_authenticated_url($iconId);
    $publicUrl = icon_public_url($iconId);

    $stmt = db()->prepare(
        "SELECT 1
         FROM map_elements e
         JOIN maps m ON m.id = e.map_id
         JOIN users u ON u.id = m.owner_id
         WHERE (
            e.style->>'custom_icon_url' = :auth_url
            OR e.style->>'custom_icon_url' = :public_url
            OR e.style->>'custom_icon_url' LIKE :like_id
         )
         AND (
            m.owner_id = :reader_id
            OR (
                m.is_published = true
                AND m.moderated_at IS NULL
                AND u.status = 'active'
                AND COALESCE(e.is_publicly_visible, true) = true
            )
         )
         LIMIT 1"
    );
    $stmt->execute([
        'auth_url' => $authUrl,
        'public_url' => $publicUrl,
        'like_id' => '%id=' . $iconId . '%',
        'reader_id' => $user['id'],
    ]);

    return (bool) $stmt->fetchColumn();
}

function icon_is_publicly_referenced(string $iconId): bool
{
    $authUrl = icon_authenticated_url($iconId);
    $publicUrl = icon_public_url($iconId);

    $stmt = db()->prepare(
        "SELECT 1
         FROM map_elements e
         JOIN maps m ON m.id = e.map_id
         JOIN users u ON u.id = m.owner_id
         WHERE (
            e.style->>'custom_icon_url' = :auth_url
            OR e.style->>'custom_icon_url' = :public_url
            OR e.style->>'custom_icon_url' LIKE :like_id
         )
         AND m.is_published = true
         AND m.moderated_at IS NULL
         AND u.status = 'active'
         AND COALESCE(e.is_publicly_visible, true) = true
         LIMIT 1"
    );
    $stmt->execute([
        'auth_url' => $authUrl,
        'public_url' => $publicUrl,
        'like_id' => '%id=' . $iconId . '%',
    ]);

    return (bool) $stmt->fetchColumn();
}

/**
 * @return array{icon: array<string, mixed>, path: string, content_type: string, byte_size: int, public: bool}
 */
function icons_resolve_serve(string $iconId, ?array $user, bool $publicOnly): array
{
    if ($iconId === '') {
        auth_fail('not_found', 'Icon not found.', 404);
    }

    $icon = fetch_icon_by_id($iconId);
    if ($icon === null) {
        auth_fail('not_found', 'Icon not found.', 404);
    }

    if ($publicOnly) {
        if (!icon_is_publicly_referenced($iconId)) {
            auth_fail('not_found', 'Icon not found.', 404);
        }
    } elseif (!icon_can_read($user, $icon)) {
        auth_fail('forbidden', 'Access denied.', 403);
    }

    $path = icon_storage_path((string) $icon['storage_key']);
    if (!is_file($path)) {
        auth_fail('not_found', 'Icon not found.', 404);
    }

    return [
        'icon' => $icon,
        'path' => $path,
        'content_type' => (string) $icon['content_type'],
        'byte_size' => (int) $icon['byte_size'],
        'public' => $publicOnly,
    ];
}

function icons_upload(array $user, array $files, array $input): array
{
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    if ($clientMutationId !== '') {
        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            return $cached;
        }
    }

    $name = normalize_icon_name($input['name'] ?? '');

    if (!isset($files['file']) || !is_array($files['file'])) {
        auth_fail('validation_error', 'Validation failed.', 400, ['file' => 'Icon file is required.']);
    }

    $file = $files['file'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE || ($file['size'] ?? 0) === 0) {
        auth_fail('validation_error', 'Validation failed.', 400, ['file' => 'Icon file is required.']);
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        auth_fail('validation_error', 'Upload failed.', 400, ['file' => 'Upload failed.']);
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size > MAX_ICON_BYTES) {
        auth_fail('payload_too_large', 'Icon too large.', 400, [
            'file' => 'Maximum icon size is 200 KB.',
        ]);
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_file($tmpName)) {
        auth_fail('validation_error', 'Upload failed.', 400, ['file' => 'Upload failed.']);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmpName);
    if ($mime !== 'image/png') {
        auth_fail('validation_error', 'Unsupported file type.', 400, [
            'file' => 'Only PNG icons are allowed.',
        ]);
    }

    $subdirHex = bin2hex(random_bytes(1));
    $subdir = 'icons/' . $subdirHex;
    $targetDir = uploads_root() . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . $subdirHex;
    if (!is_dir($targetDir) && !@mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store icon.']);
    }

    $placeholderKey = $subdir . '/pending-' . bin2hex(random_bytes(8)) . '.png';
    $stmt = db()->prepare(
        'INSERT INTO user_icons (user_id, name, storage_key, content_type, byte_size)
         VALUES (:user_id, :name, :storage_key, :content_type, :byte_size)
         RETURNING *'
    );
    try {
        $stmt->execute([
            'user_id' => $user['id'],
            'name' => $name,
            'storage_key' => $placeholderKey,
            'content_type' => 'image/png',
            'byte_size' => $size,
        ]);
    } catch (Throwable) {
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store icon.']);
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store icon.']);
    }

    $finalId = (string) $row['id'];
    $relativeKey = $subdir . '/' . $finalId . '.png';
    $targetPath = $targetDir . DIRECTORY_SEPARATOR . $finalId . '.png';

    if (is_uploaded_file($tmpName)) {
        $stored = move_uploaded_file($tmpName, $targetPath);
    } else {
        $stored = @copy($tmpName, $targetPath);
    }

    if (!$stored) {
        db()->prepare('DELETE FROM user_icons WHERE id = :id')->execute(['id' => $finalId]);
        auth_fail('validation_error', 'Upload failed.', 500, ['file' => 'Could not store icon.']);
    }

    db()->prepare('UPDATE user_icons SET storage_key = :storage_key WHERE id = :id')->execute([
        'storage_key' => $relativeKey,
        'id' => $finalId,
    ]);
    $row['id'] = $finalId;
    $row['storage_key'] = $relativeKey;

    $icon = format_icon_record($row);
    $result = ['success' => true, 'icon' => $icon];

    if ($clientMutationId !== '') {
        client_mutation_store($user['id'], $clientMutationId, 'icon', $finalId, $result);
    }

    return $result;
}

function icons_soft_remove(array $user, string $iconId): array
{
    if ($iconId === '') {
        auth_fail('validation_error', 'Validation failed.', 400, ['id' => 'Icon id is required.']);
    }

    $icon = fetch_icon_by_id($iconId);
    if ($icon === null) {
        auth_fail('not_found', 'Icon not found.', 404);
    }

    if ((string) $icon['user_id'] !== (string) $user['id']) {
        auth_fail('forbidden', 'You do not have access to this icon.', 403);
    }

    if ($icon['library_hidden_at'] === null) {
        db()->prepare(
            'UPDATE user_icons SET library_hidden_at = NOW() WHERE id = :id AND user_id = :user_id'
        )->execute([
            'id' => $iconId,
            'user_id' => $user['id'],
        ]);
    }

    return ['success' => true, 'removed' => true];
}

function icons_serve(?array $user, string $iconId): never
{
    $resolved = icons_resolve_serve($iconId, $user, false);
    serve_binary_file($resolved['path'], $resolved['content_type'], 'private, max-age=3600');
}

function icons_serve_public(string $iconId): never
{
    $resolved = icons_resolve_serve($iconId, null, true);
    serve_binary_file($resolved['path'], $resolved['content_type'], 'public, max-age=300');
}
