-- Align permanent artist deletion with the existing admin-only venue deletion rule.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if not (select relrowsecurity from pg_class where oid='public.artists'::regclass) then
  raise exception 'Artist RLS is missing';
 end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='artists' and cmd in ('DELETE','ALL'))<>1
 or not exists(select 1 from pg_policies where schemaname='public' and tablename='artists' and policyname='artists_delete_member' and cmd='DELETE' and qual='is_agency_member(agency_id)') then
  raise exception 'Artist delete policies changed; inspect before applying';
 end if;
end;
$guard$;
alter policy artists_delete_member on public.artists using(public.is_agency_admin(agency_id));
alter policy artists_delete_member on public.artists rename to artists_delete_admin_or_super;
commit;
