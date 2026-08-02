<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Cli;

use AdminSeeder;
use Reatcarto\Tests\PostgisTestCase;

/** @covers AdminSeeder */
final class SeedAdminCliTest extends PostgisTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->migrationRunner()->applyPending();
    }

    /**
     * UT-168: seed_admin.php creates admin when count(admin)=0.
     */
    public function testSeedAdminCreatesAdminWhenNoneExists(): void
    {
        $seeder = new AdminSeeder(db(), app_config());
        $this->assertSame(0, $seeder->adminCount());

        $created = $seeder->seedIfNeeded();
        $this->assertTrue($created);
        $this->assertSame(1, $seeder->adminCount());

        $admin = db()->query("SELECT * FROM users WHERE role = 'admin' LIMIT 1")->fetch();
        $this->assertIsArray($admin);
        $this->assertSame('testadmin', $admin['username']);
        $this->assertSame('admin@test.example', $admin['email']);
        $this->assertSame('admin', $admin['role']);
        $this->assertSame('active', $admin['status']);
        $this->assertNotNull($admin['email_verified_at']);
        $this->assertTrue(password_verify('TestAdmin123!', $admin['password_hash']));
    }

    /**
     * UT-169: seed_admin.php no-ops when admin exists.
     */
    public function testSeedAdminNoOpsWhenAdminExists(): void
    {
        $seeder = new AdminSeeder(db(), app_config());
        $this->assertTrue($seeder->seedIfNeeded());

        $createdAgain = $seeder->seedIfNeeded();
        $this->assertFalse($createdAgain);
        $this->assertSame(1, $seeder->adminCount());
    }
}
