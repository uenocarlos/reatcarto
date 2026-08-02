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
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $pageSize = min(MAX_PAGE_SIZE, max(1, (int) ($_GET['page_size'] ?? DEFAULT_PAGE_SIZE)));

    return elements_list($user, (string) ($_GET['map_id'] ?? ''), $page, $pageSize);
});
