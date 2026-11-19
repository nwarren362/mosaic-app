-- Mosaic application baseline. EMPTY destination only; never replay on production.
-- Requires Supabase roles, auth.users/auth.uid(), storage.objects/storage.foldername().
-- Managed platform schemas, Auth settings, bucket records and file bytes are excluded.
begin;set local check_function_bodies=false;
do $$begin if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relkind in ('r','v','m','p','f')) then raise exception 'Baseline requires an empty public application schema';end if;end$$;
do $$begin if exists(select 1 from pg_default_acl where defaclrole in ('postgres'::regrole,current_user::regrole) and defaclnamespace in (0,'public'::regnamespace)) then raise exception 'Destination default privileges require review before baseline restore';end if;end$$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;
alter schema public owner to postgres;revoke all on schema public from public,anon,authenticated,service_role;
grant usage on schema public to "postgres";
grant create on schema public to "postgres";
grant usage on schema public to PUBLIC;
grant create on schema public to PUBLIC;
grant usage on schema public to "authenticated";
create table public."activity_log" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"entity_type" "text" not null,
"entity_id" "uuid" not null,
"activity_type" "text" not null,
"summary" "text" not null,
"notes" "text",
"due_at" "timestamptz",
"completed_at" "timestamptz",
"metadata" "jsonb" default '{}'::jsonb not null,
"created_by" "uuid",
"created_at" "timestamptz" default now() not null,
"assigned_to" "uuid",
"escalated_at" "timestamptz",
"escalation_level" "text",
"escalation_workflow_event_id" "uuid");alter table public."activity_log" owner to "postgres";
create table public."agencies" ("id" "uuid" default gen_random_uuid() not null,
"name" "text" not null,
"created_at" "timestamptz" default now() not null,
"theme_preset" "text" default 'obsidian'::text not null,
"logo_url" "text");alter table public."agencies" owner to "postgres";
create table public."agency_invitations" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"email" "citext" not null,
"role" "text" not null,
"token_hash" "bytea" not null,
"invited_by" "uuid" not null,
"expires_at" "timestamptz" not null,
"accepted_at" "timestamptz",
"accepted_by" "uuid",
"created_at" "timestamptz" default now() not null);alter table public."agency_invitations" owner to "postgres";
create table public."agency_memberships" ("agency_id" "uuid" not null,
"user_id" "uuid" not null,
"role" "text" not null,
"created_at" "timestamptz" default now() not null);alter table public."agency_memberships" owner to "postgres";
create table public."agency_settings" ("agency_id" "uuid" not null,
"overdue_escalation_days" "int4" default 7 not null,
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null);alter table public."agency_settings" owner to "postgres";
create table public."agency_tag_types" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"type" "text" not null,
"label" "text" not null,
"description" "text",
"sort_order" "int4" default 0,
"active" "bool" default true,
"created_at" "timestamptz" default now());alter table public."agency_tag_types" owner to "postgres";
create table public."agency_tags" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"name" "text" not null,
"type" "text" not null,
"sort_order" "int4" default 0,
"active" "bool" default true,
"created_at" "timestamptz" default now());alter table public."agency_tags" owner to "postgres";
create table public."artist_members" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"artist_id" "uuid" not null,
"profile_id" "uuid",
"name" "text" not null,
"role" "text",
"email" "text",
"phone" "text",
"notes" "text",
"is_primary" "bool" default false not null,
"receives_gig_notifications" "bool" default true not null,
"is_default_approver" "bool" default false not null,
"approval_notes" "text",
"portal_enabled" "bool" default false not null,
"portal_invited_at" "timestamptz",
"portal_last_seen_at" "timestamptz",
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null,
"created_by" "uuid",
"updated_by" "uuid");alter table public."artist_members" owner to "postgres";
create table public."artist_tags" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"artist_id" "uuid" not null,
"tag_id" "uuid" not null,
"created_at" "timestamptz" default now());alter table public."artist_tags" owner to "postgres";
create table public."artists" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"name" "text" not null,
"genre" "text",
"contact_email" "text",
"notes" "text",
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null,
"image_url" "text",
"status" "text" default 'active'::text not null,
"banner_position_x" "int4" default 50 not null,
"banner_position_y" "int4" default 50 not null,
"banner_zoom" "int4" default 100 not null,
"home_city" "text",
"home_country" "text",
"n_piece" "int4");alter table public."artists" owner to "postgres";
create table public."contact_calls" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"venue_id" "uuid" not null,
"venue_contact_id" "uuid" not null,
"actor_id" "uuid",
"direction" "text" default 'outbound'::text not null,
"called_at" "timestamptz" default now() not null,
"duration_seconds" "int4",
"outcome" "text",
"notes" "text",
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null);alter table public."contact_calls" owner to "postgres";
create table public."contact_email_events" ("id" "uuid" default gen_random_uuid() not null,
"contact_email_id" "uuid" not null,
"event_type" "text" not null,
"payload_json" "jsonb",
"created_at" "timestamptz" default now() not null);alter table public."contact_email_events" owner to "postgres";
create table public."contact_emails" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"venue_id" "uuid" not null,
"venue_contact_id" "uuid" not null,
"actor_id" "uuid",
"direction" "text" default 'outbound'::text not null,
"subject" "text" not null,
"html_body" "text",
"text_body" "text",
"resend_email_id" "text",
"thread_key" "text",
"status" "text" default 'draft'::text not null,
"sent_at" "timestamptz",
"received_at" "timestamptz",
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null,
"from_name" "text",
"from_email" "text",
"to_email" "text",
"bcc_email" "text");alter table public."contact_emails" owner to "postgres";
create table public."gigs" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"artist_id" "uuid" not null,
"title" "text" not null,
"venue" "text",
"city" "text",
"starts_at" "timestamptz" not null,
"status" "text" default 'confirmed'::text not null,
"fee_cents" "int4" default 0 not null,
"created_at" "timestamptz" default now() not null,
"created_by" "uuid",
"updated_at" "timestamptz" default now() not null,
"notes" "text",
"venue_id" "uuid",
"promo_image_url" "text",
"archived_at" "timestamptz",
"archived_by" "uuid",
"archive_reason" "text");alter table public."gigs" owner to "postgres";
create table public."profiles" ("id" "uuid" not null,
"display_name" "text",
"is_super_user" "bool" default false not null,
"created_at" "timestamptz" default now() not null,
"first_name" "text",
"last_name" "text",
"full_name" "text");alter table public."profiles" owner to "postgres";
create table public."venue_activity" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"venue_id" "uuid" not null,
"actor_id" "uuid",
"activity_type" "text" not null,
"summary" "text",
"metadata" "jsonb",
"created_at" "timestamptz" default now() not null);alter table public."venue_activity" owner to "postgres";
create table public."venue_contacts" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"venue_id" "uuid" not null,
"name" "text" not null,
"role" "text",
"email" "text",
"phone" "text",
"notes" "text",
"is_primary" "bool" default false,
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null,
"created_by" "uuid",
"updated_by" "uuid",
"profile_id" "uuid",
"portal_enabled" "bool" default false not null,
"portal_invited_at" "timestamptz",
"portal_last_seen_at" "timestamptz",
"can_confirm_bookings" "bool" default false not null,
"can_manage_availability" "bool" default false not null,
"can_view_venue_calendar" "bool" default false not null);alter table public."venue_contacts" owner to "postgres";
create table public."venue_feedback" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"venue_id" "uuid" not null,
"author_id" "uuid" not null,
"gig_id" "uuid",
"artist_id" "uuid",
"feedback_type" "text",
"rating" "int4",
"content" "text" not null,
"created_at" "timestamptz" default now() not null,
"updated_at" "timestamptz" default now() not null);alter table public."venue_feedback" owner to "postgres";
create table public."venue_tags" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"venue_id" "uuid" not null,
"tag_id" "uuid" not null,
"created_at" "timestamptz" default now());alter table public."venue_tags" owner to "postgres";
create table public."venues" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"name" "text" not null,
"city" "text",
"country" "text" default 'UK'::text,
"capacity" "int4",
"website" "text",
"notes" "text",
"created_at" "timestamptz" default now() not null,
"created_by" "uuid",
"updated_by" "uuid",
"record_owner_id" "uuid",
"updated_at" "timestamptz" default now() not null,
"latitude" "numeric",
"longitude" "numeric",
"google_maps_url" "text",
"google_place_id" "text",
"address_line1" "text",
"address_line2" "text",
"region" "text",
"postcode" "text",
"status" "text" default 'new'::text not null,
"display_address" "text");alter table public."venues" owner to "postgres";
create table public."workflow_events" ("id" "uuid" default gen_random_uuid() not null,
"agency_id" "uuid" not null,
"event_type" "text" not null,
"entity_type" "text" not null,
"entity_id" "uuid" not null,
"actor_user_id" "uuid",
"occurred_at" "timestamptz" default now() not null,
"metadata" "jsonb" default '{}'::jsonb not null,
"created_at" "timestamptz" default now() not null);alter table public."workflow_events" owner to "postgres";
alter table public."activity_log" add constraint "activity_log_activity_type_check" CHECK (activity_type = ANY (ARRAY['note'::text, 'call'::text, 'email'::text, 'meeting'::text, 'status_change'::text, 'feedback'::text, 'task'::text, 'system'::text]));
alter table public."activity_log" add constraint "activity_log_entity_type_check" CHECK (entity_type = ANY (ARRAY['artist'::text, 'venue'::text, 'gig'::text, 'contact'::text, 'workflow'::text]));
alter table public."activity_log" add constraint "activity_log_pkey" PRIMARY KEY (id);
alter table public."activity_log" add constraint "activity_log_task_assigned_to_required" CHECK (activity_type <> 'task'::text OR assigned_to IS NOT NULL);
alter table public."agencies" add constraint "agencies_pkey" PRIMARY KEY (id);
alter table public."agency_invitations" add constraint "agency_invitations_pkey" PRIMARY KEY (id);
alter table public."agency_invitations" add constraint "agency_invitations_role_check" CHECK (role = ANY (ARRAY['agent'::text, 'admin'::text]));
alter table public."agency_invitations" add constraint "agency_invitations_token_hash_key" UNIQUE (token_hash);
alter table public."agency_memberships" add constraint "agency_memberships_pkey" PRIMARY KEY (agency_id, user_id);
alter table public."agency_memberships" add constraint "agency_memberships_role_check" CHECK (role = ANY (ARRAY['agent'::text, 'admin'::text]));
alter table public."agency_memberships" add constraint "agency_memberships_user_agency_unique" UNIQUE (user_id, agency_id);
alter table public."agency_settings" add constraint "agency_settings_pkey" PRIMARY KEY (agency_id);
alter table public."agency_tag_types" add constraint "agency_tag_types_agency_id_type_key" UNIQUE (agency_id, type);
alter table public."agency_tag_types" add constraint "agency_tag_types_pkey" PRIMARY KEY (id);
alter table public."agency_tags" add constraint "agency_tags_pkey" PRIMARY KEY (id);
alter table public."agency_tags" add constraint "agency_tags_tenant_parent_key" UNIQUE (agency_id, id);
alter table public."artist_members" add constraint "artist_members_pkey" PRIMARY KEY (id);
alter table public."artist_tags" add constraint "artist_tags_artist_id_tag_id_key" UNIQUE (artist_id, tag_id);
alter table public."artist_tags" add constraint "artist_tags_pkey" PRIMARY KEY (id);
alter table public."artists" add constraint "artists_pkey" PRIMARY KEY (id);
alter table public."artists" add constraint "artists_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));
alter table public."artists" add constraint "artists_tenant_parent_key" UNIQUE (agency_id, id);
alter table public."contact_calls" add constraint "contact_calls_pkey" PRIMARY KEY (id);
alter table public."contact_email_events" add constraint "contact_email_events_pkey" PRIMARY KEY (id);
alter table public."contact_emails" add constraint "contact_emails_pkey" PRIMARY KEY (id);
alter table public."gigs" add constraint "gigs_archive_state_check" CHECK (archived_at IS NULL AND archived_by IS NULL AND archive_reason IS NULL OR archived_at IS NOT NULL AND status = 'cancelled'::text AND archive_reason IS NOT NULL AND length(btrim(archive_reason)) >= 3 AND length(btrim(archive_reason)) <= 1000);
alter table public."gigs" add constraint "gigs_pkey" PRIMARY KEY (id);
alter table public."gigs" add constraint "gigs_status_check" CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'pending'::text]));
alter table public."gigs" add constraint "gigs_tenant_parent_key" UNIQUE (agency_id, id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."venue_activity" add constraint "venue_activity_pkey" PRIMARY KEY (id);
alter table public."venue_contacts" add constraint "venue_contacts_pkey" PRIMARY KEY (id);
alter table public."venue_contacts" add constraint "venue_contacts_tenant_parent_key" UNIQUE (agency_id, venue_id, id);
alter table public."venue_feedback" add constraint "venue_feedback_pkey" PRIMARY KEY (id);
alter table public."venue_tags" add constraint "venue_tags_pkey" PRIMARY KEY (id);
alter table public."venue_tags" add constraint "venue_tags_venue_id_tag_id_key" UNIQUE (venue_id, tag_id);
alter table public."venues" add constraint "venues_pkey" PRIMARY KEY (id);
alter table public."venues" add constraint "venues_status_check" CHECK (status = ANY (ARRAY['new'::text, 'approved'::text, 'preferred'::text, 'inactive'::text]));
alter table public."venues" add constraint "venues_tenant_parent_key" UNIQUE (agency_id, id);
alter table public."workflow_events" add constraint "workflow_events_pkey" PRIMARY KEY (id);
alter table public."activity_log" add constraint "activity_log_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."activity_log" add constraint "activity_log_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id);
alter table public."activity_log" add constraint "activity_log_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."activity_log" add constraint "activity_log_escalation_workflow_event_id_fkey" FOREIGN KEY (escalation_workflow_event_id) REFERENCES workflow_events(id);
alter table public."agency_invitations" add constraint "agency_invitations_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."agency_invitations" add constraint "agency_invitations_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."agency_invitations" add constraint "agency_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."agency_memberships" add constraint "agency_memberships_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."agency_memberships" add constraint "agency_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."agency_settings" add constraint "agency_settings_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."agency_tag_types" add constraint "agency_tag_types_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."agency_tags" add constraint "agency_tags_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."artist_members" add constraint "artist_members_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."artist_members" add constraint "artist_members_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."artist_members" add constraint "artist_members_artist_tenant_fkey" FOREIGN KEY (agency_id, artist_id) REFERENCES artists(agency_id, id) ON DELETE CASCADE;
alter table public."artist_members" add constraint "artist_members_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public."artist_members" add constraint "artist_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id);
alter table public."artist_members" add constraint "artist_members_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES profiles(id);
alter table public."artist_tags" add constraint "artist_tags_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."artist_tags" add constraint "artist_tags_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
alter table public."artist_tags" add constraint "artist_tags_artist_tenant_fkey" FOREIGN KEY (agency_id, artist_id) REFERENCES artists(agency_id, id) ON DELETE CASCADE;
alter table public."artist_tags" add constraint "artist_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES agency_tags(id) ON DELETE CASCADE;
alter table public."artist_tags" add constraint "artist_tags_tag_tenant_fkey" FOREIGN KEY (agency_id, tag_id) REFERENCES agency_tags(agency_id, id) ON DELETE CASCADE;
alter table public."artists" add constraint "artists_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."contact_calls" add constraint "contact_calls_actor_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."contact_calls" add constraint "contact_calls_agency_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."contact_calls" add constraint "contact_calls_contact_fkey" FOREIGN KEY (venue_contact_id) REFERENCES venue_contacts(id) ON DELETE CASCADE;
alter table public."contact_calls" add constraint "contact_calls_contact_tenant_fkey" FOREIGN KEY (agency_id, venue_id, venue_contact_id) REFERENCES venue_contacts(agency_id, venue_id, id) ON DELETE CASCADE;
alter table public."contact_calls" add constraint "contact_calls_venue_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public."contact_calls" add constraint "contact_calls_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE CASCADE;
alter table public."contact_email_events" add constraint "contact_email_events_email_fkey" FOREIGN KEY (contact_email_id) REFERENCES contact_emails(id) ON DELETE CASCADE;
alter table public."contact_emails" add constraint "contact_emails_actor_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."contact_emails" add constraint "contact_emails_agency_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."contact_emails" add constraint "contact_emails_contact_fkey" FOREIGN KEY (venue_contact_id) REFERENCES venue_contacts(id) ON DELETE CASCADE;
alter table public."contact_emails" add constraint "contact_emails_contact_tenant_fkey" FOREIGN KEY (agency_id, venue_id, venue_contact_id) REFERENCES venue_contacts(agency_id, venue_id, id) ON DELETE CASCADE;
alter table public."contact_emails" add constraint "contact_emails_venue_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public."contact_emails" add constraint "contact_emails_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE CASCADE;
alter table public."gigs" add constraint "gigs_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."gigs" add constraint "gigs_archived_by_fkey" FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."gigs" add constraint "gigs_artist_id_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE RESTRICT;
alter table public."gigs" add constraint "gigs_artist_tenant_fkey" FOREIGN KEY (agency_id, artist_id) REFERENCES artists(agency_id, id) ON DELETE RESTRICT;
alter table public."gigs" add constraint "gigs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."gigs" add constraint "gigs_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;
alter table public."gigs" add constraint "gigs_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE SET NULL (venue_id);
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."venue_activity" add constraint "venue_activity_actor_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."venue_activity" add constraint "venue_activity_agency_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."venue_activity" add constraint "venue_activity_venue_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public."venue_activity" add constraint "venue_activity_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE CASCADE;
alter table public."venue_contacts" add constraint "venue_contacts_agency_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."venue_contacts" add constraint "venue_contacts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."venue_contacts" add constraint "venue_contacts_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id);
alter table public."venue_contacts" add constraint "venue_contacts_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."venue_contacts" add constraint "venue_contacts_venue_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public."venue_contacts" add constraint "venue_contacts_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE CASCADE;
alter table public."venue_feedback" add constraint "venue_feedback_agency_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."venue_feedback" add constraint "venue_feedback_artist_fkey" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL;
alter table public."venue_feedback" add constraint "venue_feedback_artist_tenant_fkey" FOREIGN KEY (agency_id, artist_id) REFERENCES artists(agency_id, id) ON DELETE SET NULL (artist_id);
alter table public."venue_feedback" add constraint "venue_feedback_author_fkey" FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."venue_feedback" add constraint "venue_feedback_gig_fkey" FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE SET NULL;
alter table public."venue_feedback" add constraint "venue_feedback_gig_tenant_fkey" FOREIGN KEY (agency_id, gig_id) REFERENCES gigs(agency_id, id) ON DELETE SET NULL (gig_id);
alter table public."venue_feedback" add constraint "venue_feedback_venue_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public."venue_feedback" add constraint "venue_feedback_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE CASCADE;
alter table public."venue_tags" add constraint "venue_tags_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."venue_tags" add constraint "venue_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES agency_tags(id) ON DELETE CASCADE;
alter table public."venue_tags" add constraint "venue_tags_tag_tenant_fkey" FOREIGN KEY (agency_id, tag_id) REFERENCES agency_tags(agency_id, id) ON DELETE CASCADE;
alter table public."venue_tags" add constraint "venue_tags_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
alter table public."venue_tags" add constraint "venue_tags_venue_tenant_fkey" FOREIGN KEY (agency_id, venue_id) REFERENCES venues(agency_id, id) ON DELETE CASCADE;
alter table public."venues" add constraint "venues_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
alter table public."venues" add constraint "venues_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."venues" add constraint "venues_record_owner_fkey" FOREIGN KEY (record_owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."venues" add constraint "venues_record_owner_id_fkey" FOREIGN KEY (record_owner_id) REFERENCES auth.users(id);
alter table public."venues" add constraint "venues_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public."workflow_events" add constraint "workflow_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);
alter table public."workflow_events" add constraint "workflow_events_agency_id_fkey" FOREIGN KEY (agency_id) REFERENCES agencies(id);
CREATE INDEX activity_log_agency_entity_idx ON public.activity_log USING btree (agency_id, entity_type, entity_id, created_at DESC);
CREATE INDEX activity_log_due_at_idx ON public.activity_log USING btree (agency_id, due_at) WHERE ((due_at IS NOT NULL) AND (completed_at IS NULL));
CREATE INDEX agency_invitations_agency_id_idx ON public.agency_invitations USING btree (agency_id);
CREATE INDEX agency_invitations_email_idx ON public.agency_invitations USING btree (email);
CREATE UNIQUE INDEX agency_invitations_unique_pending ON public.agency_invitations USING btree (agency_id, email) WHERE (accepted_at IS NULL);
CREATE INDEX agency_memberships_user_id_idx ON public.agency_memberships USING btree (user_id);
CREATE INDEX agency_tags_agency_id_idx ON public.agency_tags USING btree (agency_id);
CREATE INDEX artist_members_agency_id_idx ON public.artist_members USING btree (agency_id);
CREATE INDEX artist_members_artist_id_idx ON public.artist_members USING btree (artist_id);
CREATE INDEX artist_members_profile_id_idx ON public.artist_members USING btree (profile_id);
CREATE INDEX artist_tags_artist_id_idx ON public.artist_tags USING btree (artist_id);
CREATE INDEX artist_tags_tag_id_idx ON public.artist_tags USING btree (tag_id);
CREATE INDEX artists_agency_id_idx ON public.artists USING btree (agency_id);
CREATE INDEX idx_contact_calls_contact ON public.contact_calls USING btree (venue_contact_id);
CREATE INDEX idx_contact_calls_venue ON public.contact_calls USING btree (venue_id);
CREATE INDEX idx_contact_email_events_email ON public.contact_email_events USING btree (contact_email_id);
CREATE INDEX idx_contact_emails_contact ON public.contact_emails USING btree (venue_contact_id);
CREATE INDEX idx_contact_emails_from_email ON public.contact_emails USING btree (from_email);
CREATE INDEX idx_contact_emails_resend_id ON public.contact_emails USING btree (resend_email_id);
CREATE INDEX idx_contact_emails_thread ON public.contact_emails USING btree (thread_key);
CREATE INDEX idx_contact_emails_to_email ON public.contact_emails USING btree (to_email);
CREATE INDEX idx_contact_emails_venue ON public.contact_emails USING btree (venue_id);
CREATE INDEX gigs_agency_id_idx ON public.gigs USING btree (agency_id);
CREATE INDEX gigs_artist_id_idx ON public.gigs USING btree (artist_id);
CREATE INDEX gigs_starts_at_idx ON public.gigs USING btree (starts_at);
CREATE INDEX gigs_venue_id_idx ON public.gigs USING btree (venue_id);
CREATE INDEX idx_venue_activity_created ON public.venue_activity USING btree (created_at DESC);
CREATE INDEX idx_venue_activity_venue ON public.venue_activity USING btree (venue_id);
CREATE INDEX idx_venue_contacts_agency ON public.venue_contacts USING btree (agency_id);
CREATE INDEX idx_venue_contacts_venue ON public.venue_contacts USING btree (venue_id);
CREATE INDEX venue_contacts_profile_id_idx ON public.venue_contacts USING btree (profile_id);
CREATE INDEX idx_venue_feedback_agency ON public.venue_feedback USING btree (agency_id);
CREATE INDEX idx_venue_feedback_venue ON public.venue_feedback USING btree (venue_id);
CREATE INDEX venue_tags_tag_id_idx ON public.venue_tags USING btree (tag_id);
CREATE INDEX venue_tags_venue_id_idx ON public.venue_tags USING btree (venue_id);
CREATE INDEX idx_venues_lat_lon ON public.venues USING btree (latitude, longitude);
CREATE INDEX venues_agency_id_idx ON public.venues USING btree (agency_id);
CREATE INDEX venues_display_address_trgm_idx ON public.venues USING gin (display_address gin_trgm_ops);
CREATE INDEX venues_name_idx ON public.venues USING btree (name);
CREATE INDEX venues_name_trgm_idx ON public.venues USING gin (name gin_trgm_ops);
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(p_token text)
 RETURNS agency_memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_inv public.agency_invitations%rowtype;
  v_membership public.agency_memberships%rowtype;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='Sign in to accept an invitation';
  end if;
  -- Read the authoritative current account, not a potentially stale JWT email.
  select email,email_confirmed_at into v_email,v_confirmed_at
    from auth.users where id=v_actor for share;
  if not found or v_confirmed_at is null or nullif(btrim(v_email),'') is null then
    raise exception using errcode='42501',message='Verify your account email before accepting an invitation';
  end if;
  select * into v_inv from public.agency_invitations
    where token_hash=public.invite_token_hash(p_token) for update;
  if not found then raise exception 'Invalid invitation token'; end if;
  if v_inv.accepted_at is not null then raise exception 'Invitation already accepted'; end if;
  if v_inv.expires_at<=clock_timestamp() then raise exception 'Invitation has expired'; end if;
  if lower(btrim(v_email)) is distinct from lower(btrim(v_inv.email::text)) then
    raise exception using errcode='42501',message='This invitation is for a different email address. Sign in with the invited account';
  end if;

  insert into public.agency_memberships(agency_id,user_id,role)
    values(v_inv.agency_id,v_actor,v_inv.role)
    on conflict(agency_id,user_id) do nothing
    returning * into v_membership;
  if not found then
    select * into v_membership from public.agency_memberships
      where agency_id=v_inv.agency_id and user_id=v_actor for update;
    if not found then raise exception 'Membership changed concurrently; please try again'; end if;
  end if;

  update public.agency_invitations set accepted_at=clock_timestamp(),accepted_by=v_actor where id=v_inv.id;
  return v_membership;
end;
$function$
;
alter function public."accept_agency_invitation"(p_token text) owner to "postgres";
revoke all on function public."accept_agency_invitation"(p_token text) from public,anon,authenticated,service_role;
grant execute on function public."accept_agency_invitation"(p_token text) to "postgres";
grant execute on function public."accept_agency_invitation"(p_token text) to "authenticated";
CREATE OR REPLACE FUNCTION public.archive_gig(p_gig_id uuid, p_agency_id uuid, p_reason text, p_communications_complete boolean, p_obligations_settled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_gig public.gigs%rowtype;
 v_actor uuid:=auth.uid();
 v_now timestamptz;
 v_event uuid;
 v_closed integer;
begin
 if v_actor is null or not public.is_agency_member(p_agency_id) then
   raise exception using errcode='42501',message='You must belong to this agency to archive a gig';
 end if;
 select * into v_gig from public.gigs where id=p_gig_id and agency_id=p_agency_id for update;
 if not found then raise exception 'Gig not found'; end if;
 if v_gig.created_by is distinct from v_actor and not exists(
   select 1 from public.agency_memberships where agency_id=p_agency_id and user_id=v_actor and role='admin'
 ) then raise exception using errcode='42501',message='Only the creating agent or an agency admin can archive this gig'; end if;
 if v_gig.archived_at is not null then
   return jsonb_build_object('id',v_gig.id,'archived_at',v_gig.archived_at,'closed_tasks',0,'already_archived',true);
 end if;
 v_now:=clock_timestamp();
 if v_gig.status<>'cancelled' then raise exception 'Cancel and save the gig before archiving it'; end if;
 if v_gig.starts_at<=v_now then raise exception 'Only gigs with a future start time can be archived'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then
   raise exception 'Give an archive reason between 3 and 1000 characters';
 end if;
 if p_communications_complete is distinct from true or p_obligations_settled is distinct from true then
   raise exception 'Confirm cancellation communications and outstanding obligations are resolved';
 end if;
 if exists(select 1 from public.activity_log where agency_id=p_agency_id and entity_type='gig'
   and entity_id=p_gig_id and activity_type='task' and completed_at is null
   and metadata->>'event_type'='gig.cancelled') then
   raise exception 'Complete the cancellation communications follow-up task before archiving';
 end if;
 insert into public.workflow_events(agency_id,event_type,entity_type,entity_id,actor_user_id,occurred_at,metadata)
 values(p_agency_id,'gig.archived','gig',p_gig_id,v_actor,v_now,jsonb_build_object(
   'reason',btrim(p_reason),'communications_complete',true,'obligations_settled',true)) returning id into v_event;
 update public.activity_log set completed_at=v_now,metadata=metadata||jsonb_build_object(
   'closed_reason','gig_archived','closed_by',v_actor,'archive_reason',btrim(p_reason),'archive_workflow_event_id',v_event)
 where agency_id=p_agency_id and entity_type='gig' and entity_id=p_gig_id and activity_type='task' and completed_at is null;
 get diagnostics v_closed=row_count;
 update public.gigs set archived_at=v_now,archived_by=v_actor,archive_reason=btrim(p_reason),updated_at=v_now where id=p_gig_id;
 insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary,created_by,metadata)
 values(p_agency_id,'gig',p_gig_id,'system','Gig archived: '||btrim(p_reason),v_actor,jsonb_build_object(
   'event_type','gig.archived','workflow_event_id',v_event,'occurred_at',v_now,'closed_tasks',v_closed,
   'communications_complete',true,'obligations_settled',true));
 if exists(select 1 from public.artists where id=v_gig.artist_id and agency_id=p_agency_id) then
   insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary,created_by,metadata)
   values(p_agency_id,'artist',v_gig.artist_id,'system','Gig archived: '||v_gig.title,v_actor,
     jsonb_build_object('event_type','gig.archived','gig_id',p_gig_id,'reason',btrim(p_reason),'workflow_event_id',v_event));
 end if;
 return jsonb_build_object('id',p_gig_id,'archived_at',v_now,'closed_tasks',v_closed,'already_archived',false);
end;
$function$
;
alter function public."archive_gig"(p_gig_id uuid, p_agency_id uuid, p_reason text, p_communications_complete boolean, p_obligations_settled boolean) owner to "postgres";
revoke all on function public."archive_gig"(p_gig_id uuid, p_agency_id uuid, p_reason text, p_communications_complete boolean, p_obligations_settled boolean) from public,anon,authenticated,service_role;
grant execute on function public."archive_gig"(p_gig_id uuid, p_agency_id uuid, p_reason text, p_communications_complete boolean, p_obligations_settled boolean) to "postgres";
grant execute on function public."archive_gig"(p_gig_id uuid, p_agency_id uuid, p_reason text, p_communications_complete boolean, p_obligations_settled boolean) to "authenticated";
CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select auth.uid();
$function$
;
alter function public."current_user_id"() owner to "postgres";
CREATE OR REPLACE FUNCTION public.guard_agency_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_op='UPDATE' then
   if new.agency_id is distinct from old.agency_id or new.user_id is distinct from old.user_id then
     raise exception 'Membership agency and user cannot be changed; remove and create memberships explicitly';
   end if;
 end if;
 if old.role='admin' and (tg_op='DELETE' or new.role is distinct from 'admin') then
   -- A deliberate agency deletion cascades its memberships; no orphan agency remains.
   if not exists(select 1 from public.agencies where id=old.agency_id) then
     if tg_op='DELETE' then return old; end if;
   end if;
   -- Lock every administrator, including the old row. Concurrent removals either
   -- serialize or roll one transaction back (deadlock/serialization failure).
   -- Locking admin rows also protects REPEATABLE READ from stale-count races.
   perform user_id from public.agency_memberships
     where agency_id=old.agency_id and role='admin' order by user_id for update;
   if (select count(*) from public.agency_memberships where agency_id=old.agency_id and role='admin')<=1 then
     raise exception using errcode='23514',message='Keep at least one agency administrator. Appoint another admin before removing or demoting this member';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$function$
;
alter function public."guard_agency_membership"() owner to "postgres";
revoke all on function public."guard_agency_membership"() from public,anon,authenticated,service_role;
grant execute on function public."guard_agency_membership"() to "postgres";
CREATE OR REPLACE FUNCTION public.guard_archived_gig_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_archived timestamptz;
begin
  if tg_op<>'INSERT' and old.entity_type='gig' then
    select g.archived_at into v_archived from public.gigs g
      where g.id=old.entity_id and g.agency_id=old.agency_id for share;
    if found and v_archived is not null then
      raise exception 'Activity on an archived gig cannot be changed or removed';
    end if;
  end if;
  if tg_op<>'DELETE' and new.entity_type='gig' then
    select g.archived_at into v_archived from public.gigs g
      where g.id=new.entity_id and g.agency_id=new.agency_id for share;
    if not found then
      -- Existing orphaned legacy tasks can still be completed; new broken links cannot be created.
      if tg_op='INSERT' or new.entity_id is distinct from old.entity_id
          or new.agency_id is distinct from old.agency_id or new.entity_type is distinct from old.entity_type then
        raise exception 'Gig activity must reference a gig in the same agency';
      end if;
    elsif v_archived is not null and new.activity_type='task' and new.completed_at is null then
      raise exception 'Cannot add an open task to an archived gig';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$
;
alter function public."guard_archived_gig_activity"() owner to "postgres";
revoke all on function public."guard_archived_gig_activity"() from public,anon,authenticated,service_role;
grant execute on function public."guard_archived_gig_activity"() to "postgres";
CREATE OR REPLACE FUNCTION public.guard_gig_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op='INSERT' then
    if new.archived_at is not null or new.archived_by is not null or new.archive_reason is not null then
      raise exception 'Create the gig before archiving it';
    end if;
    if auth.uid() is not null then new.created_by:=auth.uid(); end if;
    return new;
  end if;
  if old.archived_at is not null and new is distinct from old then
    raise exception 'Archived gigs are read-only';
  end if;
  if new.created_by is distinct from old.created_by or new.agency_id is distinct from old.agency_id then
    raise exception 'Gig creator and agency cannot be changed';
  end if;
  return new;
end;
$function$
;
alter function public."guard_gig_lifecycle"() owner to "postgres";
revoke all on function public."guard_gig_lifecycle"() from public,anon,authenticated,service_role;
grant execute on function public."guard_gig_lifecycle"() to "postgres";
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;

  return new;
end;
$function$
;
alter function public."handle_new_user"() owner to "postgres";
CREATE OR REPLACE FUNCTION public.invite_token_hash(p_token text)
 RETURNS bytea
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select extensions.digest(convert_to(p_token, 'utf8'), 'sha256'::text);
$function$
;
alter function public."invite_token_hash"(p_token text) owner to "postgres";
revoke all on function public."invite_token_hash"(p_token text) from public,anon,authenticated,service_role;
grant execute on function public."invite_token_hash"(p_token text) to PUBLIC;
grant execute on function public."invite_token_hash"(p_token text) to "postgres";
grant execute on function public."invite_token_hash"(p_token text) to "authenticated";
CREATE OR REPLACE FUNCTION public.is_agency_admin(p_agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_super_user()
    or exists (
      select 1
      from public.agency_memberships m
      where m.agency_id = p_agency_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    );
$function$
;
alter function public."is_agency_admin"(p_agency_id uuid) owner to "postgres";
revoke all on function public."is_agency_admin"(p_agency_id uuid) from public,anon,authenticated,service_role;
grant execute on function public."is_agency_admin"(p_agency_id uuid) to PUBLIC;
grant execute on function public."is_agency_admin"(p_agency_id uuid) to "postgres";
grant execute on function public."is_agency_admin"(p_agency_id uuid) to "authenticated";
CREATE OR REPLACE FUNCTION public.is_agency_member(p_agency_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.agency_memberships m
    where m.user_id = auth.uid()
      and m.agency_id = p_agency_id
  );
$function$
;
alter function public."is_agency_member"(p_agency_id uuid) owner to "postgres";
revoke all on function public."is_agency_member"(p_agency_id uuid) from public,anon,authenticated,service_role;
grant execute on function public."is_agency_member"(p_agency_id uuid) to "postgres";
grant execute on function public."is_agency_member"(p_agency_id uuid) to "authenticated";
CREATE OR REPLACE FUNCTION public.is_super_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select p.is_super_user
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$function$
;
alter function public."is_super_user"() owner to "postgres";
revoke all on function public."is_super_user"() from public,anon,authenticated,service_role;
grant execute on function public."is_super_user"() to PUBLIC;
grant execute on function public."is_super_user"() to "postgres";
grant execute on function public."is_super_user"() to "authenticated";
CREATE OR REPLACE FUNCTION public.monitor_health()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select true;
$function$
;
alter function public."monitor_health"() owner to "postgres";
revoke all on function public."monitor_health"() from public,anon,authenticated,service_role;
grant execute on function public."monitor_health"() to "postgres";
grant execute on function public."monitor_health"() to "anon";
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
alter function public."set_updated_at"() owner to "postgres";
create view public."task_status_view" with (security_invoker=true) as  SELECT id,
    agency_id,
    entity_type,
    entity_id,
    summary,
    notes,
    due_at,
    completed_at,
    created_at,
    assigned_to,
    metadata,
    escalated_at,
    escalation_level,
    escalation_workflow_event_id,
        CASE
            WHEN completed_at IS NOT NULL THEN false
            WHEN due_at IS NULL THEN false
            WHEN due_at < date_trunc('day'::text, now()) THEN true
            ELSE false
        END AS is_overdue,
        CASE
            WHEN completed_at IS NOT NULL THEN false
            WHEN due_at IS NULL THEN false
            WHEN due_at >= date_trunc('day'::text, now()) AND due_at < (date_trunc('day'::text, now()) + '1 day'::interval) THEN true
            ELSE false
        END AS is_due_today,
        CASE
            WHEN completed_at IS NOT NULL THEN false
            WHEN due_at IS NULL THEN false
            WHEN due_at >= (date_trunc('day'::text, now()) + '1 day'::interval) AND due_at < (date_trunc('day'::text, now()) + '4 days'::interval) THEN true
            ELSE false
        END AS is_due_soon,
        CASE
            WHEN escalation_level = 'overdue_7_days'::text THEN true
            ELSE false
        END AS is_escalated,
        CASE
            WHEN due_at IS NULL THEN NULL::integer
            ELSE GREATEST(0, floor(EXTRACT(epoch FROM now() - due_at) / 86400::numeric)::integer)
        END AS overdue_days
   FROM activity_log t
  WHERE activity_type = 'task'::text;
alter view public."task_status_view" owner to "postgres";
alter table public."activity_log" enable row level security;
alter table public."agencies" enable row level security;
alter table public."agency_invitations" enable row level security;
alter table public."agency_memberships" enable row level security;
alter table public."agency_settings" enable row level security;
alter table public."agency_tag_types" enable row level security;
alter table public."agency_tags" enable row level security;
alter table public."artist_members" enable row level security;
alter table public."artist_tags" enable row level security;
alter table public."artists" enable row level security;
alter table public."contact_calls" enable row level security;
alter table public."contact_email_events" enable row level security;
alter table public."contact_emails" enable row level security;
alter table public."gigs" enable row level security;
alter table public."profiles" enable row level security;
alter table public."venue_activity" enable row level security;
alter table public."venue_contacts" enable row level security;
alter table public."venue_feedback" enable row level security;
alter table public."venue_tags" enable row level security;
alter table public."venues" enable row level security;
alter table public."workflow_events" enable row level security;
create policy "activity_log_delete_agency_members" on "public"."activity_log" as PERMISSIVE for DELETE to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = activity_log.agency_id) AND (m.user_id = auth.uid())))));
create policy "activity_log_insert_agency_members" on "public"."activity_log" as PERMISSIVE for INSERT to "public" with check ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = activity_log.agency_id) AND (m.user_id = auth.uid())))));
create policy "activity_log_select_agency_members" on "public"."activity_log" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = activity_log.agency_id) AND (m.user_id = auth.uid())))));
create policy "activity_log_update_agency_members" on "public"."activity_log" as PERMISSIVE for UPDATE to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = activity_log.agency_id) AND (m.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = activity_log.agency_id) AND (m.user_id = auth.uid())))));
create policy "agencies_delete_super_only" on "public"."agencies" as PERMISSIVE for DELETE to "authenticated" using (is_super_user());
create policy "agencies_insert_super_only" on "public"."agencies" as PERMISSIVE for INSERT to "authenticated" with check (is_super_user());
create policy "agencies_select_member_or_super" on "public"."agencies" as PERMISSIVE for SELECT to "authenticated" using (is_agency_member(id));
create policy "agencies_update_super_only" on "public"."agencies" as PERMISSIVE for UPDATE to "authenticated" using (is_super_user()) with check (is_super_user());
create policy "invites_delete_admin" on "public"."agency_invitations" as PERMISSIVE for DELETE to "authenticated" using (is_agency_admin(agency_id));
create policy "invites_insert_admin" on "public"."agency_invitations" as PERMISSIVE for INSERT to "authenticated" with check (is_agency_admin(agency_id));
create policy "invites_select_admin" on "public"."agency_invitations" as PERMISSIVE for SELECT to "authenticated" using (is_agency_admin(agency_id));
create policy "invites_update_admin" on "public"."agency_invitations" as PERMISSIVE for UPDATE to "authenticated" using (is_agency_admin(agency_id)) with check (is_agency_admin(agency_id));
create policy "agency_memberships_select_same_agency_members" on "public"."agency_memberships" as PERMISSIVE for SELECT to "public" using (is_agency_member(agency_id));
create policy "memberships_delete_admin" on "public"."agency_memberships" as PERMISSIVE for DELETE to "authenticated" using (is_agency_admin(agency_id));
create policy "memberships_insert_admin" on "public"."agency_memberships" as PERMISSIVE for INSERT to "authenticated" with check (is_agency_admin(agency_id));
create policy "memberships_select_self_or_admin" on "public"."agency_memberships" as PERMISSIVE for SELECT to "authenticated" using (((user_id = auth.uid()) OR is_agency_admin(agency_id)));
create policy "memberships_update_admin" on "public"."agency_memberships" as PERMISSIVE for UPDATE to "authenticated" using (is_agency_admin(agency_id)) with check (is_agency_admin(agency_id));
create policy "agency_settings_select_members" on "public"."agency_settings" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = agency_settings.agency_id) AND (m.user_id = auth.uid())))));
create policy "agency_settings_update_admins" on "public"."agency_settings" as PERMISSIVE for UPDATE to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = agency_settings.agency_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['agency_admin'::text, 'admin'::text, 'manager'::text, 'owner'::text])))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = agency_settings.agency_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['agency_admin'::text, 'admin'::text, 'manager'::text, 'owner'::text]))))));
create policy "agency members can manage tag types" on "public"."agency_tag_types" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = agency_tag_types.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = agency_tag_types.agency_id) AND (am.user_id = auth.uid())))));
create policy "agency members can manage agency tags" on "public"."agency_tags" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = agency_tags.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = agency_tags.agency_id) AND (am.user_id = auth.uid())))));
create policy "agency members can read agency tags" on "public"."agency_tags" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = agency_tags.agency_id) AND (am.user_id = auth.uid())))));
create policy "artist_members_delete_for_agency_members" on "public"."artist_members" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_members.agency_id) AND (am.user_id = auth.uid())))));
create policy "artist_members_insert_for_agency_members" on "public"."artist_members" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_members.agency_id) AND (am.user_id = auth.uid())))));
create policy "artist_members_select_for_agency_members" on "public"."artist_members" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_members.agency_id) AND (am.user_id = auth.uid())))));
create policy "artist_members_update_for_agency_members" on "public"."artist_members" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_members.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_members.agency_id) AND (am.user_id = auth.uid())))));
create policy "agency members can manage artist tags" on "public"."artist_tags" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_tags.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_tags.agency_id) AND (am.user_id = auth.uid())))));
create policy "agency members can read artist tags" on "public"."artist_tags" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = artist_tags.agency_id) AND (am.user_id = auth.uid())))));
create policy "artists_delete_admin_or_super" on "public"."artists" as PERMISSIVE for DELETE to "authenticated" using (is_agency_admin(agency_id));
create policy "artists_insert_member" on "public"."artists" as PERMISSIVE for INSERT to "authenticated" with check (is_agency_member(agency_id));
create policy "artists_select_member" on "public"."artists" as PERMISSIVE for SELECT to "authenticated" using (is_agency_member(agency_id));
create policy "artists_update_member" on "public"."artists" as PERMISSIVE for UPDATE to "authenticated" using (is_agency_member(agency_id)) with check (is_agency_member(agency_id));
create policy "contact_calls_delete_for_agency_members" on "public"."contact_calls" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_calls.agency_id) AND (am.user_id = auth.uid())))));
create policy "contact_calls_insert_for_agency_members" on "public"."contact_calls" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_calls.agency_id) AND (am.user_id = auth.uid())))));
create policy "contact_calls_select_for_agency_members" on "public"."contact_calls" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_calls.agency_id) AND (am.user_id = auth.uid())))));
create policy "contact_calls_update_for_agency_members" on "public"."contact_calls" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_calls.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_calls.agency_id) AND (am.user_id = auth.uid())))));
create policy "contact_email_events_insert_for_agency_members" on "public"."contact_email_events" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM (contact_emails ce
     JOIN agency_memberships am ON ((am.agency_id = ce.agency_id)))
  WHERE ((ce.id = contact_email_events.contact_email_id) AND (am.user_id = auth.uid())))));
create policy "contact_email_events_select_for_agency_members" on "public"."contact_email_events" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (contact_emails ce
     JOIN agency_memberships am ON ((am.agency_id = ce.agency_id)))
  WHERE ((ce.id = contact_email_events.contact_email_id) AND (am.user_id = auth.uid())))));
create policy "contact_emails_insert_for_agency_members" on "public"."contact_emails" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_emails.agency_id) AND (am.user_id = auth.uid())))));
create policy "contact_emails_select_for_agency_members" on "public"."contact_emails" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_emails.agency_id) AND (am.user_id = auth.uid())))));
create policy "contact_emails_update_for_agency_members" on "public"."contact_emails" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_emails.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = contact_emails.agency_id) AND (am.user_id = auth.uid())))));
create policy "gigs_insert_agency_members" on "public"."gigs" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id)))));
create policy "gigs_select_agency_members" on "public"."gigs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id)))));
create policy "gigs_update_agency_members" on "public"."gigs" as PERMISSIVE for UPDATE to "authenticated" using (((archived_at IS NULL) AND is_agency_member(agency_id))) with check (((archived_at IS NULL) AND is_agency_member(agency_id)));
create policy "profiles_select_own_or_super" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using (((id = auth.uid()) OR is_super_user()));
create policy "profiles_select_same_agency_members" on "public"."profiles" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM (agency_memberships m1
     JOIN agency_memberships m2 ON ((m1.agency_id = m2.agency_id)))
  WHERE ((m1.user_id = auth.uid()) AND (m2.user_id = profiles.id)))));
create policy "profiles_update_own" on "public"."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = auth.uid())) with check ((id = auth.uid()));
create policy "venue_activity_delete_for_agency_members" on "public"."venue_activity" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_activity.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_activity_insert_for_agency_members" on "public"."venue_activity" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_activity.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_activity_select_for_agency_members" on "public"."venue_activity" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_activity.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_activity_update_for_agency_members" on "public"."venue_activity" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_activity.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_activity.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_contacts_delete_for_agency_members" on "public"."venue_contacts" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_contacts.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_contacts_insert_for_agency_members" on "public"."venue_contacts" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_contacts.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_contacts_select_for_agency_members" on "public"."venue_contacts" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_contacts.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_contacts_update_for_agency_members" on "public"."venue_contacts" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_contacts.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_contacts.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_feedback_delete_for_agency_members" on "public"."venue_feedback" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_feedback.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_feedback_insert_for_agency_members" on "public"."venue_feedback" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_feedback.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_feedback_select_for_agency_members" on "public"."venue_feedback" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_feedback.agency_id) AND (am.user_id = auth.uid())))));
create policy "venue_feedback_update_for_agency_members" on "public"."venue_feedback" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_feedback.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_feedback.agency_id) AND (am.user_id = auth.uid())))));
create policy "agency members can manage venue tags" on "public"."venue_tags" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_tags.agency_id) AND (am.user_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.agency_id = venue_tags.agency_id) AND (am.user_id = auth.uid())))));
create policy "venues_delete_admin_or_super" on "public"."venues" as PERMISSIVE for DELETE to "authenticated" using (((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = venues.agency_id) AND (m.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "venues_insert_admin_or_super" on "public"."venues" as PERMISSIVE for INSERT to "authenticated" with check (((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = venues.agency_id) AND (m.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "venues_insert_in_agency" on "public"."venues" as PERMISSIVE for INSERT to "public" with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.user_id = auth.uid()) AND (am.agency_id = venues.agency_id)))));
create policy "venues_select_in_agency" on "public"."venues" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.user_id = auth.uid()) AND (am.agency_id = venues.agency_id)))));
create policy "venues_select_member_or_super" on "public"."venues" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = venues.agency_id)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "venues_update_admin_or_super" on "public"."venues" as PERMISSIVE for UPDATE to "authenticated" using (((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = venues.agency_id) AND (m.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true)))))) with check (((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = venues.agency_id) AND (m.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "venues_update_in_agency" on "public"."venues" as PERMISSIVE for UPDATE to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.user_id = auth.uid()) AND (am.agency_id = venues.agency_id))))) with check ((EXISTS ( SELECT 1
   FROM agency_memberships am
  WHERE ((am.user_id = auth.uid()) AND (am.agency_id = venues.agency_id)))));
create policy "workflow_events_insert_agency_members" on "public"."workflow_events" as PERMISSIVE for INSERT to "public" with check ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = workflow_events.agency_id) AND (m.user_id = auth.uid())))));
create policy "workflow_events_select_agency_members" on "public"."workflow_events" as PERMISSIVE for SELECT to "public" using ((EXISTS ( SELECT 1
   FROM agency_memberships m
  WHERE ((m.agency_id = workflow_events.agency_id) AND (m.user_id = auth.uid())))));
create policy "Public read agency logos" on "storage"."objects" as PERMISSIVE for SELECT to "public" using ((bucket_id = 'agency-logos'::text));
create policy "Super user delete agency logos" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'agency-logos'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "Super user update agency logos" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'agency-logos'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true)))))) with check (((bucket_id = 'agency-logos'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "Super user upload agency logos" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'agency-logos'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_user = true))))));
create policy "artist_images_delete" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = 'artist-images'::text) AND (cardinality(string_to_array(name, '/'::text)) = 3) AND (split_part(name, '/'::text, 3) <> ALL (ARRAY[''::text, '.'::text, '..'::text])) AND (EXISTS ( SELECT 1
   FROM artists a
  WHERE (((a.agency_id)::text = split_part(objects.name, '/'::text, 1)) AND ((a.id)::text = split_part(objects.name, '/'::text, 2)) AND is_agency_member(a.agency_id))))));
create policy "artist_images_insert" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'artist-images'::text) AND (cardinality(string_to_array(name, '/'::text)) = 3) AND (split_part(name, '/'::text, 3) <> ALL (ARRAY[''::text, '.'::text, '..'::text])) AND (EXISTS ( SELECT 1
   FROM artists a
  WHERE (((a.agency_id)::text = split_part(objects.name, '/'::text, 1)) AND ((a.id)::text = split_part(objects.name, '/'::text, 2)) AND is_agency_member(a.agency_id))))));
create policy "artist_images_select" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'artist-images'::text) AND (cardinality(string_to_array(name, '/'::text)) = 3) AND (split_part(name, '/'::text, 3) <> ALL (ARRAY[''::text, '.'::text, '..'::text])) AND (EXISTS ( SELECT 1
   FROM artists a
  WHERE (((a.agency_id)::text = split_part(objects.name, '/'::text, 1)) AND ((a.id)::text = split_part(objects.name, '/'::text, 2)) AND is_agency_member(a.agency_id))))));
create policy "artist_images_update" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'artist-images'::text) AND (cardinality(string_to_array(name, '/'::text)) = 3) AND (split_part(name, '/'::text, 3) <> ALL (ARRAY[''::text, '.'::text, '..'::text])) AND (EXISTS ( SELECT 1
   FROM artists a
  WHERE (((a.agency_id)::text = split_part(objects.name, '/'::text, 1)) AND ((a.id)::text = split_part(objects.name, '/'::text, 2)) AND is_agency_member(a.agency_id)))))) with check (((bucket_id = 'artist-images'::text) AND (cardinality(string_to_array(name, '/'::text)) = 3) AND (split_part(name, '/'::text, 3) <> ALL (ARRAY[''::text, '.'::text, '..'::text])) AND (EXISTS ( SELECT 1
   FROM artists a
  WHERE (((a.agency_id)::text = split_part(objects.name, '/'::text, 1)) AND ((a.id)::text = split_part(objects.name, '/'::text, 2)) AND is_agency_member(a.agency_id))))));
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER guard_archived_gig_activity BEFORE INSERT OR DELETE OR UPDATE ON activity_log FOR EACH ROW EXECUTE FUNCTION guard_archived_gig_activity();
CREATE TRIGGER guard_agency_membership BEFORE DELETE OR UPDATE ON agency_memberships FOR EACH ROW EXECUTE FUNCTION guard_agency_membership();
CREATE TRIGGER trg_artists_set_updated_at BEFORE UPDATE ON artists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_contact_emails_updated_at BEFORE UPDATE ON contact_emails FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER guard_gig_lifecycle BEFORE INSERT OR UPDATE ON gigs FOR EACH ROW EXECUTE FUNCTION guard_gig_lifecycle();
CREATE TRIGGER set_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
grant DELETE on public."activity_log" to "authenticated";
grant INSERT on public."activity_log" to "authenticated";
grant SELECT on public."activity_log" to "authenticated";
grant UPDATE on public."activity_log" to "authenticated";
grant DELETE on public."agencies" to "authenticated";
grant INSERT on public."agencies" to "authenticated";
grant SELECT on public."agencies" to "authenticated";
grant UPDATE on public."agencies" to "authenticated";
grant DELETE on public."agency_invitations" to "authenticated";
grant INSERT on public."agency_invitations" to "authenticated";
grant SELECT on public."agency_invitations" to "authenticated";
grant UPDATE on public."agency_invitations" to "authenticated";
grant DELETE on public."agency_memberships" to "authenticated";
grant INSERT on public."agency_memberships" to "authenticated";
grant SELECT on public."agency_memberships" to "authenticated";
grant SELECT on public."agency_settings" to "authenticated";
grant UPDATE on public."agency_settings" to "authenticated";
grant DELETE on public."agency_tag_types" to "authenticated";
grant INSERT on public."agency_tag_types" to "authenticated";
grant SELECT on public."agency_tag_types" to "authenticated";
grant UPDATE on public."agency_tag_types" to "authenticated";
grant DELETE on public."agency_tags" to "authenticated";
grant INSERT on public."agency_tags" to "authenticated";
grant SELECT on public."agency_tags" to "authenticated";
grant UPDATE on public."agency_tags" to "authenticated";
grant DELETE on public."artist_members" to "authenticated";
grant INSERT on public."artist_members" to "authenticated";
grant SELECT on public."artist_members" to "authenticated";
grant UPDATE on public."artist_members" to "authenticated";
grant DELETE on public."artist_tags" to "authenticated";
grant INSERT on public."artist_tags" to "authenticated";
grant SELECT on public."artist_tags" to "authenticated";
grant UPDATE on public."artist_tags" to "authenticated";
grant DELETE on public."artists" to "authenticated";
grant INSERT on public."artists" to "authenticated";
grant SELECT on public."artists" to "authenticated";
grant UPDATE on public."artists" to "authenticated";
grant DELETE on public."contact_calls" to "authenticated";
grant INSERT on public."contact_calls" to "authenticated";
grant SELECT on public."contact_calls" to "authenticated";
grant UPDATE on public."contact_calls" to "authenticated";
grant INSERT on public."contact_email_events" to "authenticated";
grant SELECT on public."contact_email_events" to "authenticated";
grant DELETE on public."contact_emails" to "authenticated";
grant INSERT on public."contact_emails" to "authenticated";
grant SELECT on public."contact_emails" to "authenticated";
grant UPDATE on public."contact_emails" to "authenticated";
grant INSERT on public."gigs" to "authenticated";
grant SELECT on public."gigs" to "authenticated";
grant SELECT on public."profiles" to "authenticated";
grant SELECT on public."task_status_view" to "authenticated";
grant DELETE on public."venue_activity" to "authenticated";
grant INSERT on public."venue_activity" to "authenticated";
grant SELECT on public."venue_activity" to "authenticated";
grant UPDATE on public."venue_activity" to "authenticated";
grant DELETE on public."venue_contacts" to "authenticated";
grant INSERT on public."venue_contacts" to "authenticated";
grant SELECT on public."venue_contacts" to "authenticated";
grant UPDATE on public."venue_contacts" to "authenticated";
grant DELETE on public."venue_feedback" to "authenticated";
grant INSERT on public."venue_feedback" to "authenticated";
grant SELECT on public."venue_feedback" to "authenticated";
grant UPDATE on public."venue_feedback" to "authenticated";
grant DELETE on public."venue_tags" to "authenticated";
grant INSERT on public."venue_tags" to "authenticated";
grant SELECT on public."venue_tags" to "authenticated";
grant UPDATE on public."venue_tags" to "authenticated";
grant DELETE on public."venues" to "authenticated";
grant INSERT on public."venues" to "authenticated";
grant SELECT on public."venues" to "authenticated";
grant UPDATE on public."venues" to "authenticated";
grant INSERT on public."workflow_events" to "authenticated";
grant SELECT on public."workflow_events" to "authenticated";
grant INSERT ("activity_type") on public."activity_log" to "authenticated";
grant SELECT ("activity_type") on public."activity_log" to "authenticated";
grant UPDATE ("activity_type") on public."activity_log" to "authenticated";
grant INSERT ("agency_id") on public."activity_log" to "authenticated";
grant SELECT ("agency_id") on public."activity_log" to "authenticated";
grant UPDATE ("agency_id") on public."activity_log" to "authenticated";
grant INSERT ("assigned_to") on public."activity_log" to "authenticated";
grant SELECT ("assigned_to") on public."activity_log" to "authenticated";
grant UPDATE ("assigned_to") on public."activity_log" to "authenticated";
grant INSERT ("completed_at") on public."activity_log" to "authenticated";
grant SELECT ("completed_at") on public."activity_log" to "authenticated";
grant UPDATE ("completed_at") on public."activity_log" to "authenticated";
grant INSERT ("created_at") on public."activity_log" to "authenticated";
grant SELECT ("created_at") on public."activity_log" to "authenticated";
grant UPDATE ("created_at") on public."activity_log" to "authenticated";
grant INSERT ("created_by") on public."activity_log" to "authenticated";
grant SELECT ("created_by") on public."activity_log" to "authenticated";
grant UPDATE ("created_by") on public."activity_log" to "authenticated";
grant INSERT ("due_at") on public."activity_log" to "authenticated";
grant SELECT ("due_at") on public."activity_log" to "authenticated";
grant UPDATE ("due_at") on public."activity_log" to "authenticated";
grant INSERT ("entity_id") on public."activity_log" to "authenticated";
grant SELECT ("entity_id") on public."activity_log" to "authenticated";
grant UPDATE ("entity_id") on public."activity_log" to "authenticated";
grant INSERT ("entity_type") on public."activity_log" to "authenticated";
grant SELECT ("entity_type") on public."activity_log" to "authenticated";
grant UPDATE ("entity_type") on public."activity_log" to "authenticated";
grant INSERT ("escalated_at") on public."activity_log" to "authenticated";
grant SELECT ("escalated_at") on public."activity_log" to "authenticated";
grant UPDATE ("escalated_at") on public."activity_log" to "authenticated";
grant INSERT ("escalation_level") on public."activity_log" to "authenticated";
grant SELECT ("escalation_level") on public."activity_log" to "authenticated";
grant UPDATE ("escalation_level") on public."activity_log" to "authenticated";
grant INSERT ("escalation_workflow_event_id") on public."activity_log" to "authenticated";
grant SELECT ("escalation_workflow_event_id") on public."activity_log" to "authenticated";
grant UPDATE ("escalation_workflow_event_id") on public."activity_log" to "authenticated";
grant INSERT ("id") on public."activity_log" to "authenticated";
grant SELECT ("id") on public."activity_log" to "authenticated";
grant UPDATE ("id") on public."activity_log" to "authenticated";
grant INSERT ("metadata") on public."activity_log" to "authenticated";
grant SELECT ("metadata") on public."activity_log" to "authenticated";
grant UPDATE ("metadata") on public."activity_log" to "authenticated";
grant INSERT ("notes") on public."activity_log" to "authenticated";
grant SELECT ("notes") on public."activity_log" to "authenticated";
grant UPDATE ("notes") on public."activity_log" to "authenticated";
grant INSERT ("summary") on public."activity_log" to "authenticated";
grant SELECT ("summary") on public."activity_log" to "authenticated";
grant UPDATE ("summary") on public."activity_log" to "authenticated";
grant INSERT ("created_at") on public."agencies" to "authenticated";
grant SELECT ("created_at") on public."agencies" to "authenticated";
grant UPDATE ("created_at") on public."agencies" to "authenticated";
grant INSERT ("id") on public."agencies" to "authenticated";
grant SELECT ("id") on public."agencies" to "authenticated";
grant UPDATE ("id") on public."agencies" to "authenticated";
grant INSERT ("logo_url") on public."agencies" to "authenticated";
grant SELECT ("logo_url") on public."agencies" to "authenticated";
grant UPDATE ("logo_url") on public."agencies" to "authenticated";
grant INSERT ("name") on public."agencies" to "authenticated";
grant SELECT ("name") on public."agencies" to "authenticated";
grant UPDATE ("name") on public."agencies" to "authenticated";
grant INSERT ("theme_preset") on public."agencies" to "authenticated";
grant SELECT ("theme_preset") on public."agencies" to "authenticated";
grant UPDATE ("theme_preset") on public."agencies" to "authenticated";
grant INSERT ("accepted_at") on public."agency_invitations" to "authenticated";
grant SELECT ("accepted_at") on public."agency_invitations" to "authenticated";
grant UPDATE ("accepted_at") on public."agency_invitations" to "authenticated";
grant INSERT ("accepted_by") on public."agency_invitations" to "authenticated";
grant SELECT ("accepted_by") on public."agency_invitations" to "authenticated";
grant UPDATE ("accepted_by") on public."agency_invitations" to "authenticated";
grant INSERT ("agency_id") on public."agency_invitations" to "authenticated";
grant SELECT ("agency_id") on public."agency_invitations" to "authenticated";
grant UPDATE ("agency_id") on public."agency_invitations" to "authenticated";
grant INSERT ("created_at") on public."agency_invitations" to "authenticated";
grant SELECT ("created_at") on public."agency_invitations" to "authenticated";
grant UPDATE ("created_at") on public."agency_invitations" to "authenticated";
grant INSERT ("email") on public."agency_invitations" to "authenticated";
grant SELECT ("email") on public."agency_invitations" to "authenticated";
grant UPDATE ("email") on public."agency_invitations" to "authenticated";
grant INSERT ("expires_at") on public."agency_invitations" to "authenticated";
grant SELECT ("expires_at") on public."agency_invitations" to "authenticated";
grant UPDATE ("expires_at") on public."agency_invitations" to "authenticated";
grant INSERT ("id") on public."agency_invitations" to "authenticated";
grant SELECT ("id") on public."agency_invitations" to "authenticated";
grant UPDATE ("id") on public."agency_invitations" to "authenticated";
grant INSERT ("invited_by") on public."agency_invitations" to "authenticated";
grant SELECT ("invited_by") on public."agency_invitations" to "authenticated";
grant UPDATE ("invited_by") on public."agency_invitations" to "authenticated";
grant INSERT ("role") on public."agency_invitations" to "authenticated";
grant SELECT ("role") on public."agency_invitations" to "authenticated";
grant UPDATE ("role") on public."agency_invitations" to "authenticated";
grant INSERT ("token_hash") on public."agency_invitations" to "authenticated";
grant SELECT ("token_hash") on public."agency_invitations" to "authenticated";
grant UPDATE ("token_hash") on public."agency_invitations" to "authenticated";
grant INSERT ("agency_id") on public."agency_memberships" to "authenticated";
grant SELECT ("agency_id") on public."agency_memberships" to "authenticated";
grant INSERT ("created_at") on public."agency_memberships" to "authenticated";
grant SELECT ("created_at") on public."agency_memberships" to "authenticated";
grant INSERT ("role") on public."agency_memberships" to "authenticated";
grant SELECT ("role") on public."agency_memberships" to "authenticated";
grant UPDATE ("role") on public."agency_memberships" to "authenticated";
grant INSERT ("user_id") on public."agency_memberships" to "authenticated";
grant SELECT ("user_id") on public."agency_memberships" to "authenticated";
grant SELECT ("agency_id") on public."agency_settings" to "authenticated";
grant UPDATE ("agency_id") on public."agency_settings" to "authenticated";
grant SELECT ("created_at") on public."agency_settings" to "authenticated";
grant UPDATE ("created_at") on public."agency_settings" to "authenticated";
grant SELECT ("overdue_escalation_days") on public."agency_settings" to "authenticated";
grant UPDATE ("overdue_escalation_days") on public."agency_settings" to "authenticated";
grant SELECT ("updated_at") on public."agency_settings" to "authenticated";
grant UPDATE ("updated_at") on public."agency_settings" to "authenticated";
grant INSERT ("active") on public."agency_tag_types" to "authenticated";
grant SELECT ("active") on public."agency_tag_types" to "authenticated";
grant UPDATE ("active") on public."agency_tag_types" to "authenticated";
grant INSERT ("agency_id") on public."agency_tag_types" to "authenticated";
grant SELECT ("agency_id") on public."agency_tag_types" to "authenticated";
grant UPDATE ("agency_id") on public."agency_tag_types" to "authenticated";
grant INSERT ("created_at") on public."agency_tag_types" to "authenticated";
grant SELECT ("created_at") on public."agency_tag_types" to "authenticated";
grant UPDATE ("created_at") on public."agency_tag_types" to "authenticated";
grant INSERT ("description") on public."agency_tag_types" to "authenticated";
grant SELECT ("description") on public."agency_tag_types" to "authenticated";
grant UPDATE ("description") on public."agency_tag_types" to "authenticated";
grant INSERT ("id") on public."agency_tag_types" to "authenticated";
grant SELECT ("id") on public."agency_tag_types" to "authenticated";
grant UPDATE ("id") on public."agency_tag_types" to "authenticated";
grant INSERT ("label") on public."agency_tag_types" to "authenticated";
grant SELECT ("label") on public."agency_tag_types" to "authenticated";
grant UPDATE ("label") on public."agency_tag_types" to "authenticated";
grant INSERT ("sort_order") on public."agency_tag_types" to "authenticated";
grant SELECT ("sort_order") on public."agency_tag_types" to "authenticated";
grant UPDATE ("sort_order") on public."agency_tag_types" to "authenticated";
grant INSERT ("type") on public."agency_tag_types" to "authenticated";
grant SELECT ("type") on public."agency_tag_types" to "authenticated";
grant UPDATE ("type") on public."agency_tag_types" to "authenticated";
grant INSERT ("active") on public."agency_tags" to "authenticated";
grant SELECT ("active") on public."agency_tags" to "authenticated";
grant UPDATE ("active") on public."agency_tags" to "authenticated";
grant INSERT ("agency_id") on public."agency_tags" to "authenticated";
grant SELECT ("agency_id") on public."agency_tags" to "authenticated";
grant UPDATE ("agency_id") on public."agency_tags" to "authenticated";
grant INSERT ("created_at") on public."agency_tags" to "authenticated";
grant SELECT ("created_at") on public."agency_tags" to "authenticated";
grant UPDATE ("created_at") on public."agency_tags" to "authenticated";
grant INSERT ("id") on public."agency_tags" to "authenticated";
grant SELECT ("id") on public."agency_tags" to "authenticated";
grant UPDATE ("id") on public."agency_tags" to "authenticated";
grant INSERT ("name") on public."agency_tags" to "authenticated";
grant SELECT ("name") on public."agency_tags" to "authenticated";
grant UPDATE ("name") on public."agency_tags" to "authenticated";
grant INSERT ("sort_order") on public."agency_tags" to "authenticated";
grant SELECT ("sort_order") on public."agency_tags" to "authenticated";
grant UPDATE ("sort_order") on public."agency_tags" to "authenticated";
grant INSERT ("type") on public."agency_tags" to "authenticated";
grant SELECT ("type") on public."agency_tags" to "authenticated";
grant UPDATE ("type") on public."agency_tags" to "authenticated";
grant INSERT ("agency_id") on public."artist_members" to "authenticated";
grant SELECT ("agency_id") on public."artist_members" to "authenticated";
grant UPDATE ("agency_id") on public."artist_members" to "authenticated";
grant INSERT ("approval_notes") on public."artist_members" to "authenticated";
grant SELECT ("approval_notes") on public."artist_members" to "authenticated";
grant UPDATE ("approval_notes") on public."artist_members" to "authenticated";
grant INSERT ("artist_id") on public."artist_members" to "authenticated";
grant SELECT ("artist_id") on public."artist_members" to "authenticated";
grant UPDATE ("artist_id") on public."artist_members" to "authenticated";
grant INSERT ("created_at") on public."artist_members" to "authenticated";
grant SELECT ("created_at") on public."artist_members" to "authenticated";
grant UPDATE ("created_at") on public."artist_members" to "authenticated";
grant INSERT ("created_by") on public."artist_members" to "authenticated";
grant SELECT ("created_by") on public."artist_members" to "authenticated";
grant UPDATE ("created_by") on public."artist_members" to "authenticated";
grant INSERT ("email") on public."artist_members" to "authenticated";
grant SELECT ("email") on public."artist_members" to "authenticated";
grant UPDATE ("email") on public."artist_members" to "authenticated";
grant INSERT ("id") on public."artist_members" to "authenticated";
grant SELECT ("id") on public."artist_members" to "authenticated";
grant UPDATE ("id") on public."artist_members" to "authenticated";
grant INSERT ("is_default_approver") on public."artist_members" to "authenticated";
grant SELECT ("is_default_approver") on public."artist_members" to "authenticated";
grant UPDATE ("is_default_approver") on public."artist_members" to "authenticated";
grant INSERT ("is_primary") on public."artist_members" to "authenticated";
grant SELECT ("is_primary") on public."artist_members" to "authenticated";
grant UPDATE ("is_primary") on public."artist_members" to "authenticated";
grant INSERT ("name") on public."artist_members" to "authenticated";
grant SELECT ("name") on public."artist_members" to "authenticated";
grant UPDATE ("name") on public."artist_members" to "authenticated";
grant INSERT ("notes") on public."artist_members" to "authenticated";
grant SELECT ("notes") on public."artist_members" to "authenticated";
grant UPDATE ("notes") on public."artist_members" to "authenticated";
grant INSERT ("phone") on public."artist_members" to "authenticated";
grant SELECT ("phone") on public."artist_members" to "authenticated";
grant UPDATE ("phone") on public."artist_members" to "authenticated";
grant INSERT ("portal_enabled") on public."artist_members" to "authenticated";
grant SELECT ("portal_enabled") on public."artist_members" to "authenticated";
grant UPDATE ("portal_enabled") on public."artist_members" to "authenticated";
grant INSERT ("portal_invited_at") on public."artist_members" to "authenticated";
grant SELECT ("portal_invited_at") on public."artist_members" to "authenticated";
grant UPDATE ("portal_invited_at") on public."artist_members" to "authenticated";
grant INSERT ("portal_last_seen_at") on public."artist_members" to "authenticated";
grant SELECT ("portal_last_seen_at") on public."artist_members" to "authenticated";
grant UPDATE ("portal_last_seen_at") on public."artist_members" to "authenticated";
grant INSERT ("profile_id") on public."artist_members" to "authenticated";
grant SELECT ("profile_id") on public."artist_members" to "authenticated";
grant UPDATE ("profile_id") on public."artist_members" to "authenticated";
grant INSERT ("receives_gig_notifications") on public."artist_members" to "authenticated";
grant SELECT ("receives_gig_notifications") on public."artist_members" to "authenticated";
grant UPDATE ("receives_gig_notifications") on public."artist_members" to "authenticated";
grant INSERT ("role") on public."artist_members" to "authenticated";
grant SELECT ("role") on public."artist_members" to "authenticated";
grant UPDATE ("role") on public."artist_members" to "authenticated";
grant INSERT ("updated_at") on public."artist_members" to "authenticated";
grant SELECT ("updated_at") on public."artist_members" to "authenticated";
grant UPDATE ("updated_at") on public."artist_members" to "authenticated";
grant INSERT ("updated_by") on public."artist_members" to "authenticated";
grant SELECT ("updated_by") on public."artist_members" to "authenticated";
grant UPDATE ("updated_by") on public."artist_members" to "authenticated";
grant INSERT ("agency_id") on public."artist_tags" to "authenticated";
grant SELECT ("agency_id") on public."artist_tags" to "authenticated";
grant UPDATE ("agency_id") on public."artist_tags" to "authenticated";
grant INSERT ("artist_id") on public."artist_tags" to "authenticated";
grant SELECT ("artist_id") on public."artist_tags" to "authenticated";
grant UPDATE ("artist_id") on public."artist_tags" to "authenticated";
grant INSERT ("created_at") on public."artist_tags" to "authenticated";
grant SELECT ("created_at") on public."artist_tags" to "authenticated";
grant UPDATE ("created_at") on public."artist_tags" to "authenticated";
grant INSERT ("id") on public."artist_tags" to "authenticated";
grant SELECT ("id") on public."artist_tags" to "authenticated";
grant UPDATE ("id") on public."artist_tags" to "authenticated";
grant INSERT ("tag_id") on public."artist_tags" to "authenticated";
grant SELECT ("tag_id") on public."artist_tags" to "authenticated";
grant UPDATE ("tag_id") on public."artist_tags" to "authenticated";
grant INSERT ("agency_id") on public."artists" to "authenticated";
grant SELECT ("agency_id") on public."artists" to "authenticated";
grant UPDATE ("agency_id") on public."artists" to "authenticated";
grant INSERT ("banner_position_x") on public."artists" to "authenticated";
grant SELECT ("banner_position_x") on public."artists" to "authenticated";
grant UPDATE ("banner_position_x") on public."artists" to "authenticated";
grant INSERT ("banner_position_y") on public."artists" to "authenticated";
grant SELECT ("banner_position_y") on public."artists" to "authenticated";
grant UPDATE ("banner_position_y") on public."artists" to "authenticated";
grant INSERT ("banner_zoom") on public."artists" to "authenticated";
grant SELECT ("banner_zoom") on public."artists" to "authenticated";
grant UPDATE ("banner_zoom") on public."artists" to "authenticated";
grant INSERT ("contact_email") on public."artists" to "authenticated";
grant SELECT ("contact_email") on public."artists" to "authenticated";
grant UPDATE ("contact_email") on public."artists" to "authenticated";
grant INSERT ("created_at") on public."artists" to "authenticated";
grant SELECT ("created_at") on public."artists" to "authenticated";
grant UPDATE ("created_at") on public."artists" to "authenticated";
grant INSERT ("genre") on public."artists" to "authenticated";
grant SELECT ("genre") on public."artists" to "authenticated";
grant UPDATE ("genre") on public."artists" to "authenticated";
grant INSERT ("home_city") on public."artists" to "authenticated";
grant SELECT ("home_city") on public."artists" to "authenticated";
grant UPDATE ("home_city") on public."artists" to "authenticated";
grant INSERT ("home_country") on public."artists" to "authenticated";
grant SELECT ("home_country") on public."artists" to "authenticated";
grant UPDATE ("home_country") on public."artists" to "authenticated";
grant INSERT ("id") on public."artists" to "authenticated";
grant SELECT ("id") on public."artists" to "authenticated";
grant UPDATE ("id") on public."artists" to "authenticated";
grant INSERT ("image_url") on public."artists" to "authenticated";
grant SELECT ("image_url") on public."artists" to "authenticated";
grant UPDATE ("image_url") on public."artists" to "authenticated";
grant INSERT ("n_piece") on public."artists" to "authenticated";
grant SELECT ("n_piece") on public."artists" to "authenticated";
grant UPDATE ("n_piece") on public."artists" to "authenticated";
grant INSERT ("name") on public."artists" to "authenticated";
grant SELECT ("name") on public."artists" to "authenticated";
grant UPDATE ("name") on public."artists" to "authenticated";
grant INSERT ("notes") on public."artists" to "authenticated";
grant SELECT ("notes") on public."artists" to "authenticated";
grant UPDATE ("notes") on public."artists" to "authenticated";
grant INSERT ("status") on public."artists" to "authenticated";
grant SELECT ("status") on public."artists" to "authenticated";
grant UPDATE ("status") on public."artists" to "authenticated";
grant INSERT ("updated_at") on public."artists" to "authenticated";
grant SELECT ("updated_at") on public."artists" to "authenticated";
grant UPDATE ("updated_at") on public."artists" to "authenticated";
grant INSERT ("actor_id") on public."contact_calls" to "authenticated";
grant SELECT ("actor_id") on public."contact_calls" to "authenticated";
grant UPDATE ("actor_id") on public."contact_calls" to "authenticated";
grant INSERT ("agency_id") on public."contact_calls" to "authenticated";
grant SELECT ("agency_id") on public."contact_calls" to "authenticated";
grant UPDATE ("agency_id") on public."contact_calls" to "authenticated";
grant INSERT ("called_at") on public."contact_calls" to "authenticated";
grant SELECT ("called_at") on public."contact_calls" to "authenticated";
grant UPDATE ("called_at") on public."contact_calls" to "authenticated";
grant INSERT ("created_at") on public."contact_calls" to "authenticated";
grant SELECT ("created_at") on public."contact_calls" to "authenticated";
grant UPDATE ("created_at") on public."contact_calls" to "authenticated";
grant INSERT ("direction") on public."contact_calls" to "authenticated";
grant SELECT ("direction") on public."contact_calls" to "authenticated";
grant UPDATE ("direction") on public."contact_calls" to "authenticated";
grant INSERT ("duration_seconds") on public."contact_calls" to "authenticated";
grant SELECT ("duration_seconds") on public."contact_calls" to "authenticated";
grant UPDATE ("duration_seconds") on public."contact_calls" to "authenticated";
grant INSERT ("id") on public."contact_calls" to "authenticated";
grant SELECT ("id") on public."contact_calls" to "authenticated";
grant UPDATE ("id") on public."contact_calls" to "authenticated";
grant INSERT ("notes") on public."contact_calls" to "authenticated";
grant SELECT ("notes") on public."contact_calls" to "authenticated";
grant UPDATE ("notes") on public."contact_calls" to "authenticated";
grant INSERT ("outcome") on public."contact_calls" to "authenticated";
grant SELECT ("outcome") on public."contact_calls" to "authenticated";
grant UPDATE ("outcome") on public."contact_calls" to "authenticated";
grant INSERT ("updated_at") on public."contact_calls" to "authenticated";
grant SELECT ("updated_at") on public."contact_calls" to "authenticated";
grant UPDATE ("updated_at") on public."contact_calls" to "authenticated";
grant INSERT ("venue_contact_id") on public."contact_calls" to "authenticated";
grant SELECT ("venue_contact_id") on public."contact_calls" to "authenticated";
grant UPDATE ("venue_contact_id") on public."contact_calls" to "authenticated";
grant INSERT ("venue_id") on public."contact_calls" to "authenticated";
grant SELECT ("venue_id") on public."contact_calls" to "authenticated";
grant UPDATE ("venue_id") on public."contact_calls" to "authenticated";
grant INSERT ("contact_email_id") on public."contact_email_events" to "authenticated";
grant SELECT ("contact_email_id") on public."contact_email_events" to "authenticated";
grant INSERT ("created_at") on public."contact_email_events" to "authenticated";
grant SELECT ("created_at") on public."contact_email_events" to "authenticated";
grant INSERT ("event_type") on public."contact_email_events" to "authenticated";
grant SELECT ("event_type") on public."contact_email_events" to "authenticated";
grant INSERT ("id") on public."contact_email_events" to "authenticated";
grant SELECT ("id") on public."contact_email_events" to "authenticated";
grant INSERT ("payload_json") on public."contact_email_events" to "authenticated";
grant SELECT ("payload_json") on public."contact_email_events" to "authenticated";
grant INSERT ("actor_id") on public."contact_emails" to "authenticated";
grant SELECT ("actor_id") on public."contact_emails" to "authenticated";
grant UPDATE ("actor_id") on public."contact_emails" to "authenticated";
grant INSERT ("agency_id") on public."contact_emails" to "authenticated";
grant SELECT ("agency_id") on public."contact_emails" to "authenticated";
grant UPDATE ("agency_id") on public."contact_emails" to "authenticated";
grant INSERT ("bcc_email") on public."contact_emails" to "authenticated";
grant SELECT ("bcc_email") on public."contact_emails" to "authenticated";
grant UPDATE ("bcc_email") on public."contact_emails" to "authenticated";
grant INSERT ("created_at") on public."contact_emails" to "authenticated";
grant SELECT ("created_at") on public."contact_emails" to "authenticated";
grant UPDATE ("created_at") on public."contact_emails" to "authenticated";
grant INSERT ("direction") on public."contact_emails" to "authenticated";
grant SELECT ("direction") on public."contact_emails" to "authenticated";
grant UPDATE ("direction") on public."contact_emails" to "authenticated";
grant INSERT ("from_email") on public."contact_emails" to "authenticated";
grant SELECT ("from_email") on public."contact_emails" to "authenticated";
grant UPDATE ("from_email") on public."contact_emails" to "authenticated";
grant INSERT ("from_name") on public."contact_emails" to "authenticated";
grant SELECT ("from_name") on public."contact_emails" to "authenticated";
grant UPDATE ("from_name") on public."contact_emails" to "authenticated";
grant INSERT ("html_body") on public."contact_emails" to "authenticated";
grant SELECT ("html_body") on public."contact_emails" to "authenticated";
grant UPDATE ("html_body") on public."contact_emails" to "authenticated";
grant INSERT ("id") on public."contact_emails" to "authenticated";
grant SELECT ("id") on public."contact_emails" to "authenticated";
grant UPDATE ("id") on public."contact_emails" to "authenticated";
grant INSERT ("received_at") on public."contact_emails" to "authenticated";
grant SELECT ("received_at") on public."contact_emails" to "authenticated";
grant UPDATE ("received_at") on public."contact_emails" to "authenticated";
grant INSERT ("resend_email_id") on public."contact_emails" to "authenticated";
grant SELECT ("resend_email_id") on public."contact_emails" to "authenticated";
grant UPDATE ("resend_email_id") on public."contact_emails" to "authenticated";
grant INSERT ("sent_at") on public."contact_emails" to "authenticated";
grant SELECT ("sent_at") on public."contact_emails" to "authenticated";
grant UPDATE ("sent_at") on public."contact_emails" to "authenticated";
grant INSERT ("status") on public."contact_emails" to "authenticated";
grant SELECT ("status") on public."contact_emails" to "authenticated";
grant UPDATE ("status") on public."contact_emails" to "authenticated";
grant INSERT ("subject") on public."contact_emails" to "authenticated";
grant SELECT ("subject") on public."contact_emails" to "authenticated";
grant UPDATE ("subject") on public."contact_emails" to "authenticated";
grant INSERT ("text_body") on public."contact_emails" to "authenticated";
grant SELECT ("text_body") on public."contact_emails" to "authenticated";
grant UPDATE ("text_body") on public."contact_emails" to "authenticated";
grant INSERT ("thread_key") on public."contact_emails" to "authenticated";
grant SELECT ("thread_key") on public."contact_emails" to "authenticated";
grant UPDATE ("thread_key") on public."contact_emails" to "authenticated";
grant INSERT ("to_email") on public."contact_emails" to "authenticated";
grant SELECT ("to_email") on public."contact_emails" to "authenticated";
grant UPDATE ("to_email") on public."contact_emails" to "authenticated";
grant INSERT ("updated_at") on public."contact_emails" to "authenticated";
grant SELECT ("updated_at") on public."contact_emails" to "authenticated";
grant UPDATE ("updated_at") on public."contact_emails" to "authenticated";
grant INSERT ("venue_contact_id") on public."contact_emails" to "authenticated";
grant SELECT ("venue_contact_id") on public."contact_emails" to "authenticated";
grant UPDATE ("venue_contact_id") on public."contact_emails" to "authenticated";
grant INSERT ("venue_id") on public."contact_emails" to "authenticated";
grant SELECT ("venue_id") on public."contact_emails" to "authenticated";
grant UPDATE ("venue_id") on public."contact_emails" to "authenticated";
grant INSERT ("agency_id") on public."gigs" to "authenticated";
grant SELECT ("agency_id") on public."gigs" to "authenticated";
grant INSERT ("archive_reason") on public."gigs" to "authenticated";
grant SELECT ("archive_reason") on public."gigs" to "authenticated";
grant INSERT ("archived_at") on public."gigs" to "authenticated";
grant SELECT ("archived_at") on public."gigs" to "authenticated";
grant INSERT ("archived_by") on public."gigs" to "authenticated";
grant SELECT ("archived_by") on public."gigs" to "authenticated";
grant INSERT ("artist_id") on public."gigs" to "authenticated";
grant SELECT ("artist_id") on public."gigs" to "authenticated";
grant UPDATE ("artist_id") on public."gigs" to "authenticated";
grant INSERT ("city") on public."gigs" to "authenticated";
grant SELECT ("city") on public."gigs" to "authenticated";
grant UPDATE ("city") on public."gigs" to "authenticated";
grant INSERT ("created_at") on public."gigs" to "authenticated";
grant SELECT ("created_at") on public."gigs" to "authenticated";
grant INSERT ("created_by") on public."gigs" to "authenticated";
grant SELECT ("created_by") on public."gigs" to "authenticated";
grant INSERT ("fee_cents") on public."gigs" to "authenticated";
grant SELECT ("fee_cents") on public."gigs" to "authenticated";
grant UPDATE ("fee_cents") on public."gigs" to "authenticated";
grant INSERT ("id") on public."gigs" to "authenticated";
grant SELECT ("id") on public."gigs" to "authenticated";
grant INSERT ("notes") on public."gigs" to "authenticated";
grant SELECT ("notes") on public."gigs" to "authenticated";
grant UPDATE ("notes") on public."gigs" to "authenticated";
grant INSERT ("promo_image_url") on public."gigs" to "authenticated";
grant SELECT ("promo_image_url") on public."gigs" to "authenticated";
grant UPDATE ("promo_image_url") on public."gigs" to "authenticated";
grant INSERT ("starts_at") on public."gigs" to "authenticated";
grant SELECT ("starts_at") on public."gigs" to "authenticated";
grant UPDATE ("starts_at") on public."gigs" to "authenticated";
grant INSERT ("status") on public."gigs" to "authenticated";
grant SELECT ("status") on public."gigs" to "authenticated";
grant UPDATE ("status") on public."gigs" to "authenticated";
grant INSERT ("title") on public."gigs" to "authenticated";
grant SELECT ("title") on public."gigs" to "authenticated";
grant UPDATE ("title") on public."gigs" to "authenticated";
grant INSERT ("updated_at") on public."gigs" to "authenticated";
grant SELECT ("updated_at") on public."gigs" to "authenticated";
grant INSERT ("venue") on public."gigs" to "authenticated";
grant SELECT ("venue") on public."gigs" to "authenticated";
grant UPDATE ("venue") on public."gigs" to "authenticated";
grant INSERT ("venue_id") on public."gigs" to "authenticated";
grant SELECT ("venue_id") on public."gigs" to "authenticated";
grant UPDATE ("venue_id") on public."gigs" to "authenticated";
grant SELECT ("created_at") on public."profiles" to "authenticated";
grant SELECT ("display_name") on public."profiles" to "authenticated";
grant SELECT ("first_name") on public."profiles" to "authenticated";
grant SELECT ("full_name") on public."profiles" to "authenticated";
grant SELECT ("id") on public."profiles" to "authenticated";
grant SELECT ("is_super_user") on public."profiles" to "authenticated";
grant SELECT ("last_name") on public."profiles" to "authenticated";
grant SELECT ("agency_id") on public."task_status_view" to "authenticated";
grant SELECT ("assigned_to") on public."task_status_view" to "authenticated";
grant SELECT ("completed_at") on public."task_status_view" to "authenticated";
grant SELECT ("created_at") on public."task_status_view" to "authenticated";
grant SELECT ("due_at") on public."task_status_view" to "authenticated";
grant SELECT ("entity_id") on public."task_status_view" to "authenticated";
grant SELECT ("entity_type") on public."task_status_view" to "authenticated";
grant SELECT ("escalated_at") on public."task_status_view" to "authenticated";
grant SELECT ("escalation_level") on public."task_status_view" to "authenticated";
grant SELECT ("escalation_workflow_event_id") on public."task_status_view" to "authenticated";
grant SELECT ("id") on public."task_status_view" to "authenticated";
grant SELECT ("is_due_soon") on public."task_status_view" to "authenticated";
grant SELECT ("is_due_today") on public."task_status_view" to "authenticated";
grant SELECT ("is_escalated") on public."task_status_view" to "authenticated";
grant SELECT ("is_overdue") on public."task_status_view" to "authenticated";
grant SELECT ("metadata") on public."task_status_view" to "authenticated";
grant SELECT ("notes") on public."task_status_view" to "authenticated";
grant SELECT ("overdue_days") on public."task_status_view" to "authenticated";
grant SELECT ("summary") on public."task_status_view" to "authenticated";
grant INSERT ("activity_type") on public."venue_activity" to "authenticated";
grant SELECT ("activity_type") on public."venue_activity" to "authenticated";
grant UPDATE ("activity_type") on public."venue_activity" to "authenticated";
grant INSERT ("actor_id") on public."venue_activity" to "authenticated";
grant SELECT ("actor_id") on public."venue_activity" to "authenticated";
grant UPDATE ("actor_id") on public."venue_activity" to "authenticated";
grant INSERT ("agency_id") on public."venue_activity" to "authenticated";
grant SELECT ("agency_id") on public."venue_activity" to "authenticated";
grant UPDATE ("agency_id") on public."venue_activity" to "authenticated";
grant INSERT ("created_at") on public."venue_activity" to "authenticated";
grant SELECT ("created_at") on public."venue_activity" to "authenticated";
grant UPDATE ("created_at") on public."venue_activity" to "authenticated";
grant INSERT ("id") on public."venue_activity" to "authenticated";
grant SELECT ("id") on public."venue_activity" to "authenticated";
grant UPDATE ("id") on public."venue_activity" to "authenticated";
grant INSERT ("metadata") on public."venue_activity" to "authenticated";
grant SELECT ("metadata") on public."venue_activity" to "authenticated";
grant UPDATE ("metadata") on public."venue_activity" to "authenticated";
grant INSERT ("summary") on public."venue_activity" to "authenticated";
grant SELECT ("summary") on public."venue_activity" to "authenticated";
grant UPDATE ("summary") on public."venue_activity" to "authenticated";
grant INSERT ("venue_id") on public."venue_activity" to "authenticated";
grant SELECT ("venue_id") on public."venue_activity" to "authenticated";
grant UPDATE ("venue_id") on public."venue_activity" to "authenticated";
grant INSERT ("agency_id") on public."venue_contacts" to "authenticated";
grant SELECT ("agency_id") on public."venue_contacts" to "authenticated";
grant UPDATE ("agency_id") on public."venue_contacts" to "authenticated";
grant INSERT ("can_confirm_bookings") on public."venue_contacts" to "authenticated";
grant SELECT ("can_confirm_bookings") on public."venue_contacts" to "authenticated";
grant UPDATE ("can_confirm_bookings") on public."venue_contacts" to "authenticated";
grant INSERT ("can_manage_availability") on public."venue_contacts" to "authenticated";
grant SELECT ("can_manage_availability") on public."venue_contacts" to "authenticated";
grant UPDATE ("can_manage_availability") on public."venue_contacts" to "authenticated";
grant INSERT ("can_view_venue_calendar") on public."venue_contacts" to "authenticated";
grant SELECT ("can_view_venue_calendar") on public."venue_contacts" to "authenticated";
grant UPDATE ("can_view_venue_calendar") on public."venue_contacts" to "authenticated";
grant INSERT ("created_at") on public."venue_contacts" to "authenticated";
grant SELECT ("created_at") on public."venue_contacts" to "authenticated";
grant UPDATE ("created_at") on public."venue_contacts" to "authenticated";
grant INSERT ("created_by") on public."venue_contacts" to "authenticated";
grant SELECT ("created_by") on public."venue_contacts" to "authenticated";
grant UPDATE ("created_by") on public."venue_contacts" to "authenticated";
grant INSERT ("email") on public."venue_contacts" to "authenticated";
grant SELECT ("email") on public."venue_contacts" to "authenticated";
grant UPDATE ("email") on public."venue_contacts" to "authenticated";
grant INSERT ("id") on public."venue_contacts" to "authenticated";
grant SELECT ("id") on public."venue_contacts" to "authenticated";
grant UPDATE ("id") on public."venue_contacts" to "authenticated";
grant INSERT ("is_primary") on public."venue_contacts" to "authenticated";
grant SELECT ("is_primary") on public."venue_contacts" to "authenticated";
grant UPDATE ("is_primary") on public."venue_contacts" to "authenticated";
grant INSERT ("name") on public."venue_contacts" to "authenticated";
grant SELECT ("name") on public."venue_contacts" to "authenticated";
grant UPDATE ("name") on public."venue_contacts" to "authenticated";
grant INSERT ("notes") on public."venue_contacts" to "authenticated";
grant SELECT ("notes") on public."venue_contacts" to "authenticated";
grant UPDATE ("notes") on public."venue_contacts" to "authenticated";
grant INSERT ("phone") on public."venue_contacts" to "authenticated";
grant SELECT ("phone") on public."venue_contacts" to "authenticated";
grant UPDATE ("phone") on public."venue_contacts" to "authenticated";
grant INSERT ("portal_enabled") on public."venue_contacts" to "authenticated";
grant SELECT ("portal_enabled") on public."venue_contacts" to "authenticated";
grant UPDATE ("portal_enabled") on public."venue_contacts" to "authenticated";
grant INSERT ("portal_invited_at") on public."venue_contacts" to "authenticated";
grant SELECT ("portal_invited_at") on public."venue_contacts" to "authenticated";
grant UPDATE ("portal_invited_at") on public."venue_contacts" to "authenticated";
grant INSERT ("portal_last_seen_at") on public."venue_contacts" to "authenticated";
grant SELECT ("portal_last_seen_at") on public."venue_contacts" to "authenticated";
grant UPDATE ("portal_last_seen_at") on public."venue_contacts" to "authenticated";
grant INSERT ("profile_id") on public."venue_contacts" to "authenticated";
grant SELECT ("profile_id") on public."venue_contacts" to "authenticated";
grant UPDATE ("profile_id") on public."venue_contacts" to "authenticated";
grant INSERT ("role") on public."venue_contacts" to "authenticated";
grant SELECT ("role") on public."venue_contacts" to "authenticated";
grant UPDATE ("role") on public."venue_contacts" to "authenticated";
grant INSERT ("updated_at") on public."venue_contacts" to "authenticated";
grant SELECT ("updated_at") on public."venue_contacts" to "authenticated";
grant UPDATE ("updated_at") on public."venue_contacts" to "authenticated";
grant INSERT ("updated_by") on public."venue_contacts" to "authenticated";
grant SELECT ("updated_by") on public."venue_contacts" to "authenticated";
grant UPDATE ("updated_by") on public."venue_contacts" to "authenticated";
grant INSERT ("venue_id") on public."venue_contacts" to "authenticated";
grant SELECT ("venue_id") on public."venue_contacts" to "authenticated";
grant UPDATE ("venue_id") on public."venue_contacts" to "authenticated";
grant INSERT ("agency_id") on public."venue_feedback" to "authenticated";
grant SELECT ("agency_id") on public."venue_feedback" to "authenticated";
grant UPDATE ("agency_id") on public."venue_feedback" to "authenticated";
grant INSERT ("artist_id") on public."venue_feedback" to "authenticated";
grant SELECT ("artist_id") on public."venue_feedback" to "authenticated";
grant UPDATE ("artist_id") on public."venue_feedback" to "authenticated";
grant INSERT ("author_id") on public."venue_feedback" to "authenticated";
grant SELECT ("author_id") on public."venue_feedback" to "authenticated";
grant UPDATE ("author_id") on public."venue_feedback" to "authenticated";
grant INSERT ("content") on public."venue_feedback" to "authenticated";
grant SELECT ("content") on public."venue_feedback" to "authenticated";
grant UPDATE ("content") on public."venue_feedback" to "authenticated";
grant INSERT ("created_at") on public."venue_feedback" to "authenticated";
grant SELECT ("created_at") on public."venue_feedback" to "authenticated";
grant UPDATE ("created_at") on public."venue_feedback" to "authenticated";
grant INSERT ("feedback_type") on public."venue_feedback" to "authenticated";
grant SELECT ("feedback_type") on public."venue_feedback" to "authenticated";
grant UPDATE ("feedback_type") on public."venue_feedback" to "authenticated";
grant INSERT ("gig_id") on public."venue_feedback" to "authenticated";
grant SELECT ("gig_id") on public."venue_feedback" to "authenticated";
grant UPDATE ("gig_id") on public."venue_feedback" to "authenticated";
grant INSERT ("id") on public."venue_feedback" to "authenticated";
grant SELECT ("id") on public."venue_feedback" to "authenticated";
grant UPDATE ("id") on public."venue_feedback" to "authenticated";
grant INSERT ("rating") on public."venue_feedback" to "authenticated";
grant SELECT ("rating") on public."venue_feedback" to "authenticated";
grant UPDATE ("rating") on public."venue_feedback" to "authenticated";
grant INSERT ("updated_at") on public."venue_feedback" to "authenticated";
grant SELECT ("updated_at") on public."venue_feedback" to "authenticated";
grant UPDATE ("updated_at") on public."venue_feedback" to "authenticated";
grant INSERT ("venue_id") on public."venue_feedback" to "authenticated";
grant SELECT ("venue_id") on public."venue_feedback" to "authenticated";
grant UPDATE ("venue_id") on public."venue_feedback" to "authenticated";
grant INSERT ("agency_id") on public."venue_tags" to "authenticated";
grant SELECT ("agency_id") on public."venue_tags" to "authenticated";
grant UPDATE ("agency_id") on public."venue_tags" to "authenticated";
grant INSERT ("created_at") on public."venue_tags" to "authenticated";
grant SELECT ("created_at") on public."venue_tags" to "authenticated";
grant UPDATE ("created_at") on public."venue_tags" to "authenticated";
grant INSERT ("id") on public."venue_tags" to "authenticated";
grant SELECT ("id") on public."venue_tags" to "authenticated";
grant UPDATE ("id") on public."venue_tags" to "authenticated";
grant INSERT ("tag_id") on public."venue_tags" to "authenticated";
grant SELECT ("tag_id") on public."venue_tags" to "authenticated";
grant UPDATE ("tag_id") on public."venue_tags" to "authenticated";
grant INSERT ("venue_id") on public."venue_tags" to "authenticated";
grant SELECT ("venue_id") on public."venue_tags" to "authenticated";
grant UPDATE ("venue_id") on public."venue_tags" to "authenticated";
grant INSERT ("address_line1") on public."venues" to "authenticated";
grant SELECT ("address_line1") on public."venues" to "authenticated";
grant UPDATE ("address_line1") on public."venues" to "authenticated";
grant INSERT ("address_line2") on public."venues" to "authenticated";
grant SELECT ("address_line2") on public."venues" to "authenticated";
grant UPDATE ("address_line2") on public."venues" to "authenticated";
grant INSERT ("agency_id") on public."venues" to "authenticated";
grant SELECT ("agency_id") on public."venues" to "authenticated";
grant UPDATE ("agency_id") on public."venues" to "authenticated";
grant INSERT ("capacity") on public."venues" to "authenticated";
grant SELECT ("capacity") on public."venues" to "authenticated";
grant UPDATE ("capacity") on public."venues" to "authenticated";
grant INSERT ("city") on public."venues" to "authenticated";
grant SELECT ("city") on public."venues" to "authenticated";
grant UPDATE ("city") on public."venues" to "authenticated";
grant INSERT ("country") on public."venues" to "authenticated";
grant SELECT ("country") on public."venues" to "authenticated";
grant UPDATE ("country") on public."venues" to "authenticated";
grant INSERT ("created_at") on public."venues" to "authenticated";
grant SELECT ("created_at") on public."venues" to "authenticated";
grant UPDATE ("created_at") on public."venues" to "authenticated";
grant INSERT ("created_by") on public."venues" to "authenticated";
grant SELECT ("created_by") on public."venues" to "authenticated";
grant UPDATE ("created_by") on public."venues" to "authenticated";
grant INSERT ("display_address") on public."venues" to "authenticated";
grant SELECT ("display_address") on public."venues" to "authenticated";
grant UPDATE ("display_address") on public."venues" to "authenticated";
grant INSERT ("google_maps_url") on public."venues" to "authenticated";
grant SELECT ("google_maps_url") on public."venues" to "authenticated";
grant UPDATE ("google_maps_url") on public."venues" to "authenticated";
grant INSERT ("google_place_id") on public."venues" to "authenticated";
grant SELECT ("google_place_id") on public."venues" to "authenticated";
grant UPDATE ("google_place_id") on public."venues" to "authenticated";
grant INSERT ("id") on public."venues" to "authenticated";
grant SELECT ("id") on public."venues" to "authenticated";
grant UPDATE ("id") on public."venues" to "authenticated";
grant INSERT ("latitude") on public."venues" to "authenticated";
grant SELECT ("latitude") on public."venues" to "authenticated";
grant UPDATE ("latitude") on public."venues" to "authenticated";
grant INSERT ("longitude") on public."venues" to "authenticated";
grant SELECT ("longitude") on public."venues" to "authenticated";
grant UPDATE ("longitude") on public."venues" to "authenticated";
grant INSERT ("name") on public."venues" to "authenticated";
grant SELECT ("name") on public."venues" to "authenticated";
grant UPDATE ("name") on public."venues" to "authenticated";
grant INSERT ("notes") on public."venues" to "authenticated";
grant SELECT ("notes") on public."venues" to "authenticated";
grant UPDATE ("notes") on public."venues" to "authenticated";
grant INSERT ("postcode") on public."venues" to "authenticated";
grant SELECT ("postcode") on public."venues" to "authenticated";
grant UPDATE ("postcode") on public."venues" to "authenticated";
grant INSERT ("record_owner_id") on public."venues" to "authenticated";
grant SELECT ("record_owner_id") on public."venues" to "authenticated";
grant UPDATE ("record_owner_id") on public."venues" to "authenticated";
grant INSERT ("region") on public."venues" to "authenticated";
grant SELECT ("region") on public."venues" to "authenticated";
grant UPDATE ("region") on public."venues" to "authenticated";
grant INSERT ("status") on public."venues" to "authenticated";
grant SELECT ("status") on public."venues" to "authenticated";
grant UPDATE ("status") on public."venues" to "authenticated";
grant INSERT ("updated_at") on public."venues" to "authenticated";
grant SELECT ("updated_at") on public."venues" to "authenticated";
grant UPDATE ("updated_at") on public."venues" to "authenticated";
grant INSERT ("updated_by") on public."venues" to "authenticated";
grant SELECT ("updated_by") on public."venues" to "authenticated";
grant UPDATE ("updated_by") on public."venues" to "authenticated";
grant INSERT ("website") on public."venues" to "authenticated";
grant SELECT ("website") on public."venues" to "authenticated";
grant UPDATE ("website") on public."venues" to "authenticated";
grant INSERT ("actor_user_id") on public."workflow_events" to "authenticated";
grant SELECT ("actor_user_id") on public."workflow_events" to "authenticated";
grant INSERT ("agency_id") on public."workflow_events" to "authenticated";
grant SELECT ("agency_id") on public."workflow_events" to "authenticated";
grant INSERT ("created_at") on public."workflow_events" to "authenticated";
grant SELECT ("created_at") on public."workflow_events" to "authenticated";
grant INSERT ("entity_id") on public."workflow_events" to "authenticated";
grant SELECT ("entity_id") on public."workflow_events" to "authenticated";
grant INSERT ("entity_type") on public."workflow_events" to "authenticated";
grant SELECT ("entity_type") on public."workflow_events" to "authenticated";
grant INSERT ("event_type") on public."workflow_events" to "authenticated";
grant SELECT ("event_type") on public."workflow_events" to "authenticated";
grant INSERT ("id") on public."workflow_events" to "authenticated";
grant SELECT ("id") on public."workflow_events" to "authenticated";
grant INSERT ("metadata") on public."workflow_events" to "authenticated";
grant SELECT ("metadata") on public."workflow_events" to "authenticated";
grant INSERT ("occurred_at") on public."workflow_events" to "authenticated";
grant SELECT ("occurred_at") on public."workflow_events" to "authenticated";
commit;
