---
provider: manual
pr:
round: 1
round_created_at: 2026-08-13T00:46:00Z
status: resolved
file: src/components/map/StylePanel.jsx
line: 514
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: confirmIconEditorSave não integrado ao StylePanel

## Review Comment

`src/lib/icons/iconEditorConfirm.js` implementa o fluxo de confirmação com códigos estruturados (`offline`, `empty`, `oversize`, `auth`, `network`) e é coberto por UT-031/UT-033/UT-034. Porém `StylePanel.handleIconEditorConfirm` duplica a lógica inline (checagem offline, `api.icons.create`, toast) **sem importar** o helper.

Isso cria divergência: os testes de `iconEditorConfirm` não exercitam o caminho de produção; futuras correções (ex.: mapeamento de `401` para mensagem de sessão, guardas de export) podem ser aplicadas só no helper morto.

**Correção sugerida:** refatorar `handleIconEditorConfirm` para delegar a `confirmIconEditorSave` (passando `createIcon: api.icons.create.bind(api.icons)` e `applyCustomIconUrl`), mapear `result.code` para toasts e atualização de biblioteca. Remover duplicação e alinhar testes E2E ao helper real.

## Triage

- Decision: `valid`
- Root cause: `handleIconEditorConfirm` duplicava upload/erros sem usar `confirmIconEditorSave`.
- Fix: delegar a `confirmIconEditorSave` com blob pré-exportado do editor; estender helper para aceitar `blob` opcional e validar tamanho; mapear `result` para toast e biblioteca.
