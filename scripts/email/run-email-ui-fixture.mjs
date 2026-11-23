// Separate app on 3001. Does not alter localhost:3000, read .env.local or send mail.
import {mkdtemp,cp,writeFile,symlink,rm,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
const repo=resolve('.'),root=await mkdtemp('/private/tmp/mosaic-email-ui-');
for(const name of ['src','public','tsconfig.json','package.json'])await cp(resolve(repo,name),resolve(root,name),{recursive:true});
await symlink(resolve(repo,'node_modules'),resolve(root,'node_modules'));
await writeFile(resolve(root,'next.config.ts'),`export default {reactCompiler:true};`);
await mkdir(resolve(root,'src/app/email-test'),{recursive:true});
await writeFile(resolve(root,'src/app/email-test/page.tsx'),`"use client";
import VenueContactsSection from "../venues/[id]/_components/VenueContactsSection";
import type {Venue,VenueContact} from "../venues/[id]/_lib/types";
const venue={id:"00000000-0000-4000-8000-000000000301",agency_id:"00000000-0000-4000-8000-000000000101",name:"Synthetic venue"} as Venue;
const contact={id:"00000000-0000-4000-8000-000000000401",agency_id:venue.agency_id,venue_id:venue.id,name:"Synthetic contact",email:"contact@example.test"} as VenueContact;
export default function Test(){return <><h1>Synthetic email test — no real sending</h1><VenueContactsSection venue={venue} contacts={[contact]} onContactsChanged={async()=>{}}/></>;}`);
let mode='empty';
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3001');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:55492');
 const json=(v,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(v));};
 if(url.pathname.startsWith('/mode/')){mode=url.pathname.split('/').at(-1);json({mode});return;}
 if(url.pathname==='/auth/v1/user'){json({id:'00000000-0000-4000-8000-000000000001',email:'agent@example.test',aud:'authenticated',role:'authenticated'});return;}
 if(url.pathname==='/auth/v1/token'){json({access_token:'fake-test-token',refresh_token:'fake-refresh',token_type:'bearer',expires_in:3600,user:{id:'00000000-0000-4000-8000-000000000001',email:'agent@example.test',aud:'authenticated',role:'authenticated'}});return;}
 if(url.pathname==='/rest/v1/contact_email_deliveries'){
  if(mode==='unavailable'){json({message:'Synthetic database outage'},503);return;}
  json(mode==='pending'?[{id:'00000000-0000-4000-8000-000000000501',subject:'Saved subject',text_body:'Saved original message',bcc_myself:true}]:[]);return;
 }
 if(url.pathname==='/rest/v1/profiles'){json({id:'00000000-0000-4000-8000-000000000001',is_super_user:false});return;}
 json([]);
});
await new Promise(r=>server.listen(55492,'127.0.0.1',r));
const dev=spawn(process.execPath,[resolve(repo,'node_modules/next/dist/bin/next'),'dev',root,'--webpack','--port','3001','--hostname','127.0.0.1'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55492',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-key',SUPABASE_SERVICE_ROLE_KEY:'',CONTACT_EMAIL_SENDING_ENABLED:'false',RESEND_API_KEY:''}});
let stopping=false;async function stop(){if(stopping)return;stopping=true;dev.kill('SIGTERM');server.close();await rm(root,{recursive:true,force:true});}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{void stop();});
dev.on('exit',()=>{void stop();});
console.log('Email-only UI fixture on http://localhost:3001/email-test; shared-data app on 3000 is untouched.');
