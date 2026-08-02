<?php

declare(strict_types=1);

final class AdminSeeder
{
    public function __construct(
        private readonly PDO $db,
        private readonly array $config,
    ) {
    }

    public function seedIfNeeded(): bool
    {
        if ($this->adminCount() > 0) {
            return false;
        }

        $admin = $this->config['admin'] ?? [];
        $email = $admin['email'] ?? null;
        $username = $admin['username'] ?? null;
        $password = $admin['password'] ?? null;

        if ($email === null || $username === null || $password === null) {
            throw new InvalidArgumentException(
                'ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD must be set when no admin exists.'
            );
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            throw new RuntimeException('Unable to hash admin password.');
        }

        $stmt = $this->db->prepare(
            'INSERT INTO users (
                username,
                email,
                password_hash,
                full_name,
                role,
                status,
                email_verified_at,
                terms_version,
                privacy_version,
                consent_accepted_at
            ) VALUES (
                :username,
                :email,
                :password_hash,
                :full_name,
                :role,
                :status,
                NOW(),
                :terms_version,
                :privacy_version,
                NOW()
            )'
        );

        $stmt->execute([
            'username' => $username,
            'email' => $email,
            'password_hash' => $passwordHash,
            'full_name' => $username,
            'role' => 'admin',
            'status' => 'active',
            'terms_version' => $this->config['terms_version'] ?? '1.0.0',
            'privacy_version' => $this->config['privacy_version'] ?? '1.0.0',
        ]);

        return true;
    }

    public function adminCount(): int
    {
        return (int) $this->db
            ->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            ->fetchColumn();
    }
}
