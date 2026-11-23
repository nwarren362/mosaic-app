// Native SQL rehearsal only; no hosted database, credentials or email delivery.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativePostgresTest } from './native-postgres-test.mjs';
import { platformContract } from './baseline-platform-fixture.mjs';
const db=await nativePostgresTest();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=async(sql,re)=>{await assert.rejects(()=>db.exec(sql),re);checks++;};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const prep=(n=501,actor=1,agency=101,contact=401,subject="'Hello'",text="'Message'")=>`select public.prepare_contact_email('${id(actor)}','${id(agency)}','${id(contact)}','${id(n)}',${subject},${text},false) as d`;
const result=async(sql)=>(await db.query(sql)).rows[0].d;
const role=async(r,sql)=>{await db.exec(`begin;set local role ${r};select set_config('request.jwt.claim.sub','${id(1)}',true)`);try{return await db.query(sql);}finally{await db.exec('rollback');}};
try{
  await db.exec(platformContract);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261119000000_application_baseline.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261119000100_application_privileges.sql',import.meta.url),'utf8'));
  const migration=await readFile(new URL('../../supabase/migrations/20261122000000_contact_email_delivery.sql',import.meta.url),'utf8');
  await db.exec(migration);
  await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id(1)}','agent@example.test',now(),'{}'),('${id(2)}','other@example.test',now(),'{}');
    insert into public.agencies(id,name) values('${id(101)}','Agency A'),('${id(102)}','Agency B');
    insert into public.agency_memberships(agency_id,user_id,role) values('${id(101)}','${id(1)}','agent'),('${id(102)}','${id(2)}','admin');
    insert into public.venues(id,agency_id,name) values('${id(301)}','${id(101)}','Venue A'),('${id(302)}','${id(102)}','Venue B');
    insert into public.venue_contacts(id,agency_id,venue_id,name,email) values('${id(401)}','${id(101)}','${id(301)}','Contact A','contact@example.test'),('${id(402)}','${id(102)}','${id(302)}','Contact B','other@example.test');`);
  await reject(prep(),/not configured/);
  await db.exec(`insert into public.agency_email_senders(agency_id,from_name,from_email,smtp_host,smtp_username,encrypted_password,enabled,verified_at) values('${id(101)}','Agency A','sender@example.test','smtp.ionos.co.uk','sender@example.test','v1:synthetic-test-ciphertext',true,now());`);
  for(const r of ['anon','authenticated']){
    await assert.rejects(()=>role(r,prep()),/permission denied/);checks++;
    await assert.rejects(()=>role(r,`select public.complete_contact_email('${id(501)}')`),/permission denied/);checks++;
    await assert.rejects(()=>role(r,'select * from public.agency_email_senders'),/permission denied/);checks++;
  }
  await reject(prep(501,2),/Agency access/);
  await reject(prep(501,1,101,402),/Contact unavailable/);
  await reject(prep(501,1,101,401,"E'Hello\\r\\nBcc: bad@example.test'"),/Valid subject/);
  for(const fn of ['prepare_contact_email(uuid,uuid,uuid,uuid,text,text,boolean)','start_contact_email(uuid)','record_contact_email_receipt(uuid,text)','complete_contact_email(uuid)']) {
    eq((await db.query("select has_function_privilege('service_role',$1,'EXECUTE') allowed",['public.'+fn])).rows[0].allowed,true,'Server may execute delivery transition');
    eq((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') allowed",['public.'+fn])).rows[0].allowed,false,'Browser cannot forge delivery transition');
  }
  const d=await result(prep());eq(d.state,'ready','Reserve valid request');
  eq(d.payload,{from:'Agency A <sender@example.test>',to:['contact@example.test'],subject:'Hello',text:'Message'},'Recipient and sender from database');
  eq((await result(prep())).state,'busy','Concurrent duplicate is leased');
  await reject(prep(501,1,101,401,"'Changed'"),/original message/);
  const acl=await db.query("select has_column_privilege('authenticated','public.contact_emails','subject','INSERT') i,has_column_privilege('authenticated','public.contact_emails','status','UPDATE') u,has_table_privilege('authenticated','public.contact_emails','SELECT') s");
  eq(acl.rows[0],{i:false,u:false,s:true},'History writes blocked including baseline column grants');
  eq((await role('authenticated','select count(*)::int n from public.contact_email_deliveries')).rows[0].n,1,'Own pending request visible');
  await db.exec(`update public.venue_contacts set email='changed@example.test' where id='${id(401)}';update public.agency_email_senders set from_name='Changed';update public.contact_email_deliveries set lease_until=now()-interval '1 second'`);
  eq((await result(prep())).state,'review','Contact/sender edits prevent sending stale reserved addresses');
  eq((await db.query('select payload from public.contact_email_deliveries')).rows[0].payload,d.payload,'Original payload remains immutable');
  await db.exec(`update public.venue_contacts set email='contact@example.test' where id='${id(401)}';update public.agency_email_senders set from_name='Agency A';`);
  eq((await result(prep())).state,'ready','Unsent reservation can resume after corrected configuration');
  eq((await db.query(`select public.start_contact_email('${id(501)}') started`)).rows[0].started,true,'One-way SMTP send barrier committed');
  eq((await db.query(`select public.start_contact_email('${id(501)}') started`)).rows[0].started,false,'Cannot start SMTP twice');
  eq((await result(prep())).state,'review','Uncertain SMTP delivery is never resent');
  await db.exec(`select public.record_contact_email_receipt('${id(501)}','receipt-1')`);
  eq((await result(prep())).state,'finalize','Receipt allows safe history recovery');
  await db.exec(`create function public.fail_email_activity() returns trigger language plpgsql as $$begin if new.activity_type='email' then raise exception 'Simulated history failure';end if;return new;end$$;
    create trigger fail_email_activity before insert on public.activity_log for each row execute function public.fail_email_activity();`);
  await reject(`select public.complete_contact_email('${id(501)}')`,/Simulated history failure/);
  eq((await db.query('select count(*)::int n from public.contact_emails')).rows[0].n,0,'History failure rolls back all delivery recording');
  eq((await db.query('select state from public.contact_email_deliveries')).rows[0].state,'pending','Failed finalization remains recoverable');
  await db.exec(`drop trigger fail_email_activity on public.activity_log;select public.complete_contact_email('${id(501)}');select public.complete_contact_email('${id(501)}');`);
  eq((await db.query('select count(*)::int n from public.contact_emails')).rows[0].n,1,'Finalization is idempotent');
  eq((await db.query("select count(*)::int n from public.activity_log where activity_type='email'")).rows[0].n,1,'Single activity entry');
  eq((await result(prep())).state,'sent','Completed retry does not reserve another send');
  // More than one process racing on the same id must reserve only once.
  const concurrent=await db.concurrent([prep(502),prep(502)]);
  eq(concurrent.every(r=>r.ok),true,'Concurrent requests succeed safely');
  eq(concurrent.filter(r=>r.output.includes('"ready"')).length,1,'Only one concurrent provider reservation');
  await db.exec(`update public.contact_email_deliveries set created_at=now()-interval '24 hours',lease_until=null where id='${id(502)}'`);
  eq((await result(prep(502))).state,'review','Stale requests require review');
  await result(prep(503));
  await db.exec(`update public.agency_email_senders set enabled=false;update public.contact_email_deliveries set lease_until=null where id='${id(503)}'`);
  eq((await result(prep(503))).state,'review','Disabled sender blocks pending retry');
  await db.exec(`update public.agency_email_senders set enabled=true;update public.contact_email_deliveries set attempts=20 where id='${id(503)}'`);
  eq((await result(prep(503))).state,'review','Bounded retry attempts');
  await db.exec(`update public.contact_email_deliveries set actor_id='${id(2)}' where id='${id(503)}'`);
  await reject(prep(503),/Request unavailable/);
  eq((await role('authenticated','select count(*)::int n from public.contact_email_deliveries')).rows[0].n,2,'Other actor deliveries hidden');
  const copied=await result(prep(520).replace('false) as d','true) as d'));
  eq(copied.payload.bcc,['agent@example.test'],'BCC resolved from confirmed account');
  await db.exec(`update auth.users set email_confirmed_at=null where id='${id(1)}'`);
  await reject(prep(521).replace('false) as d','true) as d'),/Confirm your email/);
  await db.exec("update public.contact_email_deliveries set created_at=now()-interval '1 hour'");
  for(let n=510;n<515;n++)await result(prep(n));
  await reject(prep(515),/Email limit reached/);
  await db.exec(`delete from public.agency_memberships where agency_id='${id(101)}'`);
  await reject(prep(),/Agency access/);
  eq((await role('authenticated','select count(*)::int n from public.contact_email_deliveries')).rows[0].n,0,'Removed membership loses delivery visibility');
  console.log(`PASS ${checks} native contact email assertions`);
}finally{await db.close();}
