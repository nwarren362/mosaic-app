// Administrative review does not have a mail transport, even when delivery is paused.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../src/lib/emailDeliveryReviewApi.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {handleEmailDeliveryReview:handle}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let calls=[],error=null,state='sent',list=[{id:id(501),subject:'Sample',toEmail:'contact@example.test',from:'Sample <sender@example.test>',createdAt:'2026-11-23T10:00:00Z',startedAt:null,acceptedAt:null,reference:'reference',category:'unsent',busy:false,encrypted_password:'PRIVATE_FAKE_CIPHERTEXT'}];
const deps={configured:true,authenticate:async()=>id(1),rpc:async(name,args)=>{calls.push({name,args});return {data:name==='list_contact_email_reviews'?list:{state},error};}};
async function run(body,overrides={},auth='Bearer fake'){
 const r=await handle(new Request('http://localhost/api/contact-emails/review?agencyId='+id(101),{method:body===undefined?'GET':'POST',headers:{Authorization:auth},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify({agencyId:id(101),...body})})}),{...deps,...overrides});eq(r.headers.get('cache-control'),'no-store');return {status:r.status,...await r.json()};
}
eq((await run(undefined,{},'')).status,401);eq((await run(undefined,{configured:false})).status,503);eq((await run(undefined,{authenticate:async()=>null})).status,401);eq(calls.length,0,'No privileged operations before auth');
let r=await run();eq(r.status,200);eq(r.deliveries.length,1);eq(JSON.stringify(r).includes('PRIVATE_FAKE_CIPHERTEXT'),false,'Explicit projection hides unexpected fields');
const body={deliveryId:id(501),reviewId:id(701),outcome:'not_accepted',evidence:'No SMTP send was started; obsolete request cancelled.',confirmed:true};
eq((await run('{')).status,400);eq((await run({...body,actorId:id(2)})).status,400,'No actor supplied by browser');eq((await run({...body,confirmed:false})).status,400);eq((await run({...body,evidence:'short'})).status,400);eq((await run({...body,outcome:'send_again'})).status,400,'Review cannot request a send');
state='not_sent';r=await run(body);eq(r.status,200);eq(r.state,'not_sent');eq(calls.at(-1).name,'resolve_contact_email_review');eq(calls.at(-1).args.p_actor,id(1));eq(calls.at(-1).args.p_review,body.reviewId);
state='sent';r=await run({...body,outcome:'accepted',acceptedAt:'2026-11-23T10:01:00Z'});eq(r.state,'sent');eq(calls.at(-1).args.p_accepted_at,'2026-11-23T10:01:00Z');eq((await run({...body,outcome:'accepted'})).status,400);eq((await run({...body,outcome:'accepted',acceptedAt:'invalid'})).status,400);
for(const [code,status] of [['42501',403],['22023',400],['40001',409],['55000',409],['XX000',503]]){error={code,message:'PRIVATE_DETAIL'};r=await run(body);eq(r.status,status);eq(JSON.stringify(r).includes('PRIVATE_DETAIL'),false);}error=null;
eq((await run(body,{rpc:async()=>{throw Error('private')}})).status,503);state='unexpected';eq((await run(body)).status,503,'Unexpected result is never success');
eq(calls.every(c=>['list_contact_email_reviews','resolve_contact_email_review'].includes(c.name)),true,'Only review RPCs are callable');
console.log(`PASS ${checks} administrative email-review assertions; no transport or real mail`);
