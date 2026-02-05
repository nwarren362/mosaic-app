# Database

## Schemas
- `auth` (managed by Supabase): users, sessions, etc.
- `public` (application tables)
- `extensions` (Postgres extensions like pgcrypto)

## Extensions
We use `pgcrypto` for SHA-256 hashing of invitation tokens.

Note: On Supabase, `pgcrypto` is commonly installed in the `extensions` schema, so functions are referenced as:
- `extensions.digest(...)`

## Tables (public)

### `agencies`
Tenant boundary.

Columns:
- `id uuid PK`
- `name text`
- `created_at timestamptz`

RLS:
- Members (or super users) can select their agencies
- Inserts/updates/deletes are currently “super user only” by policy

### `profiles`
1:1 with `auth.users`.

Columns:
- `id uuid PK` references `auth.users(id)`
- `display_name text`
- `is_super_user boolean default false`
- `created_at timestamptz`

Created automatically via trigger on `auth.users`.

### `agency_memberships`
Links users to agencies with per-agency role.

Columns:
- `agency_id uuid FK -> agencies`
- `user_id uuid FK -> auth.users`
- `role text check in ('agent','admin')`
- `created_at timestamptz`
Primary key: `(agency_id, user_id)`

RLS:
- User can select their own memberships
- Agency admins (or super users) can manage memberships for their agency

### `agency_invitations`
Invitation-only onboarding.

Columns:
- `id uuid PK`
- `agency_id uuid FK`
- `email citext`
- `role text check in ('agent','admin')`
- `token_hash bytea unique` (SHA-256 hash of token)
- `invited_by uuid FK -> auth.users`
- `expires_at timestamptz`
- `accepted_at timestamptz null`
- `accepted_by uuid null FK -> auth.users`
- `created_at timestamptz`

Unique index:
- `agency_invitations_unique_pending (agency_id, email) WHERE accepted_at IS NULL`
  Prevents multiple pending invites per email per agency.

RLS:
- Agency admins can select/insert/update/delete invites for their agency
- Users accept invites via RPC (security definer)

## Functions (public)

### `invite_token_hash(p_token text) -> bytea`
Returns SHA-256 digest of the token.
Implementation uses `extensions.digest(convert_to(p_token, 'utf8'), 'sha256'::text)`.

### `accept_agency_invitation(p_token text) -> agency_memberships`
Security-definer function that:
- validates token hash exists
- checks not expired/accepted
- upserts membership
- marks invitation accepted

### `is_super_user()`, `is_agency_member(uuid)`, `is_agency_admin(uuid)`
Used by RLS policies to gate access.

## Triggers
- `handle_new_user`: after insert on `auth.users` inserts into `public.profiles`.

## Grants (important)
RLS is not enough by itself. The `authenticated` role must have privileges on tables/functions.
We granted:
- `select` on agencies/profiles/memberships/invitations
- `insert/update/delete` on memberships/invitations (still gated by RLS)
- `execute` on RPC functions used by the client

## Debugging notes
If you see `permission denied for table ...`:
- It’s a GRANT issue (not RLS). Add `GRANT` for the role.

If you see digest function errors:
- Ensure `pgcrypto` is installed in schema `extensions`
- Ensure code calls `extensions.digest(...)`