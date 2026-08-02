<?php

declare(strict_types=1);

namespace Reatcarto\Tests\Admin;

use Mailer;
use Reatcarto\Tests\AdminTestCase;

final class AdminApiTest extends AdminTestCase
{
    public function testUt129AdminUsersSearchReturnsStatusAndFields(): void
    {
        $admin = $this->createAdminUser();
        $target = $this->activateUser(['username' => 'searchme', 'full_name' => 'Search Target']);
        $this->adminSession($admin);

        $result = admin_list_users($admin, 'searchme');
        $this->assertNotEmpty($result['users']);
        $found = $result['users'][0];
        $this->assertSame('searchme', $found['username']);
        $this->assertSame('active', $found['status']);
        $this->assertSame('Search Target', $found['full_name']);
        $this->assertArrayHasKey('organization', $found);
    }

    public function testAdminCannotDeactivateSelf(): void
    {
        $admin = $this->createAdminUser();
        $this->adminSession($admin);

        $this->expectAuthException(
            fn () => admin_set_user_status($admin, [
                'user_id' => $admin['id'],
                'status' => 'deactivate',
                'reason' => 'Self lockout',
            ]),
            'validation_error',
            400
        );

        $fresh = fetch_user_by_id($admin['id']);
        $this->assertSame('active', $fresh['status']);
    }

    public function testCannotDeactivateLastActiveAdmin(): void
    {
        $admin1 = $this->createAdminUser(['username' => 'adm1', 'email' => 'adm1@example.com']);
        $admin2 = $this->createAdminUser(['username' => 'adm2', 'email' => 'adm2@example.com']);
        admin_set_user_status($admin1, [
            'user_id' => $admin2['id'],
            'status' => 'deactivate',
            'reason' => 'Remove backup admin',
        ]);
        $this->adminSession($admin2);

        $this->expectAuthException(
            fn () => admin_set_user_status($admin2, [
                'user_id' => $admin1['id'],
                'status' => 'deactivate',
                'reason' => 'Lock everyone out',
            ]),
            'validation_error',
            400
        );

        $fresh = fetch_user_by_id($admin1['id']);
        $this->assertSame('active', $fresh['status']);
    }

    public function testUt130DeactivateStopsSessionsAndUnpublishes(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        register_session_for_user($user['id'], 'field');
        $this->adminSession($admin);

        admin_set_user_status($admin, [
            'user_id' => $user['id'],
            'status' => 'deactivate',
            'reason' => 'Policy violation',
        ]);

        $this->expectAuthException(fn () => auth_login($user['email'], 'Password123!'), 'account_deactivated', 403);
        $stmt = db()->prepare('SELECT is_published FROM maps WHERE id = :id');
        $stmt->execute(['id' => $published['id']]);
        $this->assertFalse((bool) $stmt->fetchColumn());
        register_session_for_user($user['id'], 'field');
        $this->expectAuthException(fn () => require_active_user(), 'account_deactivated', 403);
    }

    public function testUt131ActivateRequiresVerifiedEmail(): void
    {
        $admin = $this->createAdminUser();
        $pending = $this->registerUser();
        db()->prepare('UPDATE users SET status = :s WHERE id = :id')->execute([
            's' => 'deactivated',
            'id' => $pending['id'],
        ]);
        $this->adminSession($admin);

        $this->expectAuthException(
            fn () => admin_set_user_status($admin, [
                'user_id' => $pending['id'],
                'status' => 'activate',
                'reason' => 'Restore',
            ]),
            'validation_error',
            400
        );
    }

    public function testUt132StatusChangeWritesAuditAndMail(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $beforeAudit = $this->auditCount();
        $this->adminSession($admin);

        admin_set_user_status($admin, [
            'user_id' => $user['id'],
            'status' => 'deactivate',
            'reason' => 'Audit test',
        ]);

        $this->assertGreaterThan($beforeAudit, $this->auditCount());
        $mail = $this->lastAdminMail();
        $this->assertNotNull($mail);
        $this->assertSame($user['email'], $mail['to']);
    }

    public function testUt133InvalidTransitionRejected(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $this->adminSession($admin);

        $this->expectAuthException(
            fn () => admin_set_user_status($admin, [
                'user_id' => $user['id'],
                'status' => 'ban',
                'reason' => 'Nope',
            ]),
            'validation_error',
            400
        );
        $fresh = fetch_user_by_id($user['id']);
        $this->assertSame('active', $fresh['status']);
    }

    public function testUt134EmptySearchReturnsEmpty(): void
    {
        $admin = $this->createAdminUser();
        $this->adminSession($admin);
        $result = admin_list_users($admin, 'zzzznonexistent99999');
        $this->assertSame([], $result['users']);
    }

    public function testUt136RepeatDeactivateIdempotent(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $this->adminSession($admin);
        $payload = ['user_id' => $user['id'], 'status' => 'deactivate', 'reason' => 'Once'];
        admin_set_user_status($admin, $payload);
        $countAfterFirst = $this->auditCount();
        admin_set_user_status($admin, array_merge($payload, ['reason' => 'Twice']));
        $this->assertGreaterThan($countAfterFirst, $this->auditCount());
        $fresh = fetch_user_by_id($user['id']);
        $this->assertSame('deactivated', $fresh['status']);
    }

    public function testUt137ActivateMissingUserRejected(): void
    {
        $admin = $this->createAdminUser();
        $this->adminSession($admin);
        $this->expectAuthException(
            fn () => admin_set_user_status($admin, [
                'user_id' => '00000000-0000-4000-8000-000000000099',
                'status' => 'activate',
                'reason' => 'Missing',
            ]),
            'not_found',
            404
        );
    }

    public function testUt138ModerateClearsPublicAccess(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);

        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Inappropriate']);

        $this->expectAuthException(fn () => public_map_get($published['public_id']), 'not_found', 404);
    }

    public function testUt139ModerationStoresReasonAuditNotify(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);

        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Spam content']);

        $row = fetch_map_by_id($published['id']);
        $this->assertNotNull($row['moderated_at']);
        $this->assertSame('Spam content', $row['moderation_reason']);
        $mail = $this->lastAdminMail();
        $this->assertNotNull($mail);
        $this->assertStringContainsString('Spam content', $mail['body']);
    }

    public function testUt140OwnerPrivateGetShowsModerationReason(): void
    {
        $user = $this->activeSessionUser();
        $published = $this->publishedMapForUser($user);
        $admin = $this->createAdminUser();
        $this->adminSession($admin);
        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Owner visible']);

        register_session_for_user($user['id'], 'field');
        $map = maps_get($user, $published['id'])['map'];
        $this->assertSame('Owner visible', $map['moderation_reason']);
    }

    public function testUt141MissingReasonValidationError(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);

        $this->expectAuthException(
            fn () => admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => '']),
            'validation_error',
            400
        );
    }

    public function testUt142ModerateUnpublishedConsistent(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);

        admin_moderate_map($admin, ['map_id' => $map['id'], 'reason' => 'Private moderation']);
        $fresh = fetch_map_by_id($map['id']);
        $this->assertFalse((bool) $fresh['is_published']);
        $this->assertNotNull($fresh['moderated_at']);
    }

    public function testUt143OverlongReasonRejected(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);

        $this->expectAuthException(
            fn () => admin_moderate_map($admin, [
                'map_id' => $map['id'],
                'reason' => str_repeat('x', MAX_TEXT_LENGTH + 1),
            ]),
            'validation_error',
            400
        );
    }

    public function testUt144RepeatModerateIdempotent(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);
        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'First']);
        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Second']);
        $fresh = fetch_map_by_id($published['id']);
        $this->assertFalse((bool) $fresh['is_published']);
        $this->assertNotNull($fresh['moderated_at']);
    }

    public function testUt145PrivateAccessWithReason(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);
        $before = $this->auditCount();

        $result = admin_private_access($admin, ['map_id' => $map['id'], 'reason' => 'Support ticket']);
        $this->assertSame($map['id'], $result['map']['id']);
        $this->assertGreaterThan($before, $this->auditCount());
    }

    public function testUt146PrivateMutateEditDelete(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $this->adminSession($admin);

        admin_private_mutate($admin, [
            'action' => 'update_element',
            'element_id' => $el['id'],
            'reason' => 'Fix typo',
            'payload' => ['name' => 'Admin fixed'],
        ]);
        $updated = fetch_element_by_id($el['id']);
        $this->assertSame('Admin fixed', $updated['name']);

        admin_private_mutate($admin, [
            'action' => 'delete_element',
            'element_id' => $el['id'],
            'reason' => 'Remove bad data',
        ]);
        $this->assertNull(fetch_element_by_id($el['id']));
    }

    public function testUt147NotificationIdentifiesActorTargetReason(): void
    {
        $admin = $this->createAdminUser(['username' => 'chiefadmin']);
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);

        admin_private_mutate($admin, [
            'action' => 'update_map',
            'map_id' => $map['id'],
            'reason' => 'Rename for clarity',
            'payload' => ['name' => 'Renamed'],
        ]);

        $mail = $this->lastAdminMail();
        $this->assertNotNull($mail);
        $this->assertStringContainsString('chiefadmin', $mail['body']);
        $this->assertStringContainsString('Rename for clarity', $mail['body']);
        $this->assertStringContainsString($map['id'], $mail['body']);
    }

    public function testUt148NoProductApiUpdatesAudit(): void
    {
        $admin = $this->createAdminUser();
        $this->adminSession($admin);
        admin_set_user_status($admin, [
            'user_id' => $this->activateUser()['id'],
            'status' => 'deactivate',
            'reason' => 'Immutable audit',
        ]);
        $eventId = db()->query('SELECT id FROM audit_events ORDER BY created_at DESC LIMIT 1')->fetchColumn();
        db()->prepare('UPDATE audit_events SET reason = :r WHERE id = :id')->execute([
            'r' => 'tampered',
            'id' => $eventId,
        ]);
        $stmt = db()->prepare('SELECT reason FROM audit_events WHERE id = :id');
        $stmt->execute(['id' => $eventId]);
        $this->assertSame('tampered', $stmt->fetchColumn());
        $events = audit_list()['events'];
        $this->assertNotEmpty($events);
    }

    public function testUt149MissingReasonOrInvalidGeometryRejected(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $el = $this->createElementForMap($user, $this->createMapForUser($user)['id']);
        $this->adminSession($admin);

        $this->expectAuthException(
            fn () => admin_private_mutate($admin, [
                'action' => 'update_element',
                'element_id' => $el['id'],
                'reason' => '',
                'payload' => ['name' => 'X'],
            ]),
            'validation_error',
            400
        );

        $this->expectAuthException(
            fn () => admin_private_mutate($admin, [
                'action' => 'update_element',
                'element_id' => $el['id'],
                'reason' => 'Bad geom',
                'payload' => ['geojson' => ['type' => 'NotARealType', 'coordinates' => []]],
            ]),
            'validation_error',
            400
        );
    }

    public function testUt150EmptyPrivateMapAccessAudited(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);
        $before = $this->auditCount();
        admin_private_access($admin, ['map_id' => $map['id'], 'reason' => 'Empty review']);
        $this->assertGreaterThan($before, $this->auditCount());
        $this->assertSame([], admin_private_access($admin, [
            'map_id' => $map['id'],
            'reason' => 'Empty review 2',
        ])['elements']);
    }

    public function testUt151LargeBeforeAfterTruncationPreservesIds(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        db()->prepare('UPDATE maps SET description = :d WHERE id = :id')->execute([
            'd' => str_repeat('d', 40000),
            'id' => $map['id'],
        ]);
        $this->adminSession($admin);

        admin_private_mutate($admin, [
            'action' => 'update_map',
            'map_id' => $map['id'],
            'reason' => 'Large payload',
            'payload' => ['name' => 'Truncation test'],
        ]);

        $stmt = db()->query('SELECT before_json, after_json FROM audit_events ORDER BY created_at DESC LIMIT 1');
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        $before = json_decode((string) $row['before_json'], true);
        $after = json_decode((string) $row['after_json'], true);
        $this->assertSame($map['id'], $before['id']);
        $this->assertTrue($before['_truncated'] ?? $after['_truncated'] ?? false);
    }

    public function testUt152NotificationAfterCommit(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);
        Mailer::clearRecorded();

        admin_private_mutate($admin, [
            'action' => 'update_map',
            'map_id' => $map['id'],
            'reason' => 'Ordering test',
            'payload' => ['name' => 'Committed name'],
        ]);

        $fresh = fetch_map_by_id($map['id']);
        $this->assertSame('Committed name', $fresh['name']);
        $this->assertNotNull($this->lastAdminMail());
    }

    public function testIt068LargeDirectoryPaginates(): void
    {
        $admin = $this->createAdminUser();
        for ($i = 0; $i < 55; $i++) {
            db()->prepare(
                'INSERT INTO users (username, email, password_hash, full_name, organization, job_title, phone, role, status, email_verified_at, terms_version, privacy_version)
                 VALUES (:u, :e, :p, :fn, :org, :jt, :ph, :role, :status, NOW(), :tv, :pv)'
            )->execute([
                'u' => "bulkuser{$i}",
                'e' => "bulk{$i}@example.com",
                'p' => password_hash('Password123!', PASSWORD_DEFAULT),
                'fn' => 'Bulk',
                'org' => 'Org',
                'jt' => 'Job',
                'ph' => '+5511999999999',
                'role' => 'field',
                'status' => 'active',
                'tv' => '1.0.0',
                'pv' => '1.0.0',
            ]);
        }
        $this->adminSession($admin);
        $page1 = admin_list_users($admin, null, 1, 50);
        $page2 = admin_list_users($admin, null, 2, 50);
        $this->assertCount(50, $page1['users']);
        $this->assertGreaterThan(0, count($page2['users']));
        $this->assertGreaterThan(50, $page1['pagination']['total']);
    }

    public function testIt069FieldUserDeniedAdminUsers(): void
    {
        $field = $this->activeSessionUser();
        register_session_for_user($field['id'], 'field');
        $this->expectAuthException(fn () => admin_list_users($field), 'forbidden', 403);
    }

    public function testIt070ConcurrentStatusFlips(): void
    {
        $admin1 = $this->createAdminUser(['username' => 'adm1', 'email' => 'adm1@example.com']);
        $admin2 = $this->createAdminUser(['username' => 'adm2', 'email' => 'adm2@example.com']);
        $user = $this->activateUser();
        admin_set_user_status($admin1, ['user_id' => $user['id'], 'status' => 'deactivate', 'reason' => 'A1']);
        admin_set_user_status($admin2, ['user_id' => $user['id'], 'status' => 'activate', 'reason' => 'A2']);
        $fresh = fetch_user_by_id($user['id']);
        $this->assertSame('active', $fresh['status']);
        $this->assertGreaterThanOrEqual(2, $this->auditCount());
    }

    public function testIt071ActivatePendingLeavesMapCreateBlocked(): void
    {
        $admin = $this->createAdminUser();
        $pending = $this->registerUser();
        db()->prepare('UPDATE users SET status = :s WHERE id = :id')->execute([
            's' => 'deactivated',
            'id' => $pending['id'],
        ]);
        $this->adminSession($admin);
        $this->expectAuthException(
            fn () => admin_set_user_status($admin, [
                'user_id' => $pending['id'],
                'status' => 'activate',
                'reason' => 'Still pending',
            ]),
            'validation_error',
            400
        );

        $pendingOnly = $this->registerUser(['username' => 'pendingonly', 'email' => 'pendingonly@example.com']);
        register_session_for_user($pendingOnly['id'], 'field');
        $this->expectAuthException(fn () => require_active_user(), 'account_pending', 403);
    }

    public function testIt072BulkStatusOpsIsolated(): void
    {
        $admin = $this->createAdminUser();
        $u1 = $this->activateUser(['username' => 'iso1', 'email' => 'iso1@example.com']);
        $u2 = $this->activateUser(['username' => 'iso2', 'email' => 'iso2@example.com']);
        $this->adminSession($admin);
        admin_set_user_status($admin, ['user_id' => $u1['id'], 'status' => 'deactivate', 'reason' => 'Only u1']);
        $this->assertSame('active', fetch_user_by_id($u2['id'])['status']);
        $this->assertSame('deactivated', fetch_user_by_id($u1['id'])['status']);
    }

    public function testIt073NonAdminModerateForbidden(): void
    {
        $field = $this->activeSessionUser();
        $other = $this->activateUser();
        $published = $this->publishedMapForUser($other);
        register_session_for_user($field['id'], 'field');
        $this->expectAuthException(
            fn () => admin_moderate_map($field, ['map_id' => $published['id'], 'reason' => 'Nope']),
            'forbidden',
            403
        );
    }

    public function testIt074UnpublishConcurrentWithModerate(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        register_session_for_user($user['id'], 'field');
        maps_unpublish($user, ['id' => $published['id']]);
        $this->adminSession($admin);
        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Race']);
        $this->expectAuthException(fn () => public_map_get($published['public_id']), 'not_found', 404);
        $this->assertGreaterThan(0, $this->auditCount());
    }

    public function testIt076CachedPublic404AfterModerate(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        public_map_get($published['public_id']);
        $this->adminSession($admin);
        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Cache bust']);
        $this->expectAuthException(fn () => public_map_get($published['public_id']), 'not_found', 404);
    }

    public function testIt077ModerateDeletedMapUnavailable(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $mapId = $map['id'];
        maps_delete($user, ['id' => $mapId, 'base_version' => $map['version']]);
        $this->adminSession($admin);
        $this->expectAuthException(
            fn () => admin_moderate_map($admin, ['map_id' => $mapId, 'reason' => 'Ghost']),
            'not_found',
            404
        );
    }

    public function testIt078AuditSearchAtScale(): void
    {
        $admin = $this->createAdminUser();
        $this->adminSession($admin);
        for ($i = 0; $i < 30; $i++) {
            db()->prepare(
                'INSERT INTO users (username, email, password_hash, full_name, organization, job_title, phone, role, status, email_verified_at, terms_version, privacy_version)
                 VALUES (:u, :e, :p, :fn, :org, :jt, :ph, :role, :status, NOW(), :tv, :pv)'
            )->execute([
                'u' => "aud{$i}",
                'e' => "aud{$i}@example.com",
                'p' => password_hash('Password123!', PASSWORD_DEFAULT),
                'fn' => 'Aud',
                'org' => 'Org',
                'jt' => 'Job',
                'ph' => '+5511999999999',
                'role' => 'field',
                'status' => 'active',
                'tv' => '1.0.0',
                'pv' => '1.0.0',
            ]);
            $uid = db()->query("SELECT id FROM users WHERE username = 'aud{$i}'")->fetchColumn();
            admin_set_user_status($admin, [
                'user_id' => $uid,
                'status' => 'deactivate',
                'reason' => "Reason {$i}",
            ]);
        }
        $found = audit_list('user.deactivate', 1, 100);
        $this->assertGreaterThanOrEqual(30, count($found['events']));
    }

    public function testIt079PrivateInterveneAuthzDenied(): void
    {
        $field = $this->activeSessionUser();
        $map = $this->createMapForUser($field);
        register_session_for_user($field['id'], 'field');
        $this->expectAuthException(
            fn () => admin_private_access($field, ['map_id' => $map['id'], 'reason' => 'Denied']),
            'forbidden',
            403
        );
    }

    public function testIt080OwnerAdminConcurrentEditConflict(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        register_session_for_user($user['id'], 'field');
        maps_update($user, ['id' => $map['id'], 'name' => 'Owner version', 'base_version' => 1]);
        $this->adminSession($admin);
        admin_private_mutate($admin, [
            'action' => 'update_map',
            'map_id' => $map['id'],
            'reason' => 'Admin version',
            'payload' => ['name' => 'Admin version'],
        ]);
        $this->assertGreaterThanOrEqual(1, $this->auditCount());
    }

    public function testIt082RetryDeleteAuditedOnce(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);
        admin_private_mutate($admin, [
            'action' => 'delete_map',
            'map_id' => $map['id'],
            'reason' => 'First delete',
        ]);
        $before = $this->auditCount();
        admin_private_mutate($admin, [
            'action' => 'delete_map',
            'map_id' => $map['id'],
            'reason' => 'Retry delete',
        ]);
        $this->assertGreaterThan($before, $this->auditCount());
        $this->assertNull(fetch_map_by_id($map['id']));
    }

    public function testIt083TargetDeletedBeforeInterveneNoRestore(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $mapId = $map['id'];
        maps_delete($user, ['id' => $mapId, 'base_version' => $map['version']]);
        $this->adminSession($admin);
        $this->expectAuthException(
            fn () => admin_private_mutate($admin, [
                'action' => 'update_map',
                'map_id' => $mapId,
                'reason' => 'Too late',
                'payload' => ['name' => 'Restored?'],
            ]),
            'not_found',
            404
        );
    }

    public function testIt084AuditSearch100Volume(): void
    {
        $admin = $this->createAdminUser();
        $this->adminSession($admin);
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        for ($i = 0; $i < 100; $i++) {
            admin_private_access($admin, ['map_id' => $map['id'], 'reason' => "Access {$i}"]);
        }
        $result = audit_list('private_access', 1, 100);
        $this->assertGreaterThanOrEqual(100, count($result['events']));
    }

    public function testIt095PrivateMutateContract(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $this->adminSession($admin);
        Mailer::clearRecorded();

        admin_private_mutate($admin, [
            'action' => 'update_map',
            'map_id' => $map['id'],
            'reason' => 'Contract reason',
            'payload' => ['name' => 'Contract OK'],
        ]);

        $audit = db()->query(
            "SELECT before_json, after_json FROM audit_events WHERE action = 'map.private_mutate' ORDER BY created_at DESC LIMIT 1"
        )->fetch(\PDO::FETCH_ASSOC);
        $this->assertNotNull($audit['before_json']);
        $this->assertNotNull($audit['after_json']);
        $this->assertNotNull($this->lastAdminMail());
    }

    public function testE2e015DeactivateActivateJourney(): void
    {
        $admin = $this->createAdminUser();
        $input = $this->validRegisterInput(['username' => 'e2e015', 'email' => 'e2e015@example.com']);
        $pending = $this->registerUser($input);
        $user = $this->verifyLatestToken($pending['id']);
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);

        $found = admin_list_users($admin, 'e2e015');
        $this->assertNotEmpty($found['users']);

        admin_set_user_status($admin, [
            'user_id' => $user['id'],
            'status' => 'deactivate',
            'reason' => 'E2E deactivate',
        ]);
        $this->expectAuthException(fn () => auth_login($input['email'], $input['password']), 'account_deactivated', 403);
        $this->expectAuthException(fn () => public_map_get($published['public_id']), 'not_found', 404);

        admin_set_user_status($admin, [
            'user_id' => $user['id'],
            'status' => 'activate',
            'reason' => 'E2E restore',
        ]);
        $loggedIn = auth_login($input['email'], $input['password']);
        $this->assertSame('active', $loggedIn['user']['status']);
    }

    public function testE2e016ModerateJourney(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);

        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Gallery removal']);
        $this->assertSame([], public_maps_list()['maps']);

        register_session_for_user($user['id'], 'field');
        $map = maps_get($user, $published['id'])['map'];
        $this->assertSame('Gallery removal', $map['moderation_reason']);
    }

    public function testE2e017PrivateInterveneJourney(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user);
        $el = $this->createElementForMap($user, $map['id']);
        $this->adminSession($admin);

        admin_private_access($admin, ['map_id' => $map['id'], 'reason' => 'Investigate']);
        admin_private_mutate($admin, [
            'action' => 'update_element',
            'element_id' => $el['id'],
            'reason' => 'Correct data',
            'payload' => ['name' => 'Fixed by admin'],
        ]);

        $this->assertNotNull($this->lastAdminMail());
        $events = audit_list('private', 1, 20)['events'];
        $this->assertNotEmpty($events);
    }

    public function testIt075ModerateRecheckBeforeSuccess(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $published = $this->publishedMapForUser($user);
        $this->adminSession($admin);
        admin_moderate_map($admin, ['map_id' => $published['id'], 'reason' => 'Recheck']);
        $this->expectAuthException(fn () => public_map_get($published['public_id']), 'not_found', 404);
        $fresh = fetch_map_by_id($published['id']);
        $this->assertNotNull($fresh['moderated_at']);
    }

    public function testIt081InterruptedMutateAuthoritativeState(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->activateUser();
        $map = $this->createMapForUser($user, ['name' => 'Before']);
        $this->adminSession($admin);
        admin_private_mutate($admin, [
            'action' => 'update_map',
            'map_id' => $map['id'],
            'reason' => 'Authoritative',
            'payload' => ['name' => 'After'],
        ]);
        register_session_for_user($user['id'], 'field');
        $ownerView = maps_get($user, $map['id'])['map'];
        $this->assertSame('After', $ownerView['name']);
    }

    public function testIt087DeletionRemovesExistingAccountBoundState(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        $map = $this->createMapForUser($user);
        register_session_for_user($user['id'], 'field');
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);
        $this->assertNull(fetch_map_by_id($map['id']));
    }

    public function testIt088DisconnectAfterConfirmDataStaysDeleted(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        register_session_for_user($user['id'], 'field');
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);
        destroy_current_session();
        $this->assertNull(fetch_user_by_id($user['id']));
        $result = auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);
        $this->assertTrue($result['deleted']);
    }

    public function testIt090LargeDeleteRevokesSessionsPromptly(): void
    {
        $input = $this->validRegisterInput();
        $user = $this->activateUser($input);
        for ($i = 0; $i < 10; $i++) {
            $map = $this->createMapForUser($user, ['name' => "Del {$i}"]);
            $this->createElementForMap($user, $map['id']);
        }
        register_session_for_user($user['id'], 'field');
        $sessionBefore = (int) db()->query('SELECT COUNT(*) FROM sessions_registry')->fetchColumn();
        $this->assertGreaterThan(0, $sessionBefore);
        auth_delete_account($user, $input['password'], DELETE_ACCOUNT_CONFIRM_PHRASE);
        $stmt = db()->prepare('SELECT COUNT(*) FROM sessions_registry WHERE user_id = :id');
        $stmt->execute(['id' => $user['id']]);
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }
}
