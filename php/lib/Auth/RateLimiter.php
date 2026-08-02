<?php

declare(strict_types=1);

const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 900;

function rate_limit_bucket(string $action, string $ip, string $identifier = ''): string
{
    return $action . ':' . $ip . ':' . strtolower(trim($identifier));
}

function check_rate_limit(string $bucketKey, int $max = AUTH_RATE_LIMIT_MAX, int $windowSeconds = AUTH_RATE_LIMIT_WINDOW_SECONDS): bool
{
    $pdo = db();
    $windowStart = rate_limit_window_start($windowSeconds);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'SELECT attempt_count FROM auth_rate_limits
             WHERE bucket_key = :key AND window_start = :window
             FOR UPDATE'
        );
        $stmt->execute(['key' => $bucketKey, 'window' => $windowStart]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            $insert = $pdo->prepare(
                'INSERT INTO auth_rate_limits (bucket_key, window_start, attempt_count)
                 VALUES (:key, :window, 1)'
            );
            $insert->execute(['key' => $bucketKey, 'window' => $windowStart]);
            $pdo->commit();

            return true;
        }

        if ((int) $row['attempt_count'] >= $max) {
            $pdo->commit();

            return false;
        }

        $update = $pdo->prepare(
            'UPDATE auth_rate_limits SET attempt_count = attempt_count + 1
             WHERE bucket_key = :key AND window_start = :window'
        );
        $update->execute(['key' => $bucketKey, 'window' => $windowStart]);
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function rate_limit_window_start(int $windowSeconds = AUTH_RATE_LIMIT_WINDOW_SECONDS): string
{
    $now = time();
    $aligned = $now - ($now % $windowSeconds);

    return gmdate('Y-m-d H:i:s', $aligned);
}

function request_client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

function enforce_rate_limit(string $bucketKey): void
{
    if (!check_rate_limit($bucketKey)) {
        auth_fail(
            'rate_limited',
            'Too many attempts. Please try again later.',
            429
        );
    }
}
