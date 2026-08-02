<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Cli;

use AdminSeeder;
use Reatcarto\Tests\PostgisTestCase;

/** @covers MigrationRunner */
final class MigrateCliTest extends PostgisTestCase
{
    /**
     * UT-170: migrate.php applies pending SQL idempotently on second run.
     */
    public function testMigrateAppliesPendingSqlIdempotentlyOnSecondRun(): void
    {
        $runner = $this->migrationRunner();

        $firstRun = $runner->applyPending();
        $this->assertNotEmpty($firstRun, 'First migration run should apply pending SQL files.');
        $this->assertTrue($this->tableExists('users'));
        $this->assertTrue($this->tableExists('map_elements'));
        $this->assertTrue($this->tableExists('audit_events'));

        $secondRun = $runner->applyPending();
        $this->assertSame([], $secondRun, 'Second migration run must be a no-op.');
        $this->assertSame(count($firstRun), $this->appliedMigrationCount());
    }

    private function appliedMigrationCount(): int
    {
        return (int) db()->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn();
    }
}
