#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

try {
    $seeder = new AdminSeeder(db(), app_config());
    if ($seeder->seedIfNeeded()) {
        echo "Admin user created.\n";
    } else {
        echo "Admin already exists; no changes made.\n";
    }

    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Seed failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
