// Synthetic schema derived from the audited catalog. No production records or credentials.
import { readFile } from 'node:fs/promises';
export const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const quote = s => `"${s.replaceAll('"','""')}"`;
export async function fixtureSql() {
  const c = JSON.parse(await readFile(new URL('../../docs/db/audit/catalog-2026-11-14.json',import.meta.url)));
  const names=['agencies','profiles','agency_memberships','artists','venues','gigs','workflow_events','activity_log','venue_feedback'];
  const sql=[`create role authenticated nologin nosuperuser nobypassrls;
    create role anon nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;`];
  for(const name of names){
    const cols=c.columns.filter(c=>c.table_name===name).map(c=>`${quote(c.column_name)} ${c.udt_name}${c.is_generated==='ALWAYS'?` generated always as (${c.generation_expression}) stored`:c.column_default?` default ${c.column_default}`:''}${c.is_nullable==='NO'?' not null':''}`);
    sql.push(`create table public.${quote(name)}(${cols.join(',')});alter table public.${quote(name)} enable row level security;`);
  }
  for(const x of c.constraints.filter(c=>names.includes(c.table)).sort((a,b)=>Number(a.type==='f')-Number(b.type==='f')))sql.push(`alter table public.${quote(x.table)} add constraint ${quote(x.name)} ${x.definition};`);
  for(const name of ['is_super_user','is_agency_member','is_agency_admin'])sql.push(c.functions.find(f=>f.name===name).definition+';');
  for(const p of c.policies.filter(p=>p.schemaname==='public'&&names.includes(p.tablename)))sql.push(`create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':quote(r)).join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''};`);
  for(const g of c.table_grants.filter(g=>g.table_schema==='public'&&names.includes(g.table_name)))sql.push(`grant ${g.privilege_type} on public.${quote(g.table_name)} to ${g.grantee==='PUBLIC'?'public':quote(g.grantee)};`);
  for(const n of [1,2,3,4,5])sql.push(`insert into auth.users values ('${uid(n)}');insert into public.profiles(id,display_name) values ('${uid(n)}','Agent ${n}');`);
  for(const n of [101,102])sql.push(`insert into public.agencies(id,name) values ('${uid(n)}','Test agency ${n}');`);
  for(const [a,u,r] of [[101,1,'agent'],[102,2,'agent'],[101,4,'agent'],[101,5,'admin']])sql.push(`insert into public.agency_memberships(agency_id,user_id,role) values ('${uid(a)}','${uid(u)}','${r}');`);
  for(const [a,artist] of [[101,201],[102,202]])sql.push(`insert into public.artists(id,agency_id,name) values ('${uid(artist)}','${uid(a)}','Artist ${artist}');`);
  for(const [id,status,start,creator] of [[301,'cancelled',"now()+interval '10 days'",1],[302,'confirmed',"now()+interval '10 days'",1],[303,'cancelled',"now()-interval '1 day'",1],[304,'cancelled',"now()+interval '10 days'",null],[305,'cancelled',"now()+interval '10 days'",1]])sql.push(`insert into public.gigs(id,agency_id,artist_id,title,status,starts_at,created_by) values ('${uid(id)}','${uid(101)}','${uid(201)}','Gig ${id}','${status}',${start},${creator?`'${uid(creator)}'`:'null'});`);
  sql.push(`insert into public.activity_log(id,agency_id,entity_type,entity_id,activity_type,summary,notes,assigned_to,metadata) values
    ('${uid(401)}','${uid(101)}','gig','${uid(301)}','task','Prepare poster','Keep this original note','${uid(1)}','{"workflow_event_id":"original","custom":true}'),
    ('${uid(402)}','${uid(101)}','gig','${uid(305)}','task','Notify relevant parties about gig cancellation',null,'${uid(1)}','{"event_type":"gig.cancelled"}');
    insert into public.activity_log(id,agency_id,entity_type,entity_id,activity_type,summary,completed_at,assigned_to) values
    ('${uid(403)}','${uid(101)}','gig','${uid(301)}','task','Already completed',now()-interval '1 day','${uid(1)}');`);
  return sql.join('\n');
}
