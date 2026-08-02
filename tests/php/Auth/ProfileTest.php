<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use Reatcarto\Tests\AuthTestCase;

final class ProfileTest extends AuthTestCase
{
    private function sessionUser(array $overrides = []): array
    {
        $input = $this->validRegisterInput($overrides);
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        return array_merge($user, ['password' => $input['password'], 'input' => $input]);
    }

    public function testUt039ProfileUpdate(): void
    {
        $ctx = $this->sessionUser();
        $result = auth_update_profile(fetch_user_by_id($ctx['id']), [
            'full_name' => 'Updated Name',
            'organization' => 'New Org',
            'job_title' => 'Lead',
            'phone' => '+5511888888888',
        ]);
        $this->assertSame('Updated Name', $result['user']['full_name']);
    }

    public function testUt040ChangeUsername(): void
    {
        $ctx = $this->sessionUser();
        auth_change_username(fetch_user_by_id($ctx['id']), 'new_username');
        auth_login('new_username', $ctx['password']);
        $this->expectAuthException(
            fn () => auth_login($ctx['input']['username'], $ctx['password']),
            'unauthenticated',
            401
        );
    }

    public function testUt041ChangeEmailPending(): void
    {
        $ctx = $this->sessionUser();
        auth_change_email(fetch_user_by_id($ctx['id']), 'newmail@example.com');
        $fresh = fetch_user_by_id($ctx['id']);
        $this->assertSame('newmail@example.com', $fresh['pending_email']);
        $this->assertSame($ctx['email'], $fresh['email']);
    }

    public function testUt042ChangePasswordRevokesOtherSessions(): void
    {
        $ctx = $this->sessionUser();
        register_session_for_user($ctx['id'], 'field');
        $otherSession = session_id();
        session_write_close();

        session_start();
        register_session_for_user($ctx['id'], 'field');
        auth_change_password(
            fetch_user_by_id($ctx['id']),
            $ctx['password'],
            'BrandNewPass1!',
            'BrandNewPass1!'
        );
        $remaining = (int) db()->query(
            'SELECT COUNT(*) FROM sessions_registry WHERE user_id = \'' . $ctx['id'] . '\''
        )->fetchColumn();
        $this->assertSame(1, $remaining);
        $exists = (int) db()->prepare(
            'SELECT COUNT(*) FROM sessions_registry WHERE session_id = :sid'
        )->execute(['sid' => $otherSession]) ?: 0;
        $stmt = db()->prepare('SELECT COUNT(*) FROM sessions_registry WHERE session_id = :sid');
        $stmt->execute(['sid' => $otherSession]);
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    public function testUt043DuplicateAndWrongPasswordErrors(): void
    {
        $ctx = $this->sessionUser();
        $other = $this->activateUser();
        $e = $this->expectAuthException(
            fn () => auth_change_username(fetch_user_by_id($ctx['id']), $other['username']),
            'validation_error',
            400
        );
        $this->assertArrayHasKey('username', $e->fields);
        $this->expectAuthException(
            fn () => auth_change_password(fetch_user_by_id($ctx['id']), 'wrong', 'BrandNewPass1!', 'BrandNewPass1!'),
            'validation_error',
            400
        );
    }

    public function testUt044ClearRequiredFullNameRejected(): void
    {
        $ctx = $this->sessionUser();
        $this->expectAuthException(
            fn () => auth_update_profile(fetch_user_by_id($ctx['id']), ['full_name' => '']),
            'validation_error',
            400
        );
    }

    public function testUt045OverlongPhoneAndRateLimit(): void
    {
        $ctx = $this->sessionUser();
        $this->expectAuthException(
            fn () => auth_update_profile(fetch_user_by_id($ctx['id']), [
                'phone' => str_repeat('1', AUTH_PHONE_MAX + 1),
            ]),
            'validation_error',
            400
        );
        for ($i = 0; $i < AUTH_RATE_LIMIT_MAX; $i++) {
            auth_update_profile(fetch_user_by_id($ctx['id']), ['phone' => '+551199999999' . $i]);
        }
        $this->expectAuthException(
            fn () => auth_update_profile(fetch_user_by_id($ctx['id']), ['phone' => '+5511999999999']),
            'rate_limited',
            429
        );
    }

    public function testUt046RepeatPendingEmailReplacesTokens(): void
    {
        $ctx = $this->sessionUser();
        auth_change_email(fetch_user_by_id($ctx['id']), 'pending@example.com');
        auth_change_email(fetch_user_by_id($ctx['id']), 'pending@example.com');
        $count = (int) db()->query(
            'SELECT COUNT(*) FROM email_change_tokens WHERE user_id = \'' . $ctx['id'] . '\' AND used_at IS NULL'
        )->fetchColumn();
        $this->assertSame(1, $count);
    }

    public function testIt021ProfileAuthorization(): void
    {
        $a = $this->activateUser();
        $b = $this->sessionUser();
        auth_update_profile(fetch_user_by_id($b['id']), ['full_name' => 'B Updated']);
        $freshA = fetch_user_by_id($a['id']);
        $this->assertNotSame('B Updated', $freshA['full_name']);
    }

    public function testIt022ConcurrentProfileLastWriteWins(): void
    {
        $ctx = $this->sessionUser();
        $row = fetch_user_by_id($ctx['id']);
        auth_update_profile($row, ['full_name' => 'First']);
        auth_update_profile(fetch_user_by_id($ctx['id']), ['full_name' => 'Second']);
        register_session_for_user($ctx['id'], 'field');
        $me = auth_me();
        $this->assertSame('Second', $me['user']['full_name']);
    }

    public function testIt024OlderEmailChangeTokenRejected(): void
    {
        $ctx = $this->sessionUser();
        auth_change_email(fetch_user_by_id($ctx['id']), 'first@example.com');
        $oldToken = $this->extractTokenFromMail('email_change');
        auth_change_email(fetch_user_by_id($ctx['id']), 'second@example.com');
        $this->expectAuthException(fn () => auth_verify_email($oldToken, 'email_change'), 'validation_error', 400);
        $newToken = $this->extractTokenFromMail('email_change');
        auth_verify_email($newToken, 'email_change');
        $fresh = fetch_user_by_id($ctx['id']);
        $this->assertSame('second@example.com', $fresh['email']);
    }

    public function testIt025DeactivatedProfileBlocked(): void
    {
        $ctx = $this->sessionUser();
        auth_deactivate_user($ctx['id']);
        $this->expectAuthException(
            fn () => auth_update_profile(fetch_user_by_id($ctx['id']), ['full_name' => 'Nope']),
            'account_deactivated',
            403
        );
    }

    public function testIt026UsernameUniquenessAtScale(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $_SERVER['REMOTE_ADDR'] = '10.0.1.' . $i;
            $this->activateUser($this->validRegisterInput(['username' => 'scale_user_' . $i]));
        }
        $ctx = $this->sessionUser();
        $this->expectAuthException(
            fn () => auth_change_username(fetch_user_by_id($ctx['id']), 'scale_user_2'),
            'validation_error',
            400
        );
    }
}
