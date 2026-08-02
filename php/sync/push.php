<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_error('validation_error', 'Method not allowed.', 405);
}

auth_handle_endpoint(function () {
    $user = require_active_user();
    $body = read_json_body();
    $mutations = $body['mutations'] ?? $body;
    if (!is_array($mutations)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'mutations' => 'Expected array of mutations.',
        ]);
    }

    return sync_push($user, $mutations);
});
