<?php

declare(strict_types=1);

/**
 * @return array<string, mixed>|null
 */
function fetch_user_by_id(string $userId): ?array
{
    $stmt = db()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

/**
 * @return array<string, mixed>|null
 */
function fetch_user_by_identifier(string $identifier): ?array
{
    $stmt = db()->prepare(
        'SELECT * FROM users WHERE username = :id OR email = :id LIMIT 1'
    );
    $stmt->execute(['id' => trim($identifier)]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row === false ? null : $row;
}

function username_exists(string $username, ?string $excludeUserId = null): bool
{
    $sql = 'SELECT 1 FROM users WHERE username = :username';
    $params = ['username' => $username];
    if ($excludeUserId !== null) {
        $sql .= ' AND id <> :exclude';
        $params['exclude'] = $excludeUserId;
    }
    $sql .= ' LIMIT 1';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    return (bool) $stmt->fetchColumn();
}

function email_exists(string $email, ?string $excludeUserId = null): bool
{
    $sql = 'SELECT 1 FROM users WHERE email = :email';
    $params = ['email' => $email];
    if ($excludeUserId !== null) {
        $sql .= ' AND id <> :exclude';
        $params['exclude'] = $excludeUserId;
    }
    $sql .= ' LIMIT 1';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    return (bool) $stmt->fetchColumn();
}

/**
 * @return array<string, mixed>
 */
function serialize_user(array $row): array
{
    $userId = (string) $row['id'];

    return [
        'id' => $userId,
        'username' => (string) $row['username'],
        'email' => (string) $row['email'],
        'full_name' => (string) $row['full_name'],
        'organization' => (string) $row['organization'],
        'job_title' => (string) $row['job_title'],
        'phone' => (string) $row['phone'],
        'role' => (string) $row['role'],
        'status' => (string) $row['status'],
        'email_verified' => $row['email_verified_at'] !== null,
        'pending_email' => $row['pending_email'] !== null ? (string) $row['pending_email'] : null,
        'element_categories' => list_user_element_categories($userId),
    ];
}

function hard_delete_user(string $userId): void
{
    delete_user_and_data($userId);
}

function delete_user_and_data(string $userId): void
{
    photos_delete_for_user($userId);
    videos_delete_for_user($userId);
    db()->prepare('DELETE FROM maps WHERE owner_id = :id')->execute(['id' => $userId]);
    revoke_all_user_sessions($userId);
    db()->prepare('DELETE FROM users WHERE id = :id')->execute(['id' => $userId]);
}
