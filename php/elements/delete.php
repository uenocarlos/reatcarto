<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'DELETE') {
    json_error('validation_error', 'Method not allowed.', 405);
}

auth_handle_endpoint(function () {
    $user = require_active_user();
    $body = read_json_body();
    if ($body === [] && isset($_GET['id'])) {
        $body['id'] = (string) $_GET['id'];
    }

    return elements_delete($user, $body);
});
