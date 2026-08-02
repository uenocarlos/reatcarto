# Task Memory: task_03.md

## Objective Snapshot

Implemented owner-scoped PostGIS maps/elements CRUD, filesystem photos, HTTP apiClient, and Dashboard/MapEditor/StylePanel online wiring.

## Important Decisions

- Version conflicts throw `ConflictException` (409 with snapshots) instead of `exit` so PHPUnit and endpoints share behavior.
- Non-owner map reads/updates return `not_found` (404) to avoid leaking private IDs; element mutators use `forbidden` (403) per test contract.
- Photo storage uses `copy()` fallback when `is_uploaded_file()` is false (PHPUnit fixtures).

## Learnings

- `move_uploaded_file()` fails in PHPUnit; test uploads need copy fallback or real multipart simulation.
- `json_conflict()` must not call `exit` inside service layer used by tests.

## Files / Surfaces

- PHP services: `php/lib/Maps/MapService.php`, `Elements/ElementService.php`, `Photos/PhotoService.php`, `GeoJson.php`, `ClientMutation.php`, `Limits.php`
- Endpoints: `php/maps/*`, `php/elements/*`, `php/photos/*`
- Client: `src/api/apiClient.js`, `DashBoard.jsx`, `MapEditor.jsx`, `StylePanel.jsx`
- Tests: `tests/php/Maps/`, `Elements/`, `Photos/`, `MapsTestCase.php`, `tests/js/maps.test.js`

## Errors / Corrections

- Fixed PHPUnit abort from conflict handler by introducing `ConflictException`.
- Fixed photo upload tests after adding non-upload copy path.

## Ready for Next Run

- task_04: OfflineStore/outbox; stub `prepareOffline`/`sync` in apiClient as needed.
- task_05: publish/unpublish, public gallery, UT-066 public photo GET.
