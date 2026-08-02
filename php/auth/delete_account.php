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
    $data = read_json_body();

    return auth_delete_account(
        $user,
        (string) ($data['password'] ?? ''),
        (string) ($data['confirm_phrase'] ?? $data['confirmPhrase'] ?? '')
    );
});
