-- Read-only catalog inventory. No application/customer rows or credentials.
begin read only;
set local statement_timeout = '20s';
select jsonb_build_object(
  'server_version', current_setting('server_version'),
  'read_only', current_setting('transaction_read_only'),
  'relations', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'options',c.reloptions) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage','supabase_migrations') and c.relkind in ('r','p','v','m','f')),
  'columns', (select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.ordinal_position) from (select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,is_generated,generation_expression from information_schema.columns where table_schema='public') x),
  'constraints', (select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid,true)) order by c.conrelid::regclass::text,c.conname) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
  'indexes', (select jsonb_agg(to_jsonb(x) order by x.tablename,x.indexname) from pg_indexes x where schemaname='public'),
  'policies', (select jsonb_agg(to_jsonb(x) order by x.schemaname,x.tablename,x.policyname) from pg_policies x where schemaname in ('public','storage')),
  'views', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'definition',pg_get_viewdef(c.oid,true)) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m')),
  'functions', (select jsonb_agg(jsonb_build_object('name',p.proname,'identity_args',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
  'triggers', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage')),
  'table_grants', (select jsonb_agg(to_jsonb(x) order by x.table_schema,x.table_name,x.grantee,x.privilege_type) from information_schema.table_privileges x where table_schema in ('public','storage') and grantee in ('anon','authenticated','PUBLIC','service_role')),
  'column_grants', (select jsonb_agg(to_jsonb(x) order by x.table_name,x.column_name,x.grantee,x.privilege_type) from information_schema.column_privileges x where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')),
  'default_acl', (select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'kind',d.defaclobjtype,'acl',d.defaclacl::text)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),
  'roles', (select jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'inherit',r.rolinherit,'login',r.rolcanlogin)) from pg_roles r where r.rolname in ('anon','authenticated','service_role','postgres','authenticator')),
  'role_memberships', (select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'inherit',inherit_option,'set',set_option)) from pg_auth_members),
  'schema_acl', (select jsonb_agg(jsonb_build_object('schema',nspname,'acl',nspacl::text)) from pg_namespace where nspname in ('public','storage','auth')),
  'extensions', (select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
  'migration_history_exists', to_regclass('supabase_migrations.schema_migrations') is not null
) as inventory;
rollback;
