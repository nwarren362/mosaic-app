// Real PostgreSQL policies with synthetic records; no production data or network calls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureSql,uid } from './gig-archive-fixture.mjs';
const native=process.argv[2]==='--native';
const db=native?await(await import('./native-postgres-test.mjs')).nativePostgresTest():new(await import(pathToFileURL(resolve(process.argv[2])).href)).PGlite();
const migration=await readFile(new URL('../../docs/db/migrations/20261115_artist_deletion_roles.sql',import.meta.url),'utf8');
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(fn,re,label)=>{await assert.rejects(fn,re,label);checks++;};
const asUser=async(user,fn,role='authenticated')=>{
 await db.exec(`begin;set local role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?uid(user):'']);
 try{return await fn();}finally{await db.exec('rollback');}
};
const del=(table,id)=>db.query(`delete from public.${table} where id=$1 returning id`,[uid(id)]);
try{
 console.log((await db.query('select version()')).rows[0].version);
 await db.exec(await fixtureSql());
 await db.query('insert into public.artists(id,agency_id,name) values($1,$2,$3)',[uid(203),uid(101),'Empty artist']);
 for(const [id,agency] of [[401,101],[402,102]])await db.query('insert into public.venues(id,agency_id,name) values($1,$2,$3)',[uid(id),uid(agency),'Empty venue']);
 eq((await asUser(1,()=>del('artists',203))).rows.length,1,'Baseline reproduces agent artist deletion');
 const venuePolicies=(await db.query("select * from pg_policies where tablename='venues' order by policyname")).rows;
 const grants=(await db.query("select relname,relacl::text from pg_class where oid in ('public.artists'::regclass,'public.venues'::regclass) order by relname")).rows;
 await db.exec('create policy unexpected_delete on public.artists for delete using(true)');
 await reject(()=>db.exec(migration),/policies changed/,'Policy drift refused');await db.exec('rollback;drop policy unexpected_delete on public.artists');
 await reject(()=>db.exec(migration.replace('rename to artists_delete_admin_or_super','rename to artists_delete_admin_or_super;select 1/0')),/division by zero/,'Migration failure atomic');await db.exec('rollback');
 eq((await asUser(1,()=>del('artists',203))).rows.length,1,'Failed migration restores original policy');
 await db.exec(migration);
 eq((await db.query("select * from pg_policies where tablename='venues' order by policyname")).rows,venuePolicies,'Existing venue role policies unchanged');
 eq((await db.query("select relname,relacl::text from pg_class where oid in ('public.artists'::regclass,'public.venues'::regclass) order by relname")).rows,grants,'Table grants unchanged');
 for(const user of [1,4,2,null])await asUser(user,async()=>{
  eq((await del('artists',203)).rows.length,0,'Agent/other agency/missing user cannot permanently delete artist');
  eq((await del('venues',401)).rows.length,0,'Agent/other agency/missing user cannot permanently delete venue');
 });
 for(const table of ['artists','venues'])await asUser(4,async()=>{
  const id=table==='artists'?203:401;
  eq((await db.query(`update public.${table} set status='inactive' where id=$1 returning id`,[uid(id)])).rows.length,1,'Agency agents retain safe deactivation');
  eq((await db.query(`update public.${table} set name=name where id=$1 returning id`,[uid(id)])).rows.length,1,'Agency agents retain ordinary editing');
 });
 await asUser(5,async()=>{
  eq((await del('artists',203)).rows.length,1,'Agency admin may delete empty artist');
  eq((await del('venues',401)).rows.length,1,'Agency admin may delete empty venue');
  eq((await del('artists',202)).rows.length,0,'Agency admin cannot delete other agency artist');
  eq((await del('venues',402)).rows.length,0,'Agency admin cannot delete other agency venue');
 });
 await db.query('update public.profiles set is_super_user=true where id=$1',[uid(3)]);
 await db.query("insert into public.agency_memberships(agency_id,user_id,role) values($1,$2,'agent')",[uid(101),uid(3)]);
 await asUser(3,async()=>{
  eq((await del('artists',203)).rows.length,1,'Existing support scope retained for artist deletion');
  eq((await del('venues',401)).rows.length,1,'Existing support scope retained for venue deletion');
 });
 await db.exec(await readFile(new URL('../../docs/db/migrations/20261114_gig_archiving.sql',import.meta.url),'utf8'));
 await reject(()=>asUser(5,()=>del('artists',201)),/foreign key/,'Existing gig-history restriction remains in force');
 await reject(()=>db.exec(migration),/policies changed/,'Reapply safely refused');await db.exec('rollback');
 console.log(`PASS: ${checks} core deletion role assertions.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
