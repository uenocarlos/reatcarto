<?php

declare(strict_types=1);

namespace Reatcarto\Tests;

use AuthException;
use PHPUnit\Framework\TestCase;

require_once dirname(__DIR__, 2) . '/php/lib/ApkDownload.php';

final class ApkDownloadTest extends TestCase
{
    private ?string $previousApkPath;

    protected function setUp(): void
    {
        $this->previousApkPath = getenv('APK_PATH') === false ? null : (string) getenv('APK_PATH');
    }

    protected function tearDown(): void
    {
        if ($this->previousApkPath === null) {
            putenv('APK_PATH');
            unset($_ENV['APK_PATH']);
        } else {
            putenv('APK_PATH=' . $this->previousApkPath);
            $_ENV['APK_PATH'] = $this->previousApkPath;
        }
    }

    public function testResolveFileReturnsConfiguredPath(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'apk');
        $this->assertNotFalse($path);
        file_put_contents($path, 'apk');
        putenv('APK_PATH=' . $path);
        $_ENV['APK_PATH'] = $path;

        try {
            $this->assertSame($path, apk_resolve_file());
        } finally {
            unlink($path);
        }
    }

    public function testResolveFileFailsWhenMissing(): void
    {
        $missing = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'missing-reatcarto.apk';
        putenv('APK_PATH=' . $missing);
        $_ENV['APK_PATH'] = $missing;

        $this->expectException(AuthException::class);
        apk_resolve_file();
    }
}
