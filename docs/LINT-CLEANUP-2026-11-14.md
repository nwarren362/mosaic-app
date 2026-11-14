# Lint cleanup — 14 November 2026

## Scope

Separate source maintenance task following the dependency update. Resolve the 23 lint errors and unused-code warnings without changing permissions, sending emails, migrating the database, or implementing workflows. No lint rules were disabled. Existing exhaustive-deps exceptions remain where still needed; obsolete directives were removed.

## Changes and review

- Narrow invitation RPC results with runtime checks; narrow caught errors and replace other explicit any types with existing concrete types.
- Use the Lucide icon type for navigation.
- Perform loader state updates in authentication/query result callbacks rather than directly during effect setup. Initial loading states remain; reload loading indicators begin when the authentication result arrives. Data queries and tenant predicates are unchanged. Tasks now resolves authentication before checking active-agency selection.
- Keep current invitation rows until the refresh result arrives; failed refresh clears them. This avoids clearing state directly during effect setup. On a future multi-agency UI, add explicit request cancellation/result ownership as a separate reliability improvement; this cleanup does not claim to solve request races.
- Derive read-only gig venue address from the selected venue; remove its duplicate state/effect.
- Reset branding/tag drafts with guarded render-time adjustment when their saved source changes, avoiding an effect-driven stale render.
- Extract event-time invitation expiry calculation; preserve seven-day expiry.
- Remove unused imports, unused task permission state (not used to authorize anything), and an uncalled banner-save function plus its permanently false busy flag. Active banner save paths remain unchanged.

Reviewed whitespace-insensitive source diffs to check that queries, writes and tenant filters were preserved. This is a cleanup, not a redesign of data loading or authorization.

## Verification

- `npx tsc --noEmit`: passed.
- `npm run build`: passed, all 18 static pages generated.
- `npm run lint`: zero errors; three warnings for existing native img elements in artist list/detail and gig detail. Image optimization is deferred to a separate performance task because changing image delivery requires remote-host/upload-preview and banner-layout acceptance.
- `git diff --check`: passed after whitespace cleanup.
- Authenticated browser checks: artist list/detail and member section loaded; venues loaded; gigs All filter populated and gig detail loaded; dashboard showed agency/counts; invitations showed saved rows; branding initialized stored values; tag entity list/detail loaded.
- Tag name draft edited then restored without saving; the additional Save action appeared and disappeared correctly. No checkbox toggles or tag writes performed.
- Gig venue switched in the unsaved form: address changed from the saved Derby address to Nottingham and back; Save returned to disabled. No gig write performed.
- Invitation acceptance without a token showed the expected Missing token error without consuming an invitation.
- Tasks loaded the same two previously escalated tasks. At 375px, no horizontal overflow; viewport reset afterward. Loading Tasks can invoke existing automatic escalation; no new escalation message was observed.
- Browser retains the previously observed root-HTML hydration diagnostic for extension-injected attributes. No new application runtime error observed in checked flows.

Invitation creation/regeneration, uploads and actual database saves were not executed against the connected live agency. Those paths received type/build checks and source review, rather than test-data writes. Cross-tenant security testing remains part of the database hardening task.

## Acceptance and commit plan

The user accepted the source cleanup and recorded limitations on 14 November 2026. Commit these separately from package/lockfile updates and the earlier audit/backlog consolidation. No push or deployment is authorized. Remaining advisory deferral and image warnings are explicit limitations; the whole hardening sprint is not complete.
