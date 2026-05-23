# Mosaic App — Database Schema (Public)

Last updated: 2026-04-25  
Source: information_schema.columns + FK + PK exports

---

# UI Development Convention

This document is the canonical source of truth for all database fields.

When building or updating UI pages:

1. Always reference this document
2. Consider every column for inclusion
3. Do not omit fields unintentionally
4. Document any intentional exclusions in code

---

# Core Tables

## agencies
Purpose: Tenant (music agency)

Primary key
- id

Columns
- id (uuid, not null)
- name (text, not null)
- created_at (timestamptz, not null)
- theme_preset (text, not null)
- logo_url (text)

Relationships
- Referenced by artists, venues, gigs, agency_memberships, agency_invitations

---

## profiles
Purpose: User profile (extends auth)

Primary key
- id

Columns
- id (uuid)
- display_name (text)
- is_super_user (boolean)
- created_at (timestamptz)

---

## agency_memberships
Purpose: Users ↔ agencies

Primary key
- (agency_id, user_id)

Columns
- agency_id
- user_id
- role
- created_at

---

## agency_invitations
Purpose: Invite users

Primary key
- id

Columns
- id
- agency_id
- email
- role
- token_hash
- invited_by
- expires_at
- accepted_at
- accepted_by
- created_at

---

# Artists

## artists
Purpose: Artists / bands

Primary key
- id

Columns
- id
- agency_id
- name
- genre
- contact_email
- notes
- image_url
- banner_position_x
- banner_position_y
- banner_zoom
- status
- created_at
- updated_at

Relationships
- artists.agency_id → agencies.id
- Referenced by gigs

---

# Venues

## venues
Purpose: Venues

Primary key
- id

Columns
- - id
- agency_id
- name
- city
- country
- capacity
- website
- notes
- created_at
- created_by
- updated_by
- record_owner_id
- updated_at
- latitude
- longitude
- google_maps_url
- google_place_id
- address_line1 *
- address_line2 *
- region
- postcode *
- status
- display_address

Note: Columns marked * have been retired in favour of the single column "display_address"
* display_address is the primary user-facing address
* city, postcode, country are retired (potentially secondary/search metadata)
* google_maps_url is the preferred canonical location reference
* region is a tag, not a postal field
* /venues cards show city/country only, but search includes display address

Relationships
- venues.agency_id → agencies.id
- Referenced by:
  - venue_contacts
  - venue_feedback
  - venue_activity
  - gigs

---

## venue_contacts
Purpose: Contacts for venues

Primary key
- id

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

Relationships
- venue_contacts.agency_id → agencies.id
- venue_contacts.venue_id → venues.id

---

## venue_feedback
Purpose: Feedback on venues

Primary key
- id

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

Relationships
- venue_feedback.agency_id → agencies.id
- venue_feedback.venue_id → venues.id
- venue_feedback.gig_id → gigs.id
- venue_feedback.artist_id → artists.id

---

## venue_activity
Purpose: Timeline of venue actions

Primary key
- id

Columns
- id
- agency_id
- venue_id
- actor_id
- activity_type
- summary
- metadata
- created_at

Relationships
- venue_activity.agency_id → agencies.id
- venue_activity.venue_id → venues.id

---

# Gigs

## gigs
Purpose: Shows / bookings

Primary key
- id

Columns
- id
- agency_id
- artist_id
- title
- venue
- city
- starts_at
- status
- fee_cents
- notes
- venue_id
- created_at
- created_by
- updated_at

Relationships
- gigs.agency_id → agencies.id
- gigs.artist_id → artists.id
- gigs.venue_id → venues.id

---

# Emerging CRM Layer

## contact_calls
Purpose: Logged calls (new)

Primary key
- id

Columns (inferred from schema)
- id
- agency_id
- actor_id
- (additional fields likely present)

Relationships
- contact_calls.agency_id → agencies.id
- contact_calls.actor_id → profiles.id

---

# Cross-table Conventions

## Multi-tenancy
- agency_id on all domain tables

## Audit
- created_at, updated_at
- created_by, updated_by (where applicable)

## UI identifiers
- profiles.display_name is the only human-readable user name

## Portal access model

External people such as band members and venue contacts are CRM contacts first.

Some may later receive authenticated portal access, but they should not become agency users and should not be added to `agency_memberships`.

Portal access should be scoped narrowly:
- artist members → their artist/band only
- venue contacts → their venue only

---

# Entity Overview

agencies  
├── artists  
│   └── gigs  
│  
├── venues  
│   ├── venue_contacts  
│   ├── venue_feedback  
│   ├── venue_activity  
│   └── gigs  
│  
├── agency_memberships → profiles  
└── agency_invitations → profiles  

---

# Notes / Observations

### 1. Banner system (NEW)
Artists now support:
- zoom
- horizontal focus
- vertical focus

### 2. CRM direction emerging
You now have:
- venue_contacts
- contact_calls
- venue_activity
- venue_feedback

👉 This is effectively a **CRM system forming organically**

### 3. Missing concept (important for next step)
There is currently **NO artist_members table**.

Artist members should be treated as CRM-style contacts attached to an artist/band.

Direction of travel:
- agents can email all band members with gig details
- agents can notify all band members when a gig changes
- agents can request approval from a designated band member for purchases
- agents can request approval from a designated band member for content/artwork/marketing announcements
- most bands should be able to nominate one consistent approver to avoid over-communicating with every member

This is exactly what we need to design next.

---

# Next Schema Step (Recommended)

```sql
create table artist_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  artist_id uuid not null references artists(id),
  profile_id uuid references profiles(id),
  name text not null,
  role text,
  email text,
  phone text,
  notes text,
  is_primary boolean not null default false,
  receives_gig_notifications boolean not null default true,
  is_default_approver boolean not null default false,
  approval_notes text,
  portal_enabled boolean not null default false,
  portal_invited_at timestamptz,
  portal_last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id)
);
```

## Venue Contact Portal Direction

Venue contacts may later receive limited authenticated portal access for venue-specific workflows.

Potential workflows:
- accept / confirm venue bookings
- view upcoming gigs at their venue
- manage venue availability
- support future venue calendar outsourcing / booking-agent services

Future fields likely needed on `venue_contacts`:
- profile_id
- portal_enabled
- portal_invited_at
- portal_last_seen_at
- can_confirm_bookings
- can_manage_availability
- can_view_venue_calendar

## Future Workflow Tables (Likely)

Artist members and venue contacts provide the contact layer. Workflow should be modelled separately.

Likely future workflow tables:
- artist_member_notifications
- artist_approval_requests
- artist_approval_responses
- venue_booking_confirmations
- venue_availability_blocks
- venue_booking_requests
- venue_calendar_shares

Do not overload `artist_members` or `venue_contacts` with every communication, booking, availability, or approval event. Keep contact tables focused on identity, contact details, standing preferences, and portal access flags.