<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Auth;

use AuthException;
use Mailer;
use Reatcarto\Tests\AuthTestCase;

final class VerificationTest extends AuthTestCase
{
    public function testUt013VerifyActivatesUser(): void
    {
        $pending = $this->registerUser();
        $active = $this->verifyLatestToken($pending['id']);
        $this->assertSame('active', $active['status']);
        $this->assertTrue($active['email_verified']);
    }

    public function testUt014ExpiredTokenRejected(): void
    {
        $pending = $this->registerUser();
        db()->prepare(
            'UPDATE email_verification_tokens SET expires_at = NOW() - INTERVAL \'1 hour\'
             WHERE user_id = :id'
        )->execute(['id' => $pending['id']]);
        $token = $this->extractTokenFromMail();
        $this->expectAuthException(fn () => auth_verify_email($token), 'validation_error', 400);
        $row = fetch_user_by_id($pending['id']);
        $this->assertSame('pending_verification', $row['status']);
    }

    public function testUt015ResendGenericSuccess(): void
    {
        $pending = $this->registerUser();
        Mailer::clearRecorded();
        $result = auth_resend_verification($pending['email']);
        $this->assertTrue($result['success']);
        $this->assertNotEmpty(Mailer::recordedMessages());
    }

    public function testUt016TamperedTokenInvalid(): void
    {
        $this->registerUser();
        $this->expectAuthException(fn () => auth_verify_email(str_repeat('a', 64)), 'not_found', 404);
        $this->assertSame(0, (int) db()->query(
            "SELECT COUNT(*) FROM users WHERE status = 'active'"
        )->fetchColumn());
    }

    public function testUt017MissingTokenValidation(): void
    {
        $this->expectAuthException(fn () => auth_verify_email(''), 'validation_error', 400);
    }

    public function testUt018ResendRateLimited(): void
    {
        $pending = $this->registerUser();
        for ($i = 0; $i < AUTH_RATE_LIMIT_MAX; $i++) {
            auth_resend_verification($pending['email']);
        }
        $this->expectAuthException(
            fn () => auth_resend_verification($pending['email']),
            'rate_limited',
            429
        );
    }

    public function testUt019UsedTokenReplaySafe(): void
    {
        $pending = $this->registerUser();
        $token = $this->extractTokenFromMail();
        auth_verify_email($token);
        Mailer::clearRecorded();
        $result = auth_verify_email($token);
        $this->assertSame('active', $result['user']['status']);
        $this->assertSame(0, count(Mailer::recordedMessages()));
    }

    public function testUt172MailerSendsSingleUseVerificationUrl(): void
    {
        $this->registerUser();
        $messages = Mailer::recordedMessages();
        $this->assertCount(1, $messages);
        $this->assertStringContainsString('/verify?token=', $messages[0]['body']);
        $token = $this->extractTokenFromMail();
        auth_verify_email($token);
        $replay = auth_verify_email($token);
        $this->assertTrue($replay['success']);
    }

    public function testIt006VerifyOnlyTargetUser(): void
    {
        $a = $this->registerUser();
        $tokenA = $this->extractTokenFromMail('verification');
        $b = $this->activateUser();
        register_session_for_user($b['id'], 'field');
        auth_verify_email($tokenA);
        $freshA = fetch_user_by_id($a['id']);
        $this->assertSame('active', $freshA['status']);
        $me = auth_me();
        $this->assertSame($b['id'], $me['user']['id']);
    }

    public function testIt007ConcurrentVerifyOnce(): void
    {
        $pending = $this->registerUser();
        $token = $this->extractTokenFromMail();
        auth_verify_email($token);
        $again = auth_verify_email($token);
        $this->assertSame('active', $again['user']['status']);
        $row = fetch_user_by_id($pending['id']);
        $this->assertSame('active', $row['status']);
    }

    public function testIt008ReopenLinkAlreadyVerified(): void
    {
        $pending = $this->registerUser();
        $token = $this->extractTokenFromMail();
        auth_verify_email($token);
        $again = auth_verify_email($token);
        $this->assertSame('active', $again['user']['status']);
    }

    public function testIt009LoginPendingBlocksMapCreate(): void
    {
        $input = $this->validRegisterInput();
        auth_register($input);
        $this->expectAuthException(
            fn () => auth_login($input['username'], $input['password']),
            'account_pending',
            403
        );
    }

    public function testIt010DeactivatedVerifyDoesNotReactivate(): void
    {
        $user = $this->activateUser();
        auth_deactivate_user($user['id']);
        $token = create_verification_token(db(), $user['id']);
        $this->expectAuthException(fn () => auth_verify_email($token), 'account_deactivated', 403);
    }
}
