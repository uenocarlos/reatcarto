<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Admin;

use Reatcarto\Tests\AdminTestCase;

final class DeleteAccountTest extends AdminTestCase
{
    public function testUt153HardDeleteCascades(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $path = $this->makeJpegTempFile();
        $_FILES = [
            'file' => [
                'name' => 'photo.jpg',
                'type' => 'image/jpeg',
                'tmp_name' => $path,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($path),
            ],
        ];
        photos_upload($user, $_FILES, ['element_id' => $el['id']]);
        register_session_for_user($user['id'], 'field');

        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);

        $this->assertNull(fetch_user_by_id($user['id']));
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM maps')->fetchColumn());
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM map_elements')->fetchColumn());
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM photos')->fetchColumn());
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM sessions_registry')->fetchColumn());
    }

    public function testUt154AfterDeleteLoginFailsPublic404(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        $published = $this->publishedMapForUser($user);
        $publicId = $published['public_id'];
        register_session_for_user($user['id'], 'field');

        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);

        $this->expectAuthException(fn () => auth_login($input['email'], $input['password']), 'unauthenticated', 401);
        $this->expectAuthException(fn () => public_map_get($publicId), 'not_found', 404);
    }

    public function testUt156ReregisterSameEmailEmpty(): void
    {
        $input = $this->validRegisterInput(['email' => 'reuse@example.com', 'username' => 'reuse1']);
        $user = $this->activateUser($input);
        $this->createMapForUser($user);
        register_session_for_user($user['id'], 'field');
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);

        $newUser = auth_register([
            ...$this->validRegisterInput(['email' => 'reuse@example.com', 'username' => 'reuse2']),
        ])['user'];
        $this->assertNotSame($user['id'], $newUser['id']);
        register_session_for_user($newUser['id'], 'field');
        $this->assertSame([], maps_list(fetch_user_by_id($newUser['id']))['maps']);
    }

    public function testUt157WrongPasswordNoDeletion(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        $this->createMapForUser($user);
        register_session_for_user($user['id'], 'field');

        $this->expectAuthException(
            fn () => auth_delete_account($user, 'WrongPass123!', DELETE_ACCOUNT_CONFIRM_PHRASE),
            'validation_error',
            400
        );
        $this->assertNotNull(fetch_user_by_id($user['id']));
    }

    public function testUt158MissingConfirmPhraseNoChanges(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');

        $this->expectAuthException(
            fn () => auth_delete_account($user, $input['password'], ''),
            'validation_error',
            400
        );
        $this->assertNotNull(fetch_user_by_id($user['id']));
    }

    public function testUt159ReplayDeleteIdempotent(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);

        $result = auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);
        $this->assertTrue($result['deleted']);
    }

    public function testUt160RequiresAuthenticatedSession(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        destroy_current_session();

        $this->expectAuthException(fn () => require_active_user(), 'unauthenticated', 401);
    }

    public function testIt085LargeAccountDeletionComplete(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        for ($i = 0; $i < 5; $i++) {
            $map = $this->createMapForUser($user, ['name' => "Map {$i}"]);
            for ($j = 0; $j < 3; $j++) {
                $this->createElementForMap($user, $map['id'], ['name' => "El {$i}-{$j}"]);
            }
        }
        register_session_for_user($user['id'], 'field');
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM maps')->fetchColumn());
        $this->assertSame(0, (int) db()->query('SELECT COUNT(*) FROM map_elements')->fetchColumn());
    }

    public function testIt086OtherUserCannotDeleteVictim(): void
    {
        $victimInput = $this->validRegisterInput(['username' => 'victim', 'email' => 'victim@example.com']);
        $victim = $this->activateUser($victimInput);
        $attacker = $this->activeSessionUser();

        $this->expectAuthException(
            fn () => auth_delete_account($attacker, 'WrongPassword!', DELETE_ACCOUNT_CONFIRM_PHRASE),
            'validation_error',
            400
        );
        $this->assertNotNull(fetch_user_by_id($victim['id']));
        $this->assertNotNull(fetch_user_by_id($attacker['id']));
    }

    public function testIt089DeactivatedSelfDeleteBlocked(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        auth_deactivate_user($user['id']);
        revoke_all_user_sessions($user['id']);

        $this->expectAuthException(fn () => auth_login($input['email'], $input['password']), 'account_deactivated', 403);
        $row = fetch_user_by_id($user['id']);
        register_session_for_user($user['id'], 'field');
        $_SESSION['user_id'] = $user['id'];
        start_session();
        $this->expectAuthException(
            fn () => require_valid_session(),
            'account_deactivated',
            403
        );
    }

    public function testIt096DeleteAccountFreesUniqueness(): void
    {
        $input = $this->validRegisterInput(['username' => 'freeuser', 'email' => 'free@example.com']);
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);

        $this->assertFalse(username_exists('freeuser'));
        $this->assertFalse(email_exists('free@example.com'));
    }

    public function testE2e018PermanentDeleteJourney(): void
    {
        $input = $this->validRegisterInput(['username' => 'delme', 'email' => 'delme@example.com']);
        $user = $this->activateUser($input);
        $published = $this->publishedMapForUser($user);
        $publicId = $published['public_id'];
        register_session_for_user($user['id'], 'field');

        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);

        $this->expectAuthException(fn () => auth_login($input['email'], $input['password']), 'unauthenticated', 401);
        $this->expectAuthException(fn () => public_map_get($publicId), 'not_found', 404);

        $newUser = auth_register([
            ...$this->validRegisterInput(['email' => 'delme@example.com', 'username' => 'delme2']),
        ])['user'];
        $verified = auth_verify_email($this->extractTokenFromMail())['user'];
        register_session_for_user($verified['id'], 'field');
        $this->assertSame([], maps_list(fetch_user_by_id($verified['id']))['maps']);
    }
}
