<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

auth_handle_endpoint(function () use ($method) {
    $user = require_valid_session();

    if ($method === 'GET') {
        return auth_list_element_categories($user);
    }

    if ($method === 'POST') {
        return auth_add_element_category($user, read_json_body());
    }

    json_error('validation_error', 'Method not allowed.', 405);
});
