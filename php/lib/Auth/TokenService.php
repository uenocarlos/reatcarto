<?php

declare(strict_types=1);

const TOKEN_TTL_HOURS = 24;

function generate_raw_token(): string
{
    return bin2hex(random_bytes(32));
}

function hash_token(string $rawToken): string
{
    return hash('sha256', $rawToken);
}

function token_expires_at(): string
{
    return gmdate('Y-m-d H:i:s', time() + TOKEN_TTL_HOURS * 3600);
}

function invalidate_user_tokens(PDO $pdo, string $userId, string $table): void
{
    $allowed = ['email_verification_tokens', 'email_change_tokens', 'password_reset_tokens'];
    if (!in_array($table, $allowed, true)) {
        throw new InvalidArgumentException('Invalid token table.');
    }

    $pdo->prepare(
        "UPDATE {$table} SET used_at = NOW() WHERE user_id = :user_id AND used_at IS NULL"
    )->execute(['user_id' => $userId]);
}

function create_verification_token(PDO $pdo, string $userId): string
{
    invalidate_user_tokens($pdo, $userId, 'email_verification_tokens');
    $raw = generate_raw_token();
    $pdo->prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES (:user_id, :hash, :expires_at)'
    )->execute([
        'user_id' => $userId,
        'hash' => hash_token($raw),
        'expires_at' => token_expires_at(),
    ]);

    return $raw;
}

function create_password_reset_token(PDO $pdo, string $userId): string
{
    invalidate_user_tokens($pdo, $userId, 'password_reset_tokens');
    $raw = generate_raw_token();
    $pdo->prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (:user_id, :hash, :expires_at)'
    )->execute([
        'user_id' => $userId,
        'hash' => hash_token($raw),
        'expires_at' => token_expires_at(),
    ]);

    return $raw;
}

function create_email_change_token(PDO $pdo, string $userId, string $pendingEmail): string
{
    invalidate_user_tokens($pdo, $userId, 'email_change_tokens');
    $raw = generate_raw_token();
    $pdo->prepare(
        'INSERT INTO email_change_tokens (user_id, token_hash, pending_email, expires_at)
         VALUES (:user_id, :hash, :pending_email, :expires_at)'
    )->execute([
        'user_id' => $userId,
        'hash' => hash_token($raw),
        'pending_email' => $pendingEmail,
        'expires_at' => token_expires_at(),
    ]);

    return $raw;
}

/**
 * @return array{row: array<string, mixed>, table: string}|null
 */
function find_token_row(PDO $pdo, string $rawToken, string $table): ?array
{
    $allowed = ['email_verification_tokens', 'email_change_tokens', 'password_reset_tokens'];
    if (!in_array($table, $allowed, true)) {
        throw new InvalidArgumentException('Invalid token table.');
    }

    $hash = hash_token($rawToken);
    $stmt = $pdo->prepare(
        "SELECT * FROM {$table} WHERE token_hash = :hash LIMIT 1"
    );
    $stmt->execute(['hash' => $hash]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        return null;
    }

    return ['row' => $row, 'table' => $table];
}

function mark_token_used(PDO $pdo, string $table, string $tokenId): void
{
    $pdo->prepare(
        "UPDATE {$table} SET used_at = NOW() WHERE id = :id"
    )->execute(['id' => $tokenId]);
}

function is_token_expired(array $row): bool
{
    return strtotime((string) $row['expires_at']) < time();
}

function is_token_used(array $row): bool
{
    return $row['used_at'] !== null;
}
