# Core deletion roles — 15 November 2026

Status: prepared and verified locally; pending review/release. No live policy, record or deployment changed.

## Behaviour

Permanent artist deletion is restricted to agency administrators/support, consistent with the existing venue deletion policy. Ordinary agents retain normal editing, deactivation and reactivation. Their lifecycle menus offer Deactivate instead of permanent deletion; inactive artists offer Reactivate without a Delete action.

Administrators retain the existing delete/deactivate workflow. Artist checks count all gigs (including archives) and members. Venue checks now query all associated gigs, including archives hidden from its normal list, before offering deletion. A venue with an archived gig is deactivated, preserving the link and history. Both permanent-delete paths request a returned ID and explain a zero-row result rather than navigating away as if deletion succeeded.

The UI permissions lookup fails closed for permanent deletion. It does not replace database RLS. This is a role-alignment change, not a complete server-side retention/deletion model: existing admin dependency checks remain in the UI, the archived-gig restriction remains in the database, and direct admin deletion/cascades of other related history need a separate retention decision.

## Implementation

- [Migration](migrations/20261115_artist_deletion_roles.sql) verifies the original artist DELETE policy/RLS, changes its predicate to `is_agency_admin(agency_id)` and renames it. Venue policies and table grants remain unchanged. Existing support access is preserved within existing SELECT/RLS visibility.
- [Shared UI lookup](../../src/lib/useAgencyAdministration.ts) scopes the lifecycle choice to the loaded agency.
- Artist/venue detail lifecycle controls use that lookup. No core entity refactoring or general navigation changes were included.

## Verification

- 26 assertions pass in both PGlite 17.5 and native PostgreSQL 17.12 using [test-core-deletion-roles.mjs](../../scripts/db/test-core-deletion-roles.mjs). Tests reproduce the original agent-artist deletion, verify ordinary agent/other-agency/missing-user denial, retain editing/deactivation and admin/support deletion, and check grants/policies, original gig-history FK, migration drift/atomic rollback/reapply.
- Read-only live preflight confirmed the original artist member-delete policy and existing admin-only venue policy. No customer records retrieved; no production writes.
- Browser checks with synthetic native PostgreSQL/PostgREST data: agent deactivated empty artist 204, which remained present/inactive and offered Reactivate without Delete; agent deactivated empty venue 401 and its activity recorded the change. Admin 5 saw the explicit irreversible confirmation for empty artist 203; Cancel retained it. Actual allowed admin DELETE was verified in rollback-only database tests.
- Admin venue 402 showed zero gigs in its normal list but detected its one archived gig and offered deactivation, not deletion. Accepted the reversible deactivation; venue and archived history remained, with Reactivate available.
- At 375px, lifecycle presentation fit without horizontal overflow; override reset. Chrome/native confirmation handling resumed after the user unlocked the Mac. No production page was changed.
- Final full lint: zero errors and three existing native-image warnings. TypeScript, production build and whitespace checks pass. Temporary fixture services/clusters were stopped and removed; installed PostgreSQL remains.

Screenshots outside Git: `/private/tmp/mosaic-db-audit/agent-artist-deactivated-2026-11-15.png`, `archived-venue-preserved-2026-11-15.png`, `lifecycle-mobile-2026-11-15.png`.

## Reproduce/release

```sh
node scripts/db/test-core-deletion-roles.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
node scripts/db/test-core-deletion-roles.mjs --native
node scripts/db/serve-gig-archive-fixture.mjs --core-lifecycle
```

The fuller public-schema browser fixture derives metadata from the audited catalog and uses synthetic data/auth. It is not a hosted Supabase Auth test. Startup failure now stops/removes the disposable cluster. Review before committing; repeat fresh live policy preflight before any authorised migration, then deploy matching UI and repeat agent/admin UAT on Vercel.
