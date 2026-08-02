---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/lib/export/exportSettings.js
line: 285
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Debounced persist failures are swallowed

## Review Comment

`createDebouncedExportSettingsPersist.schedule` fires flush on a timer and discards rejection:

```js
timer = setTimeout(() => {
  timer = null;
  flush().catch(() => {});
}, delayMs);
```

Network/API failures during normal option edits are silent. The owner keeps editing under the assumption US-016 persistence succeeded; only explicit `flush()` on close/export surfaces errors (and even those are often caught empty in `MapEditor`). UT-177-style “session memory retained” is fine for offline continue, but providing zero feedback on failed online saves leaves settings drift across devices with no recovery cue.

Suggested fix: accept an `onPersistError` callback (toast + `console.error` without PII), keep `memorySettings` for retry (already retained), and optionally reschedule a backoff retry. Do not claim success in UI when the last persist failed; surface a non-blocking warning on the export options panel.

## Triage

- Decision: `valid`
- Root cause: `schedule()` chamava `flush().catch(() => {})`, descartando rejeições do persist debounced. Falhas de rede/API durante edições normais ficavam silenciosas; só `flush()` explícito (close/export) propagava erro — e mesmo assim era engolido em `MapEditor`.
- Fix approach: estender `createDebouncedExportSettingsPersist` com `onPersistError`, `hasPersistFailure()` e retry com backoff (`retryDelayMs`, default 2s). Falhas debounced agora notificam via callback (sem PII no fallback `console.error`), mantêm `memorySettings` e reagem com retry; `flush()` explícito continua rejeitando (UT-177). UI (toast/aviso no painel) fica para wiring em `exportSettingsStore`/`MapEditor` via `onPersistError` + `hasPersistFailure()` — fora do escopo deste batch (`exportSettings.js` only).
