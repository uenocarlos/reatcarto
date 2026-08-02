<?php

declare(strict_types=1);

namespace Reatcarto\Tests;

abstract class AdminTestCase extends MapsTestCase
{
    protected function createAdminUser(array $overrides = []): array
    {
        $user = $this->activateUser($overrides);
        db()->prepare("UPDATE users SET role = 'admin' WHERE id = :id")->execute(['id' => $user['id']]);
        register_session_for_user($user['id'], 'admin');
        $row = fetch_user_by_id($user['id']);

        return serialize_user($row);
    }

    protected function adminSession(array $admin): void
    {
        register_session_for_user($admin['id'], 'admin');
    }

    protected function publishedMapForUser(array $user): array
    {
        $map = $this->createMapForUser($user);
        $this->createElementForMap($user, $map['id']);
        register_session_for_user($user['id'], 'field');

        return maps_publish($user, ['id' => $map['id']])['map'];
    }

    protected function auditCount(): int
    {
        return audit_count();
    }

    protected function lastAdminMail(): ?array
    {
        foreach (array_reverse(\Mailer::recordedMessages()) as $msg) {
            if ($msg['type'] === 'admin_action') {
                return $msg;
            }
        }

        return null;
    }
}
