<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__, 2);

require_once $projectRoot . '/php/config.php';
require_once $projectRoot . '/php/lib/MigrationRunner.php';
require_once $projectRoot . '/php/lib/AdminSeeder.php';
require_once $projectRoot . '/php/lib/Auth/Cors.php';
require_once $projectRoot . '/php/lib/Auth/AuthException.php';
require_once $projectRoot . '/php/lib/Auth/Validation.php';
require_once $projectRoot . '/php/lib/Auth/RateLimiter.php';
require_once $projectRoot . '/php/lib/Auth/TokenService.php';
require_once $projectRoot . '/php/lib/Auth/UserRepository.php';
require_once $projectRoot . '/php/lib/Auth/SessionService.php';
require_once $projectRoot . '/php/lib/Auth/AuthService.php';
require_once $projectRoot . '/php/lib/Limits.php';
require_once $projectRoot . '/php/lib/ClientMutation.php';
require_once $projectRoot . '/php/lib/GeoJson.php';
require_once $projectRoot . '/php/lib/Maps/MapService.php';
require_once $projectRoot . '/php/lib/Elements/ElementService.php';
require_once $projectRoot . '/php/lib/Elements/ElementCategoryService.php';
require_once $projectRoot . '/php/lib/Gis/ShapefileWriter.php';
require_once $projectRoot . '/php/lib/Gis/ShapefileExportService.php';
require_once $projectRoot . '/php/lib/Photos/PhotoService.php';
require_once $projectRoot . '/php/lib/Videos/VideoService.php';
require_once $projectRoot . '/php/lib/Icons/IconService.php';
require_once $projectRoot . '/php/lib/Public/PublicService.php';
require_once $projectRoot . '/php/lib/Sync/SyncService.php';
require_once $projectRoot . '/php/lib/Admin/AuditService.php';
require_once $projectRoot . '/php/lib/Admin/AdminService.php';
require_once $projectRoot . '/php/mail/Mailer.php';

$envFile = $projectRoot . DIRECTORY_SEPARATOR . '.env';
if (is_readable($envFile)) {
    load_env_file($envFile);
}

putenv('DB_NAME=reatcarto_test');
$_ENV['DB_NAME'] = 'reatcarto_test';

/** @var array<string, mixed> $CONFIG */
$GLOBALS['CONFIG'] = build_app_config();

function app_config(): array
{
    return $GLOBALS['CONFIG'];
}

function email_verification_required(): bool
{
    return (app_config()['require_email_verification'] ?? false) === true;
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
    $lifetime = max(0, (int) ($session['lifetime'] ?? 0));
    if ($lifetime > 0) {
        ini_set('session.gc_maxlifetime', (string) $lifetime);
        ini_set('session.cookie_lifetime', (string) $lifetime);
    }
    session_name($session['name']);
    session_set_cookie_params([
        'lifetime' => $lifetime,
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

function require_admin(): array
{
    $user = require_valid_session();
    if (($user['role'] ?? '') !== 'admin') {
        auth_fail('forbidden', 'Administrator access required.', 403);
    }

    return $user;
}
