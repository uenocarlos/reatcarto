---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T17:26:20Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 34
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Basemap error readiness sticks across switches

## Review Comment

`ExportMapModal` keeps `basemapReadiness` in React state and passes `setBasemapReadiness` straight to the preview. Online `TileLayer` only ever calls `onBasemapReadinessChange({ error: true })` on `tileerror` and never clears or replaces that object on success, remount, or basemap change:

```jsx
eventHandlers={{
  tileerror: () => onBasemapReadinessChange?.({ error: true }),
}}
```

After a single online tile failure, `evaluateBasemapReadiness` stays `error` even if the user switches to another online basemap (`RadioGroup` → `update('basemap', v)`) or the new layer loads cleanly, because nothing resets `basemapReadiness` when `config.basemap` changes. Export remains blocked with “Basemap indisponível” until the modal is closed/reopened.

This breaks US-009.EC-5/EC-7 (rapid switch / re-select settles on the latest selection) and turns a transient tile miss into a sticky session failure.

Suggested fix: reset readiness when `basemap` changes (e.g. `useEffect` → `setBasemapReadiness({})`), and have the online layer report explicit success/clear-error on `load` (or replace readiness entirely rather than only OR-ing `error: true`). Prefer replacing state with a full payload per basemap instance keyed by basemap id.

## Triage

- Decision: `valid`
- Root cause: `ExportMapModal` mantinha `basemapReadiness` em state React sem limpar quando `config.basemap` mudava. Payloads legados ou atrasados com `{ error: true }` (ou `requiredTiles` com `null` de falha anterior) permaneciam ativos após troca rápida de basemap, fazendo `evaluateBasemapReadiness` retornar `error` e bloquear exportação com "Basemap indisponível" até fechar/reabrir o modal.
- Fix: `useEffect` em `ExportMapModal` que chama `setBasemapReadiness({})` sempre que `basemap` muda, garantindo que a nova instância de camada (OnlineTileLayer com `key={basemap}`) reporte readiness fresco. `OnlineTileLayer` já emite payloads completos via `buildOnlineReadinessPayload` — não exigiu alteração adicional neste batch.
- Tests: UT-090e cobre reset pós-switch (loading em vez de error sticky) e recuperação quando tiles carregam.
