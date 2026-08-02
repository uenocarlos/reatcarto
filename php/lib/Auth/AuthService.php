<?php

declare(strict_types=1);

require_once __DIR__ . '/AuthException.php';
require_once __DIR__ . '/Validation.php';
require_once __DIR__ . '/RateLimiter.php';
require_once __DIR__ . '/TokenService.php';
require_once __DIR__ . '/SessionService.php';
require_once __DIR__ . '/UserRepository.php';
require_once dirname(__DIR__, 2) . '/mail/Mailer.php';

/** Valid bcrypt hash used when no user row exists so login always performs password_verify work. */
const AUTH_DUMMY_BCRYPT_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

/**
 * @return array{success: true, user: array<string, mixed>}|never
 */
function auth_register(array $input): array
{
    $fields = [];
    $required = [
        'username' => 'Username',
        'email' => 'Email',
        'password' => 'Password',
        'password_confirmation' => 'Password confirmation',
        'full_name' => 'Full name',
        'organization' => 'Organization',
        'job_title' => 'Job title',
        'phone' => 'Phone',
    ];

    foreach ($required as $key => $label) {
        if (!array_key_exists($key, $input) || (is_string($input[$key]) && trim($input[$key]) === '')) {
            $fields[$key] = $label . ' is required.';
        }
    }

    $consent = $input['consent'] ?? $input['consent_accepted'] ?? false;
    if (!$consent) {
        $fields['consent'] = 'You must accept the Terms of Use and Privacy Policy.';
    }

    if (isset($input['username'])) {
        $err = validate_username(is_string($input['username']) ? $input['username'] : null);
        if ($err !== null) {
            $fields['username'] = $err;
        }
    }
    if (isset($input['email'])) {
        $err = validate_email(is_string($input['email']) ? $input['email'] : null);
        if ($err !== null) {
            $fields['email'] = $err;
        }
    }
    if (isset($input['password'])) {
        $err = validate_password(is_string($input['password']) ? $input['password'] : null);
        if ($err !== null) {
            $fields['password'] = $err;
        }
    }
    if (isset($input['password'], $input['password_confirmation'])
        && is_string($input['password'])
        && is_string($input['password_confirmation'])
        && $input['password'] !== $input['password_confirmation']) {
        $fields['password_confirmation'] = 'Passwords do not match.';
    }

    foreach (['full_name' => 'Full name', 'organization' => 'Organization', 'job_title' => 'Job title'] as $key => $label) {
        if (isset($input[$key]) && is_string($input[$key])) {
            if (contains_hostile_markup($input[$key])) {
                $fields[$key] = sanitize_error_message($label . ' contains invalid characters.');
            } else {
                $err = validate_required_text($input[$key], $label);
                if ($err !== null) {
                    $fields[$key] = $err;
                }
            }
        }
    }

    if (isset($input['phone']) && is_string($input['phone']) && strlen(trim($input['phone'])) > AUTH_PHONE_MAX) {
        $fields['phone'] = 'Phone is too long.';
    }

    if ($fields !== []) {
        auth_fail('validation_error', 'Validation failed.', 400, $fields);
    }

    $ip = request_client_ip();
    enforce_rate_limit(rate_limit_bucket('register', $ip));

    $username = trim((string) $input['username']);
    $email = trim((string) $input['email']);

    if (username_exists($username)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'username' => 'Username is already taken.',
        ]);
    }
    if (email_exists($email)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'email' => 'Email is already registered.',
        ]);
    }

    $config = app_config();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO users (
                username, email, password_hash, full_name, organization, job_title, phone,
                role, status, terms_version, privacy_version, consent_accepted_at
            ) VALUES (
                :username, :email, :password_hash, :full_name, :organization, :job_title, :phone,
                :role, :status, :terms_version, :privacy_version, NOW()
            ) RETURNING *'
        );
        $stmt->execute([
            'username' => $username,
            'email' => $email,
            'password_hash' => password_hash((string) $input['password'], PASSWORD_DEFAULT),
            'full_name' => trim((string) $input['full_name']),
            'organization' => trim((string) $input['organization']),
            'job_title' => trim((string) $input['job_title']),
            'phone' => trim((string) $input['phone']),
            'role' => 'field',
            'status' => 'pending_verification',
            'terms_version' => $config['terms_version'],
            'privacy_version' => $config['privacy_version'],
        ]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        $token = create_verification_token($pdo, (string) $user['id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (str_contains($e->getMessage(), 'users_username_key') || str_contains($e->getMessage(), 'unique')) {
            if (username_exists($username)) {
                auth_fail('validation_error', 'Validation failed.', 400, [
                    'username' => 'Username is already taken.',
                ]);
            }
            auth_fail('validation_error', 'Validation failed.', 400, [
                'email' => 'Email is already registered.',
            ]);
        }
        throw $e;
    }

    Mailer::sendVerificationEmail($email, $token);

    return [
        'success' => true,
        'user' => serialize_user($user),
    ];
}

/**
 * @return array{success: true, user: array<string, mixed>}|never
 */
function auth_verify_email(string $token, ?string $type = null): array
{
    if (trim($token) === '') {
        auth_fail('validation_error', 'Verification token is required.', 400, [
            'token' => 'Token is required.',
        ]);
    }

    $pdo = db();
    $tables = $type === 'email_change'
        ? ['email_change_tokens']
        : ['email_verification_tokens', 'email_change_tokens'];

    $found = null;
    foreach ($tables as $table) {
        $found = find_token_row($pdo, $token, $table);
        if ($found !== null) {
            break;
        }
    }

    if ($found === null) {
        auth_fail('not_found', 'Invalid or unknown verification token.', 404);
    }

    $row = $found['row'];
    $table = $found['table'];

    if (is_token_used($row)) {
        if ($table === 'email_verification_tokens') {
            $user = fetch_user_by_id((string) $row['user_id']);
            if ($user !== null && $user['status'] === 'active' && $user['email_verified_at'] !== null) {
                return ['success' => true, 'user' => serialize_user($user)];
            }
        }
        auth_fail('validation_error', 'This verification link has already been used.', 400, [
            'token' => 'Token already used.',
        ]);
    }

    if (is_token_expired($row)) {
        auth_fail('validation_error', 'Verification token has expired.', 400, [
            'token' => 'Token expired.',
        ]);
    }

    $user = fetch_user_by_id((string) $row['user_id']);
    if ($user === null) {
        auth_fail('not_found', 'Invalid or unknown verification token.', 404);
    }

    if ($user['status'] === 'deactivated') {
        auth_fail('account_deactivated', 'This account has been deactivated.', 403);
    }

    $pdo->beginTransaction();
    try {
        if ($table === 'email_change_tokens') {
            $pdo->prepare(
                'UPDATE users SET email = :email, pending_email = NULL, email_verified_at = NOW(), updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'email' => (string) $row['pending_email'],
                'id' => $user['id'],
            ]);
        } else {
            if ($user['status'] === 'active' && $user['email_verified_at'] !== null) {
                mark_token_used($pdo, $table, (string) $row['id']);
                $pdo->commit();
                $fresh = fetch_user_by_id((string) $user['id']);

                return ['success' => true, 'user' => serialize_user($fresh)];
            }
            $pdo->prepare(
                'UPDATE users SET status = :status, email_verified_at = NOW(), updated_at = NOW()
                 WHERE id = :id'
            )->execute(['status' => 'active', 'id' => $user['id']]);
        }
        mark_token_used($pdo, $table, (string) $row['id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $fresh = fetch_user_by_id((string) $user['id']);

    return ['success' => true, 'user' => serialize_user($fresh)];
}

function auth_resend_verification(string $email): array
{
    if (trim($email) === '') {
        auth_fail('validation_error', 'Email is required.', 400, ['email' => 'Email is required.']);
    }

    $ip = request_client_ip();
    enforce_rate_limit(rate_limit_bucket('resend_verification', $ip, $email));

    $user = fetch_user_by_identifier($email);
    if ($user !== null && $user['status'] === 'pending_verification') {
        $token = create_verification_token(db(), (string) $user['id']);
        Mailer::sendVerificationEmail((string) $user['email'], $token);
    }

    return [
        'success' => true,
        'message' => 'If an account exists and requires verification, instructions have been sent.',
    ];
}

/**
 * @return array{success: true, user: array<string, mixed>}|never
 */
function auth_login(string $identifier, string $password): array
{
    $fields = [];
    if (trim($identifier) === '') {
        $fields['identifier'] = 'Identifier is required.';
    }
    if ($password === '') {
        $fields['password'] = 'Password is required.';
    }
    if ($fields !== []) {
        auth_fail('validation_error', 'Validation failed.', 400, $fields);
    }

    $ip = request_client_ip();
    enforce_rate_limit(rate_limit_bucket('login', $ip, $identifier));

    $user = fetch_user_by_identifier($identifier);

    $hashForVerify = $user !== null
        ? (string) $user['password_hash']
        : AUTH_DUMMY_BCRYPT_HASH;
    $authenticated = password_verify($password, $hashForVerify);

    if ($user === null || !$authenticated) {
        auth_fail('unauthenticated', 'Invalid credentials.', 401);
    }

    if ($user['status'] === 'pending_verification') {
        auth_fail(
            'account_pending',
            'Email verification is required. Check your inbox or request a new verification email.',
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

    register_session_for_user((string) $user['id'], (string) $user['role']);

    return ['success' => true, 'user' => serialize_user($user)];
}

function auth_logout(): array
{
    destroy_current_session();

    return ['success' => true];
}

function auth_me(): array
{
    $user = require_valid_session();
    if ($user['status'] === 'deactivated') {
        auth_fail('account_deactivated', 'This account has been deactivated.', 403);
    }

    return ['success' => true, 'user' => serialize_user($user)];
}

function auth_password_forgot(string $email): array
{
    $ip = request_client_ip();
    if (!check_rate_limit(rate_limit_bucket('password_forgot', $ip, $email))) {
        return [
            'success' => true,
            'message' => 'If an account exists for that email, reset instructions have been sent.',
        ];
    }

    $user = fetch_user_by_identifier($email);
    if ($user !== null && $user['status'] === 'active' && $user['email_verified_at'] !== null) {
        $token = create_password_reset_token(db(), (string) $user['id']);
        Mailer::sendPasswordResetEmail((string) $user['email'], $token);
    }

    return [
        'success' => true,
        'message' => 'If an account exists for that email, reset instructions have been sent.',
    ];
}

/**
 * @return array{success: true}|never
 */
function auth_password_reset(string $token, string $password, string $confirmation): array
{
    $fields = [];
    if (trim($token) === '') {
        $fields['token'] = 'Token is required.';
    }
    $passErr = validate_password($password);
    if ($passErr !== null) {
        $fields['password'] = $passErr;
    }
    if ($password !== $confirmation) {
        $fields['password_confirmation'] = 'Passwords do not match.';
    }
    if ($fields !== []) {
        auth_fail('validation_error', 'Validation failed.', 400, $fields);
    }

    $found = find_token_row(db(), $token, 'password_reset_tokens');
    if ($found === null) {
        auth_fail('not_found', 'Invalid or unknown reset token.', 404);
    }

    $row = $found['row'];
    if (is_token_used($row)) {
        auth_fail('validation_error', 'Reset token has already been used.', 400, [
            'token' => 'Token already used.',
        ]);
    }
    if (is_token_expired($row)) {
        auth_fail('validation_error', 'Reset token has expired.', 400, [
            'token' => 'Token expired.',
        ]);
    }

    $user = fetch_user_by_id((string) $row['user_id']);
    if ($user === null || $user['status'] !== 'active') {
        auth_fail('not_found', 'Invalid or unknown reset token.', 404);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id'
        )->execute([
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'id' => $user['id'],
        ]);
        mark_token_used($pdo, 'password_reset_tokens', (string) $row['id']);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    revoke_all_user_sessions((string) $user['id']);

    return ['success' => true];
}

/**
 * @return array{success: true, user: array<string, mixed>}|never
 */
function auth_update_profile(array $user, array $patch): array
{
    if ($user['status'] === 'deactivated') {
        auth_fail('account_deactivated', 'This account has been deactivated.', 403);
    }

    $fields = [];
    $allowed = ['full_name', 'organization', 'job_title', 'phone'];
    $updates = [];

    foreach ($allowed as $key) {
        if (!array_key_exists($key, $patch)) {
            continue;
        }
        $value = is_string($patch[$key]) ? trim($patch[$key]) : '';
        if (in_array($key, ['full_name', 'organization', 'job_title'], true) && $value === '') {
            $fields[$key] = ucfirst(str_replace('_', ' ', $key)) . ' is required.';
            continue;
        }
        $max = $key === 'phone' ? AUTH_PHONE_MAX : AUTH_TEXT_MAX;
        if (strlen($value) > $max) {
            $fields[$key] = ucfirst(str_replace('_', ' ', $key)) . ' is too long.';
            continue;
        }
        $updates[$key] = $value;
    }

    if ($fields !== []) {
        auth_fail('validation_error', 'Validation failed.', 400, $fields);
    }
    if ($updates === []) {
        auth_fail('validation_error', 'No valid fields to update.', 400);
    }

    $ip = request_client_ip();
    enforce_rate_limit(rate_limit_bucket('profile', $ip, (string) $user['id']));

    $setParts = [];
    $params = ['id' => $user['id']];
    foreach ($updates as $key => $value) {
        $setParts[] = "{$key} = :{$key}";
        $params[$key] = $value;
    }
    $sql = 'UPDATE users SET ' . implode(', ', $setParts) . ', updated_at = NOW() WHERE id = :id RETURNING *';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $fresh = $stmt->fetch(PDO::FETCH_ASSOC);

    return ['success' => true, 'user' => serialize_user($fresh)];
}

/**
 * @return array{success: true, user: array<string, mixed>}|never
 */
function auth_change_username(array $user, string $username): array
{
    $err = validate_username($username);
    if ($err !== null) {
        auth_fail('validation_error', 'Validation failed.', 400, ['username' => $err]);
    }
    if (username_exists($username, (string) $user['id'])) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'username' => 'Username is already taken.',
        ]);
    }

    $stmt = db()->prepare(
        'UPDATE users SET username = :username, updated_at = NOW() WHERE id = :id RETURNING *'
    );
    $stmt->execute(['username' => trim($username), 'id' => $user['id']]);
    $fresh = $stmt->fetch(PDO::FETCH_ASSOC);

    return ['success' => true, 'user' => serialize_user($fresh)];
}

/**
 * @return array{success: true, user: array<string, mixed>}|never
 */
function auth_change_email(array $user, string $email): array
{
    $err = validate_email($email);
    if ($err !== null) {
        auth_fail('validation_error', 'Validation failed.', 400, ['email' => $err]);
    }
    $email = trim($email);
    if (strcasecmp($email, (string) $user['email']) === 0) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'email' => 'New email must differ from the current email.',
        ]);
    }
    if (email_exists($email, (string) $user['id'])) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'email' => 'Email is already registered.',
        ]);
    }

    db()->prepare(
        'UPDATE users SET pending_email = :pending_email, updated_at = NOW() WHERE id = :id'
    )->execute(['pending_email' => $email, 'id' => $user['id']]);

    $token = create_email_change_token(db(), (string) $user['id'], $email);
    Mailer::sendEmailChangeVerification($email, $token);

    $fresh = fetch_user_by_id((string) $user['id']);

    return ['success' => true, 'user' => serialize_user($fresh)];
}

/**
 * @return array{success: true}|never
 */
function auth_change_password(array $user, string $currentPassword, string $newPassword, string $confirmation): array
{
    $fields = [];
    if ($currentPassword === '') {
        $fields['current_password'] = 'Current password is required.';
    }
    $passErr = validate_password($newPassword);
    if ($passErr !== null) {
        $fields['new_password'] = $passErr;
    }
    if ($newPassword !== $confirmation) {
        $fields['password_confirmation'] = 'Passwords do not match.';
    }
    if ($fields !== []) {
        auth_fail('validation_error', 'Validation failed.', 400, $fields);
    }

    if (!password_verify($currentPassword, (string) $user['password_hash'])) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'current_password' => 'Current password is incorrect.',
        ]);
    }

    db()->prepare(
        'UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id'
    )->execute([
        'hash' => password_hash($newPassword, PASSWORD_DEFAULT),
        'id' => $user['id'],
    ]);

    start_session();
    $currentSession = session_id();
    revoke_all_user_sessions((string) $user['id'], $currentSession !== '' ? $currentSession : null);
    session_regenerate_id(true);

    return ['success' => true];
}

function auth_deactivate_user(string $userId): void
{
    db()->prepare(
        'UPDATE users SET status = :status, updated_at = NOW() WHERE id = :id'
    )->execute(['status' => 'deactivated', 'id' => $userId]);
}

/**
 * @return array{success: true, deleted: true}|never
 */
function auth_delete_account(array $user, string $password, string $confirmPhrase): array
{
    $fields = [];
    if ($password === '') {
        $fields['password'] = 'Password is required.';
    }
    if (trim($confirmPhrase) === '') {
        $fields['confirm_phrase'] = 'Confirmation phrase is required.';
    } elseif ($confirmPhrase !== DELETE_ACCOUNT_CONFIRM_PHRASE) {
        $fields['confirm_phrase'] = 'Confirmation phrase does not match.';
    }
    if ($fields !== []) {
        auth_fail('validation_error', 'Validation failed.', 400, $fields);
    }

    $fresh = fetch_user_by_id((string) $user['id']);
    if ($fresh === null) {
        destroy_current_session();

        return ['success' => true, 'deleted' => true];
    }

    if (!password_verify($password, (string) $fresh['password_hash'])) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'password' => 'Current password is incorrect.',
        ]);
    }

    $userId = (string) $fresh['id'];
    delete_user_and_data($userId);
    destroy_current_session();

    return ['success' => true, 'deleted' => true];
}
