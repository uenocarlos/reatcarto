---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/components/map/export/LocationOptionsPanel.jsx
line: 97
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: Municipality select hard-capped at 200 rows

## Review Comment

The municipality `<Select>` renders only the first 200 filtered rows:

```jsx
{filteredMunicipalities.slice(0, 200).map((municipality) => (
```

Several Brazilian UFs have well over 200 municipalities. With an empty or weak search, later municipalities never appear, so owners cannot select a valid target required by US-010 / export gates (`locatorCount` 1|2). Persisted codes can still export, but interactive re-selection is broken for truncated names — IT-030 “searchable municipality list” is incomplete if the search result set itself is capped without an overflow affordance.

Suggested fix: remove the hard cap when a search query is active; for the unfiltered list use virtualization, server/client pagination, or require typing ≥N characters before listing. At minimum show a “refine search” hint when `filteredMunicipalities.length > 200` so the truncation is visible.

## Triage

- Decision: `valid`
- Root cause: o `<Select>` renderizava sempre `filteredMunicipalities.slice(0, 200)`, ocultando municípios além do 201º quando a busca estava vazia ou retornava muitos resultados. UFs com centenas de municípios ficavam com re-seleção interativa incompleta (IT-030).
- Fix approach: manter limite de 200 apenas na lista não filtrada (`searchActive === false`); quando a busca está ativa, renderizar todos os resultados filtrados. Exibir aviso `export-municipality-refine-hint` quando a lista truncada omitir municípios, orientando o usuário a refinar a busca.
- Verification: `npm run test -- tests/js/brazilLocation.test.js`, pipeline completo (`lint`, `typecheck`, `test`, `build`).
