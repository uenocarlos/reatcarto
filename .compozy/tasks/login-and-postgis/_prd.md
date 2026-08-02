# Product Requirements Document: Account Access and PostGIS Map Persistence

## Overview

ReatCarto currently supports map creation and field-oriented tools, but its frontend operates from local device storage and bypasses its incomplete login flow. Users cannot reliably own maps, recover them on another device, publish selected work, or depend on a central source of truth.

This feature introduces verified self-service accounts for field workers and durable server-backed persistence for user profiles, maps, PostGIS geometries, and photos. Each user receives an isolated private workspace. Owners may deliberately publish selected maps to an anonymous, read-only public gallery. Existing offline field behavior remains available through account-bound downloaded maps and explicit synchronization.

The feature serves three personas:

- Field users who capture points, lines, polygons, metadata, and photos in connected or disconnected environments.
- Anonymous visitors who discover and inspect published maps without creating an account.
- Administrators who operate accounts, moderate public content, and perform accountable support interventions.

## Goals

- Allow any field worker to register with professional details, verify their email, and log in with either email or username.
- Allow users to recover passwords and maintain their profile and credentials without administrator assistance.
- Guarantee that every map and element has an owner and that private data is inaccessible to unrelated users.
- Persist accounts, maps, geometries, metadata, attribution, and photos in a durable authoritative store.
- Allow verified users to create and edit downloaded owned maps without connectivity and synchronize later without silent conflict loss.
- Make maps private by default while allowing owners to publish selected maps for anonymous read-only discovery.
- Give administrators the requested account, moderation, and private-map support powers with immutable auditing and owner notification.
- Allow users to permanently delete their accounts and all associated product data.

## User Stories

- `US-001`–`US-002`: registration, consent, and email verification.
- `US-003`–`US-005`: login, password recovery, and profile maintenance.
- `US-006`–`US-008`: private map ownership, geospatial elements, and photos.
- `US-009`–`US-011`: offline work, synchronization, conflict resolution, and safe logout.
- `US-012`–`US-014`: publication, public discovery, and anonymous read-only viewing.
- `US-015`–`US-017`: account administration, public moderation, and audited private-map intervention.
- `US-018`: permanent account and data deletion.

[Full user stories](_user_stories.md)

## Core Features

### Open professional registration

- Registration collects full name, unique username, unique email address, password and confirmation, organization, job title, and phone number.
- Registration requires explicit acceptance of the current Terms of Use and Privacy Policy.
- The product records the accepted document versions and acceptance time.
- A successful registration creates a pending-verification account and sends email-verification instructions.
- Pending users cannot create or edit maps.
- Validation identifies invalid, missing, duplicate, or nonmatching fields without disclosing unrelated account details.

### Verified authentication and account recovery

- Users may log in with either their username or email address plus password.
- Only active, verified accounts may access private workspaces or mutate map data.
- Invalid login responses do not reveal whether an identifier exists.
- Users can request an email-based password-reset link; recovery responses do not disclose whether the email is registered.
- Verification and recovery links are single-purpose and cease to work after use, expiry, deletion, or incompatible account-state changes.
- Users can resend verification instructions under anti-abuse controls.

### Profile and credential management

- Users can update full name, organization, job title, and phone number.
- Users can change to an available username.
- Users can change email; the replacement address must be verified before becoming the trusted recovery and notification address.
- Users can change password after confirming their current password.
- Account changes never transfer or expose another user's map ownership.

### Private map workspace

- Every map belongs to exactly one field user.
- New maps are private by default.
- Verified active owners can list, search, open, rename, and delete their maps.
- Empty workspaces provide a clear path to create the first map.
- Knowing a private map or element identifier never grants access.

### Durable geospatial elements

- Owned maps support point, line, and polygon elements.
- Every element stores valid geometry, name, description, category, style, author, creation time, and update time.
- Owners can create, inspect, edit, and delete elements.
- Element ownership is inseparable from the owning map and user.
- Deleting a map removes its elements and attached photos from private and public product views.

### Field photos

- Owners can capture or choose one or more supported photos for an element.
- Users can preview and remove attachments.
- Failed or partial uploads never appear as valid public attachments.
- Photos attached to a published map are visible to anonymous visitors.
- The interface communicates file compatibility, size/count constraints, upload progress, failure, and retry.

### Account-bound offline operation

- A verified user can prepare owned maps for offline use.
- Prepared maps remain viewable and editable when connectivity is unavailable.
- Offline creates, updates, and deletions remain visibly pending until synchronized.
- A map not prepared before disconnection is reported as unavailable rather than shown incompletely.
- Private offline data is bound to its account and cannot be opened by another signed-out or signed-in user.
- Existing maps and elements stored by the prior local-only application are not imported into the account system.

### Synchronization and conflict resolution

- Pending operations synchronize when connectivity returns, with visible progress and per-item failure information.
- Synchronization retries do not duplicate accepted maps, elements, photos, or deletions.
- When the same item changed locally and remotely, the product preserves and presents both versions.
- The user selects which version becomes authoritative; the product never resolves a true conflict through silent last-write-wins behavior.
- Deletes, dependent operations, account-state changes, and ownership changes are reconciled without silently recreating deleted data.

### Safe logout

- Logout attempts to synchronize pending changes before ending the account session.
- With no unsynchronized work, logout clears private cached account data from the device.
- If synchronization cannot complete, the product explains which work remains pending and requires explicit confirmation before discarding it.
- After logout completes, another device user cannot access the prior user's private maps or photos.

### Owner-controlled publication

- Owners can publish and unpublish only their own maps.
- Publication clearly warns that map content, element details, and photos become available to anyone.
- Published maps receive a stable public route and appear in the searchable public gallery.
- Unpublishing immediately removes the map from the gallery and blocks anonymous access.
- Deletion, owner deactivation, or administrative moderation also blocks public access.

### Public gallery and anonymous viewing

- Any visitor can open and search the gallery without an account.
- The gallery returns only currently published, non-moderated maps.
- Public search supports relevant map summary text and handles empty results.
- Public map pages allow navigation and read-only inspection of elements and photos.
- Anonymous visitors cannot edit maps, export PDF, or download geographic data in this version.
- Direct public routes re-check current publication state rather than relying on stale gallery or client state.

### Account administration

- The product has two roles: field user and administrator.
- Administrators can search and list accounts and view necessary status and professional profile information.
- Administrators can activate and deactivate accounts.
- Deactivation terminates protected use and removes the account's maps from public access.
- Reactivation restores account access only if all other prerequisites, including email verification, are satisfied.
- Every status change is audited and notifies the affected user.

### Public-content moderation

- Administrators can hide or remove a published map from the gallery and anonymous route.
- Moderation requires a reason.
- The owner can see the moderation status and reason from their private workspace.
- Moderation creates an audit record and owner notification.
- Moderation does not transfer map ownership.

### Accountable private-map intervention

- Administrators may view, edit, or delete private maps and elements for support or administration.
- Every private access or mutation requires an administrative reason.
- Every action records the administrator, target, action, time, reason, and meaningful before/after context.
- Audit entries are immutable through ordinary product actions.
- Confirmed administrative mutations notify the affected owner.
- Administrative access does not make a private map public.

### Permanent account deletion

- Users can initiate permanent deletion from their authenticated account.
- The confirmation explains that account identity, maps, elements, photos, public routes, sessions, and unsynchronized account-bound local work will be removed.
- Deletion requires fresh identity confirmation and explicit irreversible consent.
- Confirmed deletion promptly revokes sessions and public access and completes removal of all associated product data.
- Reusing a former email or username never restores deleted maps or account state.

## Business Rules

### Identity and account state

- Username and email are independently unique among accounts according to the identity-reuse policy defined in the TechSpec.
- Login accepts either identifier but never creates ambiguity between accounts.
- Account lifecycle states are pending verification, active, deactivated, and deleted.
- Pending verification may move to active only after successful email verification.
- Active may move to deactivated through administrator action.
- Deactivated may return to active through administrator action if verification remains valid.
- Deleted is terminal; no product action restores a deleted account.
- A newly changed email remains pending until verified and cannot silently replace the trusted recovery address.
- Consent to the current Terms of Use and Privacy Policy is mandatory at registration and stores version and time.

### Ownership and permissions

- A map has exactly one owner; an element and photo inherit that map's ownership.
- A field user can mutate only owned content.
- A verified active account is required to create or edit map data.
- Anonymous visitors can access only currently published, non-moderated maps and only in read-only form.
- Administrator powers are the sole exception to owner-only mutation and always require audit and owner notification.
- Authorization applies to map, element, photo, synchronization, publication, and media routes independently.

### Visibility

- Private is the default and fallback visibility.
- Public visibility is an explicit owner decision.
- Published content includes the map view, element geometry and descriptive fields, and attached photos.
- Public visibility never includes edit, PDF export, or geographic-data download rights.
- Unpublication, moderation, deletion, or owner deactivation makes public content unavailable on the next access.

### Synchronization

- Server-confirmed account and map state is authoritative; offline data is a synchronized working copy.
- Every pending operation has an observable pending, synchronized, failed, or conflicted outcome.
- Retrying an operation must not repeat its user-visible effect.
- True concurrent edits preserve both versions until an authorized user resolves the conflict.
- A local edit cannot silently recreate a remotely deleted map or element.
- Logout cannot discard pending changes without explicit informed confirmation.

### Administration and audit

- Field users cannot grant themselves administrator status.
- Account status changes, public moderation, and all administrative private-map access or mutation are auditable.
- An audit record identifies actor, target, action, timestamp, reason where required, and meaningful change context.
- Ordinary users and routine administrator operations cannot modify or erase audit history.
- Notifications are sent only for confirmed administrative outcomes and identify the action without unnecessarily reproducing sensitive content.

### Data lifecycle

- Deleting an element removes its attached photos.
- Deleting a map removes its elements, photos, public route, and gallery entry.
- Deleting an account removes its profile, sessions, maps, elements, photos, publication access, and account-bound pending server data.
- Permanent deletion is not an account-deactivation shortcut and cannot be reversed.
- Data from the existing local-only version is discarded rather than migrated.

### Validation and limits

- Invalid or unsupported geometry, media, credentials, and profile values are rejected before becoming authoritative.
- Product surfaces must state applicable field, geometry, photo, map-count, storage, and request limits when a user reaches them.
- Exact operational safety limits and security time windows will be defined in the TechSpec and must be consistent across connected and offline validation.
- Input exceeding a limit is rejected explicitly rather than silently truncated when truncation could change meaning.

## User Experience

### New field-user journey

1. The visitor opens login and can choose registration.
2. Registration collects professional identity, credentials, and explicit legal consent.
3. The product confirms that verification instructions were sent.
4. The user verifies the email and logs in with username or email.
5. An empty private workspace guides creation of the first map.
6. The user creates points, lines, and polygons, adds metadata and photos, and prepares maps for offline field work.
7. Pending offline work synchronizes when connectivity returns; conflicts receive a focused two-version resolution flow.
8. The owner may publish a map after confirming the scope of anonymous exposure.

### Returning field-user journey

1. The user logs in and sees only owned maps plus intentional links to the public gallery.
2. Clear badges distinguish private, public, moderated, pending-sync, failed-sync, and conflicted states.
3. Profile settings provide username, email, password, professional-data, and account-deletion controls.
4. Logout reports synchronization progress and never hides the risk of unsent changes.

### Anonymous visitor journey

1. The visitor opens the public gallery without authentication.
2. Search and browse show only currently available published maps.
3. The visitor opens a map, navigates it, and inspects element text and photos.
4. Editing, export, and geographic-data download controls are absent or clearly unavailable.
5. A withdrawn public route shows a neutral unavailable state without exposing private details.

### Administrator journey

1. An administrator enters a role-protected account workspace.
2. Account management supports search, status review, activation, and deactivation.
3. Public-map moderation requires a reason and confirmation.
4. Private-map access and mutation require a stated reason and prominent privileged-action context.
5. Each confirmed action exposes its audit outcome and notification status.

### UX and accessibility requirements

- Login, registration, recovery, verification, profile, conflict resolution, publication, deletion, and administration must provide visible loading, success, failure, and retry states.
- Forms use explicit labels, field-level errors, keyboard navigation, sensible focus movement, and announcements for asynchronous outcomes.
- Color is never the only signal for privacy, sync, conflict, moderation, or account status.
- Destructive and public-exposure actions require specific confirmation and describe their consequences.
- Map interactions provide accessible non-map summaries or controls for essential element information where practical.
- Mobile layouts accommodate outdoor and one-handed field use without hiding account, sync, or safety states.

## High-Level Technical Constraints

- PostgreSQL with the PostGIS extension is the required authoritative persistence layer for accounts, maps, and geospatial elements.
- The feature must integrate with the existing React/Vite/Capacitor application, Leaflet map editor, and current PHP backend surface or its compatible successor.
- Existing point, line, polygon, GPS, camera, and offline-map workflows must remain recognizable to current users.
- Authentication and authorization must protect every server operation; interface hiding alone is insufficient.
- Passwords, verification credentials, recovery credentials, sessions, and administrative access must follow current secure handling practices.
- Private account data and account-bound offline copies must not be readable by another user of the device or service.
- Geospatial records must preserve a consistent coordinate reference contract and reject invalid geometry.
- The system must support interrupted mobile connectivity, resumable user-visible synchronization, and safe retries.
- Public pages must not expose private profile, map, audit, or operational fields.
- Collection and processing of name, email, phone, organization, job title, location-derived geometry, and photos must align with the accepted Terms of Use and Privacy Policy and applicable privacy obligations.
- Administrative access is highly privileged and requires stronger protection, immutable auditability, and user notification.

## Non-Goals (Out of Scope)

- Private team invitations, groups, shared ownership, and collaborative map editing.
- A team-manager role; this version has field user and administrator only.
- Administrator approval before a user may register.
- Social login, enterprise SSO, or third-party identity providers.
- Guest or unverified-user map creation and editing.
- Anonymous editing of public maps.
- Public PDF export or geographic-data download.
- Importing maps or elements from the current localStorage-based version.
- Treating local device storage as an independent authoritative map store.
- Silent last-write-wins conflict resolution.
- Reversible account deletion or automatic restoration of deleted data.

## Architecture Decision Records

- [ADR-001: Open Account Registration and Verified Identity](adrs/adr-001.md) — Use open professional registration, verified email, dual-identifier login, and self-service recovery.
- [ADR-002: Private Ownership with Anonymous Public Maps](adrs/adr-002.md) — Keep maps private by default and expose owner-published maps as anonymous read-only gallery content.
- [ADR-003: Account-Bound Offline Editing and Explicit Conflict Resolution](adrs/adr-003.md) — Preserve offline field editing, explicit conflict choice, and safe logout cleanup.
- [ADR-004: Administrative Access with Auditing and Owner Notification](adrs/adr-004.md) — Permit broad administration while making privileged actions traceable and visible to owners.
- [ADR-005: Durable Geospatial Records and Complete Account Deletion](adrs/adr-005.md) — Use PostgreSQL/PostGIS as the authority and support complete self-service data deletion.

## Open Questions

- The contents and versioning process for the Terms of Use and Privacy Policy require legal or product-owner input before release.
- Product-facing storage allowances, photo count/size limits, geometry complexity limits, and map-count limits are not yet commercially defined; the TechSpec must propose safe defaults for explicit product-owner confirmation.
- The process for creating the first administrator and recovering a locked administrator account requires an operational decision in the TechSpec.
