<?php

declare(strict_types=1);

namespace Reatcarto\Tests;

use AuthException;
use Mailer;

abstract class AuthTestCase extends PostgisTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->migrationRunner()->applyPending();
        db()->exec('DELETE FROM auth_rate_limits');
        Mailer::enableRecording(true);
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    }

    protected function tearDown(): void
    {
        Mailer::clearRecorded();
        parent::tearDown();
    }

    protected function validRegisterInput(array $overrides = []): array
    {
        $suffix = bin2hex(random_bytes(4));

        return array_merge([
            'username' => 'user_' . $suffix,
            'email' => "user_{$suffix}@example.com",
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'full_name' => 'Test User',
            'organization' => 'Org Test',
            'job_title' => 'Surveyor',
            'phone' => '+5511999999999',
            'consent' => true,
        ], $overrides);
    }

    protected function registerUser(array $overrides = []): array
    {
        $result = auth_register($this->validRegisterInput($overrides));

        return $result['user'];
    }

    protected function verifyLatestToken(string $userId): array
    {
        $stmt = db()->prepare(
            'SELECT token_hash FROM email_verification_tokens
             WHERE user_id = :id AND used_at IS NULL ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute(['id' => $userId]);
        $hash = $stmt->fetchColumn();
        $this->assertNotFalse($hash);
        $messages = Mailer::recordedMessages();
        $this->assertNotEmpty($messages);
        $body = end($messages)['body'];
        preg_match('/token=([a-f0-9]+)/', $body, $matches);
        $this->assertNotEmpty($matches[1]);

        return auth_verify_email($matches[1])['user'];
    }

    protected function activateUser(array $overrides = []): array
    {
        $pending = $this->registerUser($overrides);

        return $this->verifyLatestToken($pending['id']);
    }

    protected function loginAs(string $identifier, string $password): array
    {
        return auth_login($identifier, $password)['user'];
    }

    protected function expectAuthException(callable $fn, string $code, int $status): AuthException
    {
        try {
            $fn();
            $this->fail('Expected AuthException with code ' . $code);
        } catch (AuthException $e) {
            $this->assertSame($code, $e->errorCode);
            $this->assertSame($status, $e->status);

            return $e;
        }
    }

    protected function userCount(): int
    {
        return (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
    }

    protected function extractTokenFromMail(?string $type = 'verification'): string
    {
        $messages = Mailer::recordedMessages();
        $this->assertNotEmpty($messages);
        $msg = null;
        if ($type !== null) {
            foreach (array_reverse($messages) as $candidate) {
                if ($candidate['type'] === $type) {
                    $msg = $candidate;
                    break;
                }
            }
        } else {
            $msg = end($messages);
        }
        $this->assertNotNull($msg);
        preg_match('/token=([a-f0-9]+)/', $msg['body'], $matches);
        $this->assertNotEmpty($matches[1]);

        return $matches[1];
    }
}
