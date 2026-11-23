-- Prepared locally only. Admin reconciliation never connects to a mail provider.
begin;
alter table public.contact_email_deliveries drop constraint contact_email_deliveries_state_check;
alter table public.contact_email_deliveries add constraint contact_email_deliveries_state_check check(state in ('pending','sent','not_sent'));
alter table public.contact_email_deliveries add column resolved_at timestamptz;
alter table public.contact_email_deliveries add column resolved_by uuid references auth.users(id);
create table public.contact_email_delivery_reviews (
 id uuid primary key,
 agency_id uuid not null references public.agencies(id),
 delivery_id uuid not null references public.contact_email_deliveries(id),
 actor_id uuid not null references auth.users(id),
 outcome text not null check(outcome in ('finish_history','accepted','not_accepted')),
 evidence text not null check(length(btrim(evidence)) between 10 and 2000),
 accepted_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.contact_email_delivery_reviews enable row level security;
revoke all on public.contact_email_delivery_reviews from public,anon,authenticated,service_role;
create or replace function public.prepare_contact_email(p_actor uuid,p_agency uuid,p_contact uuid,p_id uuid,p_subject text,p_text text,p_bcc boolean)
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
  if d.state='not_sent' then return jsonb_build_object('state','cancelled','id',d.id);end if;
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

create or replace function public.record_contact_email_receipt(p_id uuid,p_provider text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_provider is null or length(p_provider) not between 1 and 200 then raise exception 'Provider receipt required';end if;
  update public.contact_email_deliveries set provider_id=p_provider,accepted_at=now() where id=p_id and state='pending' and smtp_started_at is not null and provider_id is null;
  if not found and not exists(select 1 from public.contact_email_deliveries where id=p_id and provider_id=p_provider) then
    raise exception 'Delivery receipt conflict';
  end if;
end$$;

create or replace function public.complete_contact_email(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.contact_email_deliveries;
begin
  select * into strict d from public.contact_email_deliveries where id=p_id for update;
  if d.state='sent' then return;end if;
  if d.state<>'pending' then raise exception 'Delivery was resolved without sending' using errcode='40001';end if;
  if d.provider_id is null then raise exception 'Provider receipt required';end if;
  insert into public.contact_emails(id,agency_id,venue_id,venue_contact_id,actor_id,direction,subject,text_body,thread_key,status,sent_at,from_name,from_email,to_email,bcc_email)
    values(d.id,d.agency_id,d.venue_id,d.venue_contact_id,d.actor_id,'outbound',d.subject,d.text_body,'venue-contact-'||d.venue_contact_id,'sent',d.accepted_at,
      split_part(d.payload->>'from',' <',1),substring(d.payload->>'from' from '<([^<>]+)>$'),d.payload->'to'->>0,d.payload->'bcc'->>0);
  insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary,created_by,metadata)
    values(d.agency_id,'venue',d.venue_id,'email','Email accepted by sending provider.',d.actor_id,
      jsonb_build_object('legacy_activity_type','email_sent','contact_id',d.venue_contact_id,'subject',d.subject,'smtp_message_id',d.provider_id,'delivery_id',d.id));
  update public.contact_email_deliveries set state='sent',lease_until=null where id=d.id;
end$$;

create function public.list_contact_email_reviews(p_actor uuid,p_agency uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=p_actor and role='admin') then
  raise exception 'Agency admin required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(r.item order by r.created_at) from (
  select d.created_at,jsonb_build_object('id',d.id,'subject',d.subject,'toEmail',d.payload->'to'->>0,'from',d.payload->>'from',
   'createdAt',d.created_at,'startedAt',d.smtp_started_at,'acceptedAt',d.accepted_at,
   'reference',coalesce(d.provider_id,'<'||d.id||'@'||split_part(d.smtp_connection->>'user','@',2)||'>'),
   'category',case when d.provider_id is not null then 'history' when d.smtp_started_at is null then 'unsent' else 'uncertain' end,
   'busy',d.smtp_started_at is not null and (coalesce(d.lease_until>now(),false) or d.smtp_started_at>now()-interval '2 minutes')) item
  from public.contact_email_deliveries d where d.agency_id=p_agency and d.state='pending' order by d.created_at limit 50
 ) r),'[]'::jsonb);
end$$;

create function public.resolve_contact_email_review(p_actor uuid,p_agency uuid,p_id uuid,p_review uuid,p_outcome text,p_evidence text,p_accepted_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.contact_email_deliveries; previous public.contact_email_delivery_reviews;
begin
 if not exists(select 1 from public.agency_memberships where agency_id=p_agency and user_id=p_actor and role='admin') then
  raise exception 'Agency admin required' using errcode='42501';end if;
 if p_review is null or p_evidence is null or length(btrim(p_evidence)) not between 10 and 2000 or p_outcome is null or p_outcome not in ('finish_history','accepted','not_accepted') then
  raise exception 'Resolution and evidence required' using errcode='22023';end if;
 if p_outcome<>'accepted' and p_accepted_at is not null then raise exception 'Unexpected acceptance time' using errcode='22023';end if;
 -- Same request ID is safe to retry; a changed decision must never reuse it.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_review::text,3));
 select * into previous from public.contact_email_delivery_reviews where id=p_review;
 if found then
  if previous.agency_id<>p_agency or previous.actor_id<>p_actor or previous.delivery_id<>p_id or previous.outcome<>p_outcome or previous.evidence<>p_evidence or previous.accepted_at is distinct from p_accepted_at then
   raise exception 'Review request changed' using errcode='40001';end if;
  return jsonb_build_object('state',case when previous.outcome='not_accepted' then 'not_sent' else 'sent' end);
 end if;
 select * into d from public.contact_email_deliveries where id=p_id and agency_id=p_agency for update;
 if not found then raise exception 'Delivery unavailable' using errcode='42501';end if;
 if d.state<>'pending' then raise exception 'Delivery already resolved; reload' using errcode='40001';end if;
 if d.smtp_started_at is not null and (d.lease_until>now() or d.smtp_started_at>now()-interval '2 minutes') then
  raise exception 'Delivery may still be in progress; wait and reload' using errcode='55000';end if;
 if p_outcome='finish_history' then
  if d.provider_id is null then raise exception 'Saved receipt required' using errcode='22023';end if;
  perform public.complete_contact_email(p_id);
 elsif p_outcome='accepted' then
  if d.smtp_started_at is null or d.provider_id is not null or p_accepted_at is null or p_accepted_at<d.smtp_started_at or p_accepted_at>now() then
   raise exception 'Verified acceptance time required' using errcode='22023';end if;
  update public.contact_email_deliveries set provider_id='<'||d.id||'@'||split_part(d.smtp_connection->>'user','@',2)||'>',accepted_at=p_accepted_at where id=p_id;
  perform public.complete_contact_email(p_id);
 else
  if d.provider_id is not null then raise exception 'Cannot reject a recorded acceptance' using errcode='22023';end if;
  update public.contact_email_deliveries set state='not_sent',lease_until=null where id=p_id;
  insert into public.activity_log(agency_id,entity_type,entity_id,activity_type,summary,created_by,metadata)
   values(p_agency,'venue',d.venue_id,'email','Email request closed without resending after review.',p_actor,
    jsonb_build_object('delivery_id',p_id,'contact_id',d.venue_contact_id,'review_id',p_review,'outcome','not_accepted'));
 end if;
 insert into public.contact_email_delivery_reviews(id,agency_id,delivery_id,actor_id,outcome,evidence,accepted_at)
  values(p_review,p_agency,p_id,p_actor,p_outcome,p_evidence,p_accepted_at);
 update public.contact_email_deliveries set resolved_at=now(),resolved_by=p_actor where id=p_id;
 return jsonb_build_object('state',case when p_outcome='not_accepted' then 'not_sent' else 'sent' end);
end$$;
revoke all on function public.list_contact_email_reviews(uuid,uuid),public.resolve_contact_email_review(uuid,uuid,uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.list_contact_email_reviews(uuid,uuid),public.resolve_contact_email_review(uuid,uuid,uuid,uuid,text,text,timestamptz) to service_role;
commit;
