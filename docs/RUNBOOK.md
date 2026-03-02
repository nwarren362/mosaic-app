# Runbook (Developer Notes)

This project is intentionally beginner-friendly. These notes capture “how to run” and common fixes.

## Working With ChatGPT

When modifying UI:

- Always send full file contents when requesting edits.
- Files should be explicitly renamed before upload (e.g. venue_id_page.tsx).
- ChatGPT should return full drop-in replacement files.
- No partial regex edits.

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
- Commit to GitHub → Vercel auto-builds and deploys.
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