#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

try {
    $runner = new MigrationRunner(db(), __DIR__ . '/../migrations');
    $applied = $runner->applyPending();

    if ($applied === []) {
        echo "No pending migrations.\n";
    } else {
        echo 'Applied migrations: ' . implode(', ', $applied) . "\n";
    }

    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Migration failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
