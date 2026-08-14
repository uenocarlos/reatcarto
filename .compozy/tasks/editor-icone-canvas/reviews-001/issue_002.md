---
provider: manual
pr:
round: 1
round_created_at: 2026-08-13T00:46:00Z
status: resolved
file: src/components/map/StylePanel.jsx
line: 775
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Sem indicação de que icon_color não tinge ícone custom

## Review Comment

O PRD (UX considerations) exige que, quando um ícone colorido customizado está ativo, fique **óbvio** que `icon_color` não o tingirá. Hoje o `ColorField` “Cor do Ícone” permanece editável e sem aviso mesmo com `style.custom_icon_url` preenchido; o preview da grade built-in continua mostrando máscaras coloridas, o que pode confundir o autor.

**Correção sugerida:** quando `custom_icon_url` estiver definido, exibir texto de ajuda curto (ex.: “Ícones da biblioteca/desenhados mantêm as cores originais”) e/ou desabilitar ou atenuar o seletor de cor com explicação. Cobrir com um teste RTL (ex.: E2E-012 ou caso novo) que asserta a presença do hint.

## Triage

- Decision: `valid`
- Root cause: StylePanel não comunicava que `icon_color` é ignorado quando `custom_icon_url` está ativo (ADR-001/PRD UX).
- Fix: `ColorField` com `disabled` quando há custom URL; hint textual; grade built-in com `opacity-60`; teste RTL para hint e botões de cor desabilitados.
