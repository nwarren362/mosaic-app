-- Prepared only. Requires the unreleased contact email delivery migration.
begin;
alter table public.agency_email_senders add column last_test_id uuid;
create table public.agency_email_settings_audit (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('save','check_start','check_passed','check_failed','enable','disable')),
  revision uuid not null,
  created_at timestamptz not null default now()
);
alter table public.agency_email_settings_audit enable row level security;
revoke all on public.agency_email_settings_audit from public,anon,authenticated,service_role;

create function public.read_agency_email_settings(p_actor uuid,p_agency uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.agency_email_senders;
begin
  if not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=p_actor and role='admin') then
    raise exception 'Agency admin required' using errcode='42501';
  end if;
  select * into s from public.agency_email_senders where agency_id=p_agency;
  if not found then return null;end if;
  -- Server-only response. HTTP handler must explicitly project safe public fields.
  return to_jsonb(s);
end$$;

create function public.save_agency_email_settings(p_actor uuid,p_agency uuid,p_revision uuid,p_name text,p_email text,p_port integer,p_encrypted text)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision uuid; new_revision uuid;
begin
  if not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=p_actor and role='admin') then
    raise exception 'Agency admin required' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,0));
  select revision into current_revision from public.agency_email_senders where agency_id=p_agency for update;
  if current_revision is distinct from p_revision then raise exception 'Settings changed; reload first' using errcode='40001';end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_name ~ '[<>\r\n]' or
     p_email is null or p_email !~ '^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' or
     p_port is null or p_port not in (465,587) or p_encrypted is null or p_encrypted !~ '^v1:' or length(p_encrypted)>12000 then
    raise exception 'Invalid sender configuration' using errcode='22023';
  end if;
  insert into public.agency_email_senders(agency_id,from_name,from_email,smtp_host,smtp_port,smtp_username,encrypted_password,updated_by)
    values(p_agency,btrim(p_name),p_email,'smtp.ionos.co.uk',p_port,p_email,p_encrypted,p_actor)
    on conflict(agency_id) do update set from_name=excluded.from_name,from_email=excluded.from_email,smtp_port=excluded.smtp_port,smtp_username=excluded.smtp_username,
      encrypted_password=excluded.encrypted_password,revision=gen_random_uuid(),updated_by=p_actor,updated_at=now(),enabled=false,verified_at=null,
      authorised_at=null,authorised_by=null,last_test_id=null
    returning revision into new_revision;
  insert into public.agency_email_settings_audit(agency_id,actor_id,action,revision) values(p_agency,p_actor,'save',new_revision);
end$$;

create function public.change_agency_email_settings(p_actor uuid,p_agency uuid,p_revision uuid,p_action text,p_test uuid default null,p_authorised boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.agency_email_senders; test_id uuid;
begin
  if not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=p_actor and role='admin') then
    raise exception 'Agency admin required' using errcode='42501';
  end if;
  select * into s from public.agency_email_senders where agency_id=p_agency for update;
  if not found or s.revision is distinct from p_revision then raise exception 'Settings changed; reload first' using errcode='40001';end if;
  case p_action
  when 'check_start' then
    if s.last_test_attempt_at>now()-interval '1 minute' then raise exception 'Wait one minute before another check' using errcode='54000';end if;
    test_id:=gen_random_uuid();
    update public.agency_email_senders set last_test_id=test_id,last_test_attempt_at=now(),verified_at=null,enabled=false where agency_id=p_agency;
  when 'check_passed','check_failed' then
    if p_test is null or p_test is distinct from s.last_test_id then raise exception 'Connection check changed' using errcode='40001';end if;
    update public.agency_email_senders set verified_at=case when p_action='check_passed' then now() else null end,last_test_id=null,enabled=false where agency_id=p_agency;
  when 'enable' then
    if not p_authorised or p_authorised is null then raise exception 'Sender authorisation required' using errcode='22023';end if;
    if s.verified_at is null or s.verified_at<now()-interval '1 day' then raise exception 'Check the connection before enabling' using errcode='55000';end if;
    update public.agency_email_senders set enabled=true,authorised_at=now(),authorised_by=p_actor where agency_id=p_agency;
  when 'disable' then
    update public.agency_email_senders set enabled=false where agency_id=p_agency;
  else raise exception 'Invalid action' using errcode='22023';
  end case;
  insert into public.agency_email_settings_audit(agency_id,actor_id,action,revision) values(p_agency,p_actor,p_action,s.revision);
  return jsonb_build_object('testId',test_id);
end$$;
revoke all on function public.read_agency_email_settings(uuid,uuid),public.save_agency_email_settings(uuid,uuid,uuid,text,text,integer,text),public.change_agency_email_settings(uuid,uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.read_agency_email_settings(uuid,uuid),public.save_agency_email_settings(uuid,uuid,uuid,text,text,integer,text),public.change_agency_email_settings(uuid,uuid,uuid,text,uuid,boolean) to service_role;
commit;
