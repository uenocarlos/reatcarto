---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/page/MapEditor.jsx
line: 90
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Ownership lost navigates away instead of blocking

## Review Comment

US-001.EC-9 requires that when the map is deleted or ownership is lost while the export screen is open, export actions stay blocked with a clear in-modal message. `MapEditor` sets `ownershipLost` but immediately navigates home:

```js
useEffect(() => {
  if (mapAuthError) {
    setOwnershipLost(showExport);
    toast.error('Mapa não encontrado, acesso negado ou indisponível offline');
    navigate('/');
  }
}, [mapAuthError, navigate, showExport]);
```

`ExportMapModal` already renders `data-testid="export-ownership-lost"` and disables actions when `ownershipLost` is true, but that UI is unreachable for the auth/ownership-error path because the route unmounts. IT-006 only source-scans for those strings and never simulates a mid-open 404/403, so the gap stays green.

Suggested fix: when `showExport` is true and `mapAuthError` fires, keep the editor/modal mounted, set `ownershipLost`, show the existing destructive message, and skip `navigate('/')` until the user dismisses. Only navigate when export is not open. Add an IT that opens the modal, injects map auth error, and asserts the modal remains with export disabled and no success path.

## Triage

- Decision: `UNREVIEWED`
- Notes:
