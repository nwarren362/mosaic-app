// Add remaining audited public tables to the synthetic browser fixture; no production records.
import { readFile } from 'node:fs/promises';
import { uid } from './gig-archive-fixture.mjs';
const quote=s=>`"${s.replaceAll('"','""')}"`;
export async function coreLifecycleUiFixture(){
 const c=JSON.parse(await readFile(new URL('../../docs/db/audit/catalog-2026-11-14.json',import.meta.url)));
 const existing=['agencies','profiles','agency_memberships','artists','venues','gigs','workflow_events','activity_log','venue_feedback','task_status_view'];
 const names=[...new Set(c.columns.map(x=>x.table_name))].filter(n=>!existing.includes(n));
 const sql=['create extension if not exists citext;create schema if not exists extensions;create extension if not exists pgcrypto with schema extensions;'];
 for(const name of names){
  const cols=c.columns.filter(x=>x.table_name===name).map(x=>`${quote(x.column_name)} ${x.udt_name}${x.is_generated==='ALWAYS'?` generated always as (${x.generation_expression}) stored`:x.column_default?` default ${x.column_default}`:''}${x.is_nullable==='NO'?' not null':''}`);
  sql.push(`create table public.${quote(name)}(${cols.join(',')});alter table public.${quote(name)} enable row level security;`);
 }
 for(const x of c.constraints.filter(x=>names.includes(x.table)).sort((a,b)=>Number(a.type==='f')-Number(b.type==='f')))sql.push(`alter table public.${quote(x.table)} add constraint ${quote(x.name)} ${x.definition};`);
 for(const p of c.policies.filter(p=>p.schemaname==='public'&&names.includes(p.tablename)))sql.push(`create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':quote(r)).join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''};`);
 sql.push(`create view public.task_status_view as ${c.views[0].definition};`);
 for(const g of c.table_grants.filter(g=>g.table_schema==='public'&&[...names,'task_status_view'].includes(g.table_name)))sql.push(`grant ${g.privilege_type} on public.${quote(g.table_name)} to ${g.grantee==='PUBLIC'?'public':quote(g.grantee)};`);
 // Fixture owner differs from hosted postgres; install the already-verified isolation state directly.
 sql.push('alter view public.task_status_view set (security_invoker=true);drop policy "agency can access own artist_tags" on public.artist_tags;drop policy "agency can access own tags" on public.agency_tags;');
 sql.push(await readFile(new URL('../../docs/db/migrations/20261115_artist_deletion_roles.sql',import.meta.url),'utf8'));
 for(const n of [203,204])sql.push(`insert into public.artists(id,agency_id,name) values('${uid(n)}','${uid(101)}','Empty artist ${n}');`);
 for(const n of [401,402])sql.push(`insert into public.venues(id,agency_id,name,status) values('${uid(n)}','${uid(101)}','Venue ${n}','approved');`);
 sql.push(`update public.gigs set venue_id='${uid(402)}',venue='Venue 402' where id='${uid(301)}';select set_config('request.jwt.claim.sub','${uid(1)}',false);select public.archive_gig('${uid(301)}','${uid(101)}','Synthetic archived venue history',true,true);`);
 return sql.join('\n');
}
