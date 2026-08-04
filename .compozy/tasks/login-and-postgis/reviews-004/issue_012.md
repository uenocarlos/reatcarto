---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: php/lib/Public/PublicService.php
line: 126
severity: medium
author: claude-code
provider_ref:
---

# Issue 012: Public elements response leaks map_id and author_id

## Review Comment

`public_elements_list` serializes rows with `format_element_record`, which includes private UUID `map_id` and `author_id`. Public map summaries already use a redacted formatter without the private map id; elements do not. Any anonymous visitor on `/gallery/:publicId` obtains those identifiers via network/devtools, weakening the `public_id`-only public surface (ADR-008 / IT-057).

Knowing an id alone must not grant private access, but leaking stable private identifiers from the anonymous API is still an information disclosure the public contract should avoid.

Suggested fix: add a public element formatter that omits `map_id` / `author_id` (and any other private fields), and use it in `PublicService`. Optionally strip defensively in `api.public.listElements` for defense in depth.

## Triage

- Decision: `VALID`
- Root cause: `public_elements_list()` line 126 in PublicService calls `format_element_record($elementRow, $photos)`. `format_element_record` returns `map_id` (private integer/Uuid of the owning map, NOT the `public_id`) and `author_id` (private user UUID). The map summary endpoint returns redacted `format_public_map_summary`, but elements never had an equivalent redactor.
- Fix approach:
  1. Add `format_public_element_record(array $row, array $photos = [])` alongside the private formatter — it returns a subset containing only `id, element_type, geojson, name, description, element_category, style, version, created_at, updated_at, photos` (redacting `map_id`, `author_id`).
  2. Replace `format_element_record` with `format_public_element_record` inside `public_elements_list`.
  3. For defense in depth, add a client-side strip in `api.public.listElements` (`normalizeElement` equivalent or a `normalizePublicElement` mapper) that deletes `map_id` and `author_id` from each element before returning.
