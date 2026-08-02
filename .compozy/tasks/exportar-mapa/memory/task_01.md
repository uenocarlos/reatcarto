# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Contrato e persistência de `export_settings`: migration JSONB, LWW settings-only no MapService, strip em PublicService, módulo `exportSettings.js`, mirror IndexedDB.

## Important Decisions

- Public strip via `format_public_map_summary` whitelist (nunca inclui `export_settings`) — não unset explícito.
- Settings-only branch em `maps_update` quando input contém só `id` + `export_settings` (+ opcional `client_mutation_id`); sem bump de `version`.
- Debounce helper colocado em `exportSettings.js` (`createDebouncedExportSettingsPersist`, delay default 400ms).

## Learnings

- Implementação já existia (entregue incrementalmente com tasks 02–05); esta execução validou contrato + testes e fechou tracking.

## Files / Surfaces

- `php/migrations/006_export_settings.sql`
- `php/lib/Maps/MapService.php` — `decode_export_settings_column`, `validate_export_settings_payload`, settings-only branch
- `php/lib/Public/PublicService.php` — DTO público omite settings por design
- `src/lib/export/exportSettings.js`
- `src/api/apiClient.js` — `normalizeMap`, settings-only PATCH sem `base_version`
- `tests/php/Maps/ExportSettingsTest.php`
- `tests/js/exportSettings.test.js`, `tests/js/offline.test.js`

## Errors / Corrections

- Nenhuma correção de código necessária nesta execução.

## Ready for Next Run

- Task concluída e verificada. Tasks 02–05 já dependiam deste contrato e estão operacionais.
