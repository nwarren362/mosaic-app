-- Synthetic additions for administration browser acceptance only.
update public.agency_memberships set role='admin' where agency_id='00000000-0000-4000-8000-000000000102';
insert into public.agency_memberships(agency_id,user_id,role) values('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','admin');
update public.profiles set is_super_user=true where id='00000000-0000-4000-8000-000000000003';
create table public.agency_invitations(
 id uuid primary key default gen_random_uuid(),agency_id uuid not null references public.agencies(id),
 email text not null,role text not null,token_hash bytea not null unique,
 invited_by uuid references auth.users(id),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid references auth.users(id),created_at timestamptz not null default now()
);
alter table public.agency_invitations enable row level security;
create policy invites_select_admin on public.agency_invitations for select to authenticated using(public.is_agency_admin(agency_id));
create policy invites_insert_admin on public.agency_invitations for insert to authenticated with check(public.is_agency_admin(agency_id));
create policy invites_update_admin on public.agency_invitations for update to authenticated using(public.is_agency_admin(agency_id)) with check(public.is_agency_admin(agency_id));
create policy invites_delete_admin on public.agency_invitations for delete to authenticated using(public.is_agency_admin(agency_id));
grant select,insert,update,delete on public.agency_invitations to authenticated;
create function public.invite_token_hash(p_token text) returns bytea language sql immutable as $$select sha256(convert_to(p_token,'utf8'))$$;
