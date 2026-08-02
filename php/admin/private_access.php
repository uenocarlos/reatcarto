<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('validation_error', 'Method not allowed.', 405);
}

auth_handle_endpoint(function () {
    $admin = require_admin();

    return admin_private_access($admin, read_json_body());
});
