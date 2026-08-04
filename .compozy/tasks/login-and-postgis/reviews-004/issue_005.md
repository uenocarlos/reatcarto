---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: src/components/map/StylePanel.jsx
line: 209
severity: high
author: claude-code
provider_ref:
---

# Issue 005: Offline photo upload omits depends_on for element create

## Review Comment

`StylePanel` calls `api.media.upload(element.id, file)` without the fourth `dependsOn` argument. Offline, `offlineQueuePhotoUpload` stores `depends_on: null`. In `api.sync.push`, every `photo/create` is uploaded via multipart **before** the remaining mutations hit `/sync/push.php`.

When a local element create and its photo are flushed together, the upload targets a client UUID that does not exist on the server → outbox `failed`. `_applyResource` remaps only pending dependents after the create syncs, so a failed photo never receives the server element id.

Suggested fix: when queueing an offline photo, look up a pending `element/create` for that `resource_id` and set `depends_on` to its `client_mutation_id`. In `sync.push`, skip photo creates whose dependency is not yet synced (or push element creates first). Also remap `FAILED`/`CONFLICTED` photo rows when the element id is rewritten.

## Triage

- Decision: `VALID`
- Root cause: `StylePanel.handlePhotoUpload` (line 209) invokes `api.media.upload(element.id, file)` — the `dependsOn` 4th arg is always `null`. Consequently `offlineQueuePhotoUpload` stores `depends_on: null`, and `sync.push` uploads photo creates before the element create mutation is pushed, so the element UUID is unknown server-side. Additionally, `_applyResource` in `SyncEngine.js` only rewrites dependents with `PENDING` status, leaving `FAILED` photos stranded.
- Fix approach: In `StylePanel`, compute `dependsOn` for new/unsaved elements: check the outbox for a pending `element/create` with matching element resource_id and pass its `client_mutation_id` as the 4th argument. In `SyncEngine._applyResource`, extend ID remap coverage to `FAILED`/`CONFLICTED` rows so retries can use the server id. In `api.sync.push`, defer photo uploads whose `depends_on` is not in a synced state to a subsequent batch/pass (or equivalently: push element creates first, then photos). The smallest change is to ensure `dependsOn` is set at enqueue time so `getReadyMutations` already gates photos on their element create being synced.
