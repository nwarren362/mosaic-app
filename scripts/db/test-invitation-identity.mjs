// Synthetic PostgreSQL tests. No live accounts, invitations, tokens or network calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve,dirname,join } from 'node:path';
import { pathToFileURL } from 'node:url';
const native=process.argv[2]==='--native';
let db;
if(native){
 const { nativePostgresTest }=await import('./native-postgres-test.mjs');
 db=await nativePostgresTest();
}else{
 const modulePath=resolve(process.argv[2]);
 const { PGlite }=await import(pathToFileURL(modulePath).href);
 const { citext }=await import(pathToFileURL(join(dirname(modulePath),'contrib/citext.js')).href);
 db=new PGlite({extensions:{citext}});
}
const catalog=JSON.parse(await readFile(new URL('../../docs/db/audit/catalog-2026-11-14.json',import.meta.url)));
const migration=await readFile(new URL('../../docs/db/migrations/20261114_invitation_identity.sql',import.meta.url),'utf8');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const quote=s=>`"${s.replaceAll('"','""')}"`;
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(fn,re,label)=>{await assert.rejects(fn,re,label);checks++;};
const asUser=async(user,fn,commit=false,role='authenticated')=>{
  await db.exec(`begin;set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?uid(user):'']);
  try{const r=await fn();await db.exec(commit?'commit':'rollback');return r;}catch(e){await db.exec('rollback');throw e;}
};
const accept=token=>db.query('select * from public.accept_agency_invitation($1)',[token]);
const invite=async(n,email,role='agent',extra='')=>db.query(`insert into public.agency_invitations(id,agency_id,email,role,token_hash,invited_by,expires_at${extra?',accepted_at':''}) values($1,$2,$3,$4,public.invite_token_hash($5),$6,clock_timestamp()+interval '1 day'${extra?','+extra:''})`,[uid(n),uid(101),email,role,`test-token-${n}`,uid(5)]);
try{
 console.log((await db.query('select version()')).rows[0].version);
 await db.exec(`create role authenticated nologin nosuperuser nobypassrls;create role anon nologin nosuperuser nobypassrls;create role service_role nologin nosuperuser bypassrls;
  create extension citext;create schema auth;create table auth.users(id uuid primary key,email varchar,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to authenticated,anon;
  create schema extensions;
  ${native ? 'create extension pgcrypto with schema extensions;' : 'create function extensions.digest(bytea,text) returns bytea language sql immutable as $$select sha256($1)$$;'}`);
 const names=['agencies','profiles','agency_memberships','agency_invitations'];
 for(const name of names){
  const cols=catalog.columns.filter(c=>c.table_name===name).map(c=>`${quote(c.column_name)} ${c.udt_name}${c.column_default?` default ${c.column_default}`:''}${c.is_nullable==='NO'?' not null':''}`);
  await db.exec(`create table public.${quote(name)}(${cols.join(',')});alter table public.${quote(name)} enable row level security;`);
 }
 for(const c of catalog.constraints.filter(c=>names.includes(c.table)).sort((a,b)=>Number(a.type==='f')-Number(b.type==='f')))await db.exec(`alter table public.${quote(c.table)} add constraint ${quote(c.name)} ${c.definition}`);
 for(const n of ['is_super_user','is_agency_member','is_agency_admin','invite_token_hash','accept_agency_invitation'])await db.exec(catalog.functions.find(f=>f.name===n).definition);
 for(const p of catalog.policies.filter(p=>p.schemaname==='public'&&names.includes(p.tablename)))await db.exec(`create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':quote(r)).join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''}`);
 for(const g of catalog.table_grants.filter(g=>g.table_schema==='public'&&names.includes(g.table_name)))await db.exec(`grant ${g.privilege_type} on public.${quote(g.table_name)} to ${g.grantee==='PUBLIC'?'public':quote(g.grantee)}`);
 for(const n of [1,2,3,4,5]){await db.query('insert into auth.users values($1,$2,$3)',[uid(n),`user${n}@example.test`,n===3?null:new Date().toISOString()]);await db.query('insert into public.profiles(id) values($1)',[uid(n)]);}
 await db.query('insert into public.agencies(id,name) values($1,$2)',[uid(101),'Synthetic agency']);
 await db.query("insert into public.agency_memberships(agency_id,user_id,role) values($1,$2,'admin')",[uid(101),uid(5)]);
 await invite(301,'User1@Example.TEST');await invite(302,'user3@example.test');await invite(303,'user2@example.test','admin');await invite(304,'user1@example.test','admin');await invite(305,'user5@example.test','agent');await invite(306,'user1@example.test');await invite(307,'user1@example.test');await invite(308,'user1@example.test','agent','clock_timestamp()');
 await db.query("update public.agency_invitations set expires_at=clock_timestamp()-interval '1 second' where id=$1",[uid(307)]);
 // Original audited vulnerability: any signed-in token holder can accept someone else's invitation.
 eq((await asUser(2,()=>accept('test-token-301'))).rows[0].user_id,uid(2),'Fixture reproduces bearer-only identity flaw');
 await db.exec('alter function public.accept_agency_invitation(text) set search_path=public,auth');
 await reject(()=>db.exec(migration),/function changed/,'Function drift rejected');await db.exec('rollback');
 await db.exec(catalog.functions.find(f=>f.name==='accept_agency_invitation').definition);
 await reject(()=>db.exec(migration.replace('grant execute on function public.accept_agency_invitation', 'select 1/0;grant execute on function public.accept_agency_invitation')),/division by zero/,'Migration failure rolls back');await db.exec('rollback');
 eq((await asUser(2,()=>accept('test-token-301'))).rows[0].user_id,uid(2),'Failed migration restores old implementation');
 const policies=(await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 await db.exec(migration);
 eq((await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows,policies,'Existing tenant/admin policies unchanged');
 await reject(()=>asUser(null,()=>accept('test-token-301'),false,'anon'),/permission denied/,'Anon execute revoked');
 await reject(()=>asUser(null,()=>accept('test-token-301')),/Sign in/,'Missing user rejected');
 await reject(()=>asUser(2,()=>accept('test-token-301')),/different email/,'Wrong account rejected');
 await reject(()=>asUser(3,()=>accept('test-token-302')),/Verify your account/,'Unverified invited account rejected');
 await reject(()=>asUser(1,()=>accept('unknown-token')),/Invalid invitation/,'Invalid token rejected');
 await reject(()=>asUser(1,()=>accept(null)),/Invalid invitation/,'Missing token rejected');
 await reject(()=>asUser(1,()=>accept('test-token-307')),/expired/,'Expired invitation rejected');
 await reject(()=>asUser(1,()=>accept('test-token-308')),/already accepted/,'Consumed invitation rejected');
 eq((await db.query('select accepted_at from public.agency_invitations where id=$1',[uid(301)])).rows[0].accepted_at,null,'Failed claims do not consume invitation');
 eq((await db.query('select count(*)::int n from public.agency_memberships')).rows[0].n,1,'Failed claims create no memberships');
 // Current authoritative email wins over stale/forged JWT email hints.
 await db.query('update auth.users set email=$1 where id=$2',['changed@example.test',uid(1)]);
 await reject(()=>asUser(1,async()=>{await db.exec(`select set_config('request.jwt.claim.email','user1@example.test',true)`);return accept('test-token-301');}),/different email/,'Email changes invalidate old-address invite despite stale JWT');
 await db.query('update auth.users set email=$1 where id=$2',['  USER1@example.test  ',uid(1)]);
 eq((await asUser(1,()=>accept('test-token-301'),true)).rows[0].role,'agent','Verified matching email accepts with case/edge-space normalization');
 eq((await db.query('select accepted_by from public.agency_invitations where id=$1',[uid(301)])).rows[0].accepted_by,uid(1),'Acceptance records actual user');
 await reject(()=>asUser(1,()=>accept('test-token-301')),/already accepted/,'Replay rejected');
 eq((await asUser(1,()=>accept('test-token-304'),true)).rows[0].role,'agent','Existing agent not silently promoted');
 eq((await asUser(5,()=>accept('test-token-305'),true)).rows[0].role,'admin','Existing admin not silently demoted');
 eq((await asUser(2,()=>accept('test-token-303'),true)).rows[0].role,'admin','New member receives invited role');
 await db.exec(`create function public.fail_accept() returns trigger language plpgsql as $$begin raise exception 'Injected acceptance failure';end$$;create trigger fail_accept before update on public.agency_invitations for each row execute function public.fail_accept();`);
 await invite(309,'user4@example.test');
 await reject(()=>asUser(4,()=>accept('test-token-309'),true),/Injected acceptance failure/,'Late failure rolls back whole acceptance');
 eq((await db.query('select count(*)::int n from public.agency_memberships where user_id=$1',[uid(4)])).rows[0].n,0,'Late failure leaves no membership');
 eq((await db.query('select accepted_at from public.agency_invitations where id=$1',[uid(309)])).rows[0].accepted_at,null,'Late failure leaves invitation usable');
 await db.exec('drop trigger fail_accept on public.agency_invitations;drop function public.fail_accept()');
 for(const value of [null,'']){await db.query('update auth.users set email=$1 where id=$2',[value,uid(4)]);await reject(()=>asUser(4,()=>accept('test-token-309')),/Verify your account/,'Missing email rejected');}
 await reject(()=>db.exec(migration),/function changed/,'Reapply fails safely');await db.exec('rollback');
 eq((await db.query("select encode(public.invite_token_hash('abc'),'hex') as hash")).rows[0].hash,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','Token hash matches standard SHA-256 bytes');
 eq((await db.query("select has_function_privilege('anon','public.accept_agency_invitation(text)','EXECUTE') as allowed")).rows[0].allowed,false,'Anonymous execution grant absent');
 eq((await db.query("select has_function_privilege('authenticated','public.accept_agency_invitation(text)','EXECUTE') as allowed")).rows[0].allowed,true,'Authenticated execution grant retained');
 console.log(`PASS: ${checks} invitation identity assertions (${native?'native PostgreSQL + pgcrypto':'PGlite'}).`);
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}
