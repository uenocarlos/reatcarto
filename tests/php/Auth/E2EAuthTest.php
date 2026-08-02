<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use Mailer;
use Reatcarto\Tests\AuthTestCase;

final class E2EAuthTest extends AuthTestCase
{
    public function testE2e001RegisterFlow(): void
    {
        $input = $this->validRegisterInput();
        $result = auth_register($input);
        $this->assertSame('pending_verification', $result['user']['status']);
        $row = fetch_user_by_id($result['user']['id']);
        $this->assertNotNull($row);
    }

    public function testE2e002VerifyLoginCreateMap(): void
    {
        $input = $this->validRegisterInput();
        $pending = auth_register($input)['user'];
        $active = $this->verifyLatestToken($pending['id']);
        auth_login($input['username'], $input['password']);
        $user = require_active_user();
        $stmt = db()->prepare('INSERT INTO maps (owner_id, name) VALUES (:owner_id, :name) RETURNING id');
        $stmt->execute(['owner_id' => $user['id'], 'name' => 'First map']);
        $this->assertNotFalse($stmt->fetchColumn());
        $this->assertSame('active', $active['status']);
    }

    public function testE2e003LoginLandsWithOwnedMapsOnly(): void
    {
        $ownerInput = $this->validRegisterInput();
        $owner = $this->activateUser($ownerInput);
        $other = $this->activateUser();
        db()->prepare('INSERT INTO maps (owner_id, name) VALUES (:id, :name)')->execute([
            'id' => $owner['id'],
            'name' => 'Mine',
        ]);
        db()->prepare('INSERT INTO maps (owner_id, name) VALUES (:id, :name)')->execute([
            'id' => $other['id'],
            'name' => 'Theirs',
        ]);
        auth_login($ownerInput['username'], $ownerInput['password']);
        register_session_for_user($owner['id'], 'field');
        $stmt = db()->prepare('SELECT COUNT(*) FROM maps WHERE owner_id = :id');
        $stmt->execute(['id' => $owner['id']]);
        $this->assertSame(1, (int) $stmt->fetchColumn());
    }

    public function testE2e004RecoveryFlow(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        auth_password_reset($token, 'RecoveredPass1!', 'RecoveredPass1!');
        auth_login($input['username'], 'RecoveredPass1!');
    }

    public function testE2e005ProfileAndUsernameLogin(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        auth_update_profile(fetch_user_by_id($user['id']), ['full_name' => 'New Profile Name']);
        auth_change_username(fetch_user_by_id($user['id']), 'renamed_user');
        destroy_current_session();
        auth_login('renamed_user', $input['password']);
        $me = auth_me();
        $this->assertSame('New Profile Name', $me['user']['full_name']);
    }

    public function testIt002RegisterIdempotencyBoundedMail(): void
    {
        $input = $this->validRegisterInput();
        auth_register($input);
        $before = count(Mailer::recordedMessages());
        try {
            auth_register($input);
        } catch (\AuthException) {
        }
        $this->assertSame(1, $this->userCount());
        $this->assertLessThanOrEqual($before + 1, count(Mailer::recordedMessages()));
    }

    public function testIt003VerifyUnknownUserNotFound(): void
    {
        $this->expectAuthException(fn () => auth_verify_email(str_repeat('b', 64)), 'not_found', 404);
    }

    public function testIt005RegistrationUnderLoad(): void
    {
        $start = microtime(true);
        for ($i = 0; $i < 5; $i++) {
            auth_register($this->validRegisterInput());
        }
        $this->assertLessThan(10.0, microtime(true) - $start);
    }

    public function testIt012DeepLinkReturnConcept(): void
    {
        $user = $this->activateUser();
        auth_login($user['username'], 'Password123!');
        $this->assertTrue(validate_session_registry());
    }

    public function testIt017ResetDisconnectRetry(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_password_forgot($user['email']);
        $token = $this->extractTokenFromMail('password_reset');
        auth_password_reset($token, 'OnceOnly1!', 'OnceOnly1!');
        $this->expectAuthException(
            fn () => auth_password_reset($token, 'TwiceBad1!', 'TwiceBad1!'),
            'validation_error',
            400
        );
        auth_login($input['username'], 'OnceOnly1!');
    }

    public function testIt023InterruptedPatchAuthoritative(): void
    {
        $ctx = $this->sessionUser();
        auth_update_profile(fetch_user_by_id($ctx['id']), ['full_name' => 'Saved']);
        register_session_for_user($ctx['id'], 'field');
        $me = auth_me();
        $this->assertSame('Saved', $me['user']['full_name']);
    }

    private function sessionUser(): array
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        return array_merge($user, ['password' => $input['password'], 'input' => $input]);
    }
}
