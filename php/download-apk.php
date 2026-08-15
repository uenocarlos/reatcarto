<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/ApkDownload.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

try {
    apk_serve_download();
} catch (AuthException $e) {
    json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
}
