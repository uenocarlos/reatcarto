<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use PHPUnit\Framework\TestCase;

final class CorsTest extends TestCase
{
    private ?string $previousAppBaseUrl = null;

    private ?string $previousCorsAllowedOrigins = null;

    protected function setUp(): void
    {
        $this->previousAppBaseUrl = getenv('APP_BASE_URL') !== false ? getenv('APP_BASE_URL') : null;
        $this->previousCorsAllowedOrigins = getenv('CORS_ALLOWED_ORIGINS') !== false
            ? getenv('CORS_ALLOWED_ORIGINS')
            : null;

        putenv('APP_BASE_URL=http://localhost:5173');
        $_ENV['APP_BASE_URL'] = 'http://localhost:5173';
        putenv('CORS_ALLOWED_ORIGINS=');
        unset($_ENV['CORS_ALLOWED_ORIGINS']);
    }

    protected function tearDown(): void
    {
        $this->restoreEnv('APP_BASE_URL', $this->previousAppBaseUrl);
        $this->restoreEnv('CORS_ALLOWED_ORIGINS', $this->previousCorsAllowedOrigins);
        $_SERVER['HTTP_ORIGIN'] = '';
        $_SERVER['REQUEST_METHOD'] = 'GET';
        if (function_exists('header_remove')) {
            header_remove();
        }
    }

    public function testAllowedOriginIsPermitted(): void
    {
        $this->assertTrue(is_cors_origin_allowed('http://localhost:5173'));
        $this->assertTrue(is_cors_origin_allowed('http://localhost:5173/'));
    }

    public function testDisallowedOriginIsRejected(): void
    {
        $this->assertFalse(is_cors_origin_allowed('https://evil.example'));
    }

    public function testEmptyOriginIsRejected(): void
    {
        $this->assertFalse(is_cors_origin_allowed(''));
    }

    public function testAppBaseUrlIsIncludedInAllowlist(): void
    {
        putenv('APP_BASE_URL=https://app.reatcarto.test');
        $_ENV['APP_BASE_URL'] = 'https://app.reatcarto.test';

        $this->assertContains('https://app.reatcarto.test', cors_allowed_origins());
        $this->assertTrue(is_cors_origin_allowed('https://app.reatcarto.test'));
    }

    public function testCapacitorOriginsAreAllowedByDefault(): void
    {
        $this->assertTrue(is_cors_origin_allowed('capacitor://localhost'));
        $this->assertTrue(is_cors_origin_allowed('https://localhost'));
        $this->assertTrue(is_cors_origin_allowed('http://localhost'));
    }

    public function testExtraOriginsFromEnvAreAllowed(): void
    {
        putenv('CORS_ALLOWED_ORIGINS=https://app.example.com, https://staging.example.com/');
        $_ENV['CORS_ALLOWED_ORIGINS'] = 'https://app.example.com, https://staging.example.com/';

        $this->assertTrue(is_cors_origin_allowed('https://app.example.com'));
        $this->assertTrue(is_cors_origin_allowed('https://staging.example.com'));
        $this->assertFalse(is_cors_origin_allowed('https://other.example.com'));
    }

    private function restoreEnv(string $key, ?string $value): void
    {
        if ($value === null) {
            putenv($key);
            unset($_ENV[$key]);
            return;
        }

        putenv("$key=$value");
        $_ENV[$key] = $value;
    }
}
