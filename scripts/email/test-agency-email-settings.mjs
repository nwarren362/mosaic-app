// Server and encryption tests; fake SMTP verification, no mail or hosted services.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import ts from 'typescript';
async function load(name){const source=await readFile(new URL('../../src/lib/'+name,import.meta.url),'utf8');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));}
const {encryptEmailPassword:encrypt,decryptEmailPassword:decrypt,emailEncryptionReady:ready}=await load('emailCredentialCrypto.ts');
const {handleAgencyEmailSettings:handle}=await load('agencyEmailSettingsApi.ts');
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const throws=(f,label)=>{assert.throws(f,undefined,label);checks++;};
const agency='00000000-0000-4000-8000-000000000101',other='00000000-0000-4000-8000-000000000102',actor='00000000-0000-4000-8000-000000000001',key=randomBytes(32).toString('base64');
const password='FAKE-ONLY-password-with-spaces \u00a3';
const cipher=encrypt(password,agency,key);
eq(decrypt(cipher,agency,key),password,'Encrypted credential roundtrip');eq(cipher.includes(password),false,'Ciphertext hides plaintext');eq(encrypt(password,agency,key)!==cipher,true,'Random nonce per encryption');
throws(()=>decrypt(cipher,other,key),'Tenant-bound encryption');throws(()=>decrypt(cipher,agency,randomBytes(32).toString('base64')),'Wrong key fails');throws(()=>decrypt(cipher.replace(/^v1:/,'v2:'),agency,key),'Unknown version fails');
const tampered=cipher.split(':');tampered[2]=Buffer.alloc(16).toString('base64');throws(()=>decrypt(tampered.join(':'),agency,key),'Tampered tag fails');
eq(ready(undefined),false);eq(ready('short'),false);eq(ready(key),true);
let record=null,verifyCalls=0,verifiedPassword=null,rpcCalls=[],rpcError=null,testFail=false;
const deps={serverReady:true,encryptionReady:true,sendingEnabled:false,checksEnabled:true,authenticate:async()=>actor,
 encrypt:(p,a)=>encrypt(p,a,key),decrypt:(c,a)=>decrypt(c,a,key),verify:async(c,p)=>{verifyCalls++;verifiedPassword=p;eq(c.host,'smtp.ionos.co.uk');if(testFail)throw Error('PRIVATE '+password);},
 rpc:async(name,args)=>{rpcCalls.push({name,args});if(rpcError)return {data:null,error:rpcError};if(args.p_agency!==agency)return {data:null,error:{code:'42501'}};
 if(name==='read_agency_email_settings')return {data:record,error:null};
 if(name==='save_agency_email_settings'){record={revision:randomUUID(),from_name:args.p_name,from_email:args.p_email,smtp_port:args.p_port,encrypted_password:args.p_encrypted,enabled:false,verified_at:null,PRIVATE_SERVER_VALUE:password};return {data:null,error:null};}
 if(name==='change_agency_email_settings'){if(args.p_action==='check_start'){record={...record,enabled:false,verified_at:null};return {data:{testId:randomUUID()},error:null};}if(args.p_action==='check_passed')record={...record,verified_at:new Date().toISOString()};if(args.p_action==='enable'){if(!args.p_authorised)return {data:null,error:{code:'22023'}};record={...record,enabled:true};}if(args.p_action==='disable')record={...record,enabled:false};return {data:{},error:null};}
 throw Error('Unexpected RPC');}};
async function run(body,overrides={},auth='Bearer fake',selected=agency){const request=new Request('http://localhost/api/agency-email-settings?agencyId='+selected,{method:body===undefined?'GET':'POST',headers:{Authorization:auth},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify({agencyId:selected,...body})})});const r=await handle(request,{...deps,...overrides});eq(r.headers.get('cache-control'),'no-store','No caching');return {status:r.status,...await r.json()};}
eq((await run(undefined,{},'')).status,401);eq((await run(undefined,{serverReady:false})).status,503);eq((await run(undefined,{authenticate:async()=>null})).status,401);eq((await run(undefined,{},'Bearer fake',other)).status,403);eq(verifyCalls,0,'No connection before authorisation');
let r=await run();eq(r.settings.hasPassword,false);eq(r.settings.platformSendingEnabled,false);eq(r.settings.credentialStorageReady,true);
const base={action:'save',revision:null,fromName:'Sample agency',fromEmail:'sender@example.test',smtpPort:587,password};
eq((await run('{')).status,400);eq((await run({...base,smtpHost:'127.0.0.1'})).status,400,'Arbitrary host rejected');eq((await run({...base,fromName:'Name\r\nBcc: other'})).status,400);eq((await run({...base,smtpPort:25})).status,400);eq((await run({...base,password:''})).status,400);eq((await run(base,{encryptionReady:false})).status,503,'Missing encryption blocks password save');
r=await run(base);eq(r.status,200);eq(r.settings.hasPassword,true);eq(r.settings.enabled,false);eq(decrypt(record.encrypted_password,agency,key),password);eq(JSON.stringify(r).includes(password),false);eq(JSON.stringify(r).includes(record.encrypted_password),false);eq(JSON.stringify(r).includes('PRIVATE_SERVER_VALUE'),false);
r=await run();eq(JSON.stringify(r).includes(password),false,'GET has no credential material');
eq((await run(base)).status,409,'Stale revision blocked');
let revision=record.revision;const oldCipher=record.encrypted_password;
r=await run({...base,revision,password:'',fromName:'Updated agency'});eq(r.status,200);eq(record.encrypted_password,oldCipher,'Blank password retained securely');
revision=record.revision;eq((await run({...base,revision,password:'',fromEmail:'other@example.test'})).status,400,'Changed mailbox requires its own password');
eq((await run({action:'check',revision},{checksEnabled:false})).status,503);eq(verifyCalls,0,'Paused check never connects');
r=await run({action:'check',revision});eq(r.status,200);eq(verifyCalls,1);eq(verifiedPassword,password,'Decrypt only on server');eq(Boolean(r.settings.verifiedAt),true);eq(r.settings.enabled,false,'Check does not enable sender');
eq((await run({action:'enable',revision,authorised:false})).status,400,'Sender attestation required');r=await run({action:'enable',revision,authorised:true});eq(r.settings.enabled,true);
r=await run({action:'disable',revision},{encryptionReady:false});eq(r.settings.enabled,false,'Pause remains available if encryption unavailable');
testFail=true;r=await run({action:'check',revision});eq(r.status,400);eq(r.settings.enabled,false);eq(r.settings.verifiedAt,null);eq(JSON.stringify(r).includes(password),false,'Provider error detail hidden');
for(const [code,status] of [['54000',429],['40001',409],['42501',403],['XX000',503]]){rpcError={code};eq((await run()).status,status);}rpcError=null;
eq(rpcCalls.filter(c=>c.name==='save_agency_email_settings').every(c=>c.args.p_actor===actor),true,'Actor is verified identity');
eq(verifyCalls,2,'Only explicit checks connect');
console.log(`PASS ${checks} agency settings/encryption assertions; no real credentials or connections`);
