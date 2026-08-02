---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 260
severity: high
author: claude-code
provider_ref:
---

# Issue 004: sync_resolve force-writes without verifying conflict

## Review Comment

`sync_resolve` prepares a lookup against `client_mutations` for the given `client_mutation_id`, but never fetches or validates the row (`$conflictRow` is unused). It then trusts client-supplied `mutation` / `resource_type` / `payload` and, for `choice === 'local'`, sets `force_version = true` before calling `elements_update` / `maps_update`.

Any authenticated active user can therefore call `/php/sync/resolve.php` with `choice: local` and overwrite owned maps/elements without a prior conflict and without a matching `base_version`. That turns conflict resolution into a general force-write API and undermines the TechSpec optimistic concurrency model.

Suggested fix:

1. Fetch the stored conflict/mutation record for `(user_id, client_mutation_id)` and fail with 404/409 if none exists or it is not in a conflicted state.
2. Derive `resource_type`, `op`, `resource_id`, and local payload from the stored conflict / outbox snapshot (or require the client payload to match it), not solely from the request body.
3. Only then apply `force_version` for the local choice.
4. Add PHPUnit coverage: resolve without a prior conflict must fail; resolve with a recorded conflict must succeed.

## Triage

- Decision: `valid`
- Root cause: `sync_resolve` executava lookup em `client_mutations` mas ignorava o resultado; mutações vinham do body do cliente e `force_version` era aplicado sem provar conflito prévio. Conflitos de `sync_push` também não eram persistidos no servidor.
- Fix: `sync_conflict_store` persiste conflitos no push; `sync_fetch_pending_conflict` exige `status: conflict` (404 se ausente, 409 se já resolvido); `sync_resolve` deriva mutação do registro armazenado e marca synced após sucesso; testes em `SyncResolveTest.php`.
