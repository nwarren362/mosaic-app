# Database baseline and privilege hardening — 19 November 2026

Baseline adopted and permission migration applied and verified in production on 19 November 2026, following explicit user release authorisation. No Auth setting changed. Read-only live schema and allowlisted non-secret Auth settings were refreshed using the existing user-approved CLI login. No customer rows, credentials, bucket files or authentication secrets were exported.

## Baseline and history

[Catalog](audit/catalog-2026-11-19.json), [checksums](audit/baseline-manifest-2026-11-19.json), [standard migrations](../../supabase/README.md).

The schema baseline represents the existing released state, including earlier tenant, invitation, archiving and membership repairs. It rebuilds 21 public tables, their constraints/indexes, the security-invoker task view, 13 app-owned functions, app/Auth triggers, public/Storage policies and effective application grants. Supabase-owned citext/trigram routines come from their extensions rather than being overwritten. Generated column and function/table ownership semantics are retained.

The guarded adoption script compares columns, constraints, indexes, app functions, app/signup triggers, policies, relation ownership/RLS/view options, view definitions and table/column/schema grants before recording version 20261119000000. It refuses existing migration history or mismatched state. It creates only private history objects; no application table or record is recreated. Earlier manual repairs are subsumed by the verified snapshot, not given invented execution timestamps. CLI-managed future migrations use the standard timestamped directory and history table.

Native PostgreSQL rebuild/adoption rehearsal: 270 assertions passed. Includes exact constraint/function/policy and RLS/view fidelity, extension-routine compatibility, effective grants, rejection of baseline replay and unsafe destination default grants, function/signup-trigger drift rejection and private history. Tests use minimal managed Auth/Storage contracts, not a complete hosted Supabase stack. Bucket configuration/files, Auth configuration, platform-owned schemas/extensions beyond required dependencies, collation maintenance and full hosted recovery remain separate operational concerns. This is not a new backup.

## Permission migration

20261119000100_application_privileges removes inherited CREATE on public from PUBLIC/anon/authenticated. It fixes the search paths of seven existing helpers to empty, with fully qualified application/Auth/extension references, removes unnecessary public/anonymous EXECUTE, preserves authenticated helper/hash access and removes application RPC access to trigger-only functions. It checks all 13 app-function definitions and critical RPC grants before changing anything. Public monitoring, guarded archive/invitation RPCs, RLS, table/column privileges, extension routines and existing app roles are retained.

46 local regression assertions passed, covering baseline exposure, denial of object creation, role-specific function access, monitoring, signup/profile creation, successful authenticated RLS, verified invitation acceptance preserving an existing admin role, successful gig archiving, unchanged policies/table grants/membership column protection, definition drift, transaction failure rollback, atomic version recording and reapplication refusal. No real email was sent.

Explicit function EXECUTE/search-path declarations remain required for future migrations: this narrow change does not change global PostgreSQL default privileges or move extensions. Those broader changes could affect platform-owned objects and are not necessary for this repair.

## Auth review — newly confirmed prerequisite

[Allowlisted settings](audit/auth-settings-2026-11-19.json) show signup enabled, email/password enabled, anonymous signup disabled, email auto-confirmation enabled, minimum password length six and breached-password checking disabled. Manual identity linking is disabled. No settings were changed.

Auto-confirmation means email_confirmed_at can be populated without a mailbox challenge. Therefore the released invitation function's verified-email check alone does not establish mailbox ownership under the current Auth configuration; the invitation token is still required. This is an onboarding identity gap to resolve before extending email functionality. The existing email endpoint also needs its separately recorded tenant/contact authorisation fix.

Recommended next coherent task: check the actual invitation/signup flow and email-delivery prerequisites, enable real email confirmation only after a controlled delivery test is explicitly authorised, and agree appropriate password requirements. Determine breached-password protection availability for this project before promising that control. Do not disable signup or change confirmation/SMTP settings blindly: existing onboarding must remain usable. No credentials or provider secrets are needed in chat.

## Release record

Fresh live metadata preflight matched. Adopted the verified baseline without replaying application CREATE statements, then applied the permission migration and recorded its exact version/name atomically through the management API. [Live verification](audit/baseline-privilege-release-2026-11-19.json) confirms both history versions, all 13 app-function grants/search paths, anonymous monitoring access, schema CREATE denial with USAGE preserved, private migration history, unchanged membership column safeguards and 21 validated tenant constraints. Auth changes are a separate reviewed task. Do not repeat baseline adoption or permission application on this database.

Reference: [Supabase deployment and migration history](https://supabase.com/docs/guides/deployment/database-migrations).

Production smoke checks after application: anonymous monitor RPC returned HTTP 200/true; authenticated Gigs All displayed ten records; administration/invitations loaded with the existing authorised support session; no warning/error browser logs captured. No invitation consumed, email sent or application record deliberately modified as a release test.

## Email readiness follow-up — 22 November 2026

Read-only live Auth review: custom SMTP host/port/sender are unset, no SMTP username is configured, email auto-confirmation remains enabled, Site URL is http://localhost:3000 and the redirect allow-list is empty. No settings changed and no emails sent. The earlier source-code Resend endpoint is separate from Auth delivery and still hardcodes the excluded development sender; its local key presence is not evidence of a working or authorised sender.

Public DNS lookup for ontap365.com returned the IONOS UK MX servers and SPF including _spf-eu.ionos.com. This supports assessing the existing nigel@ontap365.com Mail Basic account, without proving SMTP credentials, delivery or a paid-plan entitlement. IONOS documents smtp.ionos.co.uk with SSL/TLS on 465 or STARTTLS on 587, using the full mailbox address and mailbox password. A different-domain From address cannot be assumed to work through this account.

Next prerequisites: configure the selected mailbox password directly in Supabase’s secure SMTP settings (never in chat or Git), review the production/local redirect targets and complete the registration/confirmation return flow before enabling mandatory confirmation. Explicit approval is still required for a controlled message test. Keep agency correspondence sender identity/provider configuration tenant-scoped and editable by its administrator; do not replace one hardcoded agency address with another. Default Auth SMTP is project-wide; agency-branded Auth delivery would require a separate routing design.

Sources: [IONOS Mail Basic SMTP](https://www.ionos.co.uk/help/index.php?id=2490), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
