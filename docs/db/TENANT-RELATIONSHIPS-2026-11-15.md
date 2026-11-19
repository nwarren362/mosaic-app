# Tenant relationship safeguards — phase 1, 15 November 2026

Status: prepared and verified locally; pending review/release. Live database unchanged.

## Product outcome

Prevent a record belonging to one agency from being linked to another agency's artist, venue, tag, contact or gig. Email/call records must also reference a contact at the selected venue, even when both venues belong to the same agency. This is enforced in PostgreSQL, including when the caller belongs to both agencies and both records are visible to them.

## Scope and migration

[Migration](migrations/20261115_tenant_relationships.sql) adds five supporting unique keys and sixteen validated composite foreign keys:

- Gig → artist/venue.
- Artist member → artist; artist tag link → artist/tag.
- Venue contact → venue; venue tag link → venue/tag.
- Contact email/call → venue and the matching contact at that venue.
- Venue feedback → venue/optional artist/optional gig.
- Venue activity → venue.

Existing single-column foreign keys and their original delete actions are retained. Optional gig/feedback references use column-specific SET NULL so the agency ID is never nulled. Existing contact deletion still cascades its email/call history; this phase does not change that retention behaviour. Application gig deletion remains disabled, and archived-gig history protections remain active.

The migration guards the original sixteen FK definitions, uses lock/statement timeouts, and validates all existing rows transactionally. Inconsistent existing rows or partial DDL failure cause rollback without rewriting records. It never guesses ownership or repairs existing data automatically.

Contact-email events have no independent agency ID and already inherit their parent email through a foreign key. Polymorphic activity/workflow entity IDs and user/profile assignment/portal membership rules require separate rules and remain outside this phase. Same-agency feedback/gig/artist business consistency is also distinct from tenant isolation; this migration does not claim to enforce every possible combination.

## Verification

- [Read-only preflight](audit/tenant-relations-preflight-2026-11-15.json): all sixteen live original FK definitions match the rehearsed baseline. Zero inconsistent rows across all ten audited relationship groups, including venue activity. Only schema metadata and aggregate counts were retrieved; no personal/business records exported.
- [Native PostgreSQL 17.12 test](../../scripts/db/test-tenant-relationships.mjs): 44 assertions pass. It reproduces the pre-existing cross-agency insertion, including a caller who belongs to both agencies, then rejects invalid inserts/updates across every new relationship and same-agency wrong-venue contacts.
- Valid same-agency operations continue working. Policies and original FKs remain unchanged. Tests verify rejection/rollback for existing inconsistent data, supporting-key atomicity, source-FK drift, DDL failure and reapplication.
- Tests preserve contact-history cascades, null only optional entity IDs while keeping agency ownership, and retain archived-gig venue protection. Sample data only; no production mutation.
- Full application TypeScript/production build and lint pass alongside the companion core-role unit (zero lint errors; three existing image warnings). No new frontend flow is introduced by this SQL-only unit.

```sh
node scripts/db/test-tenant-relationships.mjs
```

Requires installed native PostgreSQL 17; the shared adapter creates a temporary private-socket cluster with no TCP listener and removes it after testing.

## Review/release

Review the migration and retained deletion semantics. Repeat preflight immediately before any authorised production application. Apply only after the existing gig-archive migration (its artist FK is RESTRICT). The full schema baseline and phased migration history remain separate hardening work; this phase does not mark all of DB-05 complete.
