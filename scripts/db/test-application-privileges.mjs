import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaBaseline } from './schema-baseline.mjs';
import { platformContract } from './baseline-platform-fixture.mjs';
import { nativePostgresTest } from './native-postgres-test.mjs';
const c=JSON.parse(await readFile(new URL('../../docs/db/audit/catalog-2026-11-19.json',import.meta.url),'utf8'));
const migration=await readFile(new URL('../../supabase/migrations/20261119000100_application_privileges.sql',import.meta.url),'utf8');
const adoption=await readFile(new URL('../../docs/db/adopt-20261119-baseline.sql',import.meta.url),'utf8');
// The CLI records this itself; the API release path must do so atomically.
const trackedMigration=migration.replace(/commit;\s*$/, "insert into supabase_migrations.schema_migrations(version,name) values('20261119000100','application_privileges');commit;");
const db=await nativePostgresTest();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(fn,re)=>{await assert.rejects(fn,re);checks++;};
const asRole=async(role,sql)=>{await db.exec(`begin;set local role ${role}`);try{return await db.query(sql);}finally{await db.exec('rollback');}};
try {
  await db.exec(platformContract);await db.exec(schemaBaseline(c));await db.exec(adoption);
  for(const r of ['anon','authenticated']) eq((await db.query("select has_schema_privilege($1,'public','CREATE') as allowed",[r])).rows[0].allowed,true,'Baseline reproduces inherited CREATE');
  await db.exec("alter function public.current_user_id() set search_path='pg_catalog'");
  await reject(()=>db.exec(migration),/functions changed/);await db.exec('rollback;alter function public.current_user_id() reset search_path');
  await reject(()=>db.exec(trackedMigration.replace('revoke create on schema public','select 1/0;revoke create on schema public')),/division by zero/);await db.exec('rollback');
  eq((await db.query('select version from supabase_migrations.schema_migrations order by version')).rows,[{version:'20261119000000'}],'Failed permission migration does not record its version');
  eq((await db.query("select has_schema_privilege('anon','public','CREATE') as allowed")).rows[0].allowed,true,'Failure preserves prior grants');
  const policies=(await db.query("select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname")).rows;
  const grants=(await db.query("select grantee,table_name,privilege_type,is_grantable from information_schema.table_privileges where table_schema='public' order by grantee,table_name,privilege_type")).rows;
  await db.exec(trackedMigration);
  eq((await db.query('select version from supabase_migrations.schema_migrations order by version')).rows,[{version:'20261119000000'},{version:'20261119000100'}],'Successful API application records the exact version');
  for(const r of ['anon','authenticated']) {
    eq((await db.query("select has_schema_privilege($1,'public','CREATE') as allowed,has_schema_privilege($1,'public','USAGE') as usage",[r])).rows[0],{allowed:false,usage:true},'Remove CREATE, preserve USAGE');
    await reject(()=>asRole(r,'create table public.forbidden_test(id int)'),/permission denied for schema public/);
  }
  for(const fn of ['is_super_user()','is_agency_member(uuid)','is_agency_admin(uuid)','current_user_id()','invite_token_hash(text)']) {
    for(const r of ['anon','authenticated']) eq((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',[r,`public.${fn}`])).rows[0].allowed,r==='authenticated',`${fn} effective RPC grant`);
  }
  for(const fn of ['handle_new_user()','set_updated_at()','guard_gig_lifecycle()','guard_archived_gig_activity()','guard_agency_membership()']){
    for(const r of ['anon','authenticated']) eq((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',[r,`public.${fn}`])).rows[0].allowed,false,`${fn} cannot be called as app RPC`);
  }
  eq((await asRole('anon','select public.monitor_health() as healthy')).rows[0].healthy,true,'Anonymous monitor survives');
  await reject(()=>asRole('authenticated','select public.monitor_health()'),/permission denied/);
  eq((await asRole('authenticated',"select public.is_super_user() as super,public.is_agency_member('00000000-0000-4000-8000-000000000101') as member,public.is_agency_admin('00000000-0000-4000-8000-000000000101') as admin,public.current_user_id() as uid,encode(public.invite_token_hash('test'),'hex') as hash")).rows[0],{super:false,member:false,admin:false,uid:null,hash:'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'},'Authenticated helpers/hash retain behaviour');
  await db.exec("insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000001','sample@example.test','{}')");
  eq((await db.query("select display_name from public.profiles where id='00000000-0000-4000-8000-000000000001'")).rows[0].display_name,'sample@example.test','Signup trigger works without caller EXECUTE');
  await db.exec(`update auth.users set email_confirmed_at=now();
    insert into public.agencies(id,name) values('00000000-0000-4000-8000-000000000101','Test agency');
    insert into public.agency_memberships(agency_id,user_id,role) values('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','admin');
    insert into public.artists(id,agency_id,name) values('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','Sample artist');
    insert into public.gigs(id,agency_id,artist_id,title,status,starts_at,created_by) values('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','Sample gig','cancelled',now()+interval '1 day','00000000-0000-4000-8000-000000000001');
    insert into public.agency_invitations(agency_id,email,role,token_hash,invited_by,expires_at) values('00000000-0000-4000-8000-000000000101','sample@example.test','agent',public.invite_token_hash('sample-token'),'00000000-0000-4000-8000-000000000001',now()+interval '1 day');`);
  await db.exec("begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true)");
  eq((await db.query('select count(*)::int n from public.artists')).rows[0].n,1,'Authenticated RLS can still use helpers');
  eq((await db.query("select role from public.accept_agency_invitation('sample-token')")).rows[0].role,'admin','Verified invitation still works and preserves role');
  eq((await db.query("select public.archive_gig('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','Sample archive check',true,true)->>'id' as id")).rows[0].id,'00000000-0000-4000-8000-000000000301','Archive still works with hardened helpers');
  await db.exec('rollback');
  eq((await db.query("select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname")).rows,policies,'RLS policies unchanged');
  eq((await db.query("select grantee,table_name,privilege_type,is_grantable from information_schema.table_privileges where table_schema='public' order by grantee,table_name,privilege_type")).rows,grants,'Table grants unchanged');
  eq((await db.query("select has_column_privilege('authenticated','public.agency_memberships','user_id','UPDATE') as identity,has_column_privilege('authenticated','public.agency_memberships','role','UPDATE') as role")).rows[0],{identity:false,role:true},'Membership safeguards retained');
  for(const fn of ['accept_agency_invitation(text)','archive_gig(uuid,uuid,text,boolean,boolean)']) for(const r of ['anon','authenticated']) eq((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',[r,`public.${fn}`])).rows[0].allowed,r==='authenticated','Existing guarded RPC grants unchanged');
  await reject(()=>db.exec(migration),/functions changed/);await db.exec('rollback');
  console.log(`PASS ${checks} application privilege assertions`);
}finally{await db.close();}
