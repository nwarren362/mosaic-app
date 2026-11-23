# Supabase key transition — prepared 23 November 2026

Status: read-only inventory and application compatibility completed locally. No live keys, signing settings or monitor secrets changed. This plan follows the legacy service-role key appearing in a private browser tool trace; it was not committed or published. Never reproduce any key in reports, shell arguments, screenshots or raw populated-form snapshots.

## Inventory

[Sanitised evidence](audit/key-transition-inventory-2026-11-23.json): legacy pair enabled; modern default publishable/secret keys exist; no Edge Functions, pg_cron or pg_net; no public function contains a literal legacy JWT; configured access-token expiry is 3600 seconds. Four prior migrations are applied; the email-review migration remains local. No pending email requests or delivery-history rows existed at inventory time.

Application changes prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SECRET_KEY`, retaining legacy-variable fallback for staging. The isolated browser fixture passes modern keys and deliberately invalid legacy values. Existing user authentication still uses Supabase Auth, not local verification with the legacy signing secret.

The separate local checkout `/Users/nigel/supabase-project-monitor` already supports modern public keys using only `apikey`. Its GitHub secret is named `MOSAIC_SUPABASE_PUBLISHABLE_KEY`, but the stored value cannot be retrieved from GitHub. Do not assume that name proves its type. Replace/verify that configuration and run the monitor before retiring legacy access; leave WhatsOn configuration unchanged.

## Release sequence

1. Obtain acceptance/release authorisation for the tested application and new review migration. Recheck live history, current key metadata, environment consumers and sender pause flags.
2. Save a dedicated modern secret securely for Mosaic's server and the modern publishable key for its browser in local/Vercel configuration. Include all still-supported preview/development consumers. Preserve the existing encryption key and leave global contact sending false. Deploy the compatible application while legacy access remains available.
3. Update the monitor's Mosaic public-key secret securely and run its read-only live check. Verify production login, authenticated tenant reads, ordinary-agent denial, admin mailbox settings/check and review queue. Existing browser tabs contain old bundled keys and must reload. Retire stale preview deployments or explicitly migrate them.
4. Check key last-used indicators and remaining consumers. Disable the legacy API-key pair only when migrated; verify modern access works and legacy requests fail. This switch affects both anon and service-role API keys. Re-enabling is an operational rollback that also restores exposed-key access, so it requires a deliberate security decision.
5. Follow Supabase's signing-key migration and revocation procedure to remove legacy JWT trust as well. Inspect the actual signing-key state first. With the inventoried one-hour access-token lifetime, Supabase advises at least one hour and fifteen minutes between rotation and legacy-secret revocation to avoid disrupting active users; re-evaluate if expiry/configuration changes. Verify session refresh, login, API/RLS and monitor after each stage. Record rotation/revocation timestamps and sanitised results, never key material.
6. Remove obsolete environment variables and securely retire temporary credential files. Confirm both gateway deactivation and signing-key revocation before marking exposed-key retirement complete. Mailbox-password encryption is independent and must not be changed by this work.

## Sources reviewed

- [Supabase: rotate leaked API keys](https://supabase.com/docs/guides/security/rotate-leaked-api-keys)
- [Migrate to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Signing-key migration, token lifetime and revocation](https://supabase.com/docs/guides/auth/signing-keys)
- [Legacy API-key enable/disable API](https://supabase.com/docs/reference/api/v1-update-project-legacy-api-keys)
