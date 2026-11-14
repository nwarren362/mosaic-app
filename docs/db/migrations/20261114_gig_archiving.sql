-- Gig archiving: no physical deletion of gigs/history by application users.
-- Apply before deploying the matching UI; no existing creator is guessed/backfilled.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.gigs, public.activity_log in access exclusive mode;

do $guard$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='gigs' and column_name='archived_at')
     or to_regprocedure('public.archive_gig(uuid,uuid,text,boolean,boolean)') is not null then
    raise exception 'Gig archive schema exists; inspect instead of reapplying';
  end if;
  if (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='gigs') is distinct from
    '[{"cmd":"DELETE","permissive":"PERMISSIVE","policyname":"gigs_delete_admin_only","qual":"(EXISTS ( SELECT 1\n   FROM agency_memberships m\n  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id) AND (m.role = ''admin''::text))))","roles":["authenticated"],"schemaname":"public","tablename":"gigs","with_check":null},{"cmd":"DELETE","permissive":"PERMISSIVE","policyname":"gigs_delete_agency_members","qual":"(EXISTS ( SELECT 1\n   FROM agency_memberships m\n  WHERE ((m.agency_id = gigs.agency_id) AND (m.user_id = auth.uid()))))","roles":["public"],"schemaname":"public","tablename":"gigs","with_check":null},{"cmd":"INSERT","permissive":"PERMISSIVE","policyname":"gigs_insert_agency_members","qual":null,"roles":["authenticated"],"schemaname":"public","tablename":"gigs","with_check":"(EXISTS ( SELECT 1\n   FROM agency_memberships m\n  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id))))"},{"cmd":"SELECT","permissive":"PERMISSIVE","policyname":"gigs_select_agency_members","qual":"(EXISTS ( SELECT 1\n   FROM agency_memberships m\n  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id))))","roles":["authenticated"],"schemaname":"public","tablename":"gigs","with_check":null},{"cmd":"UPDATE","permissive":"PERMISSIVE","policyname":"gigs_update_agency_members","qual":"(EXISTS ( SELECT 1\n   FROM agency_memberships m\n  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id))))","roles":["authenticated"],"schemaname":"public","tablename":"gigs","with_check":"(EXISTS ( SELECT 1\n   FROM agency_memberships m\n  WHERE ((m.user_id = auth.uid()) AND (m.agency_id = gigs.agency_id))))"}]'::jsonb then
    raise exception 'Gig policies changed; review before applying';
  end if;
  if (select count(*) from pg_class where oid in ('public.gigs'::regclass,'public.activity_log'::regclass,'public.workflow_events'::regclass,'public.agency_memberships'::regclass) and relrowsecurity)<>4 then
    raise exception 'Expected tenant RLS is missing';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conrelid='public.gigs'::regclass and conname='gigs_artist_id_fkey'),true)
      is distinct from 'FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE' then
    raise exception 'Gig artist relationship changed; review before applying';
  end if;
end;
$guard$;

alter table public.gigs
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add column archive_reason text,
  add constraint gigs_archive_state_check check (
    (archived_at is null and archived_by is null and archive_reason is null)
    or (archived_at is not null and status='cancelled' and archive_reason is not null and length(btrim(archive_reason)) between 3 and 1000)
  );
-- Preserve archived/history-bearing gigs if someone tries to delete their artist.
alter table public.gigs drop constraint gigs_artist_id_fkey;
alter table public.gigs add constraint gigs_artist_id_fkey foreign key(artist_id) references public.artists(id) on delete restrict;

create function public.guard_gig_lifecycle() returns trigger
language plpgsql set search_path='' as $function$
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
$function$;
create trigger guard_gig_lifecycle before insert or update on public.gigs
for each row execute function public.guard_gig_lifecycle();

-- Prevent reopening/relocating archived history and race-safe creation of new open tasks.
create function public.guard_archived_gig_activity() returns trigger
language plpgsql security definer set search_path='' as $function$
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
$function$;
create trigger guard_archived_gig_activity before insert or update or delete on public.activity_log
for each row execute function public.guard_archived_gig_activity();

-- Application users can edit live gig details, but cannot spoof ownership/archive state.
revoke delete,update on public.gigs from authenticated;
revoke update(id,agency_id,created_by,created_at,updated_at,archived_at,archived_by,archive_reason) on public.gigs from authenticated;
grant update(artist_id,title,venue,city,starts_at,status,fee_cents,notes,venue_id,promo_image_url) on public.gigs to authenticated;
drop policy gigs_delete_admin_only on public.gigs;
drop policy gigs_delete_agency_members on public.gigs;
alter policy gigs_update_agency_members on public.gigs
using (archived_at is null and public.is_agency_member(agency_id))
with check (archived_at is null and public.is_agency_member(agency_id));

create function public.archive_gig(
 p_gig_id uuid,p_agency_id uuid,p_reason text,
 p_communications_complete boolean,p_obligations_settled boolean
) returns jsonb language plpgsql security definer set search_path='' as $function$
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
$function$;
revoke all on function public.archive_gig(uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.archive_gig(uuid,uuid,text,boolean,boolean) to authenticated;
revoke all on function public.guard_gig_lifecycle(),public.guard_archived_gig_activity() from public,anon,authenticated;
commit;
