// Schema-only rebuild against disposable native PostgreSQL; managed schemas are test contracts.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaBaseline } from './schema-baseline.mjs';
import { platformContract } from './baseline-platform-fixture.mjs';
import { nativePostgresTest } from './native-postgres-test.mjs';
const c=JSON.parse(await readFile(process.argv[2],'utf8'));
const db=await nativePostgresTest();
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
try {
  await db.exec(platformContract);
  await db.exec('alter default privileges grant select on tables to anon');
  await assert.rejects(()=>db.exec(schemaBaseline(c)),/Destination default privileges/);checks++;await db.exec('rollback;alter default privileges revoke select on tables from anon');
  await db.exec(schemaBaseline(c));
  eq((await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relkind='r'")).rows[0].n,c.relations.filter(r=>r.schema==='public' && r.kind==='r').length,'All application tables rebuilt');
  const cons=(await db.query("select conrelid::regclass::text as table,conname as name,contype as type,pg_get_constraintdef(oid,true) as definition from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text,conname")).rows;
  eq(cons,[...c.constraints].sort((a,b)=>a.table.localeCompare(b.table,'en')||a.name.localeCompare(b.name,'en')),'Constraint definitions match live metadata');
  for(const f of c.functions){
    const actual=(await db.query("select pg_get_functiondef(oid) as definition from pg_proc where pronamespace='public'::regnamespace and proname=$1 and pg_get_function_identity_arguments(oid)=$2",[f.name,f.identity_args])).rows[0].definition;
    eq(actual.trim(),f.definition.trim(),`${f.name} definition preserved`);
    if(f.owner==='supabase_admin') eq((await db.query("select exists(select 1 from pg_depend d join pg_proc p on p.oid=d.objid where d.classid='pg_proc'::regclass and d.deptype='e' and p.pronamespace='public'::regnamespace and p.proname=$1 and pg_get_function_identity_arguments(p.oid)=$2) as owned",[f.name,f.identity_args])).rows[0].owned,true,`${f.name} is extension-owned`);
  }
  for(const r of c.relations.filter(r=>r.schema==='public')){
    const actual=(await db.query('select relrowsecurity as rls,relforcerowsecurity as force_rls,reloptions as options from pg_class where oid=to_regclass($1)',[`public.${r.name}`])).rows[0];
    eq(actual,{rls:r.rls,force_rls:r.force_rls,options:r.options},`${r.name} RLS/view options`);
  }
  const policies=(await db.query("select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname")).rows;
  const policyOrder=(a,b)=>a.schemaname.localeCompare(b.schemaname)||a.tablename.localeCompare(b.tablename)||a.policyname.localeCompare(b.policyname);
  eq(policies.sort(policyOrder),[...c.policies].sort(policyOrder),'Public and application Storage policies match');
  for(const g of c.table_grants.filter(g=>g.table_schema==='public')){
    eq((await db.query('select has_table_privilege($1,$2,$3) as allowed',[g.grantee,`public.${g.table_name}`,g.privilege_type])).rows[0].allowed,true,`${g.table_name} ${g.grantee} ${g.privilege_type}`);
  }
  await assert.rejects(()=>db.exec(schemaBaseline(c)),/empty public application schema/);checks++;await db.exec('rollback');
  const adoption=await readFile(new URL('../../docs/db/adopt-20261119-baseline.sql',import.meta.url),'utf8');
  await db.exec("alter function public.current_user_id() set search_path='pg_catalog'");
  await assert.rejects(()=>db.exec(adoption),/functions drift/);checks++;await db.exec('rollback;alter function public.current_user_id() reset search_path');
  await db.exec('drop trigger on_auth_user_created on auth.users');
  await assert.rejects(()=>db.exec(adoption),/triggers drift/);checks++;await db.exec('rollback');
  await db.exec(c.triggers.find(t=>t.schema==='auth' && t.name==='on_auth_user_created').definition);
  await db.exec(adoption);
  eq((await db.query('select version,name from supabase_migrations.schema_migrations')).rows,[{version:'20261119000000',name:'application_baseline'}],'Only verified baseline recorded; no invented historical entries');
  eq((await db.query("select has_schema_privilege('anon','supabase_migrations','USAGE') as allowed")).rows[0].allowed,false,'Migration history is not public');
  await assert.rejects(()=>db.exec(adoption),/already exists/);checks++;await db.exec('rollback');
  console.log(`PASS ${checks} baseline assertions; managed Auth/Storage are contracts, not a full Supabase integration test`);
} finally {await db.close();}
