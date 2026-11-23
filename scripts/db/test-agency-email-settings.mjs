// Native PostgreSQL rehearsal of the admin boundary, races and connection state machine.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativePostgresTest} from './native-postgres-test.mjs';
import {platformContract} from './baseline-platform-fixture.mjs';
const db=await nativePostgresTest();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async(fn,re,label)=>{await assert.rejects(fn,re,label);checks++;};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const result=async(sql,params=[])=>(await db.query(sql,params)).rows[0].d;
const read=(actor=1,agency=101)=>result('select public.read_agency_email_settings($1,$2) d',[id(actor),id(agency)]);
const save=(revision=null,actor=1,agency=101,name='Sample agency')=>db.query('select public.save_agency_email_settings($1,$2,$3,$4,$5,$6,$7)',[id(actor),id(agency),revision,name,'sender@example.test',587,'v1:synthetic-encrypted-password']);
const change=(revision,action,test=null,authorised=false,actor=1,agency=101)=>result('select public.change_agency_email_settings($1,$2,$3,$4,$5,$6) d',[id(actor),id(agency),revision,action,test,authorised]);
const role=async(r,sql)=>{await db.exec(`begin;set local role ${r}`);try{return await db.query(sql);}finally{await db.exec('rollback');}};
try{
 await db.exec(platformContract);
 for(const file of ['20261119000000_application_baseline.sql','20261119000100_application_privileges.sql','20261122000000_contact_email_delivery.sql','20261122000100_agency_email_settings.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id(1)}','admin@example.test',now(),'{}'),('${id(2)}','agent@example.test',now(),'{}'),('${id(3)}','other-admin@example.test',now(),'{}'),('${id(4)}','support@example.test',now(),'{}');
  insert into public.agencies(id,name) values('${id(101)}','Agency A'),('${id(102)}','Agency B');
  insert into public.agency_memberships(agency_id,user_id,role) values('${id(101)}','${id(1)}','admin'),('${id(101)}','${id(2)}','agent'),('${id(102)}','${id(3)}','admin');
  update public.profiles set is_super_user=true where id='${id(4)}';`);
 eq(await read(),null,'New agency has no implicit sender');
 for(const [actor,agency] of [[2,101],[3,101],[1,102],[4,101]]){
  await rejects(()=>read(actor,agency),/Agency admin required/,'No agent/cross-tenant/support bypass');
  await rejects(()=>save(null,actor,agency),/Agency admin required/);
 }
 await save();let s=await read();const revision=s.revision;
 eq(s.enabled,false,'New sender paused');eq(s.verified_at,null);eq(s.smtp_username,s.from_email);eq(s.encrypted_password,'v1:synthetic-encrypted-password');
 for(const r of ['anon','authenticated']){
  await rejects(()=>role(r,'select * from public.agency_email_senders'),/permission denied/);
  await rejects(()=>role(r,'select * from public.agency_email_settings_audit'),/permission denied/);
  await rejects(()=>role(r,`select public.read_agency_email_settings('${id(1)}','${id(101)}')`),/permission denied/,'Client cannot impersonate actor through RPC');
 }
 for(const fn of ['read_agency_email_settings(uuid,uuid)','save_agency_email_settings(uuid,uuid,uuid,text,text,integer,text)','change_agency_email_settings(uuid,uuid,uuid,text,uuid,boolean)']){
  eq((await db.query("select has_function_privilege('service_role',$1,'EXECUTE') allowed",['public.'+fn])).rows[0].allowed,true,'Server-only grant');
 }
 await rejects(()=>change(revision,'enable',null,true),/Check the connection/);
 const firstTest=await change(revision,'check_start');eq(Boolean(firstTest.testId),true);
 await rejects(()=>change(revision,'check_start'),/Wait one minute/,'Check rate limit');
 await rejects(()=>change(revision,'check_passed',id(999)),/Connection check changed/);
 await change(revision,'check_passed',firstTest.testId);s=await read();eq(Boolean(s.verified_at),true);eq(s.enabled,false);
 await rejects(()=>change(revision,'enable',null,false),/authorisation required/);
 await change(revision,'enable',null,true);s=await read();eq(s.enabled,true);eq(s.authorised_by,id(1));
 await change(revision,'disable');eq((await read()).enabled,false);
 await rejects(()=>change(revision,'enable',null,true,2),/Agency admin required/);
 await rejects(()=>save(null),/Settings changed/,'Stale first-save rejected');
 await save(revision);s=await read();eq(s.revision!==revision,true,'Save changes generation');eq(s.verified_at,null);eq(s.authorised_at,null);eq(s.enabled,false);
 await rejects(()=>change(revision,'check_passed',firstTest.testId),/Settings changed/,'Old check cannot verify new credentials');
 await rejects(()=>change(s.revision,'check_start'),/Wait one minute/,'Saving cannot bypass check throttle');
 await db.exec("update public.agency_email_senders set last_test_attempt_at=now()-interval '2 minutes'");
 const second=await change(s.revision,'check_start');await change(s.revision,'check_failed',second.testId);eq((await read()).verified_at,null);
 await rejects(()=>change(s.revision,'check_passed',second.testId),/Connection check changed/,'Failed/completed check token cannot be replayed');
 const stale=s.revision;
 const statement=`select public.save_agency_email_settings('${id(1)}','${id(101)}','${stale}','Concurrent agency','sender@example.test',587,'v1:synthetic-encrypted-password')`;
 const concurrent=await db.concurrent([statement,statement]);eq(concurrent.filter(r=>r.ok).length,1,'One of two stale-tab saves wins');eq(concurrent.filter(r=>r.output.includes('Settings changed')).length,1,'Other tab must reload');
 eq((await db.query("select count(*)::int n from public.agency_email_settings_audit where action='save'")).rows[0].n,3,'No audit entry for rejected save');
 await db.exec(`insert into public.agency_memberships(agency_id,user_id,role) values('${id(101)}','${id(3)}','admin');update public.agency_memberships set role='agent' where agency_id='${id(101)}' and user_id='${id(1)}'`);
 await rejects(()=>read(),/Agency admin required/,'Demoted administrator loses credential access');
 await rejects(async()=>save((await read(3)).revision),/Agency admin required/);
 eq((await read(3,102)),null,'Other agency remains untouched');
 console.log(`PASS ${checks} native agency-email settings assertions`);
}finally{await db.close();}
