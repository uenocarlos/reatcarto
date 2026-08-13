<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

try {
    icons_serve_public((string) ($_GET['id'] ?? ''));
} catch (AuthException $e) {
    json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
}
