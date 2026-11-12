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

## Environment variables
Local file (not committed):
- `.env.local`

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase “Publishable key”)

Vercel:
- Project → Settings → Environment Variables
- Add the same two keys, then redeploy.

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
