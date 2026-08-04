---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T21:15:18Z
status: resolved
file: php/lib/Photos/PhotoService.php
line: 244
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Photo delete still allows silent LWW without base_version

## Review Comment

Round 2 issue 002 closed element update/delete `base_version` requirements but noted `photos_delete` as out of batch. It still only conflicts when a version is supplied:

```php
if ($baseVersion !== null && (int) $baseVersion !== (int) $photo['version']) {
```

Omitting `base_version` deletes the photo with no conflict — silent last-write-wins. The client helper `api.media.delete` in `src/api/apiClient.js` only includes `base_version` when non-null, so the common path can skip OCC entirely. Maps and elements now require `base_version` (unless a trusted force path); photos remain outside the TechSpec optimistic-concurrency contract.

Suggested fix: require `base_version` with 400 `validation_error` when missing (unless a server-only force path is added for trusted callers), return 409 on mismatch, and add PHPUnit coverage for omitted `base_version` on photo delete. Update `api.media.delete` callers to always send the known version.

## Triage

- Decision: `valid`
- Root cause: `photos_delete` só verificava conflito quando `base_version` era fornecido (`$baseVersion !== null`), permitindo delete silencioso (LWW) sem OCC — mesmo gap corrigido em `elements_delete` e `maps_delete` nas reviews anteriores.
- Fix aplicado: terceiro parâmetro `bool $forceVersion = false` em `photos_delete`; rejeição com `validation_error` 400 quando `base_version` ausente (salvo `$forceVersion`); conflito 409 em mismatch; `'op' => 'delete'` no payload de conflito para alinhar com elementos/mapas. Teste `testPhotoDeleteRequiresBaseVersion` em `PhotosTest.php`; testes existentes atualizados para enviar `base_version`.
- Fora do escopo deste batch (follow-up): `src/api/apiClient.js` (`api.media.delete` ainda omite `base_version` quando null) e `src/components/map/StylePanel.jsx` (chama delete sem versão). O servidor agora rejeita corretamente; o cliente precisa enviar a versão conhecida num batch futuro.

## Resolution

- `photos_delete` exige `base_version` com 400 `validation_error` quando ausente (a menos que `$forceVersion === true` para callers confiáveis futuros, espelhando `elements_delete`/`maps_delete`).
- Conflito de versão retorna 409 via `json_conflict` com `'op' => 'delete'`.
- Cobertura PHPUnit: `testPhotoDeleteRequiresBaseVersion`; `testUt065DeleteRemovesPhoto` e `PublishPublicTest::testE2e008PhotoThroughPublishFlow` atualizados.
