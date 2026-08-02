# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Publication + anonymous gallery: owner publish/unpublish, public PHP endpoints with live visibility recheck, Gallery/PublicMapView UI, Dashboard badges/controls.

## Important Decisions

- Non-owner publish/unpublish returns `403 forbidden` (not 404) via `assert_map_owner(..., false)`.
- Empty map publish requires `confirm_empty: true` or returns `confirmation_required`.
- Public eligibility: `is_published && moderated_at IS NULL && owner.status = active`; all public GETs re-query DB.
- Public photo URLs use `/php/public/photo.php`; private owner URLs remain `/php/photos/get.php`.
- IT-051 auth-state checks exercised via `require_active_user()` at endpoint boundary; service functions accept caller-provided user.

## Learnings

- Overlong description publish test must UPDATE DB after create — `maps_create` rejects overlong description upfront.
- `photo_can_read` now joins owner status; deactivated owners block anonymous photo access.

## Files / Surfaces

- PHP: `MapService.php` (publish/unpublish, public eligibility helpers), `PublicService.php`, `PhotoService.php`, `Limits.php`, `php/maps/publish.php`, `unpublish.php`, `php/public/*.php`
- Frontend: `apiClient.js`, `App.jsx`, `DashBoard.jsx`, `Gallery.jsx`, `PublicMapView.jsx`, `LeafletMap.jsx` (`readOnly`)
- Tests: `tests/php/Public/PublishPublicTest.php`, `tests/js/public.test.js`

## Errors / Corrections

- Fixed DashBoard `handlePrepareOffline` stray `useCallback` dependency syntax (pre-existing).
- Fixed IT-051 to test `require_active_user` for pending/deactivated instead of service-level publish on foreign map.

## Ready for Next Run

- task_06: admin moderation UI sets `moderated_at`; public filters already honor it.
- Optional: add `readOnly` click handler on MapElements for public popup (currently contextmenu/long-press).
