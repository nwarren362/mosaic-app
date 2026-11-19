// Minimal managed-platform contracts for native tests, not a Supabase emulator.
export const platformContract = `create role postgres nosuperuser bypassrls;create role anon;create role authenticated;create role service_role bypassrls;
    create role supabase_auth_admin;create role supabase_storage_admin;create role dashboard_user;
    create schema extensions;grant usage on schema extensions to anon,authenticated,service_role,postgres;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,postgres;grant select,update on auth.users to postgres;
    create schema storage;create table storage.objects(id uuid,name text,bucket_id text,owner uuid,owner_id text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    grant usage on schema storage to anon,authenticated;`;
