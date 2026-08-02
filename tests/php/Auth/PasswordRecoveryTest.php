<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use Mailer;
use Reatcarto\Tests\AuthTestCase;

final class PasswordRecoveryTest extends AuthTestCase
{
    public function testUt032ForgotSameResponseKnownUnknown(): void
    {
        $known = auth_password_forgot('known@example.com');
        $unknown = auth_password_forgot('unknown@example.com');
        $this->assertSame($known, $unknown);
    }

    public function testUt033ResetChangesPassword(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        auth_password_reset($token, 'NewPassword1!', 'NewPassword1!');
        $this->expectAuthException(
            fn () => auth_login($input['username'], $input['password']),
            'unauthenticated',
            401
        );
        $logged = auth_login($input['username'], 'NewPassword1!');
        $this->assertSame($user['id'], $logged['user']['id']);
    }

    public function testUt034ExpiredOrUsedResetLeavesPassword(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        db()->prepare(
            'UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL \'1 hour\' WHERE user_id = :id'
        )->execute(['id' => $user['id']]);
        $this->expectAuthException(
            fn () => auth_password_reset($token, 'NewPassword1!', 'NewPassword1!'),
            'validation_error',
            400
        );
        auth_login($input['username'], $input['password']);
    }

    public function testUt035MalformedTokenOrShortPassword(): void
    {
        $this->expectAuthException(
            fn () => auth_password_reset('bad', 'short', 'short'),
            'validation_error',
            400
        );
        $this->expectAuthException(
            fn () => auth_password_reset(str_repeat('a', 64), 'ValidPass1!', 'ValidPass1!'),
            'not_found',
            404
        );
    }

    public function testUt036MissingPasswordFields(): void
    {
        $user = $this->activateUser();
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        $this->expectAuthException(
            fn () => auth_password_reset($token, '', ''),
            'validation_error',
            400
        );
    }

    public function testUt037ExcessiveForgotStillGenericSuccess(): void
    {
        for ($i = 0; $i < AUTH_RATE_LIMIT_MAX + 2; $i++) {
            $result = auth_password_forgot('abuse@example.com');
            $this->assertTrue($result['success']);
        }
    }

    public function testUt038ReplayCompletedResetTokenFails(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        auth_password_reset($token, 'NewPassword1!', 'NewPassword1!');
        $this->expectAuthException(
            fn () => auth_password_reset($token, 'AnotherPass1!', 'AnotherPass1!'),
            'validation_error',
            400
        );
    }

    public function testIt015ResetTokenIsolatesUsers(): void
    {
        $a = $this->activateUser($this->validRegisterInput());
        $b = $this->activateUser($this->validRegisterInput());
        auth_password_forgot($a['email']);
        $token = $this->extractTokenFromMail('password_reset');
        register_session_for_user($b['id'], 'field');
        auth_password_reset($token, 'ResetPass123!', 'ResetPass123!');
        auth_me();
    }

    public function testIt016ConcurrentResetOnce(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        auth_password_reset($token, 'NewPassword1!', 'NewPassword1!');
        $this->expectAuthException(
            fn () => auth_password_reset($token, 'AnotherPass1!', 'AnotherPass1!'),
            'validation_error',
            400
        );
        $sessions = (int) db()->query(
            'SELECT COUNT(*) FROM sessions_registry WHERE user_id = \'' . $user['id'] . '\''
        )->fetchColumn();
        $this->assertSame(0, $sessions);
    }

    public function testIt018PendingCannotResetToActiveEditor(): void
    {
        $input = $this->validRegisterInput();
        auth_register($input);
        auth_password_forgot($input['email']);
        $this->assertSame(0, count(array_filter(
            Mailer::recordedMessages(),
            fn ($m) => $m['type'] === 'password_reset'
        )));
    }

    public function testIt019DeactivatedResetDoesNotReactivate(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_deactivate_user($user['id']);
        auth_password_forgot($user['email']);
        $this->assertSame(0, count(array_filter(
            Mailer::recordedMessages(),
            fn ($m) => $m['type'] === 'password_reset'
        )));
    }

    public function testIt020BulkForgotNoEnumerationDiff(): void
    {
        $user = $this->activateUser();
        $known = auth_password_forgot($user['email']);
        $unknown = auth_password_forgot('missing@example.com');
        $this->assertSame(json_encode($known), json_encode($unknown));
    }
}
