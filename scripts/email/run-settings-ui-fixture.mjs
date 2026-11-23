// Isolated app + native SQL. No .env.local, real SMTP credentials, or external email calls.
import {mkdtemp,cp,writeFile,symlink,rm} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {randomBytes,createHmac} from 'node:crypto';
import {resolve} from 'node:path';
import {nativePostgresTest} from '../db/native-postgres-test.mjs';
import {platformContract} from '../db/baseline-platform-fixture.mjs';
const repo=resolve('.'),root=await mkdtemp('/private/tmp/mosaic-settings-ui-'),db=await nativePostgresTest();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let dev,server,stopping=false;
async function stop(){if(stopping)return;stopping=true;dev?.kill('SIGTERM');server?.close();await db.close();await rm(root,{recursive:true,force:true});}
try{
 await db.exec(platformContract);
 for(const file of ['20261119000000_application_baseline.sql','20261119000100_application_privileges.sql','20261122000000_contact_email_delivery.sql','20261122000100_agency_email_settings.sql'])await db.exec(await readFile(resolve(repo,'supabase/migrations',file),'utf8'));
 await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id(1)}','admin@example.test',now(),'{}'),('${id(2)}','agent@example.test',now(),'{}'),('${id(3)}','other@example.test',now(),'{}');
 insert into public.agencies(id,name) values('${id(101)}','Sample agency A'),('${id(102)}','Other agency B');
 insert into public.agency_memberships(agency_id,user_id,role) values('${id(101)}','${id(1)}','admin'),('${id(101)}','${id(2)}','agent'),('${id(102)}','${id(3)}','admin');`);
 for(const name of ['src','public','tsconfig.json','package.json'])await cp(resolve(repo,name),resolve(root,name),{recursive:true});
 await symlink(resolve(repo,'node_modules'),resolve(root,'node_modules'));
 await writeFile(resolve(root,'next.config.ts'),'export default {reactCompiler:true};');
 const route=resolve(root,'src/app/api/agency-email-settings/route.ts');
 await writeFile(route,(await readFile(route,'utf8')).replace('verify: verifyContactSmtp,','verify: async () => { const result = await fetch("http://127.0.0.1:55493/fixture-verify"); if (!result.ok) throw new Error("Synthetic verification failure"); },'));
 const jwt=n=>{const a=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({sub:id(n),role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${a}.${b}.${createHmac('sha256','synthetic-settings-only').update(`${a}.${b}`).digest('base64url')}`;};
 const user=n=>({id:id(n),email:n===2?'agent@example.test':'admin@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{}});
 let mode='pass',verifyCalls=0,queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3001');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:55493');
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
   if(url.pathname==='/fixture-state'){json({mode,verifyCalls,smtpSendCalls:0});return;}
   if(url.pathname==='/fixture-verify'){verifyCalls++;json({synthetic:true},mode==='pass'?200:400);return;}
   if(url.pathname.startsWith('/fixture-mode/') && req.method==='POST'){mode=url.pathname.split('/').at(-1);await serial(()=>db.exec("update public.agency_email_senders set last_test_attempt_at=null"));json({mode});return;}
   const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
   let n=1;try{const p=JSON.parse(Buffer.from((req.headers.authorization??'').split('.')[1],'base64url'));n=Number(p.sub.slice(-12));}catch{}
   if(url.pathname.startsWith('/auth/v1/token')){n=body.email==='agent@example.test'?2:1;json({access_token:jwt(n),refresh_token:`fake-${n}`,expires_in:3600,token_type:'bearer',user:user(n)});return;}
   if(url.pathname.startsWith('/auth/v1/user')){json(user(n));return;}
   if(url.pathname.startsWith('/auth/v1/logout')){json({});return;}
   if(url.pathname==='/rest/v1/profiles'){json({id:id(n),is_super_user:false});return;}
   if(url.pathname==='/rest/v1/agency_memberships'){
    const role=n===2?'agent':'admin';const requested=url.searchParams.get('role');
    json(requested && requested!==`eq.${role}`?[]:[{agency_id:id(101),role,agencies:{id:id(101),name:'Sample agency A'}}]);return;
   }
   if(url.pathname==='/rest/v1/agencies'){const agency={id:id(101),name:'Sample agency A',theme_preset:'obsidian',logo_url:null};json(req.headers.accept?.includes('vnd.pgrst.object')?agency:[agency]);return;}
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    if(req.headers.authorization!=='Bearer synthetic-service-key'){json({code:'42501'},403);return;}
    const name=url.pathname.split('/').at(-1);
    const params={read_agency_email_settings:['p_actor','p_agency'],save_agency_email_settings:['p_actor','p_agency','p_revision','p_name','p_email','p_port','p_encrypted'],change_agency_email_settings:['p_actor','p_agency','p_revision','p_action','p_test','p_authorised']}[name];
    if(!params){json({code:'42501'},403);return;}
    const {rows}=await serial(()=>db.query(`select public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) d`,params.map(k=>body[k]??(k==='p_authorised'?false:null))));json(rows[0].d);return;
   }
   json([]);
  }catch(error){const message=String(error.message);const code=/Agency admin/.test(message)?'42501':/changed|reload/.test(message)?'40001':/Wait one minute/.test(message)?'54000':/Check the connection/.test(message)?'55000':'22023';json({code,message:'Synthetic settings request rejected'},400);}
 });
 await new Promise(r=>server.listen(55493,'127.0.0.1',r));
 dev=spawn(process.execPath,[resolve(repo,'node_modules/next/dist/bin/next'),'dev',root,'--webpack','--port','3001','--hostname','127.0.0.1'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55493',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon-key',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key',EMAIL_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString('base64'),EMAIL_CONNECTION_CHECKS_ENABLED:'true',CONTACT_EMAIL_SENDING_ENABLED:'false',RESEND_API_KEY:''}});
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{void stop();});
 dev.on('exit',()=>{void stop();});
 console.log('Synthetic admin SMTP settings: http://localhost:3001/admin/email (admin@example.test / any sample password). No real SMTP or mail. Port 3000 untouched.');
}catch(error){await stop();throw error;}
