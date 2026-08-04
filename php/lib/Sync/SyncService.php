<?php

declare(strict_types=1);

/**
 * @param array<string, mixed> $user
 * @param list<array<string, mixed>> $mutations
 * @return array<string, mixed>
 */
function sync_push(array $user, array $mutations): array
{
    if ($user['status'] !== 'active') {
        auth_fail('account_deactivated', 'Account is deactivated.', 403);
    }

    $results = [];
    $total = count($mutations);
    $completed = 0;

    foreach ($mutations as $mutation) {
        if (!is_array($mutation)) {
            continue;
        }
        $clientMutationId = trim((string) ($mutation['client_mutation_id'] ?? ''));
        if ($clientMutationId === '') {
            $results[] = [
                'client_mutation_id' => '',
                'status' => 'failed',
                'error' => ['code' => 'validation_error', 'message' => 'client_mutation_id required.'],
            ];
            $completed++;
            continue;
        }

        $cached = client_mutation_lookup($user['id'], $clientMutationId);
        if ($cached !== null) {
            if (($cached['status'] ?? '') === 'conflict') {
                $results[] = [
                    'client_mutation_id' => $clientMutationId,
                    'status' => 'conflict',
                    'conflict' => $cached['conflict'] ?? [],
                ];
            } else {
                $results[] = sync_format_cached_result($clientMutationId, $cached);
            }
            $completed++;
            continue;
        }

        try {
            $result = sync_apply_mutation($user, $mutation);
            $results[] = [
                'client_mutation_id' => $clientMutationId,
                'status' => 'synced',
                'resource_type' => (string) ($mutation['resource_type'] ?? ''),
                'resource' => $result['resource'] ?? null,
            ];
        } catch (ConflictException $e) {
            sync_conflict_store($user, $mutation, $e);
            $results[] = [
                'client_mutation_id' => $clientMutationId,
                'status' => 'conflict',
                'conflict' => [
                    'local_snapshot' => $e->localSnapshot,
                    'remote_snapshot' => $e->remoteSnapshot,
                    'kind' => $e->kind,
                ],
            ];
        } catch (AuthException $e) {
            $results[] = [
                'client_mutation_id' => $clientMutationId,
                'status' => 'failed',
                'error' => [
                    'code' => $e->errorCode,
                    'message' => $e->getMessage(),
                    'fields' => $e->fields,
                ],
            ];
        } catch (Throwable $e) {
            $results[] = [
                'client_mutation_id' => $clientMutationId,
                'status' => 'failed',
                'error' => ['code' => 'unknown_error', 'message' => 'Unexpected error.'],
            ];
        }
        $completed++;
    }

    return [
        'success' => true,
        'results' => $results,
        'progress' => ['completed' => $completed, 'total' => $total],
    ];
}

/**
 * @return array<string, mixed>
 */
function sync_format_cached_result(string $clientMutationId, array $cached): array
{
    if (isset($cached['element'])) {
        return [
            'client_mutation_id' => $clientMutationId,
            'status' => 'synced',
            'resource_type' => 'element',
            'resource' => $cached['element'],
        ];
    }
    if (isset($cached['map'])) {
        return [
            'client_mutation_id' => $clientMutationId,
            'status' => 'synced',
            'resource_type' => 'map',
            'resource' => $cached['map'],
        ];
    }
    if (isset($cached['photo'])) {
        return [
            'client_mutation_id' => $clientMutationId,
            'status' => 'synced',
            'resource_type' => 'photo',
            'resource' => $cached['photo'],
        ];
    }
    if (isset($cached['deleted'])) {
        return [
            'client_mutation_id' => $clientMutationId,
            'status' => 'synced',
            'resource_type' => 'unknown',
            'resource' => null,
        ];
    }

    return [
        'client_mutation_id' => $clientMutationId,
        'status' => 'synced',
        'resource_type' => 'unknown',
        'resource' => null,
    ];
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $mutation
 * @return array<string, mixed>
 */
function sync_apply_mutation(array $user, array $mutation): array
{
    $resourceType = (string) ($mutation['resource_type'] ?? '');
    $op = (string) ($mutation['op'] ?? '');
    $payload = is_array($mutation['payload'] ?? null) ? $mutation['payload'] : [];
    $clientMutationId = trim((string) ($mutation['client_mutation_id'] ?? ''));
    $resourceId = $mutation['resource_id'] ?? null;
    $baseVersion = $mutation['base_version'] ?? null;

    $input = array_merge($payload, [
        'client_mutation_id' => $clientMutationId,
    ]);
    if ($resourceId !== null && $resourceId !== '') {
        $input['id'] = $resourceId;
    }
    if ($baseVersion !== null) {
        $input['base_version'] = $baseVersion;
    }

    switch ($resourceType) {
        case 'map':
            return sync_apply_map($user, $op, $input);
        case 'element':
            return sync_apply_element($user, $op, $input);
        case 'photo':
            return sync_apply_photo($user, $op, $input);
        default:
            auth_fail('validation_error', 'Unknown resource type.', 400);
    }
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function sync_apply_map(array $user, string $op, array $input): array
{
    switch ($op) {
        case 'create':
            $result = maps_create($user, $input);
            return ['resource' => $result['map']];
        case 'update':
            $result = maps_update($user, $input);
            return ['resource' => $result['map']];
        case 'delete':
            maps_delete($user, $input);
            return ['resource' => null];
        case 'publish':
            $result = maps_publish($user, $input);
            return ['resource' => $result['map']];
        case 'unpublish':
            $result = maps_unpublish($user, $input);
            return ['resource' => $result['map']];
        default:
            auth_fail('validation_error', 'Unsupported map operation.', 400);
    }
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function sync_apply_element(array $user, string $op, array $input): array
{
    switch ($op) {
        case 'create':
            $result = elements_create($user, $input);
            return ['resource' => $result['element']];
        case 'update':
            $result = elements_update($user, $input);
            return ['resource' => $result['element']];
        case 'delete':
            $elementId = (string) ($input['id'] ?? '');
            $element = fetch_element_by_id($elementId);
            if ($element === null) {
                json_conflict(
                    'Element was deleted remotely.',
                    ['id' => $elementId, 'payload' => $input],
                    ['deleted' => true],
                    'delete_update'
                );
            }
            elements_delete($user, $input);
            return ['resource' => null];
        default:
            auth_fail('validation_error', 'Unsupported element operation.', 400);
    }
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function sync_apply_photo(array $user, string $op, array $input): array
{
    if ($op === 'delete') {
        photos_delete($user, $input);
        return ['resource' => null];
    }
    auth_fail('validation_error', 'Photo upload via sync push requires multipart; use photos/upload.php.', 400);
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $mutation
 */
function sync_conflict_store(array $user, array $mutation, ConflictException $e): void
{
    $clientMutationId = trim((string) ($mutation['client_mutation_id'] ?? ''));
    if ($clientMutationId === '') {
        return;
    }

    $resourceType = (string) ($mutation['resource_type'] ?? '');
    $resourceId = (string) ($mutation['resource_id'] ?? '');

    $record = [
        'status' => 'conflict',
        'mutation' => [
            'resource_type' => $resourceType,
            'op' => (string) ($mutation['op'] ?? ''),
            'resource_id' => $mutation['resource_id'] ?? null,
            'base_version' => $mutation['base_version'] ?? null,
            'payload' => is_array($mutation['payload'] ?? null) ? $mutation['payload'] : [],
        ],
        'conflict' => [
            'local_snapshot' => $e->localSnapshot,
            'remote_snapshot' => $e->remoteSnapshot,
            'kind' => $e->kind,
        ],
    ];

    db()->prepare(
        'INSERT INTO client_mutations (client_mutation_id, user_id, resource_type, resource_id, result_json)
         VALUES (:cid, :uid, :rtype, :rid, :result)
         ON CONFLICT (client_mutation_id) DO UPDATE SET result_json = EXCLUDED.result_json'
    )->execute([
        'cid' => $clientMutationId,
        'uid' => $user['id'],
        'rtype' => $resourceType,
        'rid' => $resourceId,
        'result' => json_encode($record, JSON_UNESCAPED_UNICODE),
    ]);
}

/**
 * @param array<string, mixed> $user
 * @return array<string, mixed>
 */
function sync_fetch_pending_conflict(array $user, string $clientMutationId): array
{
    $stmt = db()->prepare(
        'SELECT result_json FROM client_mutations
         WHERE client_mutation_id = :cid AND user_id = :uid LIMIT 1'
    );
    $stmt->execute(['cid' => $clientMutationId, 'uid' => $user['id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        auth_fail('not_found', 'Conflict not found.', 404);
    }

    $decoded = json_decode((string) $row['result_json'], true);
    if (!is_array($decoded) || ($decoded['status'] ?? '') !== 'conflict') {
        auth_fail('conflict', 'Mutation is not in conflict state.', 409);
    }

    return $decoded;
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $storedResult
 */
function sync_resolve_mark_synced(
    string $clientMutationId,
    array $user,
    string $resourceType,
    string $resourceId,
    array $storedResult
): void {
    db()->prepare(
        'UPDATE client_mutations SET result_json = :result, resource_type = :rtype, resource_id = :rid
         WHERE client_mutation_id = :cid AND user_id = :uid'
    )->execute([
        'cid' => $clientMutationId,
        'uid' => $user['id'],
        'rtype' => $resourceType,
        'rid' => $resourceId,
        'result' => json_encode($storedResult, JSON_UNESCAPED_UNICODE),
    ]);
}

/**
 * @param array<string, mixed> $user
 * @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function sync_resolve(array $user, array $input): array
{
    $clientMutationId = trim((string) ($input['client_mutation_id'] ?? ''));
    $choice = (string) ($input['choice'] ?? '');

    if ($clientMutationId === '' || !in_array($choice, ['local', 'remote'], true)) {
        auth_fail('validation_error', 'Validation failed.', 400, [
            'choice' => 'Choice must be local or remote.',
        ]);
    }

    $conflictRecord = sync_fetch_pending_conflict($user, $clientMutationId);
    $storedMutation = is_array($conflictRecord['mutation'] ?? null) ? $conflictRecord['mutation'] : [];
    $resourceType = (string) ($storedMutation['resource_type'] ?? '');
    $op = (string) ($storedMutation['op'] ?? '');
    $resourceId = $storedMutation['resource_id'] ?? null;
    $baseVersion = $storedMutation['base_version'] ?? null;

    if ($choice === 'remote') {
        if ($resourceType === 'element' && $resourceId) {
            $element = fetch_element_by_id((string) $resourceId);
            if ($element === null) {
                auth_fail('not_found', 'Element not found.', 404);
            }
            assert_element_owner($user, $element, true);
            $photos = photos_for_element((string) $resourceId);
            $resource = format_element_record($element, $photos);
            sync_resolve_mark_synced($clientMutationId, $user, 'element', (string) $resourceId, [
                'element' => $resource,
            ]);

            return [
                'success' => true,
                'resource_type' => 'element',
                'resource' => $resource,
            ];
        }
        if ($resourceType === 'map' && $resourceId) {
            $map = fetch_map_by_id((string) $resourceId);
            if ($map === null) {
                auth_fail('not_found', 'Map not found.', 404);
            }
            assert_map_owner($user, $map);
            $resource = format_map_record($map);
            sync_resolve_mark_synced($clientMutationId, $user, 'map', (string) $resourceId, [
                'map' => $resource,
            ]);

            return [
                'success' => true,
                'resource_type' => 'map',
                'resource' => $resource,
            ];
        }
        if ($resourceType === 'photo' && $resourceId) {
            $photo = fetch_photo_by_id((string) $resourceId);
            if ($photo === null) {
                sync_resolve_mark_synced($clientMutationId, $user, 'photo', (string) $resourceId, [
                    'deleted' => true,
                ]);

                return [
                    'success' => true,
                    'resource_type' => 'photo',
                    'resource' => null,
                ];
            }
            if ((string) $photo['owner_id'] !== (string) $user['id']) {
                auth_fail('forbidden', 'You do not have access to this photo.', 403);
            }
            $resource = [
                'id' => (string) $photo['id'],
                'element_id' => (string) $photo['element_id'],
                'content_type' => (string) $photo['content_type'],
                'byte_size' => (int) $photo['byte_size'],
                'version' => (int) $photo['version'],
                'created_at' => (string) $photo['created_at'],
                'url' => '/php/photos/get.php?id=' . urlencode((string) $photo['id']),
            ];
            sync_resolve_mark_synced($clientMutationId, $user, 'photo', (string) $resourceId, [
                'photo' => $resource,
            ]);

            return [
                'success' => true,
                'resource_type' => 'photo',
                'resource' => $resource,
            ];
        }
        auth_fail('validation_error', 'Cannot resolve remote choice.', 400);
    }

    $payload = is_array($storedMutation['payload'] ?? null) ? $storedMutation['payload'] : [];
    $applyInput = array_merge($payload, [
        'id' => $resourceId,
    ]);
    if ($baseVersion !== null) {
        $applyInput['base_version'] = $baseVersion;
    }

    if ($resourceType === 'element') {
        if ($op === 'delete') {
            elements_delete($user, $applyInput, true);
            sync_resolve_mark_synced($clientMutationId, $user, 'element', (string) $resourceId, [
                'deleted' => true,
            ]);

            return ['success' => true, 'resource_type' => 'element', 'resource' => null];
        }
        if ($op === 'create') {
            $result = elements_create($user, $applyInput);
            sync_resolve_mark_synced(
                $clientMutationId,
                $user,
                'element',
                (string) ($result['element']['id'] ?? $resourceId),
                $result
            );

            return ['success' => true, 'resource_type' => 'element', 'resource' => $result['element']];
        }
        $result = elements_update($user, $applyInput, true);
        sync_resolve_mark_synced(
            $clientMutationId,
            $user,
            'element',
            (string) ($result['element']['id'] ?? $resourceId),
            $result
        );

        return ['success' => true, 'resource_type' => 'element', 'resource' => $result['element']];
    }

    if ($resourceType === 'map') {
        if ($op === 'delete') {
            maps_delete($user, $applyInput, true);
            sync_resolve_mark_synced($clientMutationId, $user, 'map', (string) $resourceId, [
                'deleted' => true,
            ]);

            return ['success' => true, 'resource_type' => 'map', 'resource' => null];
        }
        if ($op === 'publish') {
            $result = maps_publish($user, $applyInput, true);
            sync_resolve_mark_synced(
                $clientMutationId,
                $user,
                'map',
                (string) ($result['map']['id'] ?? $resourceId),
                $result
            );

            return ['success' => true, 'resource_type' => 'map', 'resource' => $result['map']];
        }
        if ($op === 'unpublish') {
            $result = maps_unpublish($user, $applyInput, true);
            sync_resolve_mark_synced(
                $clientMutationId,
                $user,
                'map',
                (string) ($result['map']['id'] ?? $resourceId),
                $result
            );

            return ['success' => true, 'resource_type' => 'map', 'resource' => $result['map']];
        }
        $result = maps_update($user, $applyInput, true);
        sync_resolve_mark_synced(
            $clientMutationId,
            $user,
            'map',
            (string) ($result['map']['id'] ?? $resourceId),
            $result
        );

        return ['success' => true, 'resource_type' => 'map', 'resource' => $result['map']];
    }

    if ($resourceType === 'photo') {
        if ($op === 'delete') {
            photos_delete($user, $applyInput, true);
            sync_resolve_mark_synced($clientMutationId, $user, 'photo', (string) $resourceId, [
                'deleted' => true,
            ]);

            return ['success' => true, 'resource_type' => 'photo', 'resource' => null];
        }
        auth_fail('validation_error', 'Unsupported photo operation for resolve.', 400);
    }

    auth_fail('validation_error', 'Unsupported resolve target.', 400);
}
