<?php

declare(strict_types=1);

namespace Reatcarto\Tests;

use MigrationRunner;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

abstract class PostgisTestCase extends PHPUnitTestCase
{
    protected function setUp(): void
    {
        $this->resetDatabase();
    }

    protected function resetDatabase(): void
    {
        $pdo = db();
        $pdo->exec('DROP SCHEMA public CASCADE');
        $pdo->exec('CREATE SCHEMA public');
        $pdo->exec('GRANT ALL ON SCHEMA public TO public');
        $pdo->exec('GRANT ALL ON SCHEMA public TO postgres');
    }

    protected function migrationRunner(): MigrationRunner
    {
        return new MigrationRunner(
            db(),
            dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'php' . DIRECTORY_SEPARATOR . 'migrations'
        );
    }

    protected function tableExists(string $table): bool
    {
        $stmt = db()->prepare(
            'SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = \'public\'
                  AND table_name = :table
            )'
        );
        $stmt->execute(['table' => $table]);

        return (bool) $stmt->fetchColumn();
    }
}
