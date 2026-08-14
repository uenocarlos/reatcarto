---
provider: manual
pr:
round: 1
round_created_at: 2026-08-13T00:46:00Z
status: resolved
file: src/components/map/StylePanel.jsx
line: 558
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Nome de upload de arquivo não normalizado no cliente

## Review Comment

O fluxo de desenho usa `normalizeIconName` (trunca em 100 caracteres). O fluxo de upload usa apenas `iconNameFromFileName(file.name)` sem truncar nem aplicar fallback, e envia o nome bruto para `api.icons.create`.

O servidor (`IconService::normalize_icon_name`) **rejeita** nomes com mais de 100 caracteres (`validation_error`, IT-008). Um arquivo com nome longo falha no upload com erro genérico, embora a imagem seja válida.

**Correção sugerida:** reutilizar `normalizeIconName` (ou a mesma política do editor) em `handleCustomIconFileUpload` antes de chamar `api.icons.create`. Adicionar teste que simula nome de 101+ caracteres e asserta sucesso com nome truncado ou mensagem alinhada ao contrato UT-016/IT-008.

## Triage

- Decision: `invalid`
- Reason: issue_001 remove o fluxo de upload genérico (`handleCustomIconFileUpload`); o caminho de produção passa pelo editor, que já usa `normalizeIconName` via `confirmIconEditorSave`. Sem upload de arquivo, o bug não se reproduz.
