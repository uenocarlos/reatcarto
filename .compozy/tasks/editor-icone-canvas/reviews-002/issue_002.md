---
provider: manual
pr:
round: 2
round_created_at: 2026-08-13T01:59:00Z
status: resolved
file: tests/js/iconCanvasEditor.test.jsx
line: 9
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Testes do editor mockam Fabric e não detectam falha de desenho

## Review Comment

`tests/js/iconCanvasEditor.test.jsx` substitui o pacote `fabric` inteiro por um `MockCanvas` que não emite `path:created`, não simula `isDrawingMode` nem handlers `mouse:*`. Os casos E2E-010/015/016 e UT-060 só verificam botões desabilitados na UI.

O contrato `_tests.md` atribui US-003 (lápis, formas, cor, espessura) a UT-024 e E2E-005, mas não há teste com Fabric real (ou double fiel) que prove que um gesto de desenho habilita Confirmar. O bug de `z-index` (issue_001) passou pela suíte verde.

**Correção sugerida:** adicionar pelo menos um teste de integração com Fabric real (ou harness que dispara `path:created` / `object:added`) validando que `hasContent` vira `true` após simular desenho; opcionalmente teste de regressão de `z-index` no `DialogContent` do editor.

## Triage

- Decision: `valid`
- Root cause: mock de Fabric não dispara `path:created` nem valida que conteúdo desenhável habilita Confirmar; regressão de z-index passou despercebida.
- Fix: expor instância mock via `vi.hoisted`, simular `path:created`/`object:added` com tinta visível e assertar Confirmar habilitado; adicionar teste de regressão de `z-[1100]` no dialog do editor.
