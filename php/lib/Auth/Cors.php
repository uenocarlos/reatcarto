<?php

declare(strict_types=1);

function cors_allowed_origins(): array
{
    $origins = [];

    $appBase = env_string('APP_BASE_URL', 'http://localhost:5173') ?? 'http://localhost:5173';
    $origins[] = rtrim($appBase, '/');

    $extra = env_string('CORS_ALLOWED_ORIGINS', '') ?? '';
    if ($extra !== '') {
        foreach (explode(',', $extra) as $part) {
            $part = trim($part);
            if ($part !== '') {
                $origins[] = rtrim($part, '/');
            }
        }
    }

    foreach (['capacitor://localhost', 'https://localhost', 'http://localhost'] as $capOrigin) {
        $origins[] = $capOrigin;
    }

    return array_values(array_unique($origins));
}

function is_cors_origin_allowed(string $origin): bool
{
    if ($origin === '') {
        return false;
    }

    $normalized = rtrim($origin, '/');
    foreach (cors_allowed_origins() as $allowed) {
        if ($normalized === $allowed) {
            return true;
        }
    }

    return false;
}

function send_cors_headers(): void
{
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && is_cors_origin_allowed($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
}

function handle_preflight(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        send_cors_headers();
        http_response_code(204);
        exit;
    }
}
