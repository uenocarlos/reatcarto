---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/lib/offline/OfflineStore.js
line: 239
severity: high
author: claude-code
provider_ref:
---

# Issue 006: prepareMap only upserts and never purges deletions

## Review Comment

`prepareMap` writes the map row and `put`s every provided element/photo meta, but never removes elements or photos for that map that exist in IndexedDB and are absent from the new snapshot:

```js
for (const element of elements) {
  await db.put('elements', { ... });
}
```

Re-preparing after remote deletes (or after online delete that never mirrored IDB) leaves ghost elements/photos offline. Field users can re-edit deleted geometry; sync then produces confusing conflicts or failed applies.

**Suggested fix:** Before upserting, list all `elements` / `photos_meta` for `(userId, mapId)`, compute set difference against the new snapshot IDs, and delete the extras (and related `photo_blobs` if any). Also apply the same purge when `prepareOfflineMap` refreshes.

## Triage

- Decision: `UNREVIEWED`
- Notes:
