# Gig archiving — 14 November 2026

Status: implemented, locally verified and accepted by the user. Supabase migration and deployment are pending explicit release authorisation.

## Agreed behaviour

A current agency member may archive a gig if they created it or hold that agency's admin role. The saved gig must already be cancelled and have a future start time, checked using the database clock. Existing gigs without a recorded creator require an agency admin; no creator is inferred or backfilled.

The user supplies a reason and confirms that cancellation communications and outstanding obligations are resolved. Mosaic has no structured gig settlement or communication ledger, so these are recorded attestations, not automatic financial checks. A known open `gig.cancelled` follow-up task blocks archiving.

Archiving is one database transaction: record the workflow event, close other open gig tasks with actor/reason metadata, preserve existing task notes and metadata, mark the gig archived, and add gig/artist activity. Repeated calls are idempotent. No restoration UI is provided.

Normal gig lists (Gigs, artist, venue and dashboard) exclude archived rows. Direct links and task label lookups retain access to history. The gig detail form and activity controls become read-only. An artist's old Delete gig control now opens the gig detail page, with confirmation before discarding unsaved inline edits.

## Database enforcement

Migration: [20261114_gig_archiving.sql](migrations/20261114_gig_archiving.sql).

- Stamp the authenticated creator on insertion; prevent changes to creator/agency.
- Remove application DELETE privileges/policies. Permit updates only to business fields on active gigs.
- Restrict artist deletion while gigs reference it, including archived history. Existing artist lifecycle counts continue to include archived gigs and choose deactivation.
- Restrict archival fields to the transactional `archive_gig` RPC. Check agency membership, creator/admin, cancellation, time, reason, confirmations and cancellation tasks.
- Lock the parent gig when gig activity changes, preventing new open tasks from racing an archive. Archived activity cannot be changed, moved or removed; existing legacy orphan tasks can still be completed.
- Fail before migration on unexpected policy definitions, missing RLS, changed artist FK or existing archive schema. DDL is transactional.

The activity guard uses SECURITY DEFINER with an empty search path and explicit agency/parent matching so it can see archived rows despite their UPDATE policy. Trigger functions are not callable by application roles. System activity may be appended; the UI offers no composer on archived gigs.

Concurrent archive/task edits can deadlock because both lock gig and task rows. PostgreSQL rolls one transaction back; retry after refreshing. No partial archive is committed.

## Verification

- 55 assertions pass against real PostgreSQL 17 via PGlite: access, cancellation/time/reason/confirmation checks, cancellation task blocker, creator stamping, field protection, legacy ownership, no physical deletion, task closure/history preservation, RPC rollback on late failure, idempotence, archived immutability, artist FK and migration drift/rollback.
- Native PostgreSQL 17.12 + PostgREST 16.5 sample database started successfully, using the audited schema/policies and only synthetic records. UI connected through the actual Supabase client and PostgREST API. The local auth stub does not test Supabase Auth itself.
- Browser: creator archived Gig 301 successfully. The archive reason appeared, form/activity became read-only, original task notes survived, and the remaining open task displayed completed. Gigs navigation no longer offered Gig 301.
- Browser: Gig 305 correctly rejected archival while its cancellation notification task remained open, even with both confirmations checked.
- Remaining browser acceptance completed in the in-app browser after Chrome stopped responding. Gig 305 archived successfully after its cancellation task was completed. The 375px form/result were visually checked without horizontal overflow, and the temporary viewport override was reset.
- Ordinary title edit saved and survived reload. Other agency agent had no archive control for a legacy gig; agency admin had an enabled archive control. Both archived sample gigs were absent from the final normal list.
- The local fixture covers the relevant public schema/API/RLS, with synthetic authentication; it does not verify the hosted Supabase Auth or Storage services.
- Final lint (zero errors), TypeScript, production build and diff whitespace checks pass after the accessibility/navigation changes. Three pre-existing native-image lint warnings remain.

Browser evidence (local, outside Git): `/private/tmp/mosaic-db-audit/gig-archive-browser.png`, `gig-archive-mobile.png`, and `gig-archive-list.png` in the same directory.

## Reproducing tests

Database tests (PGlite is an isolated test dependency, not an app dependency):

```sh
node scripts/db/test-gig-archiving.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
```

The [local browser fixture](../../scripts/db/serve-gig-archive-fixture.mjs) uses installed Homebrew PostgreSQL 17 and PostgREST. It binds the sample API to 127.0.0.1 ports 55480/55481, keeps PostgreSQL on a private Unix socket, and writes local client configuration to the temporary directory printed at startup. It uses synthetic authentication and must never be exposed publicly or used for real data. Start it with Node, then start Next with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from that client configuration (do not edit `.env.local`). Sign in using agent1@example.test (creator), agent4@example.test (other member), or agent5@example.test (admin), with any sample password. Stop with Ctrl-C to remove the disposable cluster; PostgreSQL software remains installed.

## Release requirements

Local browser acceptance is complete and the user has accepted the implementation. Review a fresh live preflight before applying the migration. The migration must precede the matching UI deployment, since list queries require `archived_at`. Do not roll back to a UI that offers physical deletion without considering the new DB restrictions. No push is authorised for this work yet.
