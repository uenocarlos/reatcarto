<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('validation_error', 'Method not allowed.', 405);
}

set_time_limit(120);

try {
    $user = require_active_user();
    elements_export_shapefile($user, read_json_body());
} catch (AuthException $e) {
    json_error($e->errorCode, $e->getMessage(), $e->status, $e->fields);
} catch (Throwable $e) {
    error_log('gis.export.shp: ' . $e->getMessage());
    json_error('server_error', 'Failed to export Shapefile.', 500);
}
