<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

start_session();
$userId = current_user_id();
$user = null;
if ($userId !== null) {
    $user = fetch_user_by_id($userId);
}

try {
    photos_serve($user, (string) ($_GET['id'] ?? ''));
} catch (AuthException $e) {
    json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
}
