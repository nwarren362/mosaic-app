# Administration and relationship safeguards release — 19 November 2026

User accepted localhost UAT and explicitly authorised release.

## Released

- 8b5d05b: last-administrator protection and correctly scoped administration access.
- 3a72239 and 14802da: visible/recoverable archive failures and concise cancellation-task explanation, accepted by user UAT.
- 21675b6: agency relationship constraints plus explicit artist relationship selection for Gigs and task labels.
- 0345590: admin-only permanent artist deletion, agent deactivation, and archived-gig-aware venue checks.

Pushed main through 14802daf97af0e4d3b4c2be9a716e1b31f995abd. [Vercel deployment succeeded](https://vercel.com/nwarren362s-projects/mosaic-app/2xcZ3tQP55zsxcsJufYhZu1GxjxY). App queries were deployed before adding the composite foreign keys to avoid an ambiguous-query interval.

## Database

Fresh live preflight confirmed expected membership/delete policies, no agencies without an administrator, and zero mismatches across all ten relationship groups. The CLI failed during linking/connection setup; the existing CLI login was retrieved with user-approved macOS Keychain access and used only in memory against the Supabase management API. No credential was printed or committed.

Applied the three reviewed migrations in one transaction, retaining their drift guards and timeouts:

- 20261115_membership_safeguards.sql
- 20261115_artist_deletion_roles.sql
- 20261115_tenant_relationships.sql

Reloaded PostgREST schema metadata. [Live verification](db/audit/hardening-release-2026-11-19.json) confirms the membership trigger/function, editable role but immutable membership identity, correct artist DELETE policy, and all 16 foreign keys plus five supporting unique keys validated. Eleven gigs exist in the database; ten unarchived gigs are visible in the current agency's production list. No production records were deliberately edited/deleted/archived as acceptance tests.

## Checks and remaining work

Final production build and TypeScript pass; full lint has zero errors and three pre-existing image warnings. Prior native PostgreSQL rehearsals: 37 membership, 26 deletion-role and 44 relationship assertions passed. User localhost UAT passed ordinary-agent access denial, lifecycle deactivation, archived venue preservation, admin agency scoping and cancellation-task archive explanation.

Production browser checks after migration: Gigs All displays ten records; Tasks loads ten tasks, including a known gig label; ordinary agent has no Invitations link and direct access explains that an administrator is required. No browser warning/error logs captured. Existing Unknown labels for a legacy gig remain a separate backlog issue.

Phone acceptance remains to be repeated on Vercel using real hosted accounts, not local sample logins. Band gig click-through and mobile Gigs presentation remain deferred. Migration baseline/privilege review, remaining relationship rules, email authorization/recovery and tooling-advisory review remain outstanding. Local sample services remain available for ongoing localhost testing; they are not production authentication tests.
