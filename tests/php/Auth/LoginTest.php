<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use AuthException;
use Reatcarto\Tests\AuthTestCase;

final class LoginTest extends AuthTestCase
{
    public function testUt021LoginWithEmail(): void
    {
        $input = $this->validRegisterInput();
        $active = $this->activateUser($input);
        $logged = $this->loginAs($input['email'], $input['password']);
        $this->assertSame($active['id'], $logged['id']);
        $me = auth_me();
        $this->assertSame($active['id'], $me['user']['id']);
    }

    public function testUt022LoginWithUsername(): void
    {
        $input = $this->validRegisterInput();
        $this->activateUser($input);
        $logged = $this->loginAs($input['username'], $input['password']);
        $this->assertSame($input['username'], $logged['username']);
    }

    public function testUt023WrongPasswordGeneric401(): void
    {
        $input = $this->validRegisterInput();
        $this->activateUser($input);

        $wrongPassword = $this->expectAuthException(
            fn () => auth_login($input['email'], 'WrongPass1!'),
            'unauthenticated',
            401
        );
        $unknownIdentifier = $this->expectAuthException(
            fn () => auth_login('missing_' . bin2hex(random_bytes(4)) . '@example.com', 'WrongPass1!'),
            'unauthenticated',
            401
        );

        $this->assertSame($wrongPassword->getMessage(), $unknownIdentifier->getMessage());
        $this->assertSame($wrongPassword->errorCode, $unknownIdentifier->errorCode);
        $this->assertSame($wrongPassword->status, $unknownIdentifier->status);
    }

    public function testUt024PendingAccountStatus(): void
    {
        $input = $this->validRegisterInput();
        auth_register($input);
        $this->expectAuthException(
            fn () => auth_login($input['username'], $input['password']),
            'account_pending',
            403
        );
    }

    public function testUt025DeactivatedAccountStatus(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_deactivate_user($user['id']);
        $this->expectAuthException(
            fn () => auth_login($input['username'], $input['password']),
            'account_deactivated',
            403
        );
    }

    public function testUt026HostileIdentifierSafeFailure(): void
    {
        $this->expectAuthException(
            fn () => auth_login("'; DROP TABLE users; --", 'Password123!'),
            'unauthenticated',
            401
        );
    }

    public function testUt027BlankFieldsValidation(): void
    {
        $this->expectAuthException(fn () => auth_login('', ''), 'validation_error', 400);
    }

    public function testUt028LoginRateLimited(): void
    {
        $input = $this->validRegisterInput();
        $this->activateUser($input);
        for ($i = 0; $i < AUTH_RATE_LIMIT_MAX; $i++) {
            try {
                auth_login($input['email'], 'wrong');
            } catch (AuthException) {
            }
        }
        $this->expectAuthException(
            fn () => auth_login($input['email'], 'wrong'),
            'rate_limited',
            429
        );
    }

    public function testUt161ElementsCreateRequiresSession(): void
    {
        $_SESSION = [];
        $this->expectException(AuthException::class);
        require_active_user();
    }

    public function testIt011MultiDeviceSessions(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);

        session_start();
        register_session_for_user($user['id'], 'field');
        $sessionA = session_id();
        session_write_close();

        session_start();
        register_session_for_user($user['id'], 'field');
        $sessionB = session_id();
        session_write_close();

        $stmt = db()->prepare('SELECT COUNT(*) FROM sessions_registry WHERE user_id = :id');
        $stmt->execute(['id' => $user['id']]);
        $this->assertGreaterThanOrEqual(2, (int) $stmt->fetchColumn());
        $this->assertNotSame($sessionA, $sessionB);
    }

    public function testIt013DeactivatedMidSessionBlocked(): void
    {
        $user = $this->activateUser();
        register_session_for_user($user['id'], 'field');
        auth_deactivate_user($user['id']);
        $this->expectAuthException(fn () => auth_me(), 'account_deactivated', 403);
    }

    public function testIt014ParallelLoginsIsolated(): void
    {
        $a = $this->activateUser($this->validRegisterInput());
        $b = $this->activateUser($this->validRegisterInput());
        register_session_for_user($a['id'], 'field');
        $me = auth_me();
        $this->assertSame($a['id'], $me['user']['id']);
        destroy_current_session();
        register_session_for_user($b['id'], 'field');
        $me = auth_me();
        $this->assertSame($b['id'], $me['user']['id']);
    }

    public function testIt092LoginContract(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        $logged = auth_login($input['email'], $input['password']);
        $this->assertTrue($logged['success']);
        $this->expectAuthException(
            fn () => auth_login($input['email'], 'bad'),
            'unauthenticated',
            401
        );
        auth_deactivate_user($user['id']);
        $this->expectAuthException(
            fn () => auth_login($input['email'], $input['password']),
            'account_deactivated',
            403
        );
    }
}
