<?php

declare(strict_types=1);

/**
 * @return array<string, mixed>|null
 */
function client_mutation_lookup(string $userId, string $clientMutationId): ?array
{
    $stmt = db()->prepare(
        'SELECT result_json FROM client_mutations
         WHERE client_mutation_id = :cid AND user_id = :uid LIMIT 1'
    );
    $stmt->execute(['cid' => $clientMutationId, 'uid' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row === false) {
        return null;
    }

    $decoded = json_decode((string) $row['result_json'], true);

    return is_array($decoded) ? $decoded : null;
}

function client_mutation_store(
    string $userId,
    string $clientMutationId,
    string $resourceType,
    string $resourceId,
    array $result
): void {
    db()->prepare(
        'INSERT INTO client_mutations (client_mutation_id, user_id, resource_type, resource_id, result_json)
         VALUES (:cid, :uid, :rtype, :rid, :result)
         ON CONFLICT (client_mutation_id) DO NOTHING'
    )->execute([
        'cid' => $clientMutationId,
        'uid' => $userId,
        'rtype' => $resourceType,
        'rid' => $resourceId,
        'result' => json_encode($result, JSON_UNESCAPED_UNICODE),
    ]);
}
