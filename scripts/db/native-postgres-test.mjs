// Disposable native PostgreSQL adapter for SQL regression tests; private Unix socket, no TCP.
import { spawn,execFile,execFileSync } from 'node:child_process';
import { mkdtemp,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function nativePostgresTest() {
  const bin=process.env.MOSAIC_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin';
  const root=await mkdtemp(join(tmpdir(),'mosaic-invitation-test-'));
  const data=join(root,'data'),socket=join(root,'socket');
  const run=(name,args)=>execFileSync(join(bin,name),args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  let started=false,client;
  try {
    await mkdir(socket,{mode:0o700});
    run('initdb',['-D',data,'-U','fixture_owner','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject']);
    run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-k ${socket} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start']);
    started=true;
    // Merge stdout/stderr in the child so SQL errors precede their completion marker reliably.
    // Shell source is fixed; paths/arguments are separate argv values, never interpolated.
    client=spawn('/bin/sh',['-c','exec "$@" 2>&1','psql',join(bin,'psql'),'-X','-qAt','-h',socket,'-U','fixture_owner','-d','postgres','-v','ON_ERROR_STOP=0'],{stdio:['pipe','pipe','pipe']});
    let buffer='',pending=null,sequence=0;
    client.stdout.setEncoding('utf8');
    client.stdout.on('data',chunk=>{
      buffer+=chunk;
      while(buffer.includes('\n')){
        const end=buffer.indexOf('\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+1);
        if(!pending)continue;
        if(line===pending.marker){const p=pending;pending=null;p.resolve(p.lines);}
        else pending.lines.push(line);
      }
    });
    client.on('exit',()=>{if(pending){pending.reject(new Error('Native psql exited before completing SQL'));pending=null;}});
    const exec=async sql=>{
      if(pending)throw new Error('Native test adapter requires sequential statements');
      const lines=await new Promise((resolve,reject)=>{
        const marker=`MOSAIC_SQL_DONE_${++sequence}`;pending={marker,lines:[],resolve,reject};
        client.stdin.write(`${sql};\n\\echo ${marker}\n`);
      });
      const error=lines.findIndex(line=>/^ERROR:|^FATAL:/.test(line));
      if(error>=0)throw new Error(lines.slice(error).join('\n'));
      return lines.filter(line=>line&&!/^WARNING:|^NOTICE:/.test(line));
    };
    const literal=value=>value==null?'NULL':typeof value==='number'?String(value):typeof value==='boolean'?(value?'true':'false'):`'${String(value).replaceAll("'","''")}'`;
    return {
      exec,
      async query(sql,params=[]){
        const text=sql.replace(/\$(\d+)\b/g,(_,n)=>literal(params[Number(n)-1]));
        if(/^\s*select\b/i.test(text)){
          const lines=await exec(`select coalesce(json_agg(mosaic_result),'[]'::json) from (${text}) mosaic_result`);
          return {rows:JSON.parse(lines.join('\n'))};
        }
        if(/\breturning\b/i.test(text)){
          const lines=await exec(`with mosaic_write as (${text}) select coalesce(json_agg(mosaic_write),'[]'::json) from mosaic_write`);
          return {rows:JSON.parse(lines.join('\n'))};
        }
        await exec(text);return {rows:[]};
      },
      async concurrent(statements){
        return Promise.all(statements.map(sql=>new Promise(resolve=>{
          execFile(join(bin,'psql'),['-X','-qAt','-h',socket,'-U','fixture_owner','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',timeout:15000},(error,stdout,stderr)=>resolve({ok:!error,output:stdout+stderr}));
        })));
      },
      async close(){
        client.stdin.end();
        await new Promise(resolve=>client.once('exit',resolve));
        run('pg_ctl',['-D',data,'-m','fast','-w','stop']);started=false;
        await rm(root,{recursive:true,force:true});
      },
    };
  } catch(error) {
    client?.kill();
    if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
    await rm(root,{recursive:true,force:true});
    throw error;
  }
}
