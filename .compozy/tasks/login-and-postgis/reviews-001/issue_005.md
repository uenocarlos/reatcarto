---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 228
severity: high
author: claude-code
provider_ref:
---

# Issue 005: Offline photo creates cannot sync via push

## Review Comment

`offlineQueuePhotoUpload` enqueues `resource_type: 'photo', op: 'create'` and stores the blob in IndexedDB. `sync_apply_photo` only accepts `delete` and fails creates with a message to use multipart `photos/upload.php`.

`api.sync.push` in `src/api/apiClient.js` posts JSON `{ mutations }` and ignores the `photoBlobs` / `OfflineStore` option that `SyncEngine.flush` passes. Offline photo attachments therefore never upload and remain failed or stuck in the outbox — breaking US-008/US-010 field photo sync.

Suggested fix: during flush, for each pending `photo`/`create`, read the blob from `OfflineStore` and call `photos/upload.php` (multipart) with `element_id` + `client_mutation_id`; mark the outbox row synced from that response. Alternatively extend the sync API to accept binary uploads. Ensure dependent creates wait until parent element ids are remapped (see issue on local id remapping).

Also affected: `src/api/apiClient.js`, `src/lib/sync/SyncEngine.js`, `src/lib/offline/offlineApi.js`.

## Triage

- Decision: `valid`
- Notes:
  - O bug é real: fotos offline enfileiradas nunca eram enviadas porque `api.sync.push` ignorava `photoBlobs` e encaminhava `photo`/`create` para `/sync/push.php`, onde `sync_apply_photo` rejeita creates por design (ADR/task_04: uploads permanecem multipart via `photos/upload.php`).
  - `SyncService.php` não precisa de alteração — a rejeição de create via JSON push é intencional.
  - Correção aplicada em `src/api/apiClient.js`: `sync.push` separa mutações `photo`/`create`, lê o blob via `photoBlobs.getPhotoBlob`, e envia multipart para `/photos/upload.php`.
  - Correção complementar em `src/lib/sync/SyncEngine.js`: inclui `depends_on` nas mutações enviadas; após sync de `element`/`create`, remapeia `payload.element_id` e remove a entrada local obsoleta para que uploads dependentes usem o id do servidor.
  - Testes: `tests/js/sync.test.js` (UT-070 multipart) e `tests/js/offline.test.js` (UT-091 create→photo remapping + flush).
