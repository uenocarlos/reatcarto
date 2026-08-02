<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Security;

use PHPUnit\Framework\TestCase;

final class LegacyLoginEndpointTest extends TestCase
{
    public function testLegacyRootLoginScriptIsNotDeployed(): void
    {
        $path = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'php' . DIRECTORY_SEPARATOR . 'login.php';
        $this->assertFileDoesNotExist(
            $path,
            'Legacy php/login.php must not remain in the web-served tree; use php/auth/login.php instead.'
        );
    }

    public function testNoHardcodedLegacyDbPasswordInPhpTree(): void
    {
        $legacyPath = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'php' . DIRECTORY_SEPARATOR . 'login.php';
        if (!is_readable($legacyPath)) {
            $this->addToAssertionCount(1);

            return;
        }

        $contents = file_get_contents($legacyPath);
        $this->assertIsString($contents);
        $this->assertStringNotContainsString(
            'cma352425',
            $contents,
            'php/login.php must not ship hardcoded database credentials.'
        );
    }
}
