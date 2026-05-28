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

### Platform foundations
* multi-tenant agency architecture
* Supabase auth + RLS tenancy model
* invitation-only onboarding flow
* reusable design system + shared UI primitives
* dark theme alignment + centralized theming
* mobile-friendly responsive layout foundations
* agency-aware application shell/navigation

### Core CRM foundations
* artists, venues, gigs core entities
* relational gigs ↔ artists ↔ venues model
* venue CRM/contact management foundations
* venue feedback capture model
* Google Maps link support for venues
* reusable stats tiles / status badges / layout primitives
* artist / venue / gig detail page convergence

### Activity + workflow foundations
* reusable activity timeline abstraction
* activity logging across artists, venues and gigs
* automatic activity generation for key edits
* task creation directly inside activity timeline
* task lifecycle (open/completed)
* task completion notes
* editable/deletable tasks
* cross-entity `/tasks` dashboard
* overdue / due-date task indicators
* deep-link navigation to activity sections
* reusable task/action menu pattern foundations

### UX / operational improvements
* reusable contacts section
* reusable feedback section
* consistent save/update patterns
* improved activity readability + reduced logging noise
* venue contact activity tracking
* gig activity consolidation logic
* simplified agency-focused application header
* sidebar navigation including Tasks workspace
* task menu abstracted into UI pattern and implemented into artists_id, gigs_id, and venues_id
* Implemented task re-assignment to another user via the /tasks page (under edit task)


## Active backlog

### Workflow + automation
- [ ] workflow primitives engine
- [ ] workflow templates
- [ ] reusable approval/request flows
- [ ] automated reminders/escalations
- [ ] recurring tasks
- [ ] task assignment to users
- [ ] notifications framework
- [ ] event-driven automation architecture

### Communications + CRM
- [ ] communications logging
- [ ] email composition/history inside Mosaic
- [ ] call logging + outcomes
- [ ] contact interaction timeline
- [ ] communication templates
- [ ] outbound email provider integration polish - easy configuration per agency

### Gigs + operations
- [ ] gig cancellation workflow
- [ ] cancellation communications automation
- [ ] load-in / schedule workflow support
- [ ] travel/logistics planning tools
- [ ] settlement/payment tracking
- [ ] recurring gig support

### Tours + operations
- [ ] a tour is a collection of gigs with consequtive performance dates
- [ ] tours require geographic planning, so that they follow a sensible route
- [ ] a tour can involve 1, 2 or more bands touring together, all managed by the same agency
- [ ] tours require approvals, communications, and thorough oversight to ensure smooth running
- [ ] travel planning probably the responsibility or artist(s); but later, consider agent facilitation for fee

### Dashboard + reporting
- [ ] audience/revenue/rating KPIs
- [ ] dashboard real activity feed
- [ ] urgent/open tasks widgets
- [ ] financial reporting foundations
- [ ] agency operational metrics

### UI system + architecture
- [ ] reusable ActionMenu primitive
- [ ] reusable searchable chips/filter system
- [ ] extract reusable gigs list pattern
- [ ] markdown/rich text support
- [ ] reusable media hero component
- [ ] eliminate remaining hardcoded statuses
- [ ] centralize remaining duplicated page patterns

### Media + mapping
- [ ] upload pipeline for promo images
- [ ] image gallery support
- [ ] Google Maps polish
- [ ] map thumbnails/previews
- [ ] geolocation/travel calculations

### Data model evolution
- [ ] replace snapshot fields progressively with relational data
- [ ] typed Supabase schema generation
- [ ] centralized shared types package
- [ ] audit/history retention strategy
- [ ] archival strategy for old activity/task data