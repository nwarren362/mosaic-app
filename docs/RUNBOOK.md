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

The signup/confirmation return flow is prepared locally, not yet released. Signup requests an explicit same-origin `/auth/confirm` destination and keeps the no-session instructions visible. Login/confirmation retain a pending agency invitation until successful acceptance. Acceptance shares a single promise per token during development effect replays. Provider failures and missing/unconfirmed sessions explain recovery; raw callback tokens/details are removed from the URL. An expired-link marker remains on reload. Confirmation in a different browser/device instructs the user to reopen the original agency invitation link.

The existing Supabase browser client uses implicit flow. This work does not introduce server cookies, PKCE, password-reset screens, automatic invitation emailing or agency SMTP configuration. The project-level Auth sender is separate from future tenant-scoped agency sender settings.

Local review without real mail or database access:

```sh
node scripts/auth/run-onboarding.mjs
```

Open http://127.0.0.1:55490/fixture and choose Start sample invitation. On the login page choose Sign up; use `new@example.test` with any sample password of at least six characters. The Check your email screen remains visible. Return to the fixture page and choose Simulate valid confirmation, then Continue to invitation. The sample agency should appear. Other cases: `unconfirmed@example.test` at login reports Email not confirmed; `fail@example.test` at signup simulates a provider error; `immediate@example.test` simulates the current automatic-confirmation setting. The fixture's expired-confirmation link must explain the failure, including after reload. This simulator is not proof of actual mailbox ownership or SMTP delivery.

The launcher overrides the public backend URL/key and empties RESEND_API_KEY in the child process; `.env.local` remains unchanged. An empty-message request verified that real sending is blocked before message processing. Stop with Ctrl-C. Plain `npm run dev` still uses its normal environment and must not be assumed to select sample data.

Verification: 28 automated assertions (`node scripts/auth/test-onboarding.mjs`); browser checks covered invitation/signup/no-session persistence, unconfirmed login, valid SDK fragment consumption and URL cleanup, membership acceptance once, expiry persistence despite an existing session, signup errors, immediate-session compatibility and recovery after failed acceptance. At 375px there was no horizontal overflow; viewport restored. TypeScript/production build pass; full lint has zero errors and three existing image warnings. Screenshots are outside Git under `/private/tmp/mosaic-signup-confirmation-2026-11-22.png` and `/private/tmp/mosaic-confirmation-success-2026-11-22.png`.

Release prerequisites, in order:

1. Accept/publish the tested app return route. Apply only the reviewed `docs/db/auth-redirects-prepared-2026-11-22.json` settings after release authorisation: production Site URL and exact production/local confirmation destinations. Avoid wildcard production redirects. Neither SMTP nor automatic-confirmation settings are changed by this file.
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
