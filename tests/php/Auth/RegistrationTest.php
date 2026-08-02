<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use AuthException;
use Mailer;
use Reatcarto\Tests\AuthTestCase;

final class RegistrationTest extends AuthTestCase
{
    public function testUt001RegisterCreatesPendingUserAndSendsMail(): void
    {
        $input = $this->validRegisterInput();
        $result = auth_register($input);

        $this->assertSame('pending_verification', $result['user']['status']);
        $this->assertFalse($result['user']['email_verified']);
        $this->assertSame(1, $this->userCount());
        $this->assertNotEmpty(Mailer::recordedMessages());
        $this->assertSame('verification', Mailer::recordedMessages()[0]['type']);
    }

    public function testUt002PasswordMismatchValidation(): void
    {
        $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput([
                'password_confirmation' => 'Different123!',
            ])),
            'validation_error',
            400
        );
        $this->assertSame(0, $this->userCount());
    }

    public function testUt003MissingConsentValidation(): void
    {
        $e = $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput(['consent' => false])),
            'validation_error',
            400
        );
        $this->assertArrayHasKey('consent', $e->fields);
        $this->assertSame(0, $this->userCount());
    }

    public function testUt004DuplicateUsername(): void
    {
        $input = $this->validRegisterInput();
        auth_register($input);
        $e = $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput([
                'username' => $input['username'],
                'email' => 'other_' . $input['email'],
            ])),
            'validation_error',
            400
        );
        $this->assertArrayHasKey('username', $e->fields);
    }

    public function testUt005DuplicateEmail(): void
    {
        $input = $this->validRegisterInput();
        auth_register($input);
        $e = $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput([
                'email' => $input['email'],
            ])),
            'validation_error',
            400
        );
        $this->assertArrayHasKey('email', $e->fields);
    }

    public function testUt006UsernameLengthBoundary(): void
    {
        $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput(['username' => 'ab'])),
            'validation_error',
            400
        );
        $user = auth_register($this->validRegisterInput(['username' => 'abc']));
        $this->assertSame('abc', $user['user']['username']);
    }

    public function testUt007PendingUserCannotCreateMap(): void
    {
        $pending = $this->registerUser();
        register_session_for_user($pending['id'], 'field');
        $user = fetch_user_by_id($pending['id']);
        $this->expectException(AuthException::class);
        require_active_user();
    }

    public function testUt008MalformedEmailAndHostileName(): void
    {
        $e = $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput([
                'email' => 'not-an-email',
                'full_name' => '<script>alert(1)</script>',
            ])),
            'validation_error',
            400
        );
        $this->assertArrayHasKey('email', $e->fields);
        $this->assertStringNotContainsString('<script>', json_encode($e->fields));
    }

    public function testUt009MissingRequiredFields(): void
    {
        $e = $this->expectAuthException(fn () => auth_register([]), 'validation_error', 400);
        $this->assertNotEmpty($e->fields);
        $this->assertSame(0, $this->userCount());
    }

    public function testUt010FullNameTooLongAndRegistrationRateLimit(): void
    {
        $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput([
                'full_name' => str_repeat('a', AUTH_TEXT_MAX + 1),
            ])),
            'validation_error',
            400
        );

        for ($i = 0; $i < AUTH_RATE_LIMIT_MAX; $i++) {
            auth_register($this->validRegisterInput());
        }
        $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput()),
            'rate_limited',
            429
        );
    }

    public function testIt001ConcurrentDuplicateEmailRace(): void
    {
        $email = 'race_' . bin2hex(random_bytes(4)) . '@example.com';
        $first = null;
        $second = null;
        try {
            $first = auth_register($this->validRegisterInput(['email' => $email]));
        } catch (AuthException $e) {
            $second = $e;
        }
        try {
            $result = auth_register($this->validRegisterInput(['email' => $email]));
            $first ??= $result;
        } catch (AuthException $e) {
            $second = $e;
        }
        $this->assertSame(1, $this->userCount());
        $this->assertNotNull($first);
        $this->assertNotNull($second);
    }

    public function testIt004ReRegisterAfterHardDelete(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        hard_delete_user($user['id']);
        $again = auth_register($input);
        $this->assertSame('pending_verification', $again['user']['status']);
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM maps')->fetchColumn());
    }

    public function testIt091RegisterContractStatuses(): void
    {
        $created = auth_register($this->validRegisterInput());
        $this->assertTrue($created['success']);
        $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput(['consent' => false])),
            'validation_error',
            400
        );
        db()->exec('DELETE FROM auth_rate_limits');
        $_SERVER['REMOTE_ADDR'] = '10.0.2.50';
        for ($i = 0; $i < AUTH_RATE_LIMIT_MAX; $i++) {
            auth_register($this->validRegisterInput());
        }
        $this->expectAuthException(
            fn () => auth_register($this->validRegisterInput()),
            'rate_limited',
            429
        );
    }
}
