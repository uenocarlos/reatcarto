---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: src/api/apiClient.js
line: 225
severity: high
author: claude-code
provider_ref:
---

# Issue 009: Client map/photo mutations omit required base_version

## Review Comment

Server OCC now requires `base_version` for map update/delete and photo delete (prior review rounds). The client UI still omits it:

- `api.entities.Map.delete(id)` sends only `{ id, client_mutation_id }` — `DashBoard.jsx` delete mutation never passes `map.version`.
- Dashboard rename calls `Map.update(id, { name, description })` without `version`/`base_version`, so the body field is `undefined` and dropped from JSON → 400.
- `StylePanel` calls `api.media.delete(photoId)` without `photo.version`; `media.delete` only includes `base_version` when non-null → every UI photo delete fails with 400.

Suggested fix: change `Map.delete` to accept `baseVersion`; pass `editMap.version` / `map.version` from the Dashboard; pass `photo.version` from StylePanel (keep version in local photo state). Treat missing `baseVersion` as a client programming error for these mutating helpers.

## Triage

- Decision: `VALID`
- Root cause:
  - `api.entities.Map.delete` (apiClient line 206) does not accept or send `base_version`. Server maps_delete rejects with 400.
  - `DashBoard.jsx` invokes `Map.update(id, data)` with `data = { name, description }` (no version field). The `Map.update` helper attempts `base_version: base_version ?? version ?? payload.base_version ?? payload.version` — all undefined — so base_version is omitted → 400.
  - `StylePanel.handlePhotoRemove` calls `api.media.delete(photoId)` without a 2nd `baseVersion` argument. `media.delete` only appends `base_version` when `baseVersion != null`, so it's omitted → 400.
- Fix approach:
  1. Change `api.entities.Map.delete(id, baseVersion, clientMutationId)` signature and always include `base_version` in body when the server requires it (enforce via throw/assertion to surface mistakes).
  2. In Dashboard, pass `editMap.version` through `formData` / `data` to `Map.update`, and pass `map.version` to `Map.delete`.
  3. In StylePanel, keep photo `version` in the local photos state (it's present on upload response) and pass it as the second argument to `api.media.delete`.
