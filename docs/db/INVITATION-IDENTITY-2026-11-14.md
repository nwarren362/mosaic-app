# Invitation identity — 14 November 2026

Status: tested locally and accepted for release by the user. Production application/verification is in progress. No live account, membership or invitation is used as a test fixture.

## Behaviour

Acceptance requires a signed-in account with a non-empty, verified primary email matching the invitation. Compare the current `auth.users.email` and `email_confirmed_at`, not an email from the JWT, profile or browser. Ignore case and leading/trailing whitespace; do not equate aliases, dots or plus addressing.

The token must remain valid, unused and unexpired. Lock the current account and invitation while accepting. Use the actual database clock for expiry after acquiring the invitation lock.

A new member receives the invited role. An existing member keeps their current role; accepting an invitation is not a role-change mechanism. This prevents old invitations from silently promoting or demoting an existing member. Administrators' explicit membership-management permissions remain a separate hardening unit.

Create membership and mark the invitation accepted in one transaction. Failed identity checks or any later failure must neither consume the invitation nor leave a new membership behind. Replay continues to return the existing already-accepted error.

## Implementation

[Migration](migrations/20261114_invitation_identity.sql) replaces only `accept_agency_invitation(text)` and its EXECUTE grants. It uses SECURITY DEFINER, an empty search path and schema-qualified relations/helpers. Anonymous and PUBLIC execution are revoked; authenticated execution is granted. Existing invitation/membership RLS policies are preserved.

A guard refuses deployment if the original function definition or required Auth columns differ. The read-only live preflight confirmed that the function matches the audited baseline, `auth.users` contains the expected ID/email/confirmation fields, and no custom invitation/membership triggers are present. No customer records were retrieved. Private preflight output remains outside Git at `/private/tmp/mosaic-db-audit/invitation-before.json`.

No frontend changes are required for this database-only fix: the existing acceptance page displays RPC error messages. Login/account-switch recovery and admin-page visibility remain separate backlog work.

## Verification

31 PostgreSQL 17 assertions pass using [test-invitation-identity.mjs](../../scripts/db/test-invitation-identity.mjs). Fixtures derive public tables/constraints/policies from the audited catalog and contain only synthetic users and invitations. Tests reproduce the original wrong-account acceptance, then verify:

- Anonymous execution and missing user are denied.
- Wrong, unverified, missing and changed account emails are denied; stale JWT email cannot bypass the check.
- Matching verified emails accept case-insensitively, including edge whitespace.
- Invalid/missing tokens, expired invitations and replay are rejected.
- Existing agents/admins keep their roles; new members receive the invitation role.
- Failed claims and injected late failure preserve atomicity.
- Migration drift, partial DDL failure and reapplication fail safely; existing policies remain unchanged.
- Token hashing matches the standard SHA-256 test vector; anonymous EXECUTE is absent and authenticated EXECUTE remains available.

Native rehearsal completed successfully against Homebrew PostgreSQL 17.12, using the real citext and pgcrypto extensions, with all 31 assertions passing. The same 31 assertions also pass in PGlite 17.5. The native runner uses a disposable cluster, private Unix socket and no TCP listener; it shut down and removed the test cluster on completion. PostgreSQL itself remains installed.

PGlite provides real PostgreSQL RLS and the citext extension. Its test-only `extensions.digest` adapter uses PostgreSQL's built-in `sha256(bytea)` because pgcrypto is unavailable in that runtime; it produces the same SHA-256 bytes for the unchanged production hash helper. This is not an end-to-end hosted Supabase Auth/email-delivery test. No frontend code changed, so no new frontend build or browser run is required for this SQL-only unit.

Run with an isolated PGlite installation:

```sh
node scripts/db/test-invitation-identity.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
node scripts/db/test-invitation-identity.mjs --native
```

Native mode uses [native-postgres-test.mjs](../../scripts/db/native-postgres-test.mjs), defaults to Homebrew PostgreSQL 17, and accepts a `MOSAIC_TEST_PG_BIN` directory override. It requires permission to start a local PostgreSQL server. It never connects to Supabase.

## Release

Native rehearsal and user acceptance/release authorisation are complete. Fresh live preflight matches the rehearsed baseline; the function owner has SELECT/UPDATE on Auth users and bypasses their RLS. Verify function definition/grants and use synthetic identities for acceptance checks. Do not consume real invitations as an operational probe. The user explicitly authorised this release after native rehearsal.

Outstanding: explicit membership-management safeguards (including last-admin protection), admin UI visibility, remaining cross-tenant reference constraints, migration baseline and other audit items remain open.
