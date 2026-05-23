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

## Already delivered
* basic design system
* dark theme alignment
* venues CRM foundations
* gigs linked to venue IDs
* status lozenges / segmented controls / reusable layout primitives
* artist/venue/gig detail page convergence
* activity timeline abstraction


## Backlog
- [ ] Gig cancellation workflow: status change to Cancelled triggers communication and activity logging.
- [ ] Audience/revenue/rating KPIs
- [ ] reusable media hero component
- [ ] markdown/rich text support
- [ ] workflow primitives
- [ ] communications logging
- [ ] Google Maps polish
- [ ] map thumbnail
- [ ] upload pipeline for promo images
- [ ] reusable searchable chips/filter system
- [ ] extract reusable gigs list pattern
- [ ] eliminate remaining hardcoded statuses
- [ ] replace snapshot fields progressively with relational data