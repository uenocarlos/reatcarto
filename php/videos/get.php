<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

start_session();
$user = null;
try {
    $user = require_valid_session();
} catch (AuthException $e) {
    if ($e->errorCode !== 'unauthenticated') {
        throw $e;
    }
}

try {
    videos_serve($user, (string) ($_GET['id'] ?? ''));
} catch (AuthException $e) {
    json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
}
