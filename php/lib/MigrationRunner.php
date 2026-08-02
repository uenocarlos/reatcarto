<?php

declare(strict_types=1);

final class MigrationRunner
{
    public function __construct(
        private readonly PDO $db,
        private readonly string $migrationsDir,
    ) {
    }

    /** @return list<string> */
    public function applyPending(): array
    {
        $this->ensureTrackingTable();

        $applied = [];
        foreach ($this->pendingMigrations() as $version => $path) {
            $sql = file_get_contents($path);
            if ($sql === false) {
                throw new RuntimeException("Unable to read migration file: {$path}");
            }

            $this->db->beginTransaction();
            try {
                $this->db->exec($sql);
                $stmt = $this->db->prepare(
                    'INSERT INTO schema_migrations (version) VALUES (:version)'
                );
                $stmt->execute(['version' => $version]);
                $this->db->commit();
                $applied[] = $version;
            } catch (Throwable $exception) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }

                throw $exception;
            }
        }

        return $applied;
    }

    /** @return array<string, string> */
    public function pendingMigrations(): array
    {
        $this->ensureTrackingTable();

        $appliedVersions = $this->db
            ->query('SELECT version FROM schema_migrations')
            ->fetchAll(PDO::FETCH_COLUMN);
        $appliedLookup = array_fill_keys($appliedVersions, true);

        $files = glob($this->migrationsDir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
        sort($files, SORT_STRING);

        $pending = [];
        foreach ($files as $path) {
            $version = basename($path);
            if (!isset($appliedLookup[$version])) {
                $pending[$version] = $path;
            }
        }

        return $pending;
    }

    private function ensureTrackingTable(): void
    {
        $this->db->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )'
        );
    }
}
