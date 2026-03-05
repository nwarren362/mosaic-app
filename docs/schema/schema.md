# Mosaic App — Database Schema (Public)

Last updated: 2026-03-05  
Source: `information_schema.columns` (public schema)

---

## agencies
Purpose: A tenant (music agency). Used for multi-tenancy and theming.

**Primary key**
- `id` (uuid, not null)

**Columns**
- `id` (uuid, not null)
- `name` (text, not null)
- `created_at` (timestamptz, not null)
- `theme_preset` (text, not null)
- `logo_url` (text, nullable)

---

## agency_invitations
Purpose: Invite users to join an agency with a role. Token-based.

**Primary key**
- `id` (uuid, not null)

**Columns**
- `id` (uuid, not null)
- `agency_id` (uuid, not null)
- `email` (USER-DEFINED, not null) — NOTE: type is user-defined in DB
- `role` (text, not null)
- `token_hash` (bytea, not null)
- `invited_by` (uuid, not null)
- `expires_at` (timestamptz, not null)
- `accepted_at` (timestamptz, nullable)
- `accepted_by` (uuid, nullable)
- `created_at` (timestamptz, not null)

---

## agency_memberships
Purpose: Join table linking users to agencies and roles.

**Primary key**
- (composite) likely `agency_id + user_id` (both not null)

**Columns**
- `agency_id` (uuid, not null)
- `user_id` (uuid, not null)
- `role` (text, not null)
- `created_at` (timestamptz, not null)

---

## profiles
Purpose: Per-user profile information (separate from auth user). Used for display names and permissions.

**Primary key**
- `id` (uuid, not null)

**Columns**
- `id` (uuid, not null)
- `display_name` (text, nullable)
- `is_super_user` (boolean, not null)
- `created_at` (timestamptz, not null)

**Notes**
- There is no `email`, `full_name`, or `user_name` column in `profiles` per current schema.
  - UI should use `display_name` when present, otherwise a neutral fallback.

---

## artists
Purpose: Artists/bands managed by an agency.

**Primary key**
- `id` (uuid, not null)

**Columns**
- `id` (uuid, not null)
- `agency_id` (uuid, not null)
- `name` (text, not null)
- `genre` (text, nullable)
- `contact_email` (text, nullable)
- `notes` (text, nullable)
- `image_url` (text, nullable)
- `status` (text, not null)
- `created_at` (timestamptz, not null)
- `updated_at` (timestamptz, not null)

---

## venues
Purpose: Venues managed by an agency.

**Primary key**
- `id` (uuid, not null)

**Columns**
- `id` (uuid, not null)
- `agency_id` (uuid, not null)
- `name` (text, not null)
- `city` (text, nullable)
- `country` (text, nullable)
- `capacity` (integer, nullable)
- `website` (text, nullable)
- `notes` (text, nullable)
- `created_at` (timestamptz, not null)
- `created_by` (uuid, nullable)
- `updated_by` (uuid, nullable)
- `record_owner_id` (uuid, nullable)
- `updated_at` (timestamptz, not null)

**Notes**
- Address fields and map pin fields (e.g. `address_*`, `postcode`, `lat`, `lng`) do not exist in the current `venues` table.
  - If desired, these should be added via migration before appearing in the UI.

---

## gigs
Purpose: Gigs/shows for artists, optionally linked to a venue record.

**Primary key**
- `id` (uuid, not null)

**Columns**
- `id` (uuid, not null)
- `agency_id` (uuid, not null)
- `artist_id` (uuid, not null)
- `title` (text, not null)
- `venue` (text, nullable) — free-text venue name
- `city` (text, nullable)
- `starts_at` (timestamptz, not null)
- `status` (text, not null)
- `fee_cents` (integer, not null)
- `notes` (text, nullable)
- `venue_id` (uuid, nullable) — optional FK-style link to `venues.id`
- `created_at` (timestamptz, not null)
- `created_by` (uuid, nullable)
- `updated_at` (timestamptz, not null)

---

# Cross-table conventions (observed)

## Multi-tenancy
- Tenant key appears as `agency_id` on: `artists`, `venues`, `gigs`, `agency_memberships`, `agency_invitations`.

## Audit / provenance
- `updated_at` exists and is not null on: `artists`, `venues`, `gigs`.
- `venues` also includes: `created_by`, `updated_by`, `record_owner_id`.

## Display name convention
- `profiles.display_name` is the only available “human name” field in the schema snapshot.

---

# Follow-ups (optional improvements)

- Consider standardising audit fields across core tables:
  - `created_by`, `updated_by` on `artists` and `gigs`
- If venues need geocoding / Google Maps:
  - add `address_line1`, `address_line2`, `postcode`, `region`, `lat`, `lng`, `google_place_id`
- If you want richer user identity:
  - add `full_name` and/or make sure `display_name` is required for members