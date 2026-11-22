// Loopback-only synthetic Auth/API. No provider calls, database or real email capability.
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const origin='http://localhost:3000';
const userId='00000000-0000-4000-8000-000000000001';
const agency='00000000-0000-4000-8000-000000000101';
const secret='synthetic-onboarding-only-no-real-provider-key';
let joined=false,acceptCalls=0;
const jwt=email=>{
 const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub:userId,email,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 return `${head}.${payload}.${createHmac('sha256',secret).update(`${head}.${payload}`).digest('base64url')}`;
};
const user=(email='new@example.test',confirmed=true)=>({id:userId,email,role:'authenticated',aud:'authenticated',email_confirmed_at:confirmed?new Date().toISOString():null,created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]});
const session=email=>({access_token:jwt(email),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:user(email)});
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:55490');
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 try{
  if(url.pathname==='/fixture'){
   const token=jwt('new@example.test');
   const fragment=new URLSearchParams({access_token:token,refresh_token:'fixture-refresh',expires_in:'3600',token_type:'bearer',type:'signup'});
   res.writeHead(200,{'Content-Type':'text/html'});res.end(`<h1>Synthetic onboarding links — no email</h1><p><a href="${origin}/accept-invite?token=${'a'.repeat(48)}">Start sample invitation</a></p><p><a href="${origin}/auth/confirm#${fragment}">Simulate valid confirmation</a></p><p><a href="${origin}/auth/confirm#error=access_denied&error_code=otp_expired">Simulate expired confirmation</a></p>`);return;
  }
  if(url.pathname==='/fixture-stats'){json({joined,acceptCalls});return;}
  if(url.pathname==='/fixture-reset' && req.method==='POST'){joined=false;acceptCalls=0;json({reset:true});return;}
  const chunks=[];for await(const part of req)chunks.push(part);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
  if(url.pathname==='/auth/v1/signup'){
   if(body.email==='fail@example.test'){json({msg:'Synthetic signup unavailable',code:'unexpected_failure'},500);return;}
   if(body.email==='immediate@example.test'){json(session(body.email));return;}
   console.log('Synthetic signup requested; redirect:',url.searchParams.get('redirect_to'));
   json(user(body.email,false));return;
  }
  if(url.pathname==='/auth/v1/token'){
   if(body.email==='unconfirmed@example.test'){json({msg:'Email not confirmed',code:'email_not_confirmed'},400);return;}
   json(session(body.email??'new@example.test'));return;
  }
  if(url.pathname==='/auth/v1/user'){
   let email='new@example.test';
   try{email=JSON.parse(Buffer.from(req.headers.authorization.split('.')[1],'base64url')).email;}catch{}
   json(user(email));return;
  }
  if(url.pathname==='/auth/v1/logout'){json({});return;}
  if(url.pathname==='/rest/v1/rpc/accept_agency_invitation'){
   acceptCalls++;
   if(body.p_token!=='a'.repeat(48)){json({message:'This invitation is for a different email address. Sign in with the invited account'},400);return;}
   if(joined){json({message:'Invitation already accepted'},400);return;}
   joined=true;json({agency_id:agency,role:'agent',user_id:userId});return;
  }
  if(url.pathname==='/rest/v1/profiles'){json({id:userId,is_super_user:false});return;}
  if(url.pathname==='/rest/v1/agency_memberships'){
   json(joined && !url.searchParams.has('role')?[{agency_id:agency,role:'agent',agencies:{id:agency,name:'Onboarding sample agency'}}]:[]);return;
  }
  if(url.pathname==='/rest/v1/agencies'){json({id:agency,name:'Onboarding sample agency',theme_preset:'obsidian',logo_url:null});return;}
  json([]);
 }catch{json({message:'Synthetic fixture failure'},500);}
});
await new Promise(resolve=>server.listen(55490,'127.0.0.1',resolve));
await writeFile('/private/tmp/mosaic-onboarding-client-env.json',JSON.stringify({url:'http://127.0.0.1:55490',anon:jwt('')}),{mode:0o600});
console.log('Synthetic onboarding backend ready: http://127.0.0.1:55490/fixture');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit()));
