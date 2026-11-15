// Local-only sample backend for browser acceptance; synthetic auth is NOT a Supabase Auth test.
import { mkdtemp,writeFile,mkdir,rm } from 'node:fs/promises';
import { spawn,execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { fixtureSql,uid } from './gig-archive-fixture.mjs';
import { readFile } from 'node:fs/promises';
const pg='/opt/homebrew/opt/postgresql@17/bin/';
const root=await mkdtemp('/private/tmp/mosaic-gig-ui-');
const socket=root+'/socket';await mkdir(socket,{mode:0o700});
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['pipe','pipe','pipe']});
run(pg+'initdb',['-D',root+'/data','-U','fixture_owner','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject']);
run(pg+'pg_ctl',['-D',root+'/data','-l',root+'/postgres.log','-o',`-k ${socket} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);
let sql=await fixtureSql()+await readFile(new URL('../../docs/db/migrations/20261114_gig_archiving.sql',import.meta.url),'utf8')+`\ncreate role authenticator login noinherit;grant authenticated,anon to authenticator;`;
if(process.argv.includes('--membership')) {
  sql+=await readFile(new URL('./membership-ui-fixture.sql',import.meta.url),'utf8');
  sql+=await readFile(new URL('../../docs/db/migrations/20261115_membership_safeguards.sql',import.meta.url),'utf8');
}
await writeFile(root+'/fixture.sql',sql,{mode:0o600});
run(pg+'psql',['-h',socket,'-U','fixture_owner','-d','postgres','-v','ON_ERROR_STOP=1','-f',root+'/fixture.sql']);
const secret='synthetic-local-fixture-secret-at-least-thirty-two-bytes';
const jwt=n=>{const a=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({role:n?'authenticated':'anon',sub:n?uid(n):undefined,aud:'authenticated',exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');return `${a}.${b}.${createHmac('sha256',secret).update(`${a}.${b}`).digest('base64url')}`;};
await writeFile(root+'/postgrest.conf',`db-uri = "postgresql://authenticator@/postgres?host=${socket}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${secret}"\nserver-host = "127.0.0.1"\nserver-port = 55481\n`,{mode:0o600});
const rest=spawn('/opt/homebrew/bin/postgrest',[root+'/postgrest.conf'],{stdio:['ignore','ignore','pipe']});
rest.stderr.on('data',d=>process.stderr.write(d));
const user=n=>({id:uid(n),aud:'authenticated',role:'authenticated',email:`agent${n}@example.test`,email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:new Date().toISOString()});
const api=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range,Range-Unit,Preference-Applied');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 try{
 if(req.url.startsWith('/auth/v1/')){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
  res.setHeader('content-type','application/json');
  if(req.url.startsWith('/auth/v1/token')){const n=Number(body.email?.match(/^agent([1-5])@example.test$/)?.[1]??1);res.end(JSON.stringify({access_token:jwt(n),refresh_token:`fixture-${n}`,token_type:'bearer',expires_in:7200,user:user(n)}));return;}
  if(req.url.startsWith('/auth/v1/user')){const payload=JSON.parse(Buffer.from(req.headers.authorization.split('.')[1],'base64url'));res.end(JSON.stringify(user(Number(payload.sub.slice(-12)))));return;}
  res.end('{}');return;
 }
 const url='http://127.0.0.1:55481'+req.url.replace(/^\/rest\/v1/,'');
 const headers={...req.headers};delete headers.host;delete headers.origin;delete headers.connection;
 const chunks=[];for await(const c of req)chunks.push(c);
 const r=await fetch(url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
 for(const k of ['content-type','content-range','range-unit','preference-applied'])if(r.headers.has(k))res.setHeader(k,r.headers.get(k));
 res.writeHead(r.status);res.end(Buffer.from(await r.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end(JSON.stringify({message:e.message}));}
});
await new Promise(r=>api.listen(55480,'127.0.0.1',r));
await writeFile(root+'/client-env.json',JSON.stringify({url:'http://127.0.0.1:55480',anon:jwt(null),socket,root}),{mode:0o600});
console.log(`Synthetic backend ready on 127.0.0.1:55480; no production data. Client env: ${root}/client-env.json`);
async function stop(){api.close();rest.kill();try{run(pg+'pg_ctl',['-D',root+'/data','-m','fast','-w','stop']);}finally{await rm(root,{recursive:true,force:true});process.exit();}}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
