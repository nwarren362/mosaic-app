// Start both local sample services, with real mail sending explicitly disabled.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const backend=spawn(process.execPath,['scripts/auth/serve-onboarding-fixture.mjs'],{stdio:['ignore','pipe','inherit']});
let dev;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{dev?.kill(signal);backend.kill(signal);});
await new Promise((resolve,reject)=>{
 backend.once('exit',code=>reject(new Error(`Sample backend stopped (${code})`)));
 backend.stdout.on('data',chunk=>{process.stdout.write(chunk);if(chunk.toString().includes('Synthetic onboarding backend ready:'))resolve();});
});
const config=JSON.parse(await readFile('/private/tmp/mosaic-onboarding-client-env.json','utf8'));
if(config.url!=='http://127.0.0.1:55490'){backend.kill();throw new Error('Refusing non-synthetic backend');}
dev=spawn('npm',['run','dev','--','--hostname','127.0.0.1'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.anon,RESEND_API_KEY:''}});
dev.on('exit',code=>{backend.kill();process.exitCode=code??0;});
backend.on('exit',()=>dev?.kill());
