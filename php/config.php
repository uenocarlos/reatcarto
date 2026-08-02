<?php

declare(strict_types=1);

if (!function_exists('load_env_file')) {
    function load_env_file(string $path): void
    {
        if (!is_readable($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (!str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);

            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"'))
                || (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            if (getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }

    function env_string(string $key, ?string $default = null): ?string
    {
        $value = getenv($key);
        if ($value === false) {
            return $default;
        }

        return $value;
    }

    function env_bool(string $key, bool $default = false): bool
    {
        $value = env_string($key);
        if ($value === null) {
            return $default;
        }

        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    function env_int(string $key, int $default): int
    {
        $value = env_string($key);
        if ($value === null || !is_numeric($value)) {
            return $default;
        }

        return (int) $value;
    }

    function app_root(): string
    {
        return dirname(__DIR__);
    }
}

function build_app_config(): array
{
    return [
        'db' => [
            'host' => env_string('DB_HOST', 'localhost') ?? 'localhost',
            'port' => env_int('DB_PORT', 5432),
            'name' => env_string('DB_NAME', 'reatcarto') ?? 'reatcarto',
            'user' => env_string('DB_USER', 'postgres') ?? 'postgres',
            'password' => env_string('DB_PASSWORD', '') ?? '',
        ],
        'smtp' => [
            'host' => env_string('SMTP_HOST', 'localhost') ?? 'localhost',
            'port' => env_int('SMTP_PORT', 1025),
            'user' => env_string('SMTP_USER', '') ?? '',
            'pass' => env_string('SMTP_PASS', '') ?? '',
            'from' => env_string('MAIL_FROM', 'noreply@example.com') ?? 'noreply@example.com',
        ],
        'terms_version' => env_string('TERMS_VERSION', '1.0.0') ?? '1.0.0',
        'privacy_version' => env_string('PRIVACY_VERSION', '1.0.0') ?? '1.0.0',
        'uploads_root' => env_string('UPLOADS_ROOT', app_root() . DIRECTORY_SEPARATOR . 'uploads')
            ?? app_root() . DIRECTORY_SEPARATOR . 'uploads',
        'session' => [
            'secure' => env_bool('SESSION_SECURE', false),
            'httponly' => env_bool('SESSION_HTTP_ONLY', true),
            'samesite' => env_string('SESSION_SAME_SITE', 'Lax') ?? 'Lax',
            'name' => env_string('SESSION_NAME', 'REATCARTO_SESSID') ?? 'REATCARTO_SESSID',
        ],
        'admin' => [
            'email' => env_string('ADMIN_EMAIL'),
            'username' => env_string('ADMIN_USERNAME'),
            'password' => env_string('ADMIN_PASSWORD'),
        ],
    ];
}

load_env_file(app_root() . DIRECTORY_SEPARATOR . '.env');

return build_app_config();
