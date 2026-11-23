# Runbook (Developer Notes)

This project is intentionally beginner-friendly. These notes capture “how to run” and common fixes.

## Development working method

Work directly in the Git repository. Do not use file exchange or Work with Apps as development mechanisms. [AGENTS.md](../AGENTS.md) contains the concise contributor rules; this runbook holds the practical procedures.

### Scope and repository inspection

1. Use one development task for one coherent unit of work. Define its scope and acceptance criteria before implementation.
2. Inspect `git status --short`, `git diff` and `git diff --cached` before editing. Read the relevant architecture, UI and database guidance.
3. Preserve unrelated local changes. Do not overwrite, revert, stage or commit them as part of the task. If they overlap the intended work, resolve the scope with the user before editing the overlapping changes.
4. Make focused repository edits. Keep behavioural changes and refactoring in separate tasks so each can be reviewed and accepted independently.

### Checks and acceptance

Choose checks proportionate to the change and its risk:

- Documentation-only changes: review accuracy, links and consistency, then run `git diff --check`.
- Code changes: run relevant lint checks (`npm run lint`, or `npx eslint <changed-files>` for focused checks), `npx tsc --noEmit` for TypeScript changes, and `npm run build` where compilation, routing, dependencies or production behaviour may be affected.
- There is currently no configured automated test suite. Run relevant automated tests if one is added; do not treat lint or build success as behavioural acceptance.
- Where behaviour or UI needs browser acceptance, run `npm run dev` and exercise the affected flow against the task's acceptance criteria. Check relevant success and failure paths, and mobile layout for UI changes (including 375px, per the UI system).
- Record checks run, outcomes, browser acceptance results and any blockers. If a required check or acceptance step is blocked, leave the work uncommitted and explain what remains.

### Review, commit and push

1. Review `git status --short`, `git diff` and `git diff --check`. Confirm the changes meet the agreed scope and acceptance criteria.
2. Commit only work that has passed the relevant checks and has been accepted. If user acceptance is required and still pending, leave the changes uncommitted for review.
3. Stage only the intended files or hunks, then review `git diff --cached` before committing. Exclude unrelated changes and secrets such as `.env.local`.
4. Push only when explicitly authorised. Permission to edit or commit does not itself authorise a push.

### Worktrees

Use the current checkout for normal sequential development. Use a separate Git worktree only for parallel work, experiments or risky changes that need isolation. Inspect the current checkout first and keep unrelated local changes in place; a worktree does not replace checks, acceptance or push authorisation.

## Local development
1) Start dev server:
   - `npm run dev`
2) Open:
   - http://localhost:3000/login
   - http://localhost:3000/me

## Database migrations and rehearsals

See [the migration procedure](../supabase/README.md) and [the baseline/privilege review](db/BASELINE-PRIVILEGES-2026-11-19.md). Standard migrations now live under `supabase/migrations`; baseline adoption and the permission migration were applied and verified in production on 19 November 2026. Never replay the baseline CREATE statements over an existing database. Old manual repair scripts are historical evidence, not a second migration sequence to run after the baseline.

Native schema/permission tests create disposable PostgreSQL clusters with private Unix sockets and synthetic data. Managed Supabase services are represented by minimal contracts; those tests do not replace hosted Auth/email/storage integration checks. Starting `npm run dev` alone uses the configured environment, normally the shared hosted database; it does not start or select the isolated sample backend automatically.

## Environment variables
Local file (not committed):
- `.env.local`

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase “Publishable key”)

Vercel:
- Project → Settings → Environment Variables
- Add the same two keys, then redeploy.

## Signup and confirmation readiness — 22 November 2026

The signup/confirmation return flow was accepted and deployed on 22 November 2026 at 286ad03. Exact production/local callback redirects were applied and verified; SMTP remains unconfigured and automatic email confirmation remains unchanged. See `docs/db/audit/auth-redirects-release-2026-11-22.json`. Signup requests an explicit same-origin `/auth/confirm` destination and keeps the no-session instructions visible. Login/confirmation retain a pending agency invitation until successful acceptance. Acceptance shares a single promise per token during development effect replays. Provider failures and missing/unconfirmed sessions explain recovery; raw callback tokens/details are removed from the URL. An expired-link marker remains on reload. Confirmation in a different browser/device instructs the user to reopen the original agency invitation link.

The existing Supabase browser client uses implicit flow. This work does not introduce server cookies, PKCE, password-reset screens, automatic invitation emailing or agency SMTP configuration. The project-level Auth sender is separate from future tenant-scoped agency sender settings.

Local review without real mail or database access:

```sh
node scripts/auth/run-onboarding.mjs
```

Open http://127.0.0.1:55490/fixture and choose Start sample invitation. On the login page choose Sign up; use `new@example.test` with any sample password of at least six characters. The Check your email screen remains visible. Return to the fixture page and choose Simulate valid confirmation, then Continue to invitation. The sample agency should appear. Other cases: `unconfirmed@example.test` at login reports Email not confirmed; `fail@example.test` at signup simulates a provider error; `immediate@example.test` simulates the current automatic-confirmation setting. The fixture's expired-confirmation link must explain the failure, including after reload. This simulator is not proof of actual mailbox ownership or SMTP delivery.

The launcher overrides the public backend URL/key and empties RESEND_API_KEY in the child process; `.env.local` remains unchanged. An empty-message request verified that real sending is blocked before message processing. Stop with Ctrl-C. Plain `npm run dev` still uses its normal environment and must not be assumed to select sample data.

Verification: 28 automated assertions (`node scripts/auth/test-onboarding.mjs`); browser checks covered invitation/signup/no-session persistence, unconfirmed login, valid SDK fragment consumption and URL cleanup, membership acceptance once, expiry persistence despite an existing session, signup errors, immediate-session compatibility and recovery after failed acceptance. At 375px there was no horizontal overflow; viewport restored. TypeScript/production build pass; full lint has zero errors and three existing image warnings. Screenshots are outside Git under `/private/tmp/mosaic-signup-confirmation-2026-11-22.png` and `/private/tmp/mosaic-confirmation-success-2026-11-22.png`.

Release prerequisites, in order:

1. Completed on 22 November: published the tested return route and applied only the reviewed `docs/db/auth-redirects-prepared-2026-11-22.json` settings. Production signup renders and the expired-link page shows recovery guidance. No live signup or email delivery was exercised. The Site URL is the production origin and the allow-list contains exact production/local confirmation paths; neither SMTP nor automatic-confirmation settings changed.
2. User enters the mailbox password directly into Supabase's custom SMTP settings. Candidate: sender and SMTP username `nigel@ontap365.com`, display name `Mosaic (development)`, host `smtp.ionos.co.uk`, port 587 with STARTTLS (465 SSL/TLS is also documented by IONOS). Do not put the password in chat, source files or NEXT_PUBLIC variables. IONOS requires an authorised sender/domain; Harry's address is excluded from development.
3. Obtain explicit authorisation for one controlled delivery test to a chosen unused test account/address. A real Supabase confirmation test must then check delivery, link destination, mailbox confirmation and invitation completion before requiring email confirmation for all new signups. Existing auto-confirmed accounts are not retroactively proof of mailbox ownership.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [browser implicit flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow), [IONOS SMTP](https://www.ionos.co.uk/help/index.php?id=2490).

## Git + Deploy
- A Git commit records changes locally. An explicitly authorised push to a GitHub branch connected to Vercel can trigger an automatic build and deployment.
- If Vercel fails, read the build log and fix TypeScript/build errors locally.

## Common issues

### Port 3000 already in use / lock file error
Symptoms:
- `Port 3000 is in use...`
- `Unable to acquire lock ... .next/dev/lock`

Fix:
1) Kill the process shown in the error, e.g.:
   - `kill <PID>` or `kill -9 <PID>`
2) Clear cache:
   - `rm -rf .next`
3) Restart:
   - `npm run dev`

Find process by port:
- `lsof -ti :3000`

### Vercel builds but fails TypeScript
Vercel runs `npm run build`, which is stricter than local dev.
Fix by:
- correcting types
- removing typos
- if needed temporarily using `as unknown as ...` (short-term)

Longer term:
- generate Supabase types to eliminate guesswork.

### Supabase “permission denied for table …”
This is a GRANT issue.
Fix:
- grant table privileges to `authenticated` and ensure RLS policies exist.

### Invitation token hashing errors (digest)
Fix:
- `create extension if not exists pgcrypto with schema extensions;`
- ensure `invite_token_hash` uses `extensions.digest(convert_to(token,'utf8'), 'sha256'::text)`

## Key URLs (production)
- `/login`
- `/me`
- `/admin/invitations`
- `/accept-invite?token=...`

### Controlled confirmation test passed — 22 November

User configured IONOS SMTP directly in Supabase and explicitly approved enabling Confirm email for a fresh user-controlled test alias. A read-only check confirmed the address was unused; mailer_autoconfirm was set to false, preserving sender and redirect settings. No message was sent by the settings step. The user registered directly on Vercel and supplied screenshots confirming receipt from Mosaic (development) <nigel@ontap365.com> and a successful Email confirmed result at the Vercel /auth/confirm route. Delivery and mailbox confirmation passed; no password or confirmation token was retained. After separate explicit approval, the administrator created an agent invitation for the new confirmed test account in Mosaic Music. The generated link was accepted in the separate recipient session; the administrator list showed an acceptance timestamp. The account displayed only its Mosaic Music agent membership, read ten agency gigs under All and was denied direct administration access. No additional email was sent and no invitation token was retained in repository evidence. The user approved keeping email confirmation enabled for all new registrations after the successful test. Existing automatically confirmed accounts are not retroactively reverified. Existing users retain their login state.

### Localhost restored to shared-data development — 22 November

After onboarding acceptance, the simulator was still running on port 3000 and could misleadingly accept real-looking test credentials without returning real agency data. It has now been stopped (including port 55490), and localhost restarted against `.env.local` pointing to the shared Mosaic Supabase project. No user/application data was deleted or migrated. Existing simulator browser sessions do not authenticate against Supabase; reload and sign in again. Localhost and Vercel then use the same agency records.

The current local development session explicitly empties RESEND_API_KEY, preventing the older contact-email endpoint from sending as the excluded Harry-owned address. This does not disable Supabase Auth's separately configured IONOS emails. `.env.local` itself is unchanged. To reproduce this current normal-data mode:

```sh
RESEND_API_KEY='' npm run dev -- --hostname 127.0.0.1
```

Use the onboarding simulator only when explicitly requested for a focused test, identify it clearly to the user, and restore the normal shared-data environment afterwards. Do not leave simulated authentication running as the default environment for ordinary product testing.

### Contact-email hardening prepared locally — 22 November

The venue contact-email route now uses a separately configured agency IONOS SMTP connection; it does not read Supabase Auth's custom SMTP settings. The successful project-level `nigel@ontap365.com` confirmation sender remains in place and unchanged. No contact sender has been configured or enabled by this work, and no real mail was sent. The agency self-service screen and encrypted credential administration were added locally on 23 November (see below); neither migration nor the new screen has been released. This delivery foundation is not proof of real contact-email delivery.

Prepared migration: `supabase/migrations/20261122000000_contact_email_delivery.sql`. It adds server-private sender configuration and persistent delivery requests, restricts email history writes to server transitions, and preserves authenticated history reads. The application and migration must be released together after acceptance; applying the migration first disables the old browser-side history insert. Do not enable sending until the settings/credential and administrator-review procedures are ready.

Server requirements: `SUPABASE_SERVICE_ROLE_KEY` (never public), a stable 32-byte base64 `EMAIL_CREDENTIAL_ENCRYPTION_KEY` (server-only), `EMAIL_CONNECTION_CHECKS_ENABLED=true` for explicit mailbox login checks, and eventually `CONTACT_EMAIL_SENDING_ENABLED=true` for actual delivery. Passwords are entered by agency admins and encrypted with agency-bound AES-256-GCM before database storage; no per-agency code or environment variable is required. Browser responses return only a saved-password boolean. Initially only `smtp.ionos.co.uk`, port 587 STARTTLS or 465 TLS, and a sender equal to the authenticated mailbox are supported. No sender/default is seeded. Keep actual sending disabled until release acceptance, controlled delivery testing and uncertain-request review are ready.

The route verifies the bearer login, and the server-only preparation function checks actual agency membership and derives the venue/contact/recipient, sender and optional confirmed-user BCC. It rejects arbitrary browser recipients/senders, validates content, and rate-limits new requests to five per actor per minute and 100 per agency per hour, with transaction locks. Sender/contact changes block unsent stale reservations. History writes revoke both table and inherited column-level browser grants.

SMTP has no deduplication guarantee. A persistent send barrier is committed before any SMTP attempt; once started, an attempt without a saved receipt requires review and cannot automatically send again. A receipt is saved in its own transaction; email history, shared activity and completion are then committed atomically. A later status check can recover history from the saved receipt without reconnecting to SMTP. This deliberately favours avoiding duplicate mail over automatic recovery from every failure. An administrator must reconcile uncertain/partially accepted messages against mailbox/provider records before closing a request or authorising any replacement; that review UI/procedure is a release prerequisite. `sent` means accepted by SMTP, not delivered to the recipient's inbox. The legacy `resend_email_id` remains null for SMTP; the SMTP Message-ID is kept on the delivery and activity metadata.

Focused checks: `node scripts/email/test-contact-email.mjs` (71 network-free server assertions), `node scripts/email/test-contact-smtp.mjs` (15 transport-stub assertions), and `node scripts/db/test-contact-email-delivery.mjs` (49 disposable native PostgreSQL assertions). Browser acceptance used `node scripts/email/run-email-ui-fixture.mjs`: a temporary copy on port 3001 with a synthetic backend on 55492, no real credentials and sending disabled; port 3000 was untouched. It covered visible disabled-delivery feedback/draft retention, restored pending requests with immutable contents, and 375px layout without horizontal overflow. Stop the fixture with Ctrl-C; it removes its temporary copy. Proof: `/private/tmp/mosaic-email-recovery-mobile-2026-11-22.png`. Shared database migration, actual contact-email delivery, agency settings, and user acceptance remain pending.


### Agency-admin SMTP settings prepared locally — 23 November

`/admin/email` and the Email settings navigation item are available to agency admins; the screen and server require an actual admin membership for the selected agency. A support flag alone does not grant access to credentials. The selector lists only agencies that the signed-in user administers. Account-confirmation SMTP remains a separate, unchanged Supabase Auth setting.

The admin can save a display name, IONOS mailbox address and TLS port; a blank password preserves the current credential only for the same mailbox. Changing the mailbox requires its password. Any save creates a new configuration revision, pauses sending and clears verification/authorisation. Stale tabs must reload before updating. Saving never connects to SMTP. Check connection authenticates with the saved mailbox without sending mail, pauses sending first and is limited to one attempt per minute per agency (saving cannot bypass the throttle). A failed check leaves sending paused. A successful check does not itself enable sending or prove inbox delivery/sender acceptance. Enable requires a check within the last day and explicit mailbox-use authorisation. Pause remains available even if the encryption key is unavailable. Global delivery remains a separate switch.

The second prepared migration, `supabase/migrations/20261122000100_agency_email_settings.sql`, adds server-only guarded settings operations and a secret-free settings audit. Apply both prepared migrations in order only during the approved coordinated release. The first migration was revised before release to use encrypted passwords and a sender configuration revision instead of the initial environment-backed per-agency password reference. It has not been applied to the shared database in either form. Delivery requests carry a revision, not a credential; a changed/disabled sender blocks unsent stale requests. Browser roles cannot read/write the sender or settings-audit tables or execute the privileged settings functions. Each server-side operation rechecks agency-admin membership; input actor IDs are derived from verified bearer authentication, never from browser-supplied actor fields.

Local credential setup: `node scripts/email/setup-local-credential-key.mjs` creates an encryption key in the ignored `.env.local` file, makes the file private (0600), never displays the key, and retains an existing valid key on subsequent runs. This was run and its idempotency checked on 23 November. The service-role key and connection/delivery enable flags remain unset locally. Do not enter a real mailbox password into the synthetic fixture. After release, the user must enter it directly in Mosaic; it is not copied from Supabase Auth or shared in chat.

Deployment: configure the same stable server-only encryption key wherever the same database credentials are used (local/shared database and Vercel), the Supabase server key, and the connection-check flag using secure provider/environment controls. Do not place keys in public variables, source, screenshots or logs. Preserve the encryption key outside database backups; losing/replacing it without rotation makes existing passwords unreadable and requires each agency to enter its mailbox password again. For a deliberate rotation, pause delivery, use a reviewed server-only migration process with the old/new keys, or have each agency re-enter its credential under the new key, then recheck before enabling. Never simply replace a live key while keeping encrypted credentials. Both mailbox endpoints and TLS validation are fixed to the reviewed IONOS configuration; arbitrary SMTP hosts, file/URL content and plaintext connections are not accepted. Further providers require a separately reviewed integration, not per-agency code.

Verification on 23 November: 84 network-free settings/encryption assertions, 48 native settings-security assertions, 49 native delivery assertions, 71 server-delivery assertions and 19 SMTP adapter assertions (271 total). Browser acceptance used `node scripts/email/run-settings-ui-fixture.mjs`: an isolated temporary application on port 3001 with native PostgreSQL and simulated SMTP checks; normal localhost:3000 was untouched. It covered admin-only agency selection; save and hidden/retained password; success and failure of checks; enabling; automatic pause/reset on edit/failure; stale-tab rejection and reload; ordinary-agent direct-URL denial with no email navigation; and 375px layout with no horizontal overflow. The fixture recorded three simulated checks and zero SMTP sends. Screenshot: `/private/tmp/mosaic-smtp-settings-mobile-2026-11-23.png`. Stop with Ctrl-C to remove the temporary copy/database. No real credential entry, real mailbox check, real contact email, shared migration or Vercel release has occurred. User acceptance and live setup remain pending.

Final checks on 23 November: normal `npm run build` and Webpack production build both pass, including TypeScript; lint has zero errors and the same three existing image warnings. Production dependency audit reports zero advisories. Browser bundle scan found no encryption-key variable, ciphertext column or decryptor identifiers. A sandbox port-denial cached by Turbopack initially blocked compilation; moving the local compiler cache aside (without deleting it) and rebuilding outside the sandbox resolved it. The isolated settings fixture was stopped and its disposable database/copy removed; normal shared-data development remains on port 3000. Work is uncommitted pending user acceptance; nothing was pushed.


### Agency email release — 23 November (current status)

Both email migrations were applied atomically to the shared Supabase database and their exact version/name recorded in migration history. Do not replay them. Verified all three new tables have RLS enabled; browser roles cannot read sender credentials, forge email history, or execute the privileged settings RPCs; server RPC execution is allowed. Existing artist/venue/gig/membership/email counts were unchanged (4/5/12/7/0); no sender or delivery request was seeded. See `docs/db/audit/agency-email-release-2026-11-23.json` for hashes and verification.

The user approved storing production-only Supabase server/encryption credentials in Vercel Secrets. Mailbox connection checks are enabled and actual contact email sending is explicitly false. The same final encryption key is installed in local private configuration; preserve it. Two provisional unused encryption keys appeared in browser tool output and were retired before any mailbox password was stored. The final replacement was saved without exposing it in text output. The existing legacy Supabase service-role key also appeared in this private chat's browser trace; it was not committed to Git or published. A service-key rotation requires a separate reviewed plan because rotating the legacy signing secret may affect existing Auth/API clients. Do not repeat raw accessibility snapshots of populated secret forms: use emit:false and redact field values, or wait until the form has closed before inspecting.

Application release is being verified separately below. No mailbox password, SMTP connection or real email has yet been tested through the agency settings screen. Supabase Auth remains configured for the existing development sender and confirmation remains required.


Application deployed and verified on 23 November at `344928d46019a93ad28cc75053ba12d3517a4158` ([Vercel](https://vercel.com/nwarren362s-projects/mosaic-app/HtnXjLEuYsjnTY7eDZkC8DAZ7EGx)). The live admin session successfully loaded Mosaic Music's settings through the new server endpoint; credential storage and connection checks are ready, and the global delivery switch is false. Public page returns 200; unauthenticated settings and contact-send APIs return 401. The user is being handed the live form with Mosaic (development), nigel@ontap365.com and port 587 prefilled to enter the IONOS password directly, save, and run an explicit no-email connection check. Keep agency sender paused. Password entry, successful real mailbox check and actual contact delivery are not yet verified. Screenshot: `/private/tmp/mosaic-live-smtp-ready-2026-11-23.png`.


Live IONOS connection check passed on 23 November: user entered and saved the mailbox password directly in production, ran Check connection, and enabled the agency sender. The live page verified Saved connection has passed its check. Global contact delivery stayed false; the agent restored agency sending to paused, retaining the successful check and encrypted credential. No email was sent by the connection check; actual delivery has not been tested. The user did not notice the plain-text result, so success feedback prominence is a follow-up UX defect. No mailbox password was read/exported by the agent. Proof: `/private/tmp/mosaic-smtp-connection-passed-2026-11-23.png`.

### Email review and key transition prepared — 23 November

Local follow-up only; not applied to Supabase or deployed. `20261123000000_email_delivery_review.sql` adds private review evidence and terminal `not_sent` requests. Agency admins can cancel a request that never started, complete history from a saved receipt, or record a verified outcome for an uncertain send. Unknown outcomes must stay pending. A saved review never invokes SMTP; it is atomic and safe to retry with its original review ID. Active/recent sends cannot be resolved. A closed request cannot be sent by an old worker or composer; creating a later message requires a new explicit request.

The email settings page focuses and scrolls prominent success/error notices into view beside Check connection and displays the last successful check time. The review queue is restricted to actual administrators of the selected agency, including server-side enforcement; support/super-user status alone grants no mailbox review access. Evidence is retained in a private audit table rather than exposed in general activity.

Verification: 373 automated assertions passed: settings/encryption 84, SMTP adapter 19, contact delivery API 73, review API 54, native delivery 49, native settings 48, native review 46. TypeScript, focused lint and production build pass. The isolated browser fixture exercised unsent cancellation, saved-receipt history recovery, verified non-acceptance, connection success/failure, ordinary-agent denial and narrow layout/focus. It recorded two simulated connection checks and zero SMTP sends. Modern public/server key variables were used with deliberately invalid legacy fallbacks, proving selection without using real keys. Screenshot: `/private/tmp/mosaic-email-feedback-2026-11-23.png`.

Before release: obtain acceptance and explicit push/release authorisation; preflight and apply only the new migration using the migration history procedure; deploy; verify admin/agent access and connection feedback with sending paused. See [key transition plan](db/KEY-TRANSITION-2026-11-23.md) for the separate staged credential retirement. Do not overwrite `EMAIL_CREDENTIAL_ENCRYPTION_KEY`. Actual contact delivery still needs an explicitly approved recipient/message and controlled live acceptance test. The user's edited product-vision Word file is untouched; roadmap review follows hardening.
