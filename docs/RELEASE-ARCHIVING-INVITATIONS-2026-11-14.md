# Gig archiving and invitation identity release — 14 November 2026

User accepted both changes and explicitly authorised release after native PostgreSQL rehearsal.

## Released

- `a7670c8`: cancelled future gig archiving with creator/admin permissions, preserved history and task safeguards.
- `dea5a02330b1bd06f0e3bc6372d7d76a6aac0dab`: verified-email invitation acceptance, preserving existing membership roles; native test adapter and rehearsal records.
- Both reviewed migrations applied successfully to the linked Mosaic Supabase project before pushing the UI. Fresh preflights matched the rehearsed definitions exactly. The function owner has the required Auth access and bypasses Auth RLS.
- Pushed main to GitHub; the [Vercel deployment](https://vercel.com/nwarren362s-projects/mosaic-app/9KrxbCf5h5s4oHvZaw3pfK5Lhs2b) reported success for `dea5a02`. Production domain: [Mosaic](https://mosaic-app.vercel.app).

## Verification

- 55 gig-archive assertions pass on native PostgreSQL 17.12; the same checks previously passed in PGlite and focused desktop/mobile browser acceptance.
- 31 invitation assertions pass in native PostgreSQL 17.12 with real pgcrypto/citext, and in PGlite 17.5.
- Final production build, focused script lint and whitespace checks pass. Three existing native-image warnings remain from the earlier full lint run.
- [Live verification](db/audit/archiving-invitation-release-2026-11-14.json): all four function bodies match the reviewed migration source; intended EXECUTE/column/table grants, three gig policies, two lifecycle triggers, archive fields and RESTRICT artist FK verified. All ten gigs remain present and none was archived by the migration.
- Authenticated production browser session: all ten gigs load, cancelled gig detail/activity loads, no warning/error console entries captured. Current session is an agency agent; legacy gigs have no creator, so no archive control is shown to that user. Creator/admin success and failure paths were exercised against synthetic local fixtures.
- Public production login page loads. No real invitation was consumed, no email sent, and no production gig/account/membership changed as a test. Hosted signup/email verification was not newly exercised.
- Temporary native test clusters were shut down and removed; PostgreSQL software remains installed. Screenshot evidence is outside Git at `/private/tmp/mosaic-db-audit/production-release.png`.

Earlier broad audit/TODO/schema notes remain separate outstanding local changes. Membership-management safeguards, remaining relationship constraints, migration baseline and other audit items are not represented as complete by this release.
