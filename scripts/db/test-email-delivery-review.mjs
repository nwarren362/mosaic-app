// Native PostgreSQL review reconciliation, tenant isolation and race tests. No SMTP.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativePostgresTest} from './native-postgres-test.mjs';
import {platformContract} from './baseline-platform-fixture.mjs';
const db=await nativePostgresTest();let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async(fn,re)=>{await assert.rejects(fn,re);checks++;};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const result=async(sql,args=[])=>(await db.query(sql,args)).rows[0].d;
const evidence='Provider records checked for the original recipient and message reference.';
const acceptedAt=new Date(Date.now()-5*60*1000).toISOString();
const resolve=(delivery,review,outcome,actor=2,agency=101,note=evidence,time=null)=>result('select public.resolve_contact_email_review($1,$2,$3,$4,$5,$6,$7) d',[id(actor),id(agency),id(delivery),id(review),outcome,note,time]);
const list=(actor=2,agency=101)=>result('select public.list_contact_email_reviews($1,$2) d',[id(actor),id(agency)]);
const row=async n=>(await db.query('select state,provider_id,smtp_started_at,resolved_by from public.contact_email_deliveries where id=$1',[id(n)])).rows[0];
const seed=async(n,started=true,receipt=false,agency=101,contact=401,venue=301)=>db.query(`insert into public.contact_email_deliveries(id,agency_id,actor_id,venue_id,venue_contact_id,subject,text_body,bcc_myself,payload,sender_revision,smtp_connection,created_at,smtp_started_at,provider_id,accepted_at)
 select $1,$2,$3,$4,$5,'Sample review','Sample original message',false,jsonb_build_object('from','Sample <sender@example.test>','to',jsonb_build_array('contact@example.test'),'subject','Sample review','text','Sample original message'),s.revision,jsonb_build_object('user','sender@example.test','host','smtp.ionos.co.uk','port',587),now()-interval '1 hour',case when $6 then now()-interval '10 minutes' else null end,case when $7 then 'saved-receipt' else null end,case when $7 then now()-interval '9 minutes' else null end from public.agency_email_senders s where s.agency_id=$2`,[id(n),id(agency),id(agency===101?1:3),id(venue),id(contact),started,receipt]);
const role=async(role,sql)=>{await db.exec(`begin;set local role ${role}`);try{return await db.query(sql);}finally{await db.exec('rollback');}};
try{
 await db.exec(platformContract);
 for(const file of ['20261119000000_application_baseline.sql','20261119000100_application_privileges.sql','20261122000000_contact_email_delivery.sql','20261122000100_agency_email_settings.sql','20261123000000_email_delivery_review.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id(1)}','agent@example.test',now(),'{}'),('${id(2)}','admin@example.test',now(),'{}'),('${id(3)}','other@example.test',now(),'{}'),('${id(4)}','support@example.test',now(),'{}');
 insert into public.agencies(id,name) values('${id(101)}','Agency A'),('${id(102)}','Agency B');
 insert into public.agency_memberships(agency_id,user_id,role) values('${id(101)}','${id(1)}','agent'),('${id(101)}','${id(2)}','admin'),('${id(102)}','${id(3)}','admin');
 update public.profiles set is_super_user=true where id='${id(4)}';
 insert into public.venues(id,agency_id,name) values('${id(301)}','${id(101)}','Venue A'),('${id(302)}','${id(102)}','Venue B');
 insert into public.venue_contacts(id,agency_id,venue_id,name,email) values('${id(401)}','${id(101)}','${id(301)}','Contact A','contact@example.test'),('${id(402)}','${id(102)}','${id(302)}','Contact B','other@example.test');
 insert into public.agency_email_senders(agency_id,from_name,from_email,smtp_host,smtp_username,encrypted_password,enabled,verified_at) values('${id(101)}','Sample','sender@example.test','smtp.ionos.co.uk','sender@example.test','v1:synthetic-encrypted-password',true,now()),('${id(102)}','Other','sender@example.test','smtp.ionos.co.uk','sender@example.test','v1:synthetic-encrypted-password',true,now());`);
 await seed(501,false);await seed(502);await seed(503,true,true);await seed(504);await seed(505);await seed(506,false);await seed(508);await seed(509,true,true);await seed(601,true,false,102,402,302);
 eq((await list()).length,8,'Only own agency requests');eq(JSON.stringify(await list()).includes('encrypted'),false,'No credential fields');eq((await list()).find(r=>r.id===id(501)).category,'unsent');eq((await list()).find(r=>r.id===id(503)).category,'history');eq((await list()).find(r=>r.id===id(502)).category,'uncertain');
 for(const actor of [1,3,4]){await rejects(()=>list(actor),/Agency admin required/);await rejects(()=>resolve(501,701,'not_accepted',actor),/Agency admin required/);}
 for(const r of ['anon','authenticated']){
  await rejects(()=>role(r,`select public.list_contact_email_reviews('${id(2)}','${id(101)}')`),/permission denied/);
  await rejects(()=>role(r,`select public.resolve_contact_email_review('${id(2)}','${id(101)}','${id(501)}','${id(701)}','not_accepted','Sample reason')`),/permission denied/);
  await rejects(()=>role(r,'select * from public.contact_email_delivery_reviews'),/permission denied/);
 }
 await rejects(()=>resolve(601,701,'not_accepted'),/Delivery unavailable/);
 await rejects(()=>resolve(501,701,'not_accepted',2,101,'short'),/evidence required/);
 eq((await resolve(501,701,'not_accepted')).state,'not_sent','Cancel never-started request');eq((await resolve(501,701,'not_accepted')).state,'not_sent','Retry decision idempotently');eq((await row(501)).resolved_by,id(2),'Reviewer attributed');
 eq((await result(`select public.prepare_contact_email('${id(1)}','${id(101)}','${id(401)}','${id(501)}',null,null,null) d`)).state,'cancelled','Closed request cannot reserve send');
 eq(await result(`select public.start_contact_email('${id(501)}') d`),false,'Closed request cannot start SMTP');
 await rejects(()=>resolve(501,701,'accepted',2,101,evidence,acceptedAt),/Review request changed/);
 eq((await resolve(502,702,'accepted',2,101,evidence,acceptedAt)).state,'sent');eq((await resolve(502,702,'accepted',2,101,evidence,acceptedAt)).state,'sent');
 eq((await row(502)).provider_id,`<${id(502)}@example.test>`,'Original deterministic SMTP message reference preserved');
 eq((await resolve(503,703,'finish_history')).state,'sent','Saved receipt completes history without SMTP');
 eq((await resolve(504,704,'not_accepted')).state,'not_sent');
 await rejects(()=>db.exec(`select public.record_contact_email_receipt('${id(504)}','late-receipt')`),/receipt conflict/);
 await rejects(()=>db.exec(`select public.complete_contact_email('${id(504)}')`),/resolved without sending/);
 eq((await row(504)).state,'not_sent','Late worker cannot change resolved result');
 await db.exec(`update public.contact_email_deliveries set smtp_started_at=now(),lease_until=now()+interval '1 minute' where id='${id(505)}'`);
 eq((await list()).find(r=>r.id===id(505)).busy,true);await rejects(()=>resolve(505,705,'not_accepted'),/in progress/);
 await rejects(()=>resolve(509,709,'not_accepted'),/Cannot reject a recorded acceptance/);
 await rejects(()=>resolve(508,708,'accepted',2,101,evidence,'2099-01-01T00:00:00Z'),/acceptance time required/);
 // Atomic review/history rollback and recovery.
 await db.exec(`create function public.fail_review_history() returns trigger language plpgsql as $$begin if new.activity_type='email' then raise exception 'Simulated activity failure';end if;return new;end$$;create trigger fail_review_history before insert on public.activity_log for each row execute function public.fail_review_history();`);
 await rejects(()=>resolve(508,708,'accepted',2,101,evidence,acceptedAt),/Simulated activity failure/);eq((await row(508)).state,'pending');eq((await row(508)).provider_id,null);
 eq((await db.query(`select count(*)::int n from public.contact_email_delivery_reviews where id='${id(708)}'`)).rows[0].n,0);
 await db.exec('drop trigger fail_review_history on public.activity_log');eq((await resolve(508,708,'accepted',2,101,evidence,acceptedAt)).state,'sent');
 // Cancellation versus a worker starting: only one path can win.
 const race=await db.concurrent([`select public.start_contact_email('${id(506)}')`, `select public.resolve_contact_email_review('${id(2)}','${id(101)}','${id(506)}','${id(706)}','not_accepted','Never-started request cancelled by the administrator')`]);
 const raced=await row(506);eq((raced.state==='not_sent' && raced.smtp_started_at===null)||(raced.state==='pending' && raced.smtp_started_at!==null),true,'Race cannot both cancel and start SMTP');eq(race.some(r=>r.ok),true);
 eq((await db.query('select count(*)::int n from public.contact_emails')).rows[0].n,3,'Exactly three accepted-message histories');
 eq((await db.query(`select count(*)::int n from public.contact_email_delivery_reviews where id='${id(702)}'`)).rows[0].n,1,'One audit per repeated review ID');
 console.log(`PASS ${checks} native email reconciliation assertions; no SMTP provider`);
}finally{await db.close();}
