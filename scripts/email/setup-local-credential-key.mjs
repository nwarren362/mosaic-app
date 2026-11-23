// Create a local-only master key without printing it. Never overwrite an existing key.
import {readFile,appendFile,chmod,lstat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const file='.env.local';
execFileSync('git',['check-ignore','-q',file],{stdio:'ignore'});
const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('Expected a regular ignored .env.local file');
const text=await readFile(file,'utf8');
const existing=text.match(/^\s*(?:export\s+)?EMAIL_CREDENTIAL_ENCRYPTION_KEY\s*=\s*(.*?)\s*$/m);
if(existing){
 const key=existing[1].replace(/^(['"])(.*)\1$/,'$2');
 if(!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)throw Error('Existing email encryption key needs review; it was not changed');
 await chmod(file,0o600);console.log('Existing local email encryption key retained. File permissions are private.');
}else{
 await chmod(file,0o600);
 await appendFile(file,(text.endsWith('\n')?'':'\n')+'\n# Server-only agency SMTP password encryption; retain across deployments.\nEMAIL_CREDENTIAL_ENCRYPTION_KEY='+randomBytes(32).toString('base64')+'\n',{mode:0o600});
 console.log('Created a private local email encryption key. No key was displayed; email sending remains disabled.');
}
