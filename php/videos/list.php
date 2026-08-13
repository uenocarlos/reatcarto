<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

auth_handle_endpoint(function () {
    $user = require_active_user();
    $page = (int) ($_GET['page'] ?? 1);
    $pageSize = (int) ($_GET['page_size'] ?? DEFAULT_PAGE_SIZE);

    return array_merge(['success' => true], videos_list_for_user($user, $page, $pageSize));
});
