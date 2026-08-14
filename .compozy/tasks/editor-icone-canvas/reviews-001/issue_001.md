---
provider: manual
pr:
round: 1
round_created_at: 2026-08-13T00:46:00Z
status: resolved
file: src/components/map/StylePanel.jsx
line: 868
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Upload de arquivo implementado fora do escopo do PRD

## Review Comment

O PRD lista explicitamente como **Non-Goal** o upload genérico de imagens arbitrárias como ícones personalizados (“current StylePanel stub stays out of this PRD's delivery”). A task_03 reforça: “MUST leave generic file-upload stub out of scope”.

A implementação atual em `StylePanel.jsx` (seção “Ícone Personalizado (Upload)”, `handleCustomIconFileUpload` e `prepareIconPngFile`) converte JPEG/WebP/GIF para PNG, envia para `api.icons.create` e aplica ao ponto — ou seja, entrega a feature separada que o PRD excluiu.

**Correção sugerida:** remover ou desabilitar o fluxo de upload de arquivo nesta entrega, mantendo apenas o editor de desenho (desktop) e a biblioteca “Meus ícones”. Se o produto decidir manter o upload, atualizar PRD/task e adicionar casos de teste dedicados antes de merge.

## Triage

- Decision: `valid`
- Root cause: task_04 entregou upload genérico de arquivo além do editor Fabric e biblioteca, contradizendo Non-Goal do PRD e task_03.
- Fix: remover `handleCustomIconFileUpload`, imports de `prepareIconUpload`, seção UI “Ícone Personalizado (Upload)”; manter preview/clear do ícone aplicado via biblioteca ou editor sob “Meus ícones”.
