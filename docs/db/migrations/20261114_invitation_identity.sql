-- Bind invitations to the current verified Auth identity; preserve existing membership roles.
-- Prepare/rehearse locally and inspect a fresh live preflight before applying.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $guard$
begin
  if to_regprocedure('public.accept_agency_invitation(text)') is null
    or (select count(*) from information_schema.columns where table_schema='auth' and table_name='users' and column_name in ('id','email','email_confirmed_at'))<>3 then
    raise exception 'Invitation/Auth prerequisites changed; inspect before applying';
  end if;
  if pg_get_functiondef('public.accept_agency_invitation(text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.accept_agency_invitation(p_token text)
 RETURNS agency_memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare
  v_hash bytea := public.invite_token_hash(p_token);
  v_inv public.agency_invitations;
  v_membership public.agency_memberships;
begin
  if auth.uid() is null then
    raise exception ''Must be authenticated to accept an invitation'';
  end if;

  select *
    into v_inv
  from public.agency_invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception ''Invalid invitation token'';
  end if;

  if v_inv.accepted_at is not null then
    raise exception ''Invitation already accepted'';
  end if;

  if v_inv.expires_at <= now() then
    raise exception ''Invitation has expired'';
  end if;

  -- Upsert membership
  insert into public.agency_memberships (agency_id, user_id, role)
  values (v_inv.agency_id, auth.uid(), v_inv.role)
  on conflict (agency_id, user_id) do update
    set role = excluded.role
  returning * into v_membership;

  -- Mark accepted
  update public.agency_invitations
     set accepted_at = now(),
         accepted_by = auth.uid()
   where id = v_inv.id;

  return v_membership;
end;
$function$
' then
    raise exception 'Invitation function changed; inspect before applying';
  end if;
end;
$guard$;

create or replace function public.accept_agency_invitation(p_token text)
returns public.agency_memberships language plpgsql security definer set search_path='' as $function$
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
$function$;
revoke all on function public.accept_agency_invitation(text) from public,anon,authenticated;
grant execute on function public.accept_agency_invitation(text) to authenticated;
commit;
