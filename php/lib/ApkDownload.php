<?php

declare(strict_types=1);

function apk_file_path(): string
{
    $configured = env_string('APK_PATH', '') ?? '';
    if ($configured !== '') {
        return $configured;
    }

    return app_root() . DIRECTORY_SEPARATOR . 'apk' . DIRECTORY_SEPARATOR . 'ReatCarto.apk';
}

function apk_resolve_file(): string
{
    $path = apk_file_path();
    if (!is_file($path) || !is_readable($path)) {
        auth_fail('not_found', 'Aplicativo Android indisponível.', 404);
    }

    return $path;
}

function apk_serve_download(): never
{
    $path = apk_resolve_file();
    $size = filesize($path);
    if ($size === false) {
        auth_fail('not_found', 'Aplicativo Android indisponível.', 404);
    }

    set_time_limit(0);
    header('Content-Type: application/vnd.android.package-archive');
    header('Content-Disposition: attachment; filename="ReatCarto.apk"');
    header('Content-Length: ' . (string) $size);
    header('Cache-Control: public, max-age=3600');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}
