---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: src/lib/sync/SyncEngine.js
line: 140
severity: high
author: claude-code
provider_ref:
---

# Issue 007: Offline creates do not remap local IDs after sync

## Review Comment

Offline element creates use a client-generated UUID as `resource_id` / `element.id`. After a successful sync, `_applyResource` upserts the server resource but does not remove the local-id IndexedDB entry or rewrite dependent outbox rows (e.g. photo creates with `payload.element_id` still pointing at the local id).

Dependent photo uploads and subsequent updates then target a non-existent server id, causing permanent sync failures even after photo upload support is fixed.

Suggested fix: on synced `create`, delete the scoped local key, store under the server id, and rewrite pending dependent mutations (`depends_on`, `resource_id`, `payload.element_id` / `map_id`) to the authoritative ids returned by the server. Cover with a Vitest case for create→photo dependency remapping.

Also affected: `src/lib/offline/OfflineStore.js`, `src/lib/offline/offlineApi.js`.

## Triage

- Decision: `valid`
- Notes:
  - O bug é real: creates offline usam UUID local em `resource_id`/`element.id`; sem remapeamento após sync, mutações dependentes (fotos, updates) continuam apontando para um id inexistente no servidor.
  - `depends_on` referencia `client_mutation_id`, não `resource_id`, portanto não precisa ser reescrito quando o id do elemento muda.
  - `payload.map_id` em creates de elemento usa o id do mapa já preparado no servidor; não há remapeamento de mapa offline neste fluxo.
  - Correção em `SyncEngine._applyResource` (tipo `element`): após sync de `create`, faz `upsertElement` com o recurso do servidor, `removeElement(localId)` e reescreve linhas pendentes do outbox cujo `payload.element_id` ou `resource_id` ainda referenciam o id local.
  - Lacuna adicional: `resolveConflict` chamava `_applyResource` sem `client_mutation_id`, impedindo o remapeamento no caminho de resolução de conflito; corrigido passando o id da mutação.
  - `OfflineStore.removeElement` já existia; nenhuma alteração necessária em `OfflineStore.js` ou `offlineApi.js`.
  - Testes: `UT-091` (flush create→photo remapping) e novo caso `UT-091: resolveConflict remaps local element id for dependent photo`.

## Resolution

- `src/lib/sync/SyncEngine.js`: remapeamento pós-sync em `_applyResource`; `resolveConflict` repassa `client_mutation_id`.
- `tests/js/offline.test.js`: cobertura de remapeamento via `resolveConflict`.
