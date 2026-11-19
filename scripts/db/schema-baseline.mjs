// Application schema only. Supabase-managed Auth/Storage must already exist.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const ident = s => `"${s.replaceAll('"', '""')}"`;
const role = s => s === 'PUBLIC' ? s : ident(s);
function aclGrants(acl, object, kind, letters) {
  if (acl == null) return []; // PostgreSQL's default ACL is intentional.
  return acl.slice(1,-1).split(',').filter(Boolean).flatMap(entry => {
    const m=entry.match(/^([^=]*)=([^/]*)\/.+$/);
    if(!m) throw new Error(`Unsupported ACL: ${entry}`);
    const grantee=m[1] || 'PUBLIC';
    return [...m[2].matchAll(/([A-Za-z])([*]?)/g)].map(([,letter,grant]) => {
      if(!letters[letter]) throw new Error(`Unsupported ${kind} privilege ${letter}`);
      return `grant ${letters[letter]} on ${kind} ${object} to ${role(grantee)}${grant ? ' with grant option' : ''};`;
    });
  });
}
export function schemaBaseline(c) {
  const tables=c.relations.filter(r=>r.schema==='public' && r.kind==='r');
  if(c.relations.some(r=>r.schema==='public' && !['r','v'].includes(r.kind))) throw new Error('Unsupported public relation kind');
  if(c.columns.some(x=>x.is_identity==='YES' || x.column_default?.includes('nextval('))) throw new Error('Sequence/identity requires explicit baseline support');
  const sql=[
    '-- Mosaic application baseline. EMPTY destination only; never replay on production.',
    '-- Requires Supabase roles, auth.users/auth.uid(), storage.objects/storage.foldername().',
    '-- Managed platform schemas, Auth settings, bucket records and file bytes are excluded.',
    'begin;set local check_function_bodies=false;',
    `do $$begin if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relkind in ('r','v','m','p','f')) then raise exception 'Baseline requires an empty public application schema';end if;end$$;`,
    `do $$begin if exists(select 1 from pg_default_acl where defaclrole in ('postgres'::regrole,current_user::regrole) and defaclnamespace in (0,'public'::regnamespace)) then raise exception 'Destination default privileges require review before baseline restore';end if;end$$;`,
    'create schema if not exists extensions;',
    'create extension if not exists pgcrypto with schema extensions;',
    'create extension if not exists citext with schema public;',
    'create extension if not exists pg_trgm with schema public;',
    'alter schema public owner to postgres;revoke all on schema public from public,anon,authenticated,service_role;',
    ...aclGrants(c.schema_acl.find(x=>x.schema==='public').acl,'public','schema',{U:'usage',C:'create'}),
  ];
  for(const t of tables){
    const cols=c.columns.filter(x=>x.table_schema==='public' && x.table_name===t.name).map(x=>{
      const type=x.data_type==='ARRAY' ? `${ident(x.udt_name.slice(1))}[]` : ident(x.udt_name);
      return `${ident(x.column_name)} ${type}${x.is_generated==='ALWAYS' ? ` generated always as (${x.generation_expression}) stored` : x.column_default ? ` default ${x.column_default}` : ''}${x.is_nullable==='NO' ? ' not null' : ''}`;
    });
    sql.push(`create table public.${ident(t.name)} (${cols.join(',\n')});alter table public.${ident(t.name)} owner to ${ident(t.owner)};`);
  }
  for(const x of c.constraints.filter(x=>x.type!=='f')) sql.push(`alter table public.${ident(x.table)} add constraint ${ident(x.name)} ${x.definition};`);
  for(const x of c.constraints.filter(x=>x.type==='f')) sql.push(`alter table public.${ident(x.table)} add constraint ${ident(x.name)} ${x.definition};`);
  const constraintNames=new Set(c.constraints.map(x=>x.name));
  for(const i of c.indexes) if(!constraintNames.has(i.indexname)) sql.push(i.indexdef+';');
  for(const f of c.functions){
    // Supabase owns extension routines; CREATE EXTENSION restores those objects.
    if(f.owner==='supabase_admin') continue;
    if(f.owner!=='postgres') throw new Error(`Unreviewed function owner: ${f.owner}`);
    const signature=`public.${ident(f.name)}(${f.identity_args})`;
    sql.push(f.definition+';',`alter function ${signature} owner to ${ident(f.owner)};`);
    if(f.acl!=null) sql.push(`revoke all on function ${signature} from public,anon,authenticated,service_role;`,...aclGrants(f.acl,signature,'function',{X:'execute'}));
  }
  for(const v of c.views){
    const r=c.relations.find(r=>r.schema==='public' && r.name===v.name);
    sql.push(`create view public.${ident(v.name)}${r.options?.length ? ` with (${r.options.join(',')})` : ''} as ${v.definition.replace(/;\s*$/,'')};`,`alter view public.${ident(v.name)} owner to ${ident(r.owner)};`);
  }
  for(const t of tables) if(t.rls) sql.push(`alter table public.${ident(t.name)} enable row level security;${t.force_rls ? `alter table public.${ident(t.name)} force row level security;` : ''}`);
  for(const p of c.policies) sql.push(`create policy ${ident(p.policyname)} on ${ident(p.schemaname)}.${ident(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(role).join(',')}${p.qual ? ` using (${p.qual})` : ''}${p.with_check ? ` with check (${p.with_check})` : ''};`);
  for(const t of c.triggers.filter(t=>t.schema==='public' || (t.schema==='auth' && t.name==='on_auth_user_created'))) {
    sql.push(t.definition+';');
    if(t.enabled!=='O') throw new Error('Non-default trigger state requires explicit support');
  }
  for(const g of c.table_grants.filter(g=>g.table_schema==='public')) sql.push(`grant ${g.privilege_type} on public.${ident(g.table_name)} to ${role(g.grantee)}${g.is_grantable==='YES' ? ' with grant option' : ''};`);
  for(const g of c.column_grants ?? []) sql.push(`grant ${g.privilege_type} (${ident(g.column_name)}) on public.${ident(g.table_name)} to ${role(g.grantee)}${g.is_grantable==='YES' ? ' with grant option' : ''};`);
  if(c.default_acl.some(x=>x.schema==='public' || x.schema==null)) throw new Error('Public/global default ACL needs explicit baseline support');
  sql.push('commit;');
  return sql.join('\n')+'\n';
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const c=JSON.parse(await readFile(process.argv[2],'utf8'));
  await writeFile(process.argv[3],schemaBaseline(c));
}
