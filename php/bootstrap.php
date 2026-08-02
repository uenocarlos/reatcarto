<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/MigrationRunner.php';
require_once __DIR__ . '/lib/AdminSeeder.php';
require_once __DIR__ . '/lib/Auth/Cors.php';
require_once __DIR__ . '/lib/Auth/Validation.php';
require_once __DIR__ . '/lib/Auth/RateLimiter.php';
require_once __DIR__ . '/lib/Auth/TokenService.php';
require_once __DIR__ . '/lib/Auth/UserRepository.php';
require_once __DIR__ . '/lib/Auth/SessionService.php';
require_once __DIR__ . '/lib/Auth/AuthException.php';
require_once __DIR__ . '/lib/Auth/AuthService.php';
require_once __DIR__ . '/lib/Limits.php';
require_once __DIR__ . '/lib/ClientMutation.php';
require_once __DIR__ . '/lib/GeoJson.php';
require_once __DIR__ . '/lib/Maps/MapService.php';
require_once __DIR__ . '/lib/Elements/ElementService.php';
require_once __DIR__ . '/lib/Photos/PhotoService.php';
require_once __DIR__ . '/lib/Public/PublicService.php';
require_once __DIR__ . '/lib/Sync/SyncService.php';
require_once __DIR__ . '/lib/Admin/AuditService.php';
require_once __DIR__ . '/lib/Admin/AdminService.php';

/** @var array<string, mixed> $CONFIG */
$CONFIG = require __DIR__ . '/config.php';

function app_config(): array
{
    global $CONFIG;

    return $CONFIG;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $db = app_config()['db'];
        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s',
            $db['host'],
            $db['port'],
            $db['name']
        );
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    return $pdo;
}

function configure_session(): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    $session = app_config()['session'];
    session_name($session['name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (bool) $session['secure'],
        'httponly' => (bool) $session['httponly'],
        'samesite' => (string) $session['samesite'],
    ]);
}

function start_session(): void
{
    configure_session();
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function json_response(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $code, string $message, int $status = 400, array $fields = []): never
{
    json_response([
        'success' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
            'fields' => $fields,
        ],
    ], $status);
}

function current_user_id(): ?string
{
    return isset($_SESSION['user_id']) ? (string) $_SESSION['user_id'] : null;
}

function require_auth(): array
{
    return require_valid_session();
}

function require_admin(): array
{
    $user = require_auth();
    $role = $_SESSION['role'] ?? ($user['role'] ?? null);
    if ($role !== 'admin' || ($user['role'] ?? '') !== 'admin') {
        json_error('forbidden', 'Administrator access required.', 403);
    }

    return $user;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error('validation_error', 'Invalid JSON payload.', 400);
    }

    return $data;
}
