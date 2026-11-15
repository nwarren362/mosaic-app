# Membership safeguards — 15 November 2026

Status: implemented, locally verified and accepted for a local commit. Not pushed or applied to production.

## Product behaviour

An agency must retain at least one administrator. Appoint another admin before removing or demoting the last one. The rule also applies to super-users and account-deletion cascades; an administrator account cannot be deleted while that would leave an agency without an admin. Memberships cannot be silently reassigned to another user or agency.

Ordinary agents do not see Invitations in desktop/mobile navigation. Direct visits to administration URLs show an access explanation without mounting the administration form. Agency admins can use Invitations, restricted to agencies they themselves administer. Branding and Test tools retain their super-user boundary. Database RLS remains authoritative even if a browser is stale or modified.

Support users retain the existing membership-policy scope. Existing agency SELECT policies do not expose other agencies' names to a super-user without membership; those agencies retain their identifier fallback in the invitation selector, rather than widening database read permissions. A dedicated support workflow/name-display improvement remains separate work.

## Implementation and evidence

- [Migration](migrations/20261115_membership_safeguards.sql): guard existing RLS/policies and reject pre-existing agencies without an admin; preserve policies; permit app updates to role only; add a SECURITY DEFINER trigger with empty search path.
- Before an admin reduction, lock the agency's administrator membership rows in deterministic order and count the remaining admins. Simultaneous changes serialize or roll one transaction back; no admin-less agency can result. Multi-row deletion is transactional. A deliberate whole-agency purge may cascade memberships because its parent no longer exists; other domain history/FKs may independently prevent such a purge.
- Read-only live preflight: no custom membership triggers, expected policies/grants/columns, and zero agencies without an admin. Private metadata output: `/private/tmp/mosaic-db-audit/membership-before-2026-11-15.json`. No identities or customer records retrieved; no production writes.
- Shared administration-access lookup uses the authenticated user's own role, fixing the previous aggregation of other members' roles. Support scope uses existing RLS. The client admin layout checks access before rendering children and rechecks on navigation/focus; failed checks deny access.
- [Regression tests](../../scripts/db/test-membership-safeguards.mjs): 29 assertions in PGlite; 37 in native PostgreSQL 17.12, including simultaneous removals **and demotions** under READ COMMITTED and REPEATABLE READ. Tests cover sole-admin protection, support recovery, ordinary agent/other-agency denial, identity/audit-field protection, bulk atomicity, account cascades, intentional agency cascade and migration drift/rollback/reapply.
- Native fixture/Next browser checks: agent has no invite link or create control and is denied direct access; a mixed-role user (agent in agency 101, admin in agency 102) sees only agency 102 in Invitations and successfully creates a synthetic invitation there; the same agency admin is denied Branding; support user sees existing support navigation and both agency identifiers. At 375px, agent drawer has no invite link and access-denial content fits without horizontal overflow.
- Final full lint: zero errors, three pre-existing native-image warnings. TypeScript and production build pass. The first build stalled in the restricted sandbox; an unsandboxed rerun completed successfully. Diff whitespace check passes. All disposable test services/clusters were stopped and removed.

Reproduce:

```sh
node scripts/db/test-membership-safeguards.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
node scripts/db/test-membership-safeguards.mjs --native
node scripts/db/serve-gig-archive-fixture.mjs --membership
```

The optional browser fixture uses synthetic auth, invitations, roles and records. It never connects to live Supabase. Stop it to remove the disposable cluster; PostgreSQL software remains installed.

## Review/release and remaining work

Review locally before committing/deploying. Repeat live preflight immediately before any authorised migration; deploy the matching UI and check real agent/admin navigation on Vercel. No new membership-management screen is introduced; last-admin enforcement is exercised through database tests.

This unit does not complete DB-06. The broader destructive-action matrix (including agent access to artist deletion), relationship consistency, reliable workflow/email delivery and migration-baseline work remain open. The historical policy snapshot shows member artist deletion and admin/super-user venue deletion; reconcile those deliberately in the next role-policy unit, with UI lifecycle behaviour and linked history considered.
