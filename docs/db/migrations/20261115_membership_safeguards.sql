-- Preserve agency administration while retaining existing admin/super-user RLS.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.agency_memberships in share row exclusive mode;
do $guard$
begin
 if to_regprocedure('public.guard_agency_membership()') is not null then
   raise exception 'Membership guard exists; inspect instead of reapplying';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.agency_memberships'::regclass) then
   raise exception 'Membership RLS is missing';
 end if;
 if (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='agency_memberships') is distinct from '[{"cmd":"SELECT","permissive":"PERMISSIVE","policyname":"agency_memberships_select_same_agency_members","qual":"is_agency_member(agency_id)","roles":["public"],"schemaname":"public","tablename":"agency_memberships","with_check":null},{"cmd":"DELETE","permissive":"PERMISSIVE","policyname":"memberships_delete_admin","qual":"is_agency_admin(agency_id)","roles":["authenticated"],"schemaname":"public","tablename":"agency_memberships","with_check":null},{"cmd":"INSERT","permissive":"PERMISSIVE","policyname":"memberships_insert_admin","qual":null,"roles":["authenticated"],"schemaname":"public","tablename":"agency_memberships","with_check":"is_agency_admin(agency_id)"},{"cmd":"SELECT","permissive":"PERMISSIVE","policyname":"memberships_select_self_or_admin","qual":"((user_id = auth.uid()) OR is_agency_admin(agency_id))","roles":["authenticated"],"schemaname":"public","tablename":"agency_memberships","with_check":null},{"cmd":"UPDATE","permissive":"PERMISSIVE","policyname":"memberships_update_admin","qual":"is_agency_admin(agency_id)","roles":["authenticated"],"schemaname":"public","tablename":"agency_memberships","with_check":"is_agency_admin(agency_id)"}]'::jsonb then
   raise exception 'Membership policies changed; inspect before applying';
 end if;
 if exists(select 1 from public.agencies a where not exists(select 1 from public.agency_memberships m where m.agency_id=a.id and m.role='admin')) then
   raise exception 'An agency has no administrator; resolve ownership before applying';
 end if;
end;
$guard$;

create function public.guard_agency_membership() returns trigger
language plpgsql security definer set search_path='' as $function$
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
$function$;
create trigger guard_agency_membership before update or delete on public.agency_memberships
for each row execute function public.guard_agency_membership();
revoke all on function public.guard_agency_membership() from public,anon,authenticated;
-- Roles remain editable through admin-scoped RLS; identity/timestamp are immutable for app users.
revoke update on public.agency_memberships from authenticated;
revoke update(agency_id,user_id,created_at) on public.agency_memberships from authenticated;
grant update(role) on public.agency_memberships to authenticated;
commit;
