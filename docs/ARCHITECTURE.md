# Architecture

## Overview
Mosaic is a multi-tenant SaaS built with:
- **Supabase** (Postgres + Auth + RLS)
- **Next.js** (App Router)
- **Vercel** (hosting + CI/CD)

Tenancy is enforced at the database layer using **Row Level Security (RLS)**.

## Tenancy model
- **Agency** is the primary tenant boundary.
- A user can belong to one or more agencies.
- Role is scoped **per agency**, not global.

Core rule: **All tenant-scoped domain data must reference `agency_id`**.

## Roles
There are three conceptual roles:
- **Agent** (role = `agent` in a membership)
- **Agency Admin** (role = `admin` in a membership)
- **Super User** (internal support/dev flag): `profiles.is_super_user = true`

Super User is implemented as a flag, not a special table. It is allowed to bypass some checks via helper functions.

## Authentication
- Users authenticate via Supabase Auth.
- A `profiles` row is created automatically on signup via trigger (`handle_new_user`).
- The app reads the session client-side and relies on RLS to protect data access.

## Authorization
Authorization is enforced by:
1) **Postgres grants** (`GRANT ... TO authenticated;`)
2) **RLS policies** on tables
3) Helper functions:
   - `is_super_user()`
   - `is_agency_member(agency_id)`
   - `is_agency_admin(agency_id)`

Important: UI checks are for convenience only. **RLS is the security boundary.**

## UI Architecture

Mosaic uses a custom UI system defined in:
- src/components/ui.tsx
- src/app/globals.css
- src/lib/themePresets.ts
- src/app/providers.tsx

All visual components must use UI primitives defined in ui.tsx.
No page should style raw HTML elements directly.

## Key flows

### Bootstrap (first-time setup)
1) Create first Auth user
2) Set `profiles.is_super_user = true` for that user
3) Create first `agencies` row
4) Create first `agency_memberships` row linking user to agency as `admin`

### Invitation-only onboarding
1) Admin creates an invite for an email + role in a specific agency
2) App generates a random token; database stores only `token_hash`
3) User logs in, then calls RPC:
   - `accept_agency_invitation(token)`
4) RPC creates or updates membership and marks invite accepted

Security notes:
- Raw token is **never stored** in DB.
- Duplicate pending invites for same agency+email are prevented by a unique index.

## Client vs Server responsibilities
Current state (early learning phase):
- Most actions are done from client-side Supabase calls with RLS protection.

Later (production hardening):
- Prefer server routes (Next.js route handlers) for sensitive actions like creating invites.
- Keep DB functions for state transitions (accept invite) because they are easy to secure and audit.

## UI strategy
Early stage: functional pages with minimal styling.
Planned: add a small design system and a dark theme aligned to Mosaic Music’s audience (digitally savvy metal musicians).