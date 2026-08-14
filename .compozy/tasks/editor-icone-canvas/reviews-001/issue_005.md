---
provider: manual
pr:
round: 1
round_created_at: 2026-08-13T00:46:00Z
status: resolved
file: php/icons/uploads
line: 0
severity: low
author: claude-code
provider_ref:
---

# Issue 005: Artefato de upload versionado no repositório

## Review Comment

Há um PNG de teste em `php/icons/uploads/icons/bf/19daae9b-2b8f-4682-bae4-471fb6872df9.png` (untracked, mas dentro da árvore de ícones). O serviço grava ícones em `uploads/icons/` sob `UPLOADS_ROOT`; esses bytes não devem ir para o controle de versão.

Sem `.gitignore` para `php/icons/uploads/` ou `uploads/`, há risco de commit acidental de dados de usuário em produção.

**Correção sugerida:** adicionar padrão de ignore para diretórios de upload gerados, remover o artefato de teste do workspace, e documentar no README de deploy que `UPLOADS_ROOT` é externo ao repo (espelhando o padrão de fotos).

## Triage

- Decision: `valid`
- Root cause: artefato de teste em `php/icons/uploads/` e `.gitignore` sem cobrir diretórios de upload.
- Fix: adicionar `/uploads/` e `/php/icons/uploads/` ao `.gitignore`; remover PNG de teste do workspace.
