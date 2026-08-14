---
provider: manual
pr:
round: 2
round_created_at: 2026-08-13T01:59:00Z
status: resolved
file: src/components/map/iconEditor/IconCanvasEditor.jsx
line: 527
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Dialog do editor abaixo do StylePanel bloqueia desenho

## Review Comment

O usuário reporta que não consegue fazer o básico — desenhar no canvas. A causa é empilhamento de `z-index`:

- `StylePanel` usa `z-[1001]` (`absolute`/`fixed` no painel de estilo).
- `IconCanvasEditor` abre via `DialogContent` com o padrão shadcn `z-50` (`src/components/ui/dialog.jsx`).
- O dialog é portado ao `body`, mas com `z-index` **50**, ficando **abaixo** do painel (`1001`). O painel intercepta `pointer` events sobre o modal (overlay + canvas), impedindo lápis, formas e confirmação.

O projeto já resolve o mesmo conflito em outros modais sobre o editor:

- `MobileEditorActionsMenu` → `SheetContent` + `overlayClassName="z-[1100]"`
- `StylePanel` `SelectContent` → `z-[1100]`

O editor de ícones não elevou a camada.

**Correção sugerida:** elevar overlay e conteúdo do dialog a `z-[1100]` (ou acima de `1001`). Estender `DialogContent` para aceitar `overlayClassName` (como `SheetContent`) ou aplicar classes equivalentes no `IconCanvasEditor`. Adicionar teste RTL que asserta classes de empilhamento ou simula pointer no canvas com Fabric real/jsdom.

**Arquivos relacionados:** `src/components/ui/dialog.jsx`, `src/components/map/StylePanel.jsx` (referência `z-[1001]`).

## Triage

- Decision: `valid`
- Root cause: `IconCanvasEditor` usa `DialogContent` com `z-50` padrão, abaixo do `StylePanel` (`z-[1001]`), bloqueando pointer events no canvas.
- Fix: estender `DialogContent` com `overlayClassName` (como `SheetContent`) e aplicar `z-[1100]` no overlay e conteúdo do editor.
