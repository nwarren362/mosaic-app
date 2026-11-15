// Synthetic data only; --native additionally exercises concurrent removals at two isolation levels.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureSql,uid } from './gig-archive-fixture.mjs';
const native=process.argv[2]==='--native';
const db=native?await(await import('./native-postgres-test.mjs')).nativePostgresTest():new(await import(pathToFileURL(resolve(process.argv[2])).href)).PGlite();
const migration=await readFile(new URL('../../docs/db/migrations/20261115_membership_safeguards.sql',import.meta.url),'utf8');
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(fn,re,label)=>{await assert.rejects(fn,re,label);checks++;};
const asUser=async(user,fn,commit=false,role='authenticated')=>{
 await db.exec(`begin;set local role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?uid(user):'']);
 try{const r=await fn();await db.exec(commit?'commit':'rollback');return r;}catch(e){await db.exec('rollback');throw e;}
};
const demote=id=>db.query("update public.agency_memberships set role='agent' where agency_id=$1 and user_id=$2 returning user_id",[uid(101),uid(id)]);
const remove=id=>db.query('delete from public.agency_memberships where agency_id=$1 and user_id=$2 returning user_id',[uid(101),uid(id)]);
try{
 console.log((await db.query('select version()')).rows[0].version);
 await db.exec(await fixtureSql());
 await reject(()=>db.exec(migration),/no administrator/,'Fail on orphan agency');await db.exec('rollback');
 await db.query("update public.agency_memberships set role='admin' where agency_id=$1",[uid(102)]);
 await db.exec('create policy unexpected on public.agency_memberships for update using(true)');
 await reject(()=>db.exec(migration),/policies changed/,'Fail on policy drift');await db.exec('rollback;drop policy unexpected on public.agency_memberships');
 const policies=(await db.query("select * from pg_policies where tablename='agency_memberships' order by policyname")).rows;
 await reject(()=>db.exec(migration.replace('grant update(role)','select 1/0;grant update(role)')),/division by zero/,'Migration DDL failure rolls back');await db.exec('rollback');
 eq((await db.query("select count(*)::int n from pg_trigger where tgname='guard_agency_membership'")).rows[0].n,0,'No partial trigger');
 await db.exec(migration);
 eq((await db.query("select * from pg_policies where tablename='agency_memberships' order by policyname")).rows,policies,'RLS unchanged');
 await reject(()=>asUser(5,()=>remove(5)),/at least one agency administrator/,'Sole admin cannot remove self');
 await reject(()=>asUser(5,()=>demote(5)),/at least one agency administrator/,'Sole admin cannot demote self');
 await db.query('update public.profiles set is_super_user=true where id=$1',[uid(3)]);
 await reject(()=>asUser(3,()=>remove(5)),/at least one agency administrator/,'Super-user cannot orphan agency');
 for(const user of [1,4,2])await asUser(user,async()=>{
  eq((await demote(5)).rows.length,0,'Other agent/agency cannot demote admin');
  eq((await remove(5)).rows.length,0,'Other agent/agency cannot remove admin');
  await reject(()=>db.query("insert into public.agency_memberships(agency_id,user_id,role) values($1,$2,'admin')",[uid(101),uid(3)]),/row-level security/,'Cannot create admin membership');
 });
 await reject(()=>asUser(5,()=>db.query('update public.agency_memberships set user_id=$1 where agency_id=$2 and user_id=$3',[uid(3),uid(101),uid(5)])),/permission denied/,'App cannot move membership identity');
 await reject(()=>db.query('update public.agency_memberships set agency_id=$1 where agency_id=$2 and user_id=$3',[uid(102),uid(101),uid(5)]),/agency and user cannot be changed/,'Trigger rejects privileged identity move');
 await reject(()=>asUser(5,()=>db.query('update public.agency_memberships set created_at=now() where user_id=$1',[uid(5)])),/permission denied/,'Audit timestamp immutable');
 await asUser(5,async()=>{
  eq((await remove(4)).rows.length,1,'Admin may remove ordinary member');
  eq((await db.query("update public.agency_memberships set role='admin' where agency_id=$1 and user_id=$2 returning user_id",[uid(101),uid(4)])).rows.length,0,'Removed member is absent within transaction');
 });
 await asUser(5,async()=>{
  await db.query("update public.agency_memberships set role='admin' where agency_id=$1 and user_id=$2",[uid(101),uid(4)]);
  eq((await demote(5)).rows.length,1,'Admin transfer permits self-demotion once another admin exists');
 });
 await db.query("update public.agency_memberships set role='admin' where agency_id=$1 and user_id=$2",[uid(101),uid(4)]);
 await reject(()=>asUser(3,()=>db.query("delete from public.agency_memberships where agency_id=$1 and role='admin'",[uid(101)])),/at least one agency administrator/,'Bulk deletion cannot remove every admin');
 eq((await db.query("select count(*)::int n from public.agency_memberships where agency_id=$1 and role='admin'",[uid(101)])).rows[0].n,2,'Bulk failure is atomic');
 await db.query("update public.agency_memberships set role='agent' where agency_id=$1 and user_id=$2",[uid(101),uid(4)]);
 await reject(()=>db.query('delete from auth.users where id=$1',[uid(5)]),/at least one agency administrator/,'Account cascade cannot remove last admin');
 await asUser(3,async()=>eq((await db.query("insert into public.agency_memberships(agency_id,user_id,role) values($1,$2,'admin') returning user_id",[uid(101),uid(3)])).rows.length,1,'Support can appoint recovery admin'));
 if(native){
  for(const action of ['delete','demote'])for(const isolation of ['READ COMMITTED','REPEATABLE READ']){
   await db.query("update public.agency_memberships set role='admin' where agency_id=$1 and user_id=$2",[uid(101),uid(4)]);
   const operation=action==='delete'?'delete from public.agency_memberships':"update public.agency_memberships set role='agent'";
   const sql=n=>`begin isolation level ${isolation};set local lock_timeout='3s';select pg_sleep(0.1);${operation} where agency_id='${uid(101)}' and user_id='${uid(n)}';commit;`;
   const result=await db.concurrent([sql(4),sql(5)]);
   eq(result.filter(r=>r.ok).length,1,`${action}/${isolation}: only one concurrent admin change commits`);
   eq((await db.query("select count(*)::int n from public.agency_memberships where agency_id=$1 and role='admin'",[uid(101)])).rows[0].n,1,`${action}/${isolation}: agency retains admin`);
   // Restore both synthetic admins as database owner for the next scenario.
   for(const n of [4,5])await db.query("insert into public.agency_memberships(agency_id,user_id,role) values($1,$2,'admin') on conflict(agency_id,user_id) do update set role='admin'",[uid(101),uid(n)]);
  }
 }
 // Deliberate whole-agency purge still cascades memberships and existing domain records.
 await db.query('delete from public.agencies where id=$1',[uid(101)]);
 eq((await db.query('select count(*)::int n from public.agency_memberships where agency_id=$1',[uid(101)])).rows[0].n,0,'Agency purge has no orphan memberships');
 await reject(()=>db.exec(migration),/guard exists/,'Reapply rejected');await db.exec('rollback');
 console.log(`PASS: ${checks} membership safeguards assertions${native?' including native concurrency':''}.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
