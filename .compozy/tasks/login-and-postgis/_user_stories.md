# User Stories: Account Access and PostGIS Map Persistence

Canonical behavior catalog for account access, durable geospatial maps, public
viewing, offline field work, and administration. Companion to `_prd.md`;
consumed by `_techspec.md` and `_tests.md`.

## Personas

- **Field user** — a technician, surveyor, or other field worker who owns maps, captures geospatial data, works through connectivity gaps, and controls publication.
- **Anonymous visitor** — a person without an account who discovers and views published maps.
- **Administrator** — an authorized operator who manages accounts, moderates public content, and intervenes in map data with full accountability.

## Story Index

| ID | Feature Area | Persona | Story |
| --- | --- | --- | --- |
| US-001 | Registration | Field user | Create a professional account |
| US-002 | Registration | Field user | Verify an email address |
| US-003 | Authentication | Field user | Log in with email or username |
| US-004 | Authentication | Field user | Recover a forgotten password |
| US-005 | Profile | Field user | Maintain profile and credentials |
| US-006 | Private maps | Field user | Create and manage owned maps |
| US-007 | Map elements | Field user | Capture and edit geospatial elements |
| US-008 | Map elements | Field user | Attach photos to elements |
| US-009 | Offline work | Field user | Work on downloaded maps without connectivity |
| US-010 | Synchronization | Field user | Synchronize changes and resolve conflicts |
| US-011 | Authentication | Field user | Log out without silently losing work |
| US-012 | Publication | Field user | Publish and unpublish an owned map |
| US-013 | Public discovery | Anonymous visitor | Discover published maps |
| US-014 | Public viewing | Anonymous visitor | Inspect a published map |
| US-015 | Administration | Administrator | Manage account status |
| US-016 | Administration | Administrator | Moderate public maps |
| US-017 | Administration | Administrator | Intervene in private maps with accountability |
| US-018 | Privacy | Field user | Permanently delete an account and its data |

## Registration

### US-001: Create a professional account

**As a** field user, **I want** to register my professional identity, **so that** I can own and manage field maps.

Acceptance criteria:

- AC-1: Given the registration page, when I submit a unique username and email, full name, password and confirmation, organization, job title, phone number, and required consent, then the product creates a pending-verification account and sends verification instructions.
- AC-2: Given missing, malformed, duplicate, or nonmatching values, when I submit, then the product identifies the affected fields and does not create the account.
- AC-3: Given the Terms of Use and Privacy Policy, when I consent, then the product records the accepted versions and time.
- AC-4: Given a pending account, when I attempt to create or edit a map before verification, then the product blocks the action and offers to resend verification.

Edge cases:

- EC-1 (Invalid input): Malformed email, phone, hostile text, or nonmatching passwords → submission is rejected with field-specific guidance and no unsafe text is rendered.
- EC-2 (Empty / missing): Any required field or consent is absent → no account is created and each omission is identified.
- EC-3 (Limits): A field exceeds its documented length or registration is repeatedly attempted → input is rejected or temporarily limited with a clear message.
- EC-4 (Permissions): An already authenticated user opens registration → they are directed to their account rather than creating an accidental second session.
- EC-5 (Concurrency): Two registrations claim the same username or email → at most one succeeds; the other receives a uniqueness error.
- EC-6 (Interruption): Connectivity fails during submission → the user sees that registration was not confirmed and can safely retry.
- EC-7 (Repetition): The same valid form is submitted twice → only one account exists and duplicate verification delivery is bounded.
- EC-8 (Ordering): Verification is opened before account creation completes → no account is activated and a safe retry path is shown.
- EC-9 (State transitions): A deactivated or deleted identity is re-registered → the product applies the documented reuse rule without restoring old maps.
- EC-10 (Scale): High registration volume → legitimate users receive responsive status while anti-abuse controls remain in effect.

### US-002: Verify an email address

**As a** field user, **I want** to prove control of my email, **so that** I can activate map creation and recover my account.

Acceptance criteria:

- AC-1: Given a valid pending account and verification link, when I open it before expiry, then the account becomes verified and I can log in to create and edit maps.
- AC-2: Given an expired or invalid link, when I open it, then no account state changes and I can request a replacement.
- AC-3: Given a pending account, when I request resend, then verification instructions are sent without revealing sensitive account details.

Edge cases:

- EC-1 (Invalid input): A tampered verification token → rejected without activating any account.
- EC-2 (Empty / missing): The route has no token → verification does not occur and resend guidance appears.
- EC-3 (Limits): Repeated resend requests → delivery is rate-limited with a retry message.
- EC-4 (Permissions): A token for one account is opened during another user's session → only the token's intended account can be verified.
- EC-5 (Concurrency): Two valid verification requests race → the account ends verified once.
- EC-6 (Interruption): The connection drops after activation → reopening the link reports the already-verified state.
- EC-7 (Repetition): An already-used token is replayed → no duplicate side effects occur.
- EC-8 (Ordering): Login occurs before verification → viewing permitted public content is allowed, but owned-map creation and editing remain blocked.
- EC-9 (State transitions): A deactivated or deleted account's token is opened → it is not reactivated.
- EC-10 (Scale): A delivery backlog occurs → the interface reports pending delivery and permits bounded resend.

## Authentication

### US-003: Log in with email or username

**As a** field user, **I want** to log in using either identifier, **so that** I can access my maps conveniently.

Acceptance criteria:

- AC-1: Given an active verified account, when I provide its email or username and correct password, then I enter my private map workspace.
- AC-2: Given invalid credentials, when I submit them, then access is denied with a generic error.
- AC-3: Given an unverified account, when credentials are correct, then the product explains that verification is required and offers resend.
- AC-4: Given a deactivated account, when credentials are correct, then access remains denied with an account-status message.

Edge cases:

- EC-1 (Invalid input): Malformed or hostile identifier input → login fails safely without exposing account existence.
- EC-2 (Empty / missing): Identifier or password is blank → submission is blocked and the missing field is indicated.
- EC-3 (Limits): Repeated failed attempts → further attempts are temporarily limited without locking out unrelated users.
- EC-4 (Permissions): A valid anonymous public-map session attempts an owner action → login is required and return navigation is preserved.
- EC-5 (Concurrency): The same account logs in on multiple devices → each valid session is recognized under the documented session policy.
- EC-6 (Interruption): Connectivity fails during login → no false success is shown and retry remains available.
- EC-7 (Repetition): The login form is submitted repeatedly after success → one active navigation occurs.
- EC-8 (Ordering): A protected deep link is opened before login → successful login returns the user to the authorized destination.
- EC-9 (State transitions): An account becomes deactivated during a session → the next protected action ends access and explains the state.
- EC-10 (Scale): Many simultaneous logins → authentication remains responsive and no user's identity crosses into another session.

### US-004: Recover a forgotten password

**As a** field user, **I want** an email-based reset flow, **so that** I can regain access without administrator help.

Acceptance criteria:

- AC-1: Given the recovery page, when I submit an account email, then the product gives the same confirmation whether or not the address exists.
- AC-2: Given a valid reset link, when I submit a valid new password and confirmation, then the old password no longer works and I can log in with the new one.
- AC-3: Given an expired, used, or invalid link, when I attempt reset, then no password changes and I can request a new link.

Edge cases:

- EC-1 (Invalid input): Malformed email, token, or invalid password → reset is rejected with safe guidance.
- EC-2 (Empty / missing): Required reset values are missing → no state changes.
- EC-3 (Limits): Excessive recovery requests → responses remain generic and requests are temporarily limited.
- EC-4 (Permissions): A reset token is used while logged into another account → only the intended account may be reset.
- EC-5 (Concurrency): Two valid reset attempts race → only the first accepted password becomes current and remaining tokens are invalidated.
- EC-6 (Interruption): Connection fails during password submission → retry reveals whether the token remains usable without applying two changes.
- EC-7 (Repetition): A completed reset link is replayed → it cannot change the password again.
- EC-8 (Ordering): Password reset is attempted before email verification → the product does not bypass required verification.
- EC-9 (State transitions): The account is deactivated or deleted before reset → reset does not reactivate or recreate it.
- EC-10 (Scale): Bulk recovery abuse occurs → service remains available to legitimate users and does not leak registered addresses.

### US-005: Maintain profile and credentials

**As a** field user, **I want** to update my profile, username, email, and password, **so that** my account remains accurate and secure.

Acceptance criteria:

- AC-1: Given my profile, when I update full name, organization, job title, or phone with valid values, then the new values appear on my account.
- AC-2: Given a unique valid username, when I change it, then subsequent login accepts the new username and rejects the old one.
- AC-3: Given a new unique email, when I change it, then verification is required for the new address and recovery does not move to it until verification succeeds.
- AC-4: Given my current password and a valid new password confirmation, when I change it, then future login requires the new password.

Edge cases:

- EC-1 (Invalid input): Invalid profile values, duplicate identifiers, or incorrect current password → affected changes are rejected precisely.
- EC-2 (Empty / missing): A required identity field is cleared → the account remains unchanged.
- EC-3 (Limits): Values exceed defined lengths or changes are spammed → rejected or rate-limited with guidance.
- EC-4 (Permissions): Another field user attempts to update the profile → access is denied.
- EC-5 (Concurrency): Profile is edited from two sessions → stale changes are detected or the resulting saved state is clearly reported.
- EC-6 (Interruption): A change is interrupted → the page reloads with the authoritative saved state.
- EC-7 (Repetition): The same update is resubmitted → no duplicate consent, verification, or notification is created.
- EC-8 (Ordering): A new-email verification arrives after another email change → only the currently pending address can become active.
- EC-9 (State transitions): The account is deactivated while editing → the update is denied and the session ends.
- EC-10 (Scale): Large account directories exist → uniqueness checks remain responsive without revealing other profiles.

## Private Maps and Elements

### US-006: Create and manage owned maps

**As a** field user, **I want** a private workspace of maps I own, **so that** my field data is isolated from other accounts.

Acceptance criteria:

- AC-1: Given a verified active account, when I create a map with valid map details, then it appears in my workspace as private by default.
- AC-2: Given my workspace, when I list, open, rename, or delete my map, then the requested change applies only to my map.
- AC-3: Given another user's private map identifier, when I attempt to open or change it, then access is denied without exposing its contents.
- AC-4: Given no owned maps, when I open the workspace, then I see an empty state with a create action.

Edge cases:

- EC-1 (Invalid input): Invalid coordinates, zoom, or malformed map details → creation or update is rejected.
- EC-2 (Empty / missing): Required map name is blank → no map is created.
- EC-3 (Limits): Name, description, or owned-map count reaches a documented limit → action is blocked with an actionable limit message.
- EC-4 (Permissions): Anonymous, unverified, deactivated, or non-owner actor attempts mutation → denied.
- EC-5 (Concurrency): Rename and delete occur concurrently → deletion wins and no map is recreated by stale update.
- EC-6 (Interruption): Create or delete loses connectivity → status remains pending or unchanged until a confirmed result.
- EC-7 (Repetition): Create or delete request is retried → it does not create duplicates or fail on an already-completed deletion.
- EC-8 (Ordering): A map route opens before workspace loading → access is evaluated before content is displayed.
- EC-9 (State transitions): An unpublished or deleted map receives an edit → deleted maps reject edits; unpublished owned maps remain editable.
- EC-10 (Scale): Workspace contains 100× typical map volume → results remain navigable through search or pagination.

### US-007: Capture and edit geospatial elements

**As a** field user, **I want** to save points, lines, and polygons with descriptive fields and styles, **so that** my survey data persists with its spatial meaning.

Acceptance criteria:

- AC-1: Given my editable map, when I create a valid point, line, or polygon, then it is saved with name, description, category, style, author, and creation/update dates.
- AC-2: Given my existing element, when I edit geometry or metadata, then the map shows the saved version and updated attribution.
- AC-3: Given my existing element, when I delete it and confirm, then it disappears from owned and public views after synchronization.
- AC-4: Given another user's element, when I try to mutate it, then access is denied even if I know its identifier.

Edge cases:

- EC-1 (Invalid input): Invalid, hostile, self-invalidating, or unsupported geometry and metadata → rejected with the invalid part identified.
- EC-2 (Empty / missing): Required geometry or name is absent → element is not saved.
- EC-3 (Limits): Geometry complexity or metadata exceeds documented limits → save is rejected before silent truncation.
- EC-4 (Permissions): Non-owner, anonymous, unverified, or deactivated actor mutates an element → denied.
- EC-5 (Concurrency): Two sessions edit one element → a conflict is surfaced rather than silently overwriting.
- EC-6 (Interruption): Capture is interrupted → a recoverable pending draft remains where possible and no corrupt element appears.
- EC-7 (Repetition): A save or delete is retried → only one resulting element state exists.
- EC-8 (Ordering): Metadata is submitted before valid geometry → save remains unavailable.
- EC-9 (State transitions): The containing map or element is deleted before update → update is rejected and stale local state is reconciled.
- EC-10 (Scale): A map has 100× typical elements → loading and editing remain progressive and the interface communicates progress.

### US-008: Attach photos to elements

**As a** field user, **I want** to attach one or more photos to an element, **so that** its field condition has visual evidence.

Acceptance criteria:

- AC-1: Given an owned element, when I capture or choose supported photos, then previews appear and the photos save with the element.
- AC-2: Given an attached photo, when I remove it and confirm, then it disappears from private and, when applicable, public views.
- AC-3: Given a public map, when an element contains photos, then anonymous visitors may inspect those photos.

Edge cases:

- EC-1 (Invalid input): Unsupported, corrupt, or hostile file → rejected without affecting existing photos.
- EC-2 (Empty / missing): Capture is canceled or returns no file → no empty attachment is created.
- EC-3 (Limits): Photo count or size exceeds documented limits → excess upload is rejected with remaining allowance shown.
- EC-4 (Permissions): Non-owner attempts attachment changes → denied; public visitors receive read-only media.
- EC-5 (Concurrency): A photo is removed while another session updates the element → conflict preserves a resolvable state.
- EC-6 (Interruption): Upload stops midway → partial media is not exposed and retry is offered.
- EC-7 (Repetition): The same upload operation retries → it does not create duplicate attachments.
- EC-8 (Ordering): Photo upload starts before the element exists → it remains pending until a valid element can own it or is canceled.
- EC-9 (State transitions): Element or account is deleted during upload → upload stops and no orphaned public photo remains.
- EC-10 (Scale): Many photos load on one map → thumbnails load progressively and navigation remains usable.

## Offline Work and Synchronization

### US-009: Work on downloaded maps without connectivity

**As a** field user, **I want** to view and edit downloaded owned maps offline, **so that** field work continues without a network.

Acceptance criteria:

- AC-1: Given an owned map prepared on the device, when connectivity is unavailable, then I can open it and inspect its cached elements and photos.
- AC-2: Given an offline owned map, when I create, edit, or delete elements, then each operation is retained as visibly pending.
- AC-3: Given a map not downloaded before disconnection, when I try to open it offline, then the product explains that it is unavailable rather than showing incomplete data.
- AC-4: Given a public anonymous visitor without connectivity, when no public map copy is available, then the product does not imply online content is current.

Edge cases:

- EC-1 (Invalid input): An offline edit creates invalid geometry → it is rejected before entering the sync queue.
- EC-2 (Empty / missing): The device has no prepared maps → a clear offline empty state appears.
- EC-3 (Limits): Local storage cannot fit another map, photo, or edit → the user is warned before data is lost.
- EC-4 (Permissions): Cached data belongs to another signed-out account → it is inaccessible.
- EC-5 (Concurrency): The same account edits one map on two offline devices → both retain work and later enter conflict handling.
- EC-6 (Interruption): The app restarts during capture → confirmed pending operations recover without corruption.
- EC-7 (Repetition): The user repeats an offline action after uncertain feedback → pending operations remain identifiable and deduplicable.
- EC-8 (Ordering): Delete is queued before an earlier unsynced edit → synchronization respects the final intended state.
- EC-9 (State transitions): A cached map was deleted or access revoked remotely → local work is quarantined for review on reconnection.
- EC-10 (Scale): A large downloaded map is opened → progress and storage use are visible and the interface remains responsive.

### US-010: Synchronize changes and resolve conflicts

**As a** field user, **I want** pending work to synchronize and conflicts to preserve both versions, **so that** I do not silently lose field data.

Acceptance criteria:

- AC-1: Given pending valid operations and restored connectivity, when synchronization runs, then progress and success/failure status are visible and accepted changes appear across sessions.
- AC-2: Given local and remote changes to the same item, when synchronization detects a conflict, then both versions are shown with relevant context and neither is silently discarded.
- AC-3: Given a conflict, when I choose the local or remote version, then the selected result becomes authoritative and synchronization completes.
- AC-4: Given a failed operation, when I retry after the cause is resolved, then already accepted operations are not duplicated.

Edge cases:

- EC-1 (Invalid input): A queued operation no longer passes current validation → it is isolated with an explanation while other valid work proceeds.
- EC-2 (Empty / missing): There are no pending operations → sync reports up to date without creating work.
- EC-3 (Limits): Queue or payload is very large → progress is incremental and failures identify the affected items.
- EC-4 (Permissions): Account becomes unverified, deactivated, or loses ownership → protected changes do not synchronize.
- EC-5 (Concurrency): Sync runs simultaneously on multiple devices → duplicate operations collapse and true conflicts remain explicit.
- EC-6 (Interruption): Connectivity or app process stops mid-sync → completed work remains complete and remaining work can resume.
- EC-7 (Repetition): The same batch is replayed → server-visible results occur once.
- EC-8 (Ordering): Dependent operations arrive out of order → prerequisites are applied first or dependents remain pending.
- EC-9 (State transitions): Remote element or map was deleted → local edits are presented as a deletion conflict, not used to recreate silently.
- EC-10 (Scale): 100× typical pending operations synchronize → the user can continue observing progress and individual failures.

### US-011: Log out without silently losing work

**As a** field user, **I want** logout to synchronize and clear private device data safely, **so that** another device user cannot see my maps and I do not lose pending work unknowingly.

Acceptance criteria:

- AC-1: Given no pending changes, when I log out, then my session ends and private cached account data is removed from the device.
- AC-2: Given pending changes and connectivity, when I log out, then synchronization is attempted before clearing and logout reports the result.
- AC-3: Given unsynchronized changes that cannot be sent, when I log out, then the product names the risk and requires explicit confirmation before discarding.
- AC-4: Given logout completion, when another user opens the app, then no prior private map is accessible.

Edge cases:

- EC-1 (Invalid input): Corrupt pending operation exists → logout identifies unsent work and requires the loss decision.
- EC-2 (Empty / missing): No cached account data exists → logout still ends the session successfully.
- EC-3 (Limits): A large queue delays logout → progress and cancel behavior are clear.
- EC-4 (Permissions): Session is already expired → local private data is still cleared safely after pending-work handling.
- EC-5 (Concurrency): Logout occurs while sync is active → one coordinated completion or confirmation flow results.
- EC-6 (Interruption): App closes during logout → next launch does not expose an ambiguous active session and resumes safe cleanup.
- EC-7 (Repetition): Logout is tapped repeatedly → one logout operation occurs.
- EC-8 (Ordering): Clear-data step is requested before sync result → it waits for result or explicit discard confirmation.
- EC-9 (State transitions): Account is deactivated during logout → no new protected sync starts, and unsent work handling remains explicit.
- EC-10 (Scale): Many cached maps exist → cleanup progress is visible and all account-bound private data is removed.

## Publication and Public Access

### US-012: Publish and unpublish an owned map

**As a** field user, **I want** to control whether my map is public, **so that** I can share selected work while keeping all other maps private.

Acceptance criteria:

- AC-1: Given a private owned map, when I confirm publication after seeing what becomes public, then it receives a public route and appears in the gallery.
- AC-2: Given a published owned map, when I unpublish it, then anonymous access and gallery discovery stop immediately.
- AC-3: Given any new map, when no publication action has occurred, then it remains private.
- AC-4: Given another user's map, when I attempt to change visibility, then access is denied.

Edge cases:

- EC-1 (Invalid input): Map lacks valid public-facing details → publication is blocked with required corrections.
- EC-2 (Empty / missing): Map has no elements → publication requires explicit confirmation of the empty public map.
- EC-3 (Limits): Public description or preview exceeds limits → publication does not silently truncate required meaning.
- EC-4 (Permissions): Anonymous, unverified, deactivated, or non-owner actor publishes → denied.
- EC-5 (Concurrency): Publish and unpublish race → one final visibility state is authoritative and displayed.
- EC-6 (Interruption): Connection fails during toggle → interface does not claim a state until confirmed.
- EC-7 (Repetition): Publish or unpublish retries → no duplicate gallery entries or routes are created.
- EC-8 (Ordering): Public link is opened before publication completes → it remains unavailable until state is confirmed.
- EC-9 (State transitions): Map or owner account is deleted or deactivated → public access stops.
- EC-10 (Scale): Many maps are published simultaneously → each appears once and visibility remains owner-specific.

### US-013: Discover published maps

**As an** anonymous visitor, **I want** a searchable public gallery, **so that** I can find maps without creating an account.

Acceptance criteria:

- AC-1: Given published maps, when I open the gallery without login, then I see public summaries and can open them.
- AC-2: Given a search term, when I search, then matching published maps are returned without exposing private maps.
- AC-3: Given no matching maps, when search completes, then I see a useful empty result.

Edge cases:

- EC-1 (Invalid input): Hostile or malformed search text → handled safely and never interpreted as executable content.
- EC-2 (Empty / missing): Empty search → shows the default public listing.
- EC-3 (Limits): Very long search or deep result set → bounded input and navigable pagination apply.
- EC-4 (Permissions): Anonymous visitor requests private entries → none are returned.
- EC-5 (Concurrency): A map is unpublished while results load → opening it rechecks visibility and denies access.
- EC-6 (Interruption): Search loses connectivity → prior results are not presented as newly current and retry is offered.
- EC-7 (Repetition): The same search repeats → stable results do not duplicate entries.
- EC-8 (Ordering): A direct public route is opened before gallery load → route works independently when the map is public.
- EC-9 (State transitions): A moderated, deleted, or owner-deactivated map remains in stale results → opening it is unavailable.
- EC-10 (Scale): Gallery has 100× typical maps → search and pagination remain usable without loading every map at once.

### US-014: Inspect a published map

**As an** anonymous visitor, **I want** to navigate a published map and inspect its elements and photos, **so that** I can understand shared field information.

Acceptance criteria:

- AC-1: Given a valid public route, when I open it without login, then I can navigate the map and inspect read-only element details and photos.
- AC-2: Given a public map, when I attempt edit, export, or geographic-data download, then those actions are unavailable.
- AC-3: Given an unpublished, deleted, or moderated map, when I open its prior route, then content is unavailable.

Edge cases:

- EC-1 (Invalid input): Malformed map or element identifier → safe not-found behavior.
- EC-2 (Empty / missing): Published map has no elements or photos → map still opens with an accurate empty state.
- EC-3 (Limits): Dense geometry or many photos → content loads progressively without disabling navigation.
- EC-4 (Permissions): Anonymous visitor attempts owner or admin actions → denied.
- EC-5 (Concurrency): Owner updates an element while it is viewed → refresh shows a coherent saved version.
- EC-6 (Interruption): Network fails while viewing → unavailable content and retry state are distinguished from map deletion.
- EC-7 (Repetition): Public route or photo is requested repeatedly → no mutation or duplicate activity occurs.
- EC-8 (Ordering): Element deep link opens before map details → visibility is checked before element content appears.
- EC-9 (State transitions): Map becomes private during viewing → subsequent protected data requests stop and the page becomes unavailable.
- EC-10 (Scale): 100× typical elements are present → viewport and progressive loading keep inspection usable.

## Administration

### US-015: Manage account status

**As an** administrator, **I want** to list, activate, and deactivate accounts, **so that** I can operate the service safely.

Acceptance criteria:

- AC-1: Given administrator access, when I search or browse accounts, then I see necessary status and professional profile information.
- AC-2: Given an active account, when I confirm deactivation, then its protected sessions and mutations stop and its public maps become unavailable.
- AC-3: Given a deactivated account, when I activate it, then access returns subject to email-verification state.
- AC-4: Given any status change, then an audit record is created and the affected user is notified.

Edge cases:

- EC-1 (Invalid input): Invalid account identifier or status transition → rejected without affecting another account.
- EC-2 (Empty / missing): Search has no matches → clear empty result.
- EC-3 (Limits): Large account directory → searchable, paginated results remain usable.
- EC-4 (Permissions): Field user or anonymous actor opens admin functions → denied without admin data exposure.
- EC-5 (Concurrency): Two administrators change one status → final state and both attempts are auditable.
- EC-6 (Interruption): Status request loses connection → no success is shown until authoritative state is known.
- EC-7 (Repetition): Same activation or deactivation repeats → state stays correct and repeated attempts remain traceable without duplicate side effects.
- EC-8 (Ordering): Activation occurs before required email verification → protected map editing remains blocked.
- EC-9 (State transitions): Deleted account is activated → rejected; deletion is not reversible.
- EC-10 (Scale): Bulk operational load occurs → individual account isolation and audit completeness remain intact.

### US-016: Moderate public maps

**As an** administrator, **I want** to hide or remove inappropriate public maps, **so that** the public gallery remains trustworthy.

Acceptance criteria:

- AC-1: Given a published map, when I confirm moderation, then it immediately disappears from gallery and anonymous routes.
- AC-2: Given a moderation action, then the reason is recorded, the owner is notified, and the audit entry identifies the administrator.
- AC-3: Given a hidden map, when the owner views it privately, then its moderation status and reason are visible.

Edge cases:

- EC-1 (Invalid input): Missing reason or invalid map target → action is rejected.
- EC-2 (Empty / missing): Map already has no public content → status is still handled consistently without exposing it.
- EC-3 (Limits): Reason exceeds limits → rejected without silent truncation.
- EC-4 (Permissions): Non-admin attempts moderation → denied.
- EC-5 (Concurrency): Owner unpublishes while admin moderates → final private/unavailable state is consistent and admin attempt is audited.
- EC-6 (Interruption): Moderation request is interrupted → public visibility is rechecked before showing outcome.
- EC-7 (Repetition): Same moderation action repeats → map remains unavailable and no contradictory state appears.
- EC-8 (Ordering): Public page is cached before moderation → fresh access rechecks status and withholds content.
- EC-9 (State transitions): Deleted map is moderated → no recreation occurs and attempt receives an already-unavailable result.
- EC-10 (Scale): Many reports or moderation actions exist → administrators can search them and audit remains complete.

### US-017: Intervene in private maps with accountability

**As an** administrator, **I want** to view, edit, or delete a private map for support, **so that** I can resolve serious data problems.

Acceptance criteria:

- AC-1: Given a private map and stated administrative reason, when I access it, then access is allowed and audited.
- AC-2: Given a private map or element, when I confirm an edit or deletion, then the change applies, the before/after context is audited, and the owner is notified.
- AC-3: Given an administrator action, when the owner reviews notification or history, then they can identify the action, time, actor, target, and reason.
- AC-4: Given audit history, no field user or ordinary administrator action can alter or erase prior entries.

Edge cases:

- EC-1 (Invalid input): Missing reason, invalid geometry, or invalid target → intervention is rejected.
- EC-2 (Empty / missing): Target has no elements → access audit still records the private-map view.
- EC-3 (Limits): Large before/after content → audit retains meaningful traceability without unsafe truncation or exposure.
- EC-4 (Permissions): Field user, anonymous actor, or invalid admin session intervenes → denied.
- EC-5 (Concurrency): Owner and administrator edit the same element → conflict is explicit and both attempts remain auditable.
- EC-6 (Interruption): Admin operation is interrupted → authoritative state is shown and partial mutation is not reported as complete.
- EC-7 (Repetition): Destructive request retries → item is deleted once and each privileged attempt remains traceable.
- EC-8 (Ordering): Notification delivery occurs before action confirmation → notification is sent only for confirmed outcomes.
- EC-9 (State transitions): Account or map is deleted before intervention → action does not restore it.
- EC-10 (Scale): Audit volume reaches 100× typical → authorized review remains searchable and complete.

## Privacy and Data Lifecycle

### US-018: Permanently delete an account and its data

**As a** field user, **I want** to permanently delete my account, **so that** I can remove my personal and map data from the product.

Acceptance criteria:

- AC-1: Given an authenticated user, when I request deletion, then the product clearly lists that account, maps, elements, photos, public access, and sessions will be permanently removed.
- AC-2: Given valid confirmation, when deletion completes, then login stops working and all owned public routes and private data become unavailable.
- AC-3: Given unsynchronized local changes, when deletion is requested, then the product warns that those account-bound changes will also be discarded.
- AC-4: Given completed deletion, when the prior email or username is used later, then no previous maps or account state are restored.

Edge cases:

- EC-1 (Invalid input): Incorrect password or malformed confirmation → deletion does not start.
- EC-2 (Empty / missing): Confirmation is absent → no data changes.
- EC-3 (Limits): Account owns many maps, elements, and photos → deletion progress or completion status remains clear and complete.
- EC-4 (Permissions): Another field user attempts deletion → denied; administrator intervention follows its separately audited rules.
- EC-5 (Concurrency): Edit, publish, sync, or admin action races with deletion → deletion prevents new account-bound state and removes confirmed existing state.
- EC-6 (Interruption): Client disconnects after confirmation → returning cannot restore data and can obtain safe completion status where identity still permits.
- EC-7 (Repetition): Deletion request is replayed → it remains complete without recreating or erroring on absent data.
- EC-8 (Ordering): Logout or email change occurs during confirmation → deletion requires a current authenticated confirmation.
- EC-9 (State transitions): Deactivated account seeks self-deletion → a secure recovery or administrator-assisted path is provided without reactivating map access.
- EC-10 (Scale): Very large account deletion runs → public access and sessions stop promptly while complete removal is finalized consistently.
