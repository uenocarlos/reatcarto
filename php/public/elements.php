<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

send_cors_headers();
handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_error('validation_error', 'Method not allowed.', 405);
}

public_handle_endpoint(function () {
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    $pageSize = isset($_GET['page_size']) ? (int) $_GET['page_size'] : DEFAULT_PAGE_SIZE;

    return public_elements_list((string) ($_GET['public_id'] ?? ''), $page, $pageSize);
});
