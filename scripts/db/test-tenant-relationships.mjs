// Native PostgreSQL + real FK/cascade/RLS tests; synthetic data only.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativePostgresTest } from './native-postgres-test.mjs';
import { fixtureSql,uid } from './gig-archive-fixture.mjs';
import { coreLifecycleUiFixture } from './core-lifecycle-ui-fixture.mjs';
const db=await nativePostgresTest();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(fn,re,label)=>{await assert.rejects(fn,re,label);checks++;};
const migration=await readFile(new URL('../../docs/db/migrations/20261115_tenant_relationships.sql',import.meta.url),'utf8');
const asUser=async(fn)=>{
 await db.exec('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid(1)]);
 try{return await fn();}finally{await db.exec('rollback');}
};
const insertMember=()=>db.query('insert into public.artist_members(agency_id,artist_id,name) values($1,$2,$3) returning id',[uid(101),uid(202),'Wrong agency']);
const count=async(table,where='true')=>(await db.query(`select count(*)::int n from public.${table} where ${where}`)).rows[0].n;
try{
 console.log((await db.query('select version()')).rows[0].version);
 await db.exec(await fixtureSql());
 await db.exec(await readFile(new URL('../../docs/db/migrations/20261114_gig_archiving.sql',import.meta.url),'utf8'));
 await db.exec(await coreLifecycleUiFixture());
 await db.query("insert into public.agency_memberships(agency_id,user_id,role) values($1,$2,'agent')",[uid(102),uid(1)]);
 await db.query('insert into public.venues(id,agency_id,name) values($1,$2,$3)',[uid(403),uid(102),'Other agency venue']);
 for(const [id,agency,venue] of [[501,101,401],[502,102,403],[503,101,402]])await db.query('insert into public.venue_contacts(id,agency_id,venue_id,name) values($1,$2,$3,$4)',[uid(id),uid(agency),uid(venue),`Contact ${id}`]);
 for(const [id,agency] of [[601,101],[602,102]])await db.query("insert into public.agency_tags(id,agency_id,name,type) values($1,$2,$3,'region')",[uid(id),uid(agency),`Tag ${id}`]);
 await db.query("insert into public.gigs(id,agency_id,artist_id,venue_id,title,starts_at) values($1,$2,$3,$4,'Other gig',now()+interval '1 day')",[uid(306),uid(102),uid(202),uid(403)]);
 await db.query("insert into public.contact_emails(id,agency_id,venue_id,venue_contact_id,subject) values($1,$2,$3,$4,'Original email')",[uid(801),uid(101),uid(401),uid(501)]);
 await db.query('insert into public.contact_calls(id,agency_id,venue_id,venue_contact_id) values($1,$2,$3,$4)',[uid(802),uid(101),uid(401),uid(501)]);
 eq((await asUser(insertMember)).rows.length,1,'Baseline reproduces cross-agency link even for a user belonging to both agencies');
 const policies=(await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 const originalFks=(await db.query("select conname,pg_get_constraintdef(oid,true) definition from pg_constraint where connamespace='public'::regnamespace and contype='f' order by conname")).rows;
 // Existing inconsistent data must make validation roll back the entire migration.
 await insertMember();
 await reject(()=>db.exec(migration),/foreign key/,'Existing inconsistent rows refuse migration');await db.exec('rollback');
 eq(await count('artist_members'),1,'Failed migration does not rewrite existing records');
 eq((await db.query("select count(*)::int n from pg_constraint where conname like '%_tenant_parent_key'")).rows[0].n,0,'Validation failure rolls back supporting indexes');
 await db.exec('delete from public.artist_members');
 await reject(()=>db.exec(migration.replace('alter table public.venues add constraint venues_tenant_parent_key','select 1/0;alter table public.venues add constraint venues_tenant_parent_key')),/division by zero/,'Partial DDL failure is atomic');await db.exec('rollback');
 await db.exec("alter table public.gigs drop constraint gigs_venue_id_fkey;alter table public.gigs add constraint gigs_venue_id_fkey foreign key(venue_id) references public.venues(id) on delete restrict;");
 await reject(()=>db.exec(migration),/relationships changed/,'Original FK drift refused');await db.exec('rollback');
 await db.exec("alter table public.gigs drop constraint gigs_venue_id_fkey;alter table public.gigs add constraint gigs_venue_id_fkey foreign key(venue_id) references public.venues(id) on delete set null;");
 await db.exec(migration);
 eq((await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows,policies,'Tenant/admin policies unchanged');
 eq((await db.query("select count(*)::int n from pg_constraint where conname like '%_tenant_fkey' and convalidated")).rows[0].n,16,'All sixteen scoped FKs validated');
 const afterOriginal=(await db.query("select conname,pg_get_constraintdef(oid,true) definition from pg_constraint where connamespace='public'::regnamespace and contype='f' and conname not like '%_tenant_fkey' order by conname")).rows;
 eq(afterOriginal,originalFks,'Existing single-column FKs preserved');
 const invalid=[
  ["insert into public.gigs(agency_id,artist_id,title,starts_at) values($1,$2,'Wrong artist',now()+interval '1 day')",[uid(101),uid(202)]],
  ["insert into public.gigs(agency_id,artist_id,venue_id,title,starts_at) values($1,$2,$3,'Wrong venue',now()+interval '1 day')",[uid(101),uid(201),uid(403)]],
  ['insert into public.artist_members(agency_id,artist_id,name) values($1,$2,$3)',[uid(101),uid(202),'Wrong agency']],
  ['insert into public.artist_tags(agency_id,artist_id,tag_id) values($1,$2,$3)',[uid(101),uid(202),uid(601)]],
  ['insert into public.artist_tags(agency_id,artist_id,tag_id) values($1,$2,$3)',[uid(101),uid(201),uid(602)]],
  ["insert into public.venue_contacts(agency_id,venue_id,name) values($1,$2,'Wrong venue')",[uid(101),uid(403)]],
  ['insert into public.venue_tags(agency_id,venue_id,tag_id) values($1,$2,$3)',[uid(101),uid(403),uid(601)]],
  ['insert into public.venue_tags(agency_id,venue_id,tag_id) values($1,$2,$3)',[uid(101),uid(401),uid(602)]],
  ["insert into public.contact_emails(agency_id,venue_id,venue_contact_id,subject) values($1,$2,$3,'Wrong agency')",[uid(101),uid(403),uid(502)]],
  ["insert into public.contact_emails(agency_id,venue_id,venue_contact_id,subject) values($1,$2,$3,'Wrong contact')",[uid(101),uid(401),uid(502)]],
  ["insert into public.contact_emails(agency_id,venue_id,venue_contact_id,subject) values($1,$2,$3,'Wrong venue within agency')",[uid(101),uid(402),uid(501)]],
  ['insert into public.contact_calls(agency_id,venue_id,venue_contact_id) values($1,$2,$3)',[uid(101),uid(403),uid(502)]],
  ['insert into public.contact_calls(agency_id,venue_id,venue_contact_id) values($1,$2,$3)',[uid(101),uid(401),uid(502)]],
  ['insert into public.contact_calls(agency_id,venue_id,venue_contact_id) values($1,$2,$3)',[uid(101),uid(402),uid(501)]],
  ["insert into public.venue_feedback(agency_id,venue_id,author_id,content) values($1,$2,$3,'Wrong venue')",[uid(101),uid(403),uid(1)]],
  ["insert into public.venue_feedback(agency_id,venue_id,author_id,artist_id,content) values($1,$2,$3,$4,'Wrong artist')",[uid(101),uid(401),uid(1),uid(202)]],
  ["insert into public.venue_feedback(agency_id,venue_id,author_id,gig_id,content) values($1,$2,$3,$4,'Wrong gig')",[uid(101),uid(401),uid(1),uid(306)]],
  ["insert into public.venue_activity(agency_id,venue_id,activity_type) values($1,$2,'note')",[uid(101),uid(403)]],
  ['update public.gigs set venue_id=$1 where id=$2',[uid(403),uid(302)]],
  ['update public.venue_contacts set venue_id=$1 where id=$2',[uid(402),uid(501)]],
  ['update public.venues set agency_id=$1 where id=$2',[uid(102),uid(401)]],
 ];
 for(const [sql,params] of invalid)await reject(()=>asUser(()=>db.query(sql,params)),/foreign key/,'Inconsistent reference rejected despite membership in both agencies');
 const valid=[
  ['insert into public.artist_members(agency_id,artist_id,name) values($1,$2,$3) returning id',[uid(101),uid(201),'Member']],
  ['insert into public.artist_tags(agency_id,artist_id,tag_id) values($1,$2,$3) returning id',[uid(101),uid(201),uid(601)]],
  ["insert into public.venue_contacts(agency_id,venue_id,name) values($1,$2,'Contact') returning id",[uid(101),uid(401)]],
  ['insert into public.venue_tags(agency_id,venue_id,tag_id) values($1,$2,$3) returning id',[uid(101),uid(401),uid(601)]],
  ["insert into public.contact_emails(agency_id,venue_id,venue_contact_id,subject) values($1,$2,$3,'Email') returning id",[uid(101),uid(401),uid(501)]],
  ['insert into public.contact_calls(agency_id,venue_id,venue_contact_id) values($1,$2,$3) returning id',[uid(101),uid(401),uid(501)]],
  ["insert into public.venue_feedback(agency_id,venue_id,author_id,content) values($1,$2,$3,'Feedback') returning id",[uid(101),uid(401),uid(1)]],
  ["insert into public.venue_activity(agency_id,venue_id,activity_type) values($1,$2,'note') returning id",[uid(101),uid(401)]],
 ];
 for(const [sql,params] of valid)eq((await asUser(()=>db.query(sql,params))).rows.length,1,'Valid same-agency writes remain available');
 await db.query('delete from public.venue_contacts where id=$1',[uid(501)]);
 eq(await count('contact_emails'),0,'Contact deletion retains original email cascade');
 eq(await count('contact_calls'),0,'Contact deletion retains original call cascade');
 await db.query('delete from public.venues where id=$1',[uid(403)]);
 eq((await db.query('select agency_id,venue_id from public.gigs where id=$1',[uid(306)])).rows[0],{agency_id:uid(102),venue_id:null},'Optional gig venue nulls only venue ID, preserving tenant');
 await db.query('insert into public.artists(id,agency_id,name) values($1,$2,$3)',[uid(205),uid(101),'Feedback-only artist']);
 await db.query('insert into public.venue_feedback(id,agency_id,venue_id,author_id,artist_id,content) values($1,$2,$3,$4,$5,$6)',[uid(810),uid(101),uid(401),uid(1),uid(205),'History']);
 await db.query('delete from public.artists where id=$1',[uid(205)]);
 eq((await db.query('select agency_id,artist_id from public.venue_feedback where id=$1',[uid(810)])).rows[0],{agency_id:uid(101),artist_id:null},'Optional feedback artist nulls only artist ID');
 await reject(()=>db.query('delete from public.venues where id=$1',[uid(402)]),/Archived gigs are read-only/,'Existing archived gig history stays protected');
 await reject(()=>db.exec(migration),/constraints exist/,'Reapply refused');await db.exec('rollback');
 console.log(`PASS: ${checks} tenant relationship assertions.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
