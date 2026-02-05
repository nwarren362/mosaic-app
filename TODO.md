# TODO / Cleanup Backlog

This is a hobby project. Keep momentum: do 1–2 cleanup tasks per milestone.

## Invitations UX + Admin tooling
- [ ] Add **Delete invite** button to `/admin/invitations` (delete pending invites)
- [ ] Add **Regenerate/Resend invite** button (create a new token + replace invite row)
- [ ] Improve UX: after redirect to `/login`, automatically resume invite acceptance (store token briefly in localStorage)
- [ ] Add UI guard: hide admin pages/links unless user is an agency admin (RLS remains the real security)
- [ ] Add “Invite status” filters (pending/accepted/expired)

## Type safety & DX
- [ ] Generate Supabase TypeScript types (remove `unknown as` casts)
- [ ] Centralize types (e.g. `src/types/`), reduce inline types in pages

## Security & operations
- [ ] Add basic rate limiting for invite creation (later: server route)
- [ ] Add audit logging table (optional, later)
- [ ] Decide whether to keep Nigel as `is_super_user=true` long term or add a safer admin workflow

## UI fundamentals (do after core flows)
- [ ] Add a minimal design system: `Page`, `Card`, `Button`, `Input`
- [ ] Add dark theme defaults aligned to Mosaic Music aesthetic