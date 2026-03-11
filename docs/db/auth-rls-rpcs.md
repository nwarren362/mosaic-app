# Database Architecture: Auth, RLS, RPCs & Grants (Supabase)

This document describes the behavioural architecture of the Mosaic database:
authentication integration, invitations, agency membership, Row Level Security (RLS),
RPC functions, triggers, and database permissions.

It intentionally does NOT describe table schemas or column lists.

For the canonical list of application tables and fields, see:

docs/schema/schema.md

That document is the single source of truth for database structure.

---

# Overview

Mosaic uses Supabase Postgres with a multi-tenant design.

Each agency represents a tenant.
Users may belong to one or more agencies.

Key concepts:

- Supabase Auth manages users
- profiles extends auth users with application metadata
- agency_memberships defines which users belong to which agencies
- agency_invitations manages onboarding via email invitation
- RLS policies ensure users can only access data belonging to their agencies

---

# Schemas

Supabase uses two important schemas.

## auth schema

Managed by Supabase.

Contains:

- auth.users
- authentication metadata
- password / identity providers

Application code never writes directly to these tables.

---

## public schema

Contains all Mosaic application tables and functions, including:

- agencies
- profiles
- agency_memberships
- agency_invitations
- artists
- venues
- gigs

Full table structure is documented in:

docs/schema/schema.md

---

# Extensions

## pgcrypto

Used for invitation token hashing.

Supabase installs extensions in the extensions schema.

Correct usage:

extensions.digest(...)

Incorrect usage:

public.digest(...)

Using the wrong schema will cause runtime errors.

---

# Agency Invitations

Invitations allow an existing agency member to invite a new user by email.

The process:

1. An agency admin creates an invitation.
2. A token is generated.
3. The token hash is stored in the database.
4. The token is emailed to the invitee.
5. The invitee signs up via Supabase Auth.
6. An RPC validates the token and creates membership.

Important properties:

- Invitations expire
- Tokens are stored hashed, never plaintext
- Each invitation records who invited the user

---

# RPC Functions

Supabase exposes Postgres functions as RPC endpoints.

These are used when application logic must run inside the database
to ensure transactional safety and enforce permissions.

## accept_agency_invitation()

This function:

1. Validates the invitation token
2. Ensures the invitation is not expired
3. Creates the agency_memberships record
4. Marks the invitation as accepted

The function ensures that membership creation is atomic and secure.

---

# Triggers

Triggers are used to automate database behaviour.

Typical uses include:

- Automatically creating a profiles row when a user signs up
- Ensuring membership records exist
- Updating audit fields

Triggers ensure the application cannot accidentally skip important steps.

---

# Row Level Security (RLS)

RLS enforces multi-tenancy at the database level.

Policies ensure that users can only access data belonging to agencies
they are members of.

Typical policy pattern:

EXISTS (
  SELECT 1
  FROM agency_memberships
  WHERE agency_memberships.agency_id = <row.agency_id>
  AND agency_memberships.user_id = auth.uid()
)

This prevents data leakage between agencies.

RLS is applied to core application tables such as:

- artists
- venues
- gigs

---

# Grants & Permissions

Supabase roles include:

- anon
- authenticated
- service_role

Typical pattern:

- anon → limited access
- authenticated → normal application users
- service_role → backend administrative access

Application access is normally granted to authenticated.

---

# Debugging & Operational Notes

## Common issues

### Function cannot find digest()

Use:

extensions.digest(...)

not:

public.digest(...)

### Invitation acceptance fails

Possible causes:

- expired invitation
- token mismatch
- invitation already accepted

### RLS blocking queries

If queries fail unexpectedly:

1. Confirm the user has a valid agency_memberships row
2. Confirm the RLS policy references auth.uid()
3. Verify the agency_id matches the row being accessed

---

# Design Principles

The Mosaic database follows these principles:

1. Multi-tenant by default
2. Security enforced by the database
3. Sensitive operations handled via RPC
4. Tokens stored hashed
5. Application structure documented separately from behaviour

---

# Related Documentation

Database structure (tables & columns):

docs/schema/schema.md

Other architecture documentation:

docs/
