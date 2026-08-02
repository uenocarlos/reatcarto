<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

auth_handle_endpoint(function () {
    $admin = require_admin();
    $q = isset($_GET['q']) ? (string) $_GET['q'] : null;
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    $pageSize = isset($_GET['page_size']) ? (int) $_GET['page_size'] : DEFAULT_PAGE_SIZE;

    return admin_list_audit($admin, $q, $page, $pageSize);
});
