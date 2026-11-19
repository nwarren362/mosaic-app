-- DB-08: narrow application schema/function privileges; preserve platform extensions.
-- Rehearse against the 19 November baseline; do not apply on drift.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$ begin
 if (select pg_get_userbyid(nspowner) from pg_namespace where nspname='public')<>'postgres' then
  raise exception 'Public schema owner changed; inspect before applying';
 end if;
 if (select jsonb_object_agg(proname||'('||pg_get_function_identity_arguments(oid)||')',md5(pg_get_functiondef(oid))) from pg_proc where pronamespace='public'::regnamespace and proname in ('accept_agency_invitation','archive_gig','current_user_id','guard_agency_membership','guard_archived_gig_activity','guard_gig_lifecycle','handle_new_user','invite_token_hash','is_agency_admin','is_agency_member','is_super_user','monitor_health','set_updated_at')) is distinct from $expected${"accept_agency_invitation(p_token text)":"bf71e39bb2a0986982822fa0597e616a","archive_gig(p_gig_id uuid, p_agency_id uuid, p_reason text, p_communications_complete boolean, p_obligations_settled boolean)":"5e5363977ef9f1a55ca9ab234f84f10b","current_user_id()":"343abfad241a7722a8a229f282415dfe","guard_agency_membership()":"c2952cbeba3532ae8642b042e14013bf","guard_archived_gig_activity()":"dea3dace40586a39669498e8c2fd4b1c","guard_gig_lifecycle()":"c6bd8efde27804a108371960480e3282","handle_new_user()":"aab54b481a7f86765a3788ac609f50f7","invite_token_hash(p_token text)":"e1986f4e2230109520215e55ed2ba99f","is_agency_admin(p_agency_id uuid)":"aeed73f28e8435da27a2c6ab400dab19","is_agency_member(p_agency_id uuid)":"08099145c50996d648899af52791864d","is_super_user()":"73207ac97ad57b7f1606ada9d0f96a5b","monitor_health()":"42b6ad1916b091893960de1ec55707cc","set_updated_at()":"4d6804d5850641a33867814c9e76a714"}$expected$::jsonb then
  raise exception 'Application functions changed; inspect before applying';
 end if;
 if not has_function_privilege('anon','public.monitor_health()','execute')
 or has_function_privilege('anon','public.accept_agency_invitation(text)','execute')
 or has_function_privilege('anon','public.archive_gig(uuid,uuid,text,boolean,boolean)','execute') then
  raise exception 'Critical RPC grants changed; inspect before applying';
 end if;
end;$guard$;
revoke create on schema public from public,anon,authenticated;
alter function public.current_user_id() set search_path='';
revoke execute on function public.current_user_id() from public,anon;
grant execute on function public.current_user_id() to authenticated;
alter function public.handle_new_user() set search_path='';
revoke execute on function public.handle_new_user() from public,anon;
revoke execute on function public.handle_new_user() from authenticated;
alter function public.invite_token_hash(p_token text) set search_path='';
revoke execute on function public.invite_token_hash(p_token text) from public,anon;
grant execute on function public.invite_token_hash(p_token text) to authenticated;
alter function public.is_agency_admin(p_agency_id uuid) set search_path='';
revoke execute on function public.is_agency_admin(p_agency_id uuid) from public,anon;
grant execute on function public.is_agency_admin(p_agency_id uuid) to authenticated;
alter function public.is_agency_member(p_agency_id uuid) set search_path='';
revoke execute on function public.is_agency_member(p_agency_id uuid) from public,anon;
grant execute on function public.is_agency_member(p_agency_id uuid) to authenticated;
alter function public.is_super_user() set search_path='';
revoke execute on function public.is_super_user() from public,anon;
grant execute on function public.is_super_user() to authenticated;
alter function public.set_updated_at() set search_path='';
revoke execute on function public.set_updated_at() from public,anon;
revoke execute on function public.set_updated_at() from authenticated;
commit;
