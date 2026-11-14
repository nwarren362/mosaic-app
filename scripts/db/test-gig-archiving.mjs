// Run: node scripts/db/test-gig-archiving.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureSql,uid } from './gig-archive-fixture.mjs';
const { PGlite }=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(fn,re,label)=>{await assert.rejects(fn,re,label);checks++;};
const migration=await readFile(new URL('../../docs/db/migrations/20261114_gig_archiving.sql',import.meta.url),'utf8');
const asUser=async(user,fn,commit=false,role='authenticated')=>{
  await db.exec(`begin;set local role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?uid(user):'']);
  try{const r=await fn();await db.exec(commit?'commit':'rollback');return r;}catch(e){await db.exec('rollback');throw e;}
};
const archive=(id=301,reason='No longer required',communications=true,obligations=true)=>db.query('select public.archive_gig($1,$2,$3,$4,$5) as result',[uid(id),uid(101),reason,communications,obligations]);
try{
  console.log((await db.query('select version()')).rows[0].version);
  await db.exec(await fixtureSql());
  await db.exec('create policy unexpected_policy on public.gigs for delete using (true)');
  await reject(()=>db.exec(migration),/policies changed/,'Fail safely on policy drift');
  await db.exec('rollback;drop policy unexpected_policy on public.gigs');
  await reject(()=>db.exec(migration.replace('create function public.archive_gig(', 'select 1/0;create function public.archive_gig(')),/division by zero/,'DDL failure is atomic');
  await db.exec('rollback');
  eq((await db.query("select count(*)::int n from information_schema.columns where table_name='gigs' and column_name='archived_at'")).rows[0].n,0,'Failed migration leaves no archive schema');
  await db.exec(migration);
  for(const user of [2,3,4,null])await reject(()=>asUser(user,()=>archive()),/belong|creating agent/,'Only creator/admin in agency may archive');
  await reject(()=>asUser(null,()=>archive(),false,'anon'),/permission denied/,'Anonymous RPC denied');
  await reject(()=>asUser(1,()=>archive(302)),/Cancel and save/,'Must cancel first');
  await reject(()=>asUser(1,()=>archive(303)),/future start/,'Past gig cannot be archived');
  await reject(()=>asUser(1,()=>archive(304)),/creating agent/,'Legacy creator not guessed');
  for(const reason of [null,'  ','x'.repeat(1001)])await reject(()=>asUser(1,()=>archive(301,reason)),/archive reason/,'Reason validated');
  for(const flags of [[false,true],[true,false],[null,true]])await reject(()=>asUser(1,()=>archive(301,'Reason',...flags)),/Confirm cancellation/,'Attestations required');
  await reject(()=>asUser(1,()=>archive(305)),/follow-up task/,'Unfinished cancellation task blocks archive');
  await asUser(1,()=>db.query('update public.activity_log set completed_at=now() where id=$1',[uid(402)]),true);
  eq((await asUser(1,()=>archive(305))).rows[0].result.closed_tasks,0,'Completed cancellation followup permits archive');
  eq((await asUser(5,()=>archive(304))).rows[0].result.already_archived,false,'Admin may archive legacy gig');
  for(const user of [1,5]){
    await reject(()=>asUser(user,()=>db.query('delete from public.gigs where id=$1',[uid(301)])),/permission denied/,'Even admin cannot physically delete gig');
    for(const col of ['created_by','archived_by'])await reject(()=>asUser(user,()=>db.query(`update public.gigs set ${col}=$1 where id=$2`,[uid(user),uid(301)])),/permission denied/,'Protected columns cannot be spoofed');
    await reject(()=>asUser(user,()=>db.query('update public.gigs set archived_at=now() where id=$1',[uid(301)])),/permission denied/,'Cannot bypass RPC');
  }
  await asUser(1,async()=>{
    const r=await db.query('insert into public.gigs(agency_id,artist_id,title,starts_at,created_by) values($1,$2,$3,now()+interval \'1 day\',$4) returning created_by',[uid(101),uid(201),'New gig',uid(5)]);
    eq(r.rows[0].created_by,uid(1),'Database stamps actual creator');
  });
  await reject(()=>asUser(1,()=>db.query('insert into public.gigs(agency_id,artist_id,title,starts_at,archived_at) values($1,$2,$3,now(),now())',[uid(101),uid(201),'Spoofed archive'])),/Create the gig/,'Insert cannot bypass lifecycle');
  await asUser(4,async()=>eq((await db.query('update public.gigs set title=title where id=$1 returning id',[uid(301)])).rows.length,1,'Agency collaborators may edit live gig details'));
  const taskBefore=(await db.query('select * from public.activity_log where id=$1',[uid(403)])).rows[0];
  // Inject a failure after tasks and gig update: the entire RPC must roll back.
  await db.exec(`create function public.fail_archive_log() returns trigger language plpgsql as $$begin if new.activity_type='system' then raise exception 'Injected log failure';end if;return new;end$$;create trigger fail_archive_log before insert on public.activity_log for each row execute function public.fail_archive_log();`);
  await reject(()=>asUser(1,()=>archive(),true),/Injected log failure/,'Archive is atomic on late failure');
  eq((await db.query('select archived_at from public.gigs where id=$1',[uid(301)])).rows[0].archived_at,null,'Failed archive leaves gig live');
  eq((await db.query('select completed_at from public.activity_log where id=$1',[uid(401)])).rows[0].completed_at,null,'Failed archive leaves tasks open');
  eq((await db.query('select count(*)::int n from public.workflow_events')).rows[0].n,0,'Failed archive leaves no event');
  await db.exec('drop trigger fail_archive_log on public.activity_log;drop function public.fail_archive_log()');
  eq((await asUser(1,()=>archive(),true)).rows[0].result.closed_tasks,1,'Archive closes only remaining open tasks');
  const task=(await db.query('select * from public.activity_log where id=$1',[uid(401)])).rows[0];
  eq(task.notes,'Keep this original note','Notes preserved');eq(task.metadata.workflow_event_id,'original','Existing workflow link preserved');eq(task.metadata.closed_reason,'gig_archived','Task closure reason recorded');eq(task.metadata.closed_by,uid(1),'Task closure actor recorded');
  eq((await db.query('select * from public.activity_log where id=$1',[uid(403)])).rows[0],taskBefore,'Already completed task unchanged');
  eq((await asUser(1,()=>archive(),true)).rows[0].result.already_archived,true,'Retry is idempotent');
  eq((await db.query('select count(*)::int n from public.workflow_events')).rows[0].n,1,'Exactly one archive event');
  eq((await db.query("select count(*)::int n from public.activity_log where metadata->>'event_type'='gig.archived'")).rows[0].n,2,'Gig and artist history retained');
  eq((await db.query('select archived_by,archive_reason from public.gigs where id=$1',[uid(301)])).rows[0],{archived_by:uid(1),archive_reason:'No longer required'},'Archive actor and reason recorded');
  await asUser(1,async()=>{
    eq((await db.query('select id from public.gigs where id=$1',[uid(301)])).rows.length,1,'History still readable');
    eq((await db.query('select id from public.gigs where id=$1 and archived_at is null',[uid(301)])).rows.length,0,'Normal list excludes archived gig');
    eq((await db.query('update public.gigs set title=$1 where id=$2 returning id',['Change',uid(301)])).rows.length,0,'Archived details cannot change');
  });
  for(const sql of ['update public.activity_log set completed_at=null where id=$1','delete from public.activity_log where id=$1',`update public.activity_log set entity_type='artist',entity_id='${uid(201)}' where id=$1`])await reject(()=>asUser(1,()=>db.query(sql,[uid(401)])),/archived gig/,'Archived task/history immutable');
  await reject(()=>asUser(1,()=>db.query("insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary,assigned_to) values($1,'gig',$2,'task','New task',$3)",[uid(101),uid(301),uid(1)])),/open task/,'No new open task on archive');
  await reject(()=>asUser(1,()=>db.query("insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary) values($1,'gig',$2,'note','Broken link')",[uid(101),uid(999)])),/same agency/,'New orphan links rejected');
  await reject(()=>db.query('delete from public.artists where id=$1',[uid(201)]),/foreign key/,'Deleting artist cannot strand gig history');
  await reject(()=>db.exec(migration),/schema exists/,'Reapply fails safely');await db.exec('rollback');
  console.log(`PASS: ${checks} gig archiving assertions.`);
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}
