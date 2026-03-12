# Mosaic App — Database Schema (Public)

Last updated: 2026-03-11  
Source: information_schema.columns (public schema) and verified foreign key constraints

---

# UI Development Convention

This document is the canonical source of truth for all database fields.

When building or updating an application UI page (for example venues/[id], artists/[id], or gigs/[id]):

1. Developers must reference this document.
2. Every column relevant to user input or display should be considered for inclusion in the UI.
3. No UI form should omit database fields unintentionally.

If a field is intentionally excluded from the UI, the reason should be documented in the page code.

---

## agencies
Purpose: A tenant (music agency). Used for multi‑tenancy and theming.

Primary key
- id (uuid, not null)

Columns
- id (uuid, not null)
- name (text, not null)
- created_at (timestamptz, not null)
- theme_preset (text, not null)
- logo_url (text, nullable)

Relationships (verified foreign keys)

- Referenced by artists.agency_id
- Referenced by venues.agency_id
- Referenced by gigs.agency_id
- Referenced by agency_memberships.agency_id
- Referenced by agency_invitations.agency_id

---

## agency_invitations
Purpose: Invite users to join an agency with a role.

Primary key
- id (uuid, not null)

Columns
- id (uuid, not null)
- agency_id (uuid, not null)
- email (user-defined, not null)
- role (text, not null)
- token_hash (bytea, not null)
- invited_by (uuid, not null)
- expires_at (timestamptz, not null)
- accepted_at (timestamptz, nullable)
- accepted_by (uuid, nullable)
- created_at (timestamptz, not null)

Relationships (verified foreign keys)

- agency_invitations.agency_id → agencies.id

Reference columns (not currently FK‑enforced)

- agency_invitations.invited_by → profiles.id (application convention)
- agency_invitations.accepted_by → profiles.id (application convention)

---

## agency_memberships
Purpose: Join table linking users to agencies and roles.

Primary key
- composite (agency_id, user_id)

Columns
- agency_id (uuid, not null)
- user_id (uuid, not null)
- role (text, not null)
- created_at (timestamptz, not null)

Relationships (verified foreign keys)

- agency_memberships.agency_id → agencies.id

Reference columns (not currently FK‑enforced)

- agency_memberships.user_id → profiles.id (application convention)

---

## profiles
Purpose: Per‑user profile information extending Supabase auth users.

Primary key
- id (uuid, not null)

Columns
- id (uuid, not null)
- display_name (text, nullable)
- is_super_user (boolean, not null)
- created_at (timestamptz, not null)

Notes

- display_name is currently the only human‑friendly user name field.
- UI should fall back to a neutral placeholder if display_name is null.

Referenced by (application convention)

- agency_memberships.user_id
- venues.created_by
- venues.updated_by
- venues.record_owner_id
- agency_invitations.invited_by
- agency_invitations.accepted_by
- gigs.created_by

---

## artists
Purpose: Artists or bands managed by an agency.

Primary key
- id (uuid, not null)

Columns
- id (uuid, not null)
- agency_id (uuid, not null)
- name (text, not null)
- genre (text, nullable)
- contact_email (text, nullable)
- notes (text, nullable)
- image_url (text, nullable)
- status (text, not null)
- created_at (timestamptz, not null)
- updated_at (timestamptz, not null)

Relationships (verified foreign keys)

- artists.agency_id → agencies.id

Referenced by

- gigs.artist_id

### UI Fields (Artist Editor)

Editable fields

- name
- genre
- contact_email
- status
- image_url
- notes

System / metadata fields

- created_at
- updated_at

---

## venues
Purpose: Venues managed by an agency.

Primary key
- id (uuid, not null)

Columns
- id (uuid, not null)
- agency_id (uuid, not null)
- name (text, not null)
- city (text, nullable)
- country (text, nullable)
- capacity (integer, nullable)
- website (text, nullable)
- notes (text, nullable)
- created_at (timestamptz, not null)
- created_by (uuid, nullable)
- updated_by (uuid, nullable)
- record_owner_id (uuid, nullable)
- updated_at (timestamptz, not null)
- latitude numeric
- longitude numeric
- google_maps_url text
- google_place_id text

Above 4 fields support routing, mapping and tour planning.

Relationships (verified foreign keys)

- venues.agency_id → agencies.id

Referenced by

- venue_contacts.venue_id
- venue_feedback.venue_id
- venue_activity.venue_id
- gigs.venue_id

Reference columns (not currently FK‑enforced)

- venues.created_by → profiles.id (application convention)
- venues.updated_by → profiles.id (application convention)
- venues.record_owner_id → profiles.id (application convention)

Notes

- Address fields and map coordinates are not currently present in the schema.
- These would need to be added via migration before appearing in the UI.

### UI Fields (Venue Editor)

Editable fields

- name
- city
- country
- capacity
- website
- notes
- record_owner_id

System / metadata fields

- created_at
- created_by
- updated_at
- updated_by

---

## venue_contacts

Purpose: People associated with a venue (bookers, promoters, production, etc.)

Primary key

- id (uuid)

Columns

- id
- agency_id
- venue_id
- name
- role
- email
- phone
- notes
- is_primary
- created_at
- updated_at
- created_by
- updated_by

Relationships (verified foreign keys)

- venue_contacts.agency_id → agencies.id
- venue_contacts.venue_id → venues.id

Reference columns (not FK-enforced)

- venue_contacts.created_by → profiles.id
- venue_contacts.updated_by → profiles.id

---

## venue_feedback

Purpose: Operational knowledge and feedback about venues from gigs or agents.

Primary key

- id (uuid)

Columns

- id
- agency_id
- venue_id
- author_id
- gig_id
- artist_id
- feedback_type
- rating
- content
- created_at
- updated_at

Relationships (verified foreign keys)

- venue_feedback.agency_id → agencies.id
- venue_feedback.venue_id → venues.id
- venue_feedback.gig_id → gigs.id
- venue_feedback.artist_id → artists.id

Reference columns (not FK-enforced)

- venue_feedback.author_id → profiles.id

---

## venue_activity

Purpose: Timeline of actions related to a venue.

Primary key

- id (uuid)

Columns

- id
- agency_id
- venue_id
- actor_id
- activity_type
- summary
- metadata
- created_at

Relationships (verified foreign keys)

- venue_activity.agency_id → agencies.id
- venue_activity.venue_id → venues.id

Reference columns (not FK-enforced)

- venue_activity.actor_id → profiles.id

## gigs
Purpose: Gigs or shows for artists.

Primary key
- id (uuid, not null)

Columns
- id (uuid, not null)
- agency_id (uuid, not null)
- artist_id (uuid, not null)
- title (text, not null)
- venue (text, nullable)
- city (text, nullable)
- starts_at (timestamptz, not null)
- status (text, not null)
- fee_cents (integer, not null)
- notes (text, nullable)
- venue_id (uuid, nullable)
- created_at (timestamptz, not null)
- created_by (uuid, nullable)
- updated_at (timestamptz, not null)

Relationships (verified foreign keys)

- gigs.agency_id → agencies.id
- gigs.artist_id → artists.id
- gigs.venue_id → venues.id

Reference columns (not currently FK‑enforced)

- gigs.created_by → profiles.id (application convention)

### UI Fields (Gig Editor)

Editable fields

- title
- artist_id
- venue_id
- venue
- city
- starts_at
- status
- fee_cents
- notes

System / metadata fields

- created_at
- created_by
- updated_at

---

# Cross‑table conventions

Multi‑tenancy

- agency_id appears on most application tables to enforce tenant isolation.

Audit / provenance

- updated_at exists on artists, venues, and gigs.
- venues also includes created_by, updated_by, and record_owner_id.

Display names

- profiles.display_name is the only human‑readable user identifier.

---

# Entity Relationship Overview

agencies
│
├── artists
│       └── gigs
│
├── venues
│       └── gigs
│
├── agency_memberships
│       └── profiles
│
└── agency_invitations
        └── profiles (via invited_by / accepted_by)

---

# See also

Database behavioural architecture (Auth, RLS, RPCs, triggers, grants):

docs/db/auth-rls-rpcs.md
