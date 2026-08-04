---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/lib/offline/offlineApi.js
line: 177
severity: high
author: claude-code
provider_ref:
---

# Issue 010: Offline photo lifecycle is incomplete end-to-end

## Review Comment

Three linked gaps leave offline photos unusable until (sometimes after) sync:

1. **`offlineQueuePhotoUpload`** returns only `{ client_mutation_id, _queued, status }` — no `id`, no blob URL. `StylePanel` immediately does `id: photo.id`, `url: photo.url || api.media.url(photo.id)`, producing broken list rows.
2. **`SyncEngine._applyResource`** handles only `map` and `element`. Successful photo creates never write `photos_meta` or drop temporary blob keys; delete/resolve with `resource: null` never cleans IDB.
3. **`api.media.delete`** has no offline branch — photo remove always hits the network (`apiClient.js` ~340).

Related file: `src/lib/sync/SyncEngine.js` (~169–204).

**Suggested fix:**

- Return a local photo placeholder: `id` = `client_mutation_id` (or stable local UUID), `url` from `URL.createObjectURL`/`storePhotoBlob` reader, `_pending: true`.
- On sync of photo create/delete, upsert/remove `photos_meta` and clear blobs.
- Enqueue photo delete offline with optional `depends_on`.

## Triage

- Decision: `UNREVIEWED`
- Notes:
