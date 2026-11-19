import json
from pathlib import Path
c=json.load(open('docs/db/audit/catalog-2026-11-19.json'))
checks=[]
def add(label,query,expected):
 checks.append(f" if ({query}) is distinct from $expected${json.dumps(expected,separators=(',',':'))}$expected$::jsonb then raise exception 'Baseline {label} drift; inspect before recording';end if;")
add('columns',"select jsonb_object_agg(table_name||'.'||column_name,jsonb_build_object('type',udt_name,'nullable',is_nullable,'default',column_default,'generated',generation_expression,'identity',is_identity)) from information_schema.columns where table_schema='public'",{x['table_name']+'.'+x['column_name']:{'type':x['udt_name'],'nullable':x['is_nullable'],'default':x['column_default'],'generated':x['generation_expression'],'identity':x['is_identity']} for x in c['columns']})
add('constraints',"select jsonb_object_agg(conrelid::regclass::text||'.'||conname,pg_get_constraintdef(oid,true)) from pg_constraint where connamespace='public'::regnamespace",{x['table']+'.'+x['name']:x['definition'] for x in c['constraints']})
add('indexes',"select jsonb_object_agg(indexname,indexdef) from pg_indexes where schemaname='public'",{x['indexname']:x['indexdef'] for x in c['indexes']})
add('policies',"select jsonb_object_agg(schemaname||'.'||tablename||'.'||policyname,to_jsonb(p)) from pg_policies p where schemaname in ('public','storage')",{x['schemaname']+'.'+x['tablename']+'.'+x['policyname']:x for x in c['policies']})
add('functions',"select jsonb_object_agg(proname||'('||pg_get_function_identity_arguments(oid)||')',pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and proowner='postgres'::regrole",{x['name']+'('+x['identity_args']+')':x['definition'] for x in c['functions'] if x['owner']=='postgres'})
add('relations',"select jsonb_object_agg(c.relname,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'options',c.reloptions,'kind',c.relkind)) from pg_class c where relnamespace='public'::regnamespace and relkind in ('r','v','p','m','f')",{x['name']:{k:x[k] for k in ['owner','rls','force_rls','options','kind']} for x in c['relations'] if x['schema']=='public'})
add('views',"select jsonb_object_agg(c.relname,pg_get_viewdef(c.oid,true)) from pg_class c where relnamespace='public'::regnamespace and relkind='v'",{x['name']:x['definition'] for x in c['views']})
add('table grants',"select jsonb_object_agg(table_name||'.'||grantee||'.'||privilege_type,is_grantable) from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated','PUBLIC','service_role')",{x['table_name']+'.'+x['grantee']+'.'+x['privilege_type']:x['is_grantable'] for x in c['table_grants'] if x['table_schema']=='public'})
add('column grants',"select jsonb_object_agg(table_name||'.'||column_name||'.'||grantee||'.'||privilege_type,is_grantable) from information_schema.column_privileges where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')",{x['table_name']+'.'+x['column_name']+'.'+x['grantee']+'.'+x['privilege_type']:x['is_grantable'] for x in c['column_grants']})
add('public schema privileges',"select to_jsonb(nspacl::text) from pg_namespace where nspname='public'",next(x['acl'] for x in c['schema_acl'] if x['schema']=='public'))
add('triggers',"select jsonb_object_agg(n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and t.tgname='on_auth_user_created'))",{x['schema']+'.'+x['table']+'.'+x['name']:{'definition':x['definition'],'enabled':x['enabled']} for x in c['triggers'] if x['schema']=='public' or (x['schema']=='auth' and x['name']=='on_auth_user_created')})
s="""-- Adopt the verified existing state; NEVER replay the CREATE baseline on this database.
-- Existing historical scripts remain evidence, not fictitious migration-history entries.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $guard$ begin
 if to_regnamespace('supabase_migrations') is not null then raise exception 'Migration schema already exists; inspect before adoption';end if;
"""+'\n'.join(checks)+"""
end;$guard$;
create schema supabase_migrations authorization postgres;
revoke all on schema supabase_migrations from public,anon,authenticated;
create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
alter table supabase_migrations.schema_migrations owner to postgres;
revoke all on supabase_migrations.schema_migrations from public,anon,authenticated;
insert into supabase_migrations.schema_migrations(version,name) values('20261119000000','application_baseline');
commit;
"""
Path('docs/db/adopt-20261119-baseline.sql').write_text(s)
