<?php

declare(strict_types=1);

function register_session_for_user(string $userId, string $role): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['role'] = $role;

    $sessionId = session_id();
    db()->prepare(
        'INSERT INTO sessions_registry (session_id, user_id, last_seen_at)
         VALUES (:session_id, :user_id, NOW())
         ON CONFLICT (session_id) DO UPDATE SET user_id = EXCLUDED.user_id, last_seen_at = NOW()'
    )->execute([
        'session_id' => $sessionId,
        'user_id' => $userId,
    ]);
}

function touch_current_session(): void
{
    start_session();
    $sessionId = session_id();
    if ($sessionId === '') {
        return;
    }

    db()->prepare(
        'UPDATE sessions_registry SET last_seen_at = NOW() WHERE session_id = :session_id'
    )->execute(['session_id' => $sessionId]);
}

function destroy_current_session(): void
{
    start_session();
    $sessionId = session_id();
    if ($sessionId !== '') {
        db()->prepare('DELETE FROM sessions_registry WHERE session_id = :session_id')
            ->execute(['session_id' => $sessionId]);
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            (bool) $params['secure'],
            (bool) $params['httponly']
        );
    }
    session_destroy();
}

function revoke_all_user_sessions(string $userId, ?string $exceptSessionId = null): void
{
    $pdo = db();
    if ($exceptSessionId !== null) {
        $pdo->prepare(
            'DELETE FROM sessions_registry WHERE user_id = :user_id AND session_id <> :except'
        )->execute(['user_id' => $userId, 'except' => $exceptSessionId]);
    } else {
        $pdo->prepare('DELETE FROM sessions_registry WHERE user_id = :user_id')
            ->execute(['user_id' => $userId]);
    }
}

function validate_session_registry(): bool
{
    start_session();
    $userId = current_user_id();
    $sessionId = session_id();
    if ($userId === null || $sessionId === '') {
        return false;
    }

    $stmt = db()->prepare(
        'SELECT 1 FROM sessions_registry WHERE session_id = :session_id AND user_id = :user_id'
    );
    $stmt->execute(['session_id' => $sessionId, 'user_id' => $userId]);

    return (bool) $stmt->fetchColumn();
}

function require_valid_session(): array
{
    start_session();
    $userId = current_user_id();
    if ($userId === null) {
        auth_fail('unauthenticated', 'Authentication required.', 401);
    }

    $user = fetch_user_by_id($userId);
    if ($user === null) {
        destroy_current_session();
        auth_fail('unauthenticated', 'Authentication required.', 401);
    }

    if ($user['status'] === 'deactivated') {
        auth_fail('account_deactivated', 'This account has been deactivated.', 403);
    }

    if (!validate_session_registry()) {
        destroy_current_session();
        auth_fail('unauthenticated', 'Authentication required.', 401);
    }

    touch_current_session();

    return $user;
}

function require_active_user(): array
{
    $user = require_valid_session();
    if (email_verification_required() && $user['status'] === 'pending_verification') {
        auth_fail(
            'account_pending',
            'Email verification is required before this action.',
            403
        );
    }
    if ($user['status'] === 'deactivated') {
        auth_fail(
            'account_deactivated',
            'This account has been deactivated.',
            403
        );
    }

    return $user;
}
