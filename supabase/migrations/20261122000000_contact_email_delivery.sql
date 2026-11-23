-- Prepared only: review/rehearse before applying to the shared database.
begin;
-- No default sender, and no browser access to provider credentials/configuration.
create table public.agency_email_senders (
  agency_id uuid primary key references public.agencies(id),
  from_name text not null check (length(from_name) between 1 and 120 and from_name !~ '[<>\r\n]'),
  from_email text not null check (from_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  smtp_host text not null check (smtp_host in ('smtp.ionos.co.uk')),
  smtp_port integer not null default 587 check (smtp_port in (465,587)),
  smtp_username text not null check (smtp_username=from_email),
  encrypted_password text not null check (length(encrypted_password) between 20 and 12000),
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  last_test_attempt_at timestamptz,
  authorised_by uuid references auth.users(id),
  authorised_at timestamptz,
  enabled boolean not null default false,
  verified_at timestamptz,
  check (not enabled or verified_at is not null)
);
create table public.contact_email_deliveries (
  id uuid primary key,
  agency_id uuid not null references public.agencies(id),
  actor_id uuid not null references auth.users(id),
  venue_id uuid not null,
  venue_contact_id uuid not null,
  subject text not null,
  text_body text not null,
  bcc_myself boolean not null,
  payload jsonb not null,
  sender_revision uuid not null,
  smtp_connection jsonb not null,
  smtp_started_at timestamptz,
  state text not null default 'pending' check (state in ('pending','sent')),
  created_at timestamptz not null default now(),
  lease_until timestamptz,
  attempts integer not null default 0,
  provider_id text,
  accepted_at timestamptz,
  foreign key (agency_id,venue_id) references public.venues(agency_id,id),
  foreign key (agency_id,venue_id,venue_contact_id) references public.venue_contacts(agency_id,venue_id,id)
);
create index contact_email_deliveries_actor_created on public.contact_email_deliveries(actor_id,created_at);
create index contact_email_deliveries_agency_created on public.contact_email_deliveries(agency_id,created_at);
alter table public.agency_email_senders enable row level security;
alter table public.contact_email_deliveries enable row level security;
revoke all on public.agency_email_senders,public.contact_email_deliveries from public,anon,authenticated,service_role;
grant select on public.contact_email_deliveries to authenticated;
create policy own_contact_email_deliveries on public.contact_email_deliveries for select to authenticated
  using (actor_id=auth.uid() and exists(select 1 from public.agency_memberships m where m.agency_id=contact_email_deliveries.agency_id and m.user_id=auth.uid()));

-- Only the authenticated server calls these routines with the verified identity.
create function public.prepare_contact_email(p_actor uuid,p_agency uuid,p_contact uuid,p_id uuid,p_subject text,p_text text,p_bcc boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.contact_email_deliveries; c public.venue_contacts; s public.agency_email_senders; b text;
begin
  if not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=p_actor) then
    raise exception 'Agency access required' using errcode='42501';
  end if;
  -- Serialize new sends/rate-limit decisions for the agency, including concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,1));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_agency::text,0));
  select * into d from public.contact_email_deliveries where id=p_id for update;
  if found then
    if d.actor_id<>p_actor or d.agency_id<>p_agency or d.venue_contact_id<>p_contact then
      raise exception 'Request unavailable' using errcode='42501';
    end if;
    if p_subject is not null and (d.subject<>p_subject or d.text_body is distinct from p_text or d.bcc_myself is distinct from p_bcc) then
      raise exception 'Retry must use the original message' using errcode='22023';
    end if;
  else
    if p_subject is null or length(btrim(p_subject)) not between 1 and 200 or p_subject ~ '[\r\n]' or
       p_text is null or length(btrim(p_text)) not between 1 and 20000 or p_bcc is null then
      raise exception 'Valid subject and message required' using errcode='22023';
    end if;
    select * into c from public.venue_contacts where id=p_contact and agency_id=p_agency;
    if not found or c.email is null or c.email !~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+\.[^[:space:]@<>,;]+$' then
      raise exception 'Contact unavailable or email invalid' using errcode='22023';
    end if;
    if not exists(select 1 from public.venues where id=c.venue_id and agency_id=p_agency) then
      raise exception 'Venue unavailable' using errcode='42501';
    end if;
    select * into s from public.agency_email_senders where agency_id=p_agency and enabled and verified_at is not null;
    if not found then raise exception 'Agency email sending is not configured' using errcode='55000';end if;
    if (select count(*) from public.contact_email_deliveries where actor_id=p_actor and created_at>now()-interval '1 minute')>=5 or
       (select count(*) from public.contact_email_deliveries where agency_id=p_agency and created_at>now()-interval '1 hour')>=100 then
      raise exception 'Email limit reached; try later' using errcode='54000';
    end if;
    if p_bcc then
      select email into b from auth.users where id=p_actor and email_confirmed_at is not null;
      if b is null then raise exception 'Confirm your email before requesting a copy' using errcode='22023';end if;
    end if;
    insert into public.contact_email_deliveries(id,agency_id,actor_id,venue_id,venue_contact_id,subject,text_body,bcc_myself,payload,sender_revision,smtp_connection)
    values(p_id,p_agency,p_actor,c.venue_id,p_contact,p_subject,p_text,p_bcc,
      jsonb_build_object('from',s.from_name||' <'||s.from_email||'>','to',jsonb_build_array(c.email),'subject',p_subject,'text',p_text)
        || case when b is null then '{}'::jsonb else jsonb_build_object('bcc',jsonb_build_array(b)) end,s.revision,jsonb_build_object('host',s.smtp_host,'port',s.smtp_port,'user',s.smtp_username)) returning * into d;
  end if;
  if d.state='sent' then return jsonb_build_object('state','sent','id',d.id);end if;
  -- A recorded SMTP receipt can finish history without ever sending again.
  if d.provider_id is not null then return jsonb_build_object('state','finalize','id',d.id,'providerId',d.provider_id);end if;
  -- SMTP has no idempotency guarantee. Any started send with no saved receipt needs review.
  if d.smtp_started_at is not null then return jsonb_build_object('state','review','id',d.id);end if;
  if d.created_at<now()-interval '23 hours' or d.attempts>=20 then
    return jsonb_build_object('state','review','id',d.id);
  end if;
  if d.lease_until>now() then return jsonb_build_object('state','busy','id',d.id);end if;
  -- Do not retry after sender disablement, contact removal or loss of the agency relationship.
  if not exists(select 1 from public.venue_contacts where id=d.venue_contact_id and agency_id=d.agency_id and venue_id=d.venue_id and email=d.payload->'to'->>0) or
     not exists(select 1 from public.agency_email_senders where agency_id=d.agency_id and enabled and verified_at is not null and revision=d.sender_revision and from_name||' <'||from_email||'>'=d.payload->>'from' and jsonb_build_object('host',smtp_host,'port',smtp_port,'user',smtp_username)=d.smtp_connection) then
    return jsonb_build_object('state','review','id',d.id);
  end if;
  update public.contact_email_deliveries set lease_until=now()+interval '60 seconds',attempts=attempts+1 where id=d.id;
  return jsonb_build_object('state','ready','id',d.id,'payload',d.payload,'encryptedPassword',(select encrypted_password from public.agency_email_senders where agency_id=d.agency_id and revision=d.sender_revision),'connection',d.smtp_connection);
end$$;

-- Persist a one-way send barrier BEFORE connecting to SMTP. A crashed/ambiguous send
-- is never automatically resent, even if the client retries or the lease expires.
create function public.start_contact_email(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.contact_email_deliveries d set smtp_started_at=now()
    where d.id=p_id and d.state='pending' and d.smtp_started_at is null and d.lease_until>now()
      and exists(select 1 from public.agency_memberships m where m.agency_id=d.agency_id and m.user_id=d.actor_id)
      and exists(select 1 from public.agency_email_senders s where s.agency_id=d.agency_id and s.revision=d.sender_revision and s.enabled);
  return found;
end$$;
create function public.record_contact_email_receipt(p_id uuid,p_provider text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_provider is null or length(p_provider) not between 1 and 200 then raise exception 'Provider receipt required';end if;
  update public.contact_email_deliveries set provider_id=p_provider,accepted_at=now() where id=p_id and smtp_started_at is not null and provider_id is null;
  if not found and not exists(select 1 from public.contact_email_deliveries where id=p_id and provider_id=p_provider) then
    raise exception 'Delivery receipt conflict';
  end if;
end$$;

create function public.complete_contact_email(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.contact_email_deliveries;
begin
  select * into strict d from public.contact_email_deliveries where id=p_id for update;
  if d.state='sent' then return;end if;
  if d.provider_id is null then raise exception 'Provider receipt required';end if;
  insert into public.contact_emails(id,agency_id,venue_id,venue_contact_id,actor_id,direction,subject,text_body,thread_key,status,sent_at,from_name,from_email,to_email,bcc_email)
    values(d.id,d.agency_id,d.venue_id,d.venue_contact_id,d.actor_id,'outbound',d.subject,d.text_body,'venue-contact-'||d.venue_contact_id,'sent',d.accepted_at,
      split_part(d.payload->>'from',' <',1),substring(d.payload->>'from' from '<([^<>]+)>$'),d.payload->'to'->>0,d.payload->'bcc'->>0);
  insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary,created_by,metadata)
    values(d.agency_id,'venue',d.venue_id,'email','Email accepted by sending provider.',d.actor_id,
      jsonb_build_object('legacy_activity_type','email_sent','contact_id',d.venue_contact_id,'subject',d.subject,'smtp_message_id',d.provider_id,'delivery_id',d.id));
  update public.contact_email_deliveries set state='sent',lease_until=null where id=d.id;
end$$;
revoke all on function public.prepare_contact_email(uuid,uuid,uuid,uuid,text,text,boolean),public.start_contact_email(uuid),public.record_contact_email_receipt(uuid,text),public.complete_contact_email(uuid) from public,anon,authenticated;
grant execute on function public.prepare_contact_email(uuid,uuid,uuid,uuid,text,text,boolean),public.start_contact_email(uuid),public.record_contact_email_receipt(uuid,text),public.complete_contact_email(uuid) to service_role;
-- Eliminate browser-forged delivery history. Column ACLs exist in the baseline too.
revoke insert,update,delete on public.contact_emails from authenticated;
do $$declare cols text;begin
  select string_agg(quote_ident(attname),',') into cols from pg_attribute where attrelid='public.contact_emails'::regclass and attnum>0 and not attisdropped;
  execute 'revoke insert ('||cols||'), update ('||cols||'), references ('||cols||') on public.contact_emails from authenticated';
end$$;
commit;
