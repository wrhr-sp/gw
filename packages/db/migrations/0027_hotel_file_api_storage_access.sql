begin;

-- 0027_hotel_file_api_storage_access
-- Successor API commands bind short-lived storage authority to the active creator session.

alter table public.hotel_file_uploads
  add column initiated_session_id uuid,
  add column reservation_fingerprint text,
  add constraint hotel_file_uploads_initiated_session_fk
    foreign key (company_id, initiated_session_id)
    references public.auth_sessions(company_id, id),
  add constraint hotel_file_uploads_v2_reservation_check check (
    (initiated_session_id is null and reservation_fingerprint is null)
    or (
      initiated_session_id is not null
      and reservation_fingerprint is not null
      and pg_catalog.btrim(reservation_fingerprint) = reservation_fingerprint
      and pg_catalog.octet_length(reservation_fingerprint) between 32 and 512
      and expires_at <= created_at + interval '5 minutes'
    )
  );

create table public.hotel_file_access_grants (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  branch_id uuid not null,
  parent_type text not null,
  parent_id uuid not null,
  file_version_id uuid not null,
  issued_by uuid not null,
  issued_by_type text not null check (issued_by_type in ('INTERNAL_STAFF', 'HOUSEKEEPING', 'HOTEL_OWNER')),
  session_id uuid not null,
  grant_token_hash bytea not null unique
    check (pg_catalog.octet_length(grant_token_hash) = 32),
  disposition text not null check (disposition in ('INLINE', 'ATTACHMENT')),
  expires_at timestamptz not null,
  issued_at timestamptz not null default pg_catalog.statement_timestamp(),
  last_outcome text check (last_outcome in ('STARTED', 'SUCCEEDED', 'FAILED', 'ABORTED')),
  outcome_recorded_at timestamptz,
  unique (company_id, branch_id, id),
  foreign key (company_id, branch_id, parent_type, parent_id, file_version_id)
    references public.hotel_file_versions(company_id, branch_id, parent_type, parent_id, id),
  foreign key (company_id, issued_by) references public.users(company_id, id),
  foreign key (company_id, session_id) references public.auth_sessions(company_id, id),
  check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes'),
  check ((last_outcome is null) = (outcome_recorded_at is null))
);
create index hotel_file_access_grants_user_rate_idx
  on public.hotel_file_access_grants(company_id, issued_by, issued_at desc);
create index hotel_file_access_grants_branch_rate_idx
  on public.hotel_file_access_grants(company_id, branch_id, issued_at desc);

create policy hotel_file_api_terminal_audit_insert
  on public.audit_events
  for insert
  to werehere_hotel_file_api_definer
  with check (
    current_user = 'werehere_hotel_file_api_definer'
    and event_code = 'HOTEL_FILE_ACCESS_OUTCOME_RECORDED'
    and resource_type = 'HOTEL_FILE_ACCESS_GRANT'
    and actor_user_id is not null
    and session_id is not null
    and branch_id is not null
  );

alter table public.hotel_file_access_grants enable row level security;
alter table public.hotel_file_access_grants force row level security;
create policy hotel_file_access_grants_definer_only
  on public.hotel_file_access_grants
  using (
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_hotel_file_api_definer' then true
      else false
    end
  )
  with check (
    case
      when public.runtime_is_schema_owner() then true
      when current_user = 'werehere_hotel_file_api_definer' then true
      else false
    end
  );
revoke all on table public.hotel_file_access_grants from public;

create function public.reject_hotel_file_upload_v2_authority_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.initiated_session_id is distinct from old.initiated_session_id
     or new.reservation_fingerprint is distinct from old.reservation_fingerprint then
    raise exception using errcode = '23514', message = 'hotel file upload creator session authority is immutable';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_hotel_file_upload_v2_authority_change() from public;
create trigger hotel_file_uploads_v2_authority_immutable
before update of initiated_session_id, reservation_fingerprint on public.hotel_file_uploads
for each row execute function public.reject_hotel_file_upload_v2_authority_change();

create function public.reject_hotel_file_access_grant_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.branch_id is distinct from old.branch_id
     or new.parent_type is distinct from old.parent_type
     or new.parent_id is distinct from old.parent_id
     or new.file_version_id is distinct from old.file_version_id
     or new.issued_by is distinct from old.issued_by
     or new.issued_by_type is distinct from old.issued_by_type
     or new.session_id is distinct from old.session_id
     or new.grant_token_hash is distinct from old.grant_token_hash
     or new.disposition is distinct from old.disposition
     or new.expires_at is distinct from old.expires_at
     or new.issued_at is distinct from old.issued_at then
    raise exception using errcode = '23514', message = 'hotel file access grant identity is immutable';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_hotel_file_access_grant_identity_change() from public;
create trigger hotel_file_access_grants_identity_immutable
before update of id, company_id, branch_id, parent_type, parent_id, file_version_id,
  issued_by, issued_by_type, session_id, grant_token_hash, disposition, expires_at, issued_at
on public.hotel_file_access_grants
for each row execute function public.reject_hotel_file_access_grant_identity_change();

-- Returns the active actor only after personal DENY precedence, a current ALLOW,
-- and an active exact hotel scope have all been checked.
create function public.hotel_file_api_authorized_actor(p_branch_id uuid, p_permission_code text)
returns table(session_id uuid, user_id uuid, user_type text, company_id uuid)
language sql
volatile
parallel unsafe
set search_path = pg_catalog
as $function$
  with active_actor as (
    select session_record.id as session_id, session_record.user_id,
      user_record.user_type, session_record.company_id
    from public.auth_sessions session_record
    join public.users user_record
      on user_record.company_id = session_record.company_id
     and user_record.id = session_record.user_id
    join public.companies company_record
      on company_record.id = session_record.company_id
     and company_record.status = 'ACTIVE'
    join public.hotel_profiles hotel_record
      on hotel_record.company_id = session_record.company_id
     and hotel_record.branch_id = p_branch_id
     and hotel_record.hotel_status = 'ACTIVE'
    where public.runtime_has_capability('API_RUNTIME')
      and session_record.company_id = public.api_current_company_id()
      and session_record.id = nullif(pg_catalog.current_setting('app.session_id', true), '')::uuid
      and session_record.revoked_at is null
      and session_record.idle_expires_at > pg_catalog.statement_timestamp()
      and session_record.absolute_expires_at > pg_catalog.statement_timestamp()
      and user_record.status = 'ACTIVE'
  ), effective_subjects as (
    select 'USER'::text as subject_type, actor.user_id as subject_id
    from active_actor actor
    union all
    select 'ROLE', membership.role_id
    from active_actor actor
    join public.user_role_memberships membership
      on membership.company_id = actor.company_id and membership.user_id = actor.user_id
    join public.roles role_record
      on role_record.company_id = membership.company_id and role_record.id = membership.role_id
    where membership.valid_from <= pg_catalog.statement_timestamp()
      and (membership.valid_until is null or membership.valid_until > pg_catalog.statement_timestamp())
      and role_record.status = 'ACTIVE'
    union all
    select 'GROUP', membership.group_id
    from active_actor actor
    join public.user_group_memberships membership
      on membership.company_id = actor.company_id and membership.user_id = actor.user_id
    join public.user_groups group_record
      on group_record.company_id = membership.company_id and group_record.id = membership.group_id
    where membership.valid_from <= pg_catalog.statement_timestamp()
      and (membership.valid_until is null or membership.valid_until > pg_catalog.statement_timestamp())
      and group_record.status = 'ACTIVE'
  ), permission_effects as (
    select permission_record.effect
    from active_actor actor
    join public.permission_grants permission_record
      on permission_record.company_id = actor.company_id
    join effective_subjects subject
      on subject.subject_type = permission_record.subject_type
     and subject.subject_id = permission_record.subject_id
    where permission_record.permission_code = p_permission_code
      and (permission_record.branch_id is null or permission_record.branch_id = p_branch_id)
      and permission_record.valid_from <= pg_catalog.statement_timestamp()
      and (permission_record.valid_until is null or permission_record.valid_until > pg_catalog.statement_timestamp())
  )
  select actor.session_id, actor.user_id, actor.user_type, actor.company_id
  from active_actor actor
  where exists (
      select 1 from public.hotel_staff_assignments scope_record
      where actor.user_type = 'INTERNAL_STAFF'
        and scope_record.company_id = actor.company_id
        and scope_record.branch_id = p_branch_id
        and scope_record.user_id = actor.user_id
        and scope_record.terminated_at is null
        and scope_record.start_date <= current_date
        and (scope_record.end_date is null or scope_record.end_date >= current_date)
      union all
      select 1 from public.housekeeping_hotel_links scope_record
      where actor.user_type = 'HOUSEKEEPING'
        and scope_record.company_id = actor.company_id
        and scope_record.branch_id = p_branch_id
        and scope_record.user_id = actor.user_id
        and scope_record.terminated_at is null
        and scope_record.start_date <= current_date
        and (scope_record.end_date is null or scope_record.end_date >= current_date)
      union all
      select 1 from public.hotel_owner_assignments scope_record
      where actor.user_type = 'HOTEL_OWNER'
        and scope_record.company_id = actor.company_id
        and scope_record.branch_id = p_branch_id
        and scope_record.user_id = actor.user_id
        and scope_record.terminated_at is null
        and scope_record.start_date <= current_date
        and (scope_record.end_date is null or scope_record.end_date >= current_date)
    )
    and exists (select 1 from permission_effects where effect = 'ALLOW')
    and not exists (select 1 from permission_effects where effect = 'DENY')
$function$;
revoke all on function public.hotel_file_api_authorized_actor(uuid, text) from public;

create function public.hotel_file_init_upload_v2(
  p_upload_id uuid, p_branch_id uuid, p_parent_type text, p_parent_id uuid,
  p_declared_file_name text, p_declared_mime_type text, p_declared_size_bytes bigint,
  p_quarantine_object_key text, p_ttl_seconds integer, p_reservation_fingerprint text,
  p_idempotency_id uuid, p_idempotency_key text, p_request_hash text, p_trace_id uuid
)
returns table(result_status text, upload_id uuid, state text, expires_at timestamptz)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- HOTEL_FILE_UPLOAD permission_grants DENY is evaluated by hotel_file_api_authorized_actor.
  v_actor record; v_existing record; v_now timestamptz := pg_catalog.statement_timestamp();
  v_expires_at timestamptz; v_audit_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_ttl_seconds not between 1 and 300
     or p_reservation_fingerprint is null
     or pg_catalog.btrim(p_reservation_fingerprint) <> p_reservation_fingerprint
     or pg_catalog.octet_length(p_reservation_fingerprint) not between 32 and 512 then
    raise exception using errcode='22023', message='invalid hotel file upload reservation';
  end if;
  select * into v_actor from public.hotel_file_api_authorized_actor(p_branch_id, 'HOTEL_FILE_UPLOAD');
  if not found then return query select 'FORBIDDEN'::text,null::uuid,null::text,null::timestamptz; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_actor.company_id::text||':'||v_actor.user_id::text||':'||p_idempotency_key||':POST:/api/hotel-files/uploads',0
  ));
  perform 1 from public.file_attachment_parents parent_record
    where parent_record.company_id=v_actor.company_id and parent_record.branch_id=p_branch_id
      and parent_record.parent_type=p_parent_type and parent_record.parent_id=p_parent_id for update;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::text,null::timestamptz; return; end if;
  select idempotency_record.request_hash,idempotency_record.resource_id into v_existing
    from public.idempotency_records idempotency_record
    where idempotency_record.company_id=v_actor.company_id
      and idempotency_record.actor_user_id=v_actor.user_id
      and idempotency_record.idempotency_key=p_idempotency_key
      and idempotency_record.http_method='POST'
      and idempotency_record.operation_path='/api/hotel-files/uploads' for update;
  if found then
    if v_existing.request_hash<>p_request_hash then
      return query select 'IDEMPOTENCY_CONFLICT'::text,null::uuid,null::text,null::timestamptz;
    else
      return query select 'REPLAYED'::text,upload_record.id,upload_record.state,upload_record.expires_at
        from public.hotel_file_uploads upload_record
        where upload_record.company_id=v_actor.company_id
          and upload_record.id=v_existing.resource_id
          and upload_record.initiated_by=v_actor.user_id
          and upload_record.initiated_session_id=v_actor.session_id
          and upload_record.expires_at>v_now;
      if not found then return query select 'IDEMPOTENCY_CONFLICT'::text,null::uuid,null::text,null::timestamptz; end if;
    end if;
    return;
  end if;
  v_expires_at := v_now + pg_catalog.make_interval(secs=>p_ttl_seconds);
  insert into public.hotel_file_uploads(
    id,company_id,branch_id,parent_type,parent_id,initiated_by,initiated_session_id,
    reservation_fingerprint,declared_file_name,declared_mime_type,declared_size_bytes,
    reserved_size_bytes,quarantine_object_key,expires_at,created_at,updated_at
  ) values (
    p_upload_id,v_actor.company_id,p_branch_id,p_parent_type,p_parent_id,v_actor.user_id,v_actor.session_id,
    p_reservation_fingerprint,p_declared_file_name,p_declared_mime_type,p_declared_size_bytes,
    p_declared_size_bytes,p_quarantine_object_key,v_expires_at,v_now,v_now
  );
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id)
  values(v_audit_id,'HOTEL_FILE_UPLOAD_INITIATED',v_actor.user_id,v_actor.user_type,v_actor.session_id,
    v_actor.company_id,p_branch_id,'HOTEL_FILE_UPLOAD',p_upload_id,
    pg_catalog.jsonb_build_object('state','PENDING_UPLOAD','reservedSizeBytes',p_declared_size_bytes),'SUCCEEDED',p_trace_id);
  insert into public.idempotency_records(id,company_id,actor_user_id,idempotency_key,http_method,
    operation_path,request_hash,status,resource_type,resource_id,audit_event_id,result_snapshot,
    completed_at,expires_at)
  values(p_idempotency_id,v_actor.company_id,v_actor.user_id,p_idempotency_key,'POST',
    '/api/hotel-files/uploads',p_request_hash,'COMPLETED','HOTEL_FILE_UPLOAD',p_upload_id,v_audit_id,
    pg_catalog.jsonb_build_object('uploadId',p_upload_id),v_now,v_now+interval '24 hours');
  return query select 'CREATED'::text,p_upload_id,'PENDING_UPLOAD'::text,v_expires_at;
end
$function$;

create function public.hotel_file_authorize_upload_body_v1(p_upload_id uuid)
returns table(result_status text, upload_id uuid, quarantine_object_key text,
  reserved_size_bytes bigint, declared_mime_type text, expires_at timestamptz,
  reservation_fingerprint text, upload_state text, source_etag text,
  source_object_version text)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- HOTEL_FILE_UPLOAD permission_grants DENY and active hotel scope are rechecked here.
  v_upload record; v_actor record;
begin
  select * into v_upload from public.hotel_file_uploads upload_record
    where upload_record.id=p_upload_id and upload_record.company_id=public.api_current_company_id() for update;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::text,null::bigint,null::text,null::timestamptz,null::text,null::text,null::text,null::text; return; end if;
  select * into v_actor from public.hotel_file_api_authorized_actor(v_upload.branch_id,'HOTEL_FILE_UPLOAD');
  if not found or v_upload.initiated_by<>v_actor.user_id
     or v_upload.initiated_session_id<>v_actor.session_id then
    return query select 'NOT_FOUND'::text,null::uuid,null::text,null::bigint,null::text,null::timestamptz,null::text,null::text,null::text,null::text; return;
  end if;
  perform 1 from public.file_attachment_parents parent_record
    where parent_record.company_id=v_upload.company_id and parent_record.branch_id=v_upload.branch_id
      and parent_record.parent_type=v_upload.parent_type and parent_record.parent_id=v_upload.parent_id;
  if not found or (v_upload.state='PENDING_UPLOAD' and v_upload.expires_at<=pg_catalog.statement_timestamp())
     or v_upload.state not in ('PENDING_UPLOAD','QUARANTINED') then
    return query select 'NOT_FOUND'::text,null::uuid,null::text,null::bigint,null::text,null::timestamptz,null::text,null::text,null::text,null::text; return;
  end if;
  return query select 'AUTHORIZED'::text,v_upload.id,v_upload.quarantine_object_key,
    v_upload.reserved_size_bytes,v_upload.declared_mime_type,v_upload.expires_at,
    v_upload.reservation_fingerprint,v_upload.state,v_upload.source_etag,
    v_upload.source_object_version;
end
$function$;

create function public.hotel_file_complete_upload_v2(
  p_upload_id uuid, p_reservation_fingerprint text, p_source_etag text,
  p_source_object_version text, p_source_size_bytes bigint, p_source_mime_type text,
  p_scan_job_id uuid, p_trace_id uuid
)
returns table(result_status text, upload_id uuid, scan_job_id uuid, state text)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- HOTEL_FILE_UPLOAD permission_grants DENY, exact parent, initiated_by and initiated_session_id are mandatory.
  v_upload record; v_actor record; v_job_id uuid; v_now timestamptz:=pg_catalog.statement_timestamp();
begin
  select * into v_upload from public.hotel_file_uploads upload_record
    where upload_record.company_id=public.api_current_company_id() and upload_record.id=p_upload_id for update;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::uuid,null::text; return; end if;
  select * into v_actor from public.hotel_file_api_authorized_actor(v_upload.branch_id,'HOTEL_FILE_UPLOAD');
  if not found or v_upload.initiated_by<>v_actor.user_id
     or v_upload.initiated_session_id<>v_actor.session_id
     or v_upload.reservation_fingerprint is distinct from p_reservation_fingerprint then
    return query select 'NOT_FOUND'::text,null::uuid,null::uuid,null::text; return;
  end if;
  perform 1 from public.file_attachment_parents parent_record
    where parent_record.company_id=v_upload.company_id and parent_record.branch_id=v_upload.branch_id
      and parent_record.parent_type=v_upload.parent_type and parent_record.parent_id=v_upload.parent_id;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::uuid,null::text; return; end if;
  -- Response-loss exact replay is intentionally checked before expiry/state rejection.
  if v_upload.state='QUARANTINED' then
    select job_record.id into v_job_id from public.hotel_file_scan_jobs job_record
      where job_record.company_id=v_upload.company_id and job_record.branch_id=v_upload.branch_id
        and job_record.upload_id=v_upload.id;
    if v_upload.source_etag=p_source_etag
       and v_upload.source_object_version=p_source_object_version
       and v_upload.source_size_bytes=p_source_size_bytes
       and v_upload.source_mime_type=p_source_mime_type then
      return query select 'REPLAYED'::text,v_upload.id,v_job_id,'QUARANTINED'::text;
    else
      return query select 'VERSION_CONFLICT'::text,null::uuid,null::uuid,null::text;
    end if;
    return;
  end if;
  if v_upload.state<>'PENDING_UPLOAD' or v_upload.expires_at<=v_now
     or p_source_etag is null or pg_catalog.btrim(p_source_etag)=''
     or p_source_object_version is null or pg_catalog.btrim(p_source_object_version)=''
     or p_source_size_bytes<>v_upload.reserved_size_bytes
     or p_source_mime_type<>v_upload.declared_mime_type then
    return query select 'VERSION_CONFLICT'::text,null::uuid,null::uuid,null::text; return;
  end if;
  update public.hotel_file_uploads set source_etag=p_source_etag,
    source_object_version=p_source_object_version,source_size_bytes=p_source_size_bytes,
    source_mime_type=p_source_mime_type,upload_completed_at=v_now,state='QUARANTINED',
    version=version+1,updated_at=pg_catalog.clock_timestamp()
    where company_id=v_upload.company_id and id=v_upload.id;
  insert into public.hotel_file_scan_jobs(id,company_id,branch_id,upload_id,state)
    values(p_scan_job_id,v_upload.company_id,v_upload.branch_id,v_upload.id,'PENDING');
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id)
  values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_UPLOAD_COMPLETED',v_actor.user_id,v_actor.user_type,
    v_actor.session_id,v_upload.company_id,v_upload.branch_id,'HOTEL_FILE_UPLOAD',v_upload.id,
    pg_catalog.jsonb_build_object('state','QUARANTINED'),'SUCCEEDED',p_trace_id);
  return query select 'CREATED'::text,v_upload.id,p_scan_job_id,'QUARANTINED'::text;
end
$function$;

create function public.hotel_file_read_status_v2(p_upload_id uuid)
returns table(result_status text, upload_id uuid, state text, file_version_id uuid,
  failure_code text, updated_at timestamptz)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- Approved readers may inspect status; otherwise only the creator with current upload authority may poll it.
  v_upload record; v_actor record; v_file_version_id uuid; v_read_allowed boolean := false;
begin
  select * into v_upload from public.hotel_file_uploads upload_record
    where upload_record.company_id=public.api_current_company_id() and upload_record.id=p_upload_id;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::text,null::uuid,null::text,null::timestamptz; return; end if;
  select * into v_actor from public.hotel_file_api_authorized_actor(v_upload.branch_id,'HOTEL_FILE_READ');
  v_read_allowed := found;
  if not v_read_allowed then
    select * into v_actor from public.hotel_file_api_authorized_actor(v_upload.branch_id,'HOTEL_FILE_UPLOAD');
  end if;
  if not found
     or (not v_read_allowed and v_upload.initiated_by<>v_actor.user_id)
     or not exists(select 1 from public.file_attachment_parents parent_record
       where parent_record.company_id=v_upload.company_id and parent_record.branch_id=v_upload.branch_id
         and parent_record.parent_type=v_upload.parent_type and parent_record.parent_id=v_upload.parent_id) then
    return query select 'NOT_FOUND'::text,null::uuid,null::text,null::uuid,null::text,null::timestamptz; return;
  end if;
  if v_upload.state in ('READY_UNLINKED','LINKED') then
    select version_record.id into v_file_version_id from public.hotel_file_versions version_record
      where version_record.company_id=v_upload.company_id and version_record.upload_id=v_upload.id;
  end if;
  return query select 'CREATED'::text,v_upload.id,v_upload.state,
    v_file_version_id,
    case when v_upload.state in ('REJECTED','SCAN_FAILED','EXPIRED') then v_upload.failure_code else null end,
    v_upload.updated_at;
end
$function$;

create function public.hotel_file_issue_access_grant_v1(
  p_grant_id uuid, p_file_version_id uuid, p_parent_type text, p_parent_id uuid,
  p_disposition text, p_grant_token_hash bytea, p_ttl_seconds integer, p_trace_id uuid
)
returns table(result_status text, grant_id uuid, expires_at timestamptz)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- HOTEL_FILE_READ / HOTEL_FILE_DOWNLOAD permission_grants use personal DENY precedence.
  v_version record; v_upload record; v_actor record; v_request_actor record;
  v_now timestamptz:=pg_catalog.statement_timestamp();
  v_expires_at timestamptz; v_permission text;
begin
  if p_ttl_seconds not between 1 and 300 or p_grant_token_hash is null
     or pg_catalog.octet_length(p_grant_token_hash)<>32
     or p_disposition not in ('INLINE','ATTACHMENT') then
    raise exception using errcode='22023',message='invalid hotel file access grant';
  end if;
  select session_record.id as session_id,user_record.id as user_id,user_record.user_type,
         session_record.company_id
    into v_request_actor
    from public.auth_sessions session_record
    join public.users user_record on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id
    join public.companies company_record on company_record.id=session_record.company_id
    where session_record.id=nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid
      and session_record.revoked_at is null
      and session_record.idle_expires_at>v_now and session_record.absolute_expires_at>v_now
      and user_record.status='ACTIVE' and company_record.status='ACTIVE';
  select version_record.* into v_version from public.hotel_file_versions version_record
    where version_record.company_id=public.api_current_company_id() and version_record.id=p_file_version_id;
  if not found or v_version.parent_type<>p_parent_type or v_version.parent_id<>p_parent_id then
    if v_request_actor.session_id is not null then
      insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
        resource_type,resource_id,after_summary,result,trace_id)
      values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_DENIED',v_request_actor.user_id,v_request_actor.user_type,
        v_request_actor.session_id,v_request_actor.company_id,null,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
        pg_catalog.jsonb_build_object('disposition',p_disposition,'reason','NOT_FOUND'),'FAILED',p_trace_id);
    end if;
    return query select 'NOT_FOUND'::text,null::uuid,null::timestamptz; return;
  end if;
  v_permission:=case when p_disposition='ATTACHMENT' then 'HOTEL_FILE_DOWNLOAD' else 'HOTEL_FILE_READ' end;
  select * into v_actor from public.hotel_file_api_authorized_actor(v_version.branch_id,v_permission);
  select upload_record.* into v_upload from public.hotel_file_uploads upload_record
    where upload_record.company_id=v_version.company_id and upload_record.id=v_version.upload_id;
  if not found or v_actor.session_id is null or v_upload.state<>'LINKED'
     or not exists(select 1 from public.hotel_file_links link_record
       where link_record.company_id=v_version.company_id and link_record.branch_id=v_version.branch_id
         and link_record.parent_type=p_parent_type and link_record.parent_id=p_parent_id
         and link_record.file_version_id=v_version.id)
     or not exists(select 1 from public.file_scan_attempts evidence_record
       where evidence_record.company_id=v_version.company_id and evidence_record.upload_id=v_upload.id
         and evidence_record.state='SUCCEEDED' and evidence_record.verdict='CLEAN'
         and evidence_record.scanner_sha256=v_version.sha256
         and evidence_record.actual_size_bytes=v_version.size_bytes
         and evidence_record.detected_mime_type=v_version.mime_type) then
         if v_request_actor.session_id is not null then
         insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
         resource_type,resource_id,after_summary,result,trace_id)
         values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_DENIED',v_request_actor.user_id,v_request_actor.user_type,
         v_request_actor.session_id,v_request_actor.company_id,v_version.branch_id,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
         pg_catalog.jsonb_build_object('disposition',p_disposition,'reason','AUTHORITY'),'FAILED',p_trace_id);
         end if;
         return query select 'NOT_FOUND'::text,null::uuid,null::timestamptz; return;
         end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_version.company_id::text||':'||v_actor.user_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_version.company_id::text||':'||v_version.branch_id::text,1));
  if (select count(*) from public.hotel_file_access_grants grant_record
      where grant_record.company_id=v_version.company_id and grant_record.issued_by=v_actor.user_id
        and grant_record.issued_at>v_now-interval '1 minute')>=60
     or (select count(*) from public.hotel_file_access_grants grant_record
      where grant_record.company_id=v_version.company_id and grant_record.branch_id=v_version.branch_id
        and grant_record.issued_at>v_now-interval '1 minute')>=300 then
    insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
      resource_type,resource_id,after_summary,result,trace_id)
    values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_DENIED',v_actor.user_id,v_actor.user_type,
      v_actor.session_id,v_version.company_id,v_version.branch_id,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
      pg_catalog.jsonb_build_object('disposition',p_disposition,'reason','RATE_LIMITED'),'FAILED',p_trace_id);
    return query select 'RATE_LIMITED'::text,null::uuid,null::timestamptz; return;
  end if;
  v_expires_at:=v_now+pg_catalog.make_interval(secs=>p_ttl_seconds);
  insert into public.hotel_file_access_grants(id,company_id,branch_id,parent_type,parent_id,
    file_version_id,issued_by,issued_by_type,session_id,grant_token_hash,disposition,expires_at,issued_at)
  values(p_grant_id,v_version.company_id,v_version.branch_id,p_parent_type,p_parent_id,
    v_version.id,v_actor.user_id,v_actor.user_type,v_actor.session_id,p_grant_token_hash,p_disposition,v_expires_at,v_now);
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id)
  values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_GRANTED',v_actor.user_id,v_actor.user_type,
    v_actor.session_id,v_version.company_id,v_version.branch_id,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
    pg_catalog.jsonb_build_object('disposition',p_disposition),'SUCCEEDED',p_trace_id);
  return query select 'CREATED'::text,p_grant_id,v_expires_at;
end
$function$;

create function public.hotel_file_resolve_access_grant_v1(
  p_grant_id uuid, p_grant_token_hash bytea, p_trace_id uuid
)
returns table(result_status text, file_version_id uuid, clean_object_key text,
  destination_etag text, destination_object_version text, sha256 bytea,
  size_bytes bigint, mime_type text, file_name text, disposition text, expires_at timestamptz)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- HOTEL_FILE_READ / HOTEL_FILE_DOWNLOAD are rechecked for the bound grant and session.
  v_grant record; v_version record; v_upload record; v_actor record; v_request_actor record;
  v_permission text; v_now timestamptz:=pg_catalog.statement_timestamp();
begin
  select session_record.id as session_id,user_record.id as user_id,user_record.user_type,
         session_record.company_id
    into v_request_actor
    from public.auth_sessions session_record
    join public.users user_record on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id
    join public.companies company_record on company_record.id=session_record.company_id
    where session_record.id=nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid
      and session_record.revoked_at is null
      and session_record.idle_expires_at>v_now and session_record.absolute_expires_at>v_now
      and user_record.status='ACTIVE' and company_record.status='ACTIVE';
  if p_grant_token_hash is not null and pg_catalog.octet_length(p_grant_token_hash)=32 then
    select grant_record.* into v_grant from public.hotel_file_access_grants grant_record
      where grant_record.company_id=public.api_current_company_id()
        and grant_record.id=p_grant_id and grant_record.grant_token_hash=p_grant_token_hash for update;
  end if;
  if v_request_actor.session_id is null or v_grant.id is null or v_grant.expires_at<=v_now then
    if v_request_actor.session_id is not null then
      insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
        resource_type,resource_id,after_summary,result,trace_id)
      values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_DENIED',v_request_actor.user_id,v_request_actor.user_type,
        v_request_actor.session_id,v_request_actor.company_id,null,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
        pg_catalog.jsonb_build_object('reason','GRANT'),'FAILED',p_trace_id);
    end if;
    return query select 'NOT_FOUND'::text,null::uuid,null::text,null::text,null::text,null::bytea,
      null::bigint,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  v_permission:=case when v_grant.disposition='ATTACHMENT' then 'HOTEL_FILE_DOWNLOAD' else 'HOTEL_FILE_READ' end;
  select * into v_actor from public.hotel_file_api_authorized_actor(v_grant.branch_id,v_permission);
  select version_record.* into v_version from public.hotel_file_versions version_record
    where version_record.company_id=v_grant.company_id and version_record.branch_id=v_grant.branch_id
      and version_record.parent_type=v_grant.parent_type and version_record.parent_id=v_grant.parent_id
      and version_record.id=v_grant.file_version_id;
  select upload_record.* into v_upload from public.hotel_file_uploads upload_record
    where upload_record.company_id=v_grant.company_id and upload_record.id=v_version.upload_id;
  if v_actor.session_id is null or v_actor.session_id<>v_grant.session_id
     or v_actor.user_id<>v_grant.issued_by or v_upload.state<>'LINKED'
     or not exists(select 1 from public.hotel_file_links link_record
       where link_record.company_id=v_grant.company_id and link_record.branch_id=v_grant.branch_id
         and link_record.parent_type=v_grant.parent_type and link_record.parent_id=v_grant.parent_id
         and link_record.file_version_id=v_grant.file_version_id)
     or not exists(select 1 from public.file_scan_attempts evidence_record
       where evidence_record.company_id=v_grant.company_id and evidence_record.upload_id=v_upload.id
         and evidence_record.state='SUCCEEDED' and evidence_record.verdict='CLEAN'
         and evidence_record.scanner_sha256=v_version.sha256
         and evidence_record.actual_size_bytes=v_version.size_bytes
         and evidence_record.detected_mime_type=v_version.mime_type) then
    insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
      resource_type,resource_id,after_summary,result,trace_id)
    values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_DENIED',v_request_actor.user_id,v_request_actor.user_type,
      v_request_actor.session_id,v_request_actor.company_id,v_grant.branch_id,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
      pg_catalog.jsonb_build_object('reason','AUTHORITY','disposition',v_grant.disposition),'FAILED',p_trace_id);
    return query select 'NOT_FOUND'::text,null::uuid,null::text,null::text,null::text,null::bytea,
      null::bigint,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  return query select 'AUTHORIZED'::text,v_version.id,v_version.clean_object_key,
    v_version.destination_etag,v_version.destination_object_version,v_version.sha256,
    v_version.size_bytes,v_version.mime_type,v_version.file_name,v_grant.disposition,v_grant.expires_at;
end
$function$;

create function public.hotel_file_record_access_outcome_v1(
  p_grant_token_hash bytea, p_outcome text, p_trace_id uuid
)
returns table(result_status text)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  -- Once STARTED is authorized, terminal audit remains writable after permission/session revocation.
  v_grant record; v_session_id uuid;
begin
  if p_grant_token_hash is null or pg_catalog.octet_length(p_grant_token_hash)<>32
     or p_outcome not in ('STARTED','SUCCEEDED','FAILED','ABORTED') then
    return query select 'NOT_FOUND'::text; return;
  end if;
  v_session_id:=nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid;
  select grant_record.* into v_grant from public.hotel_file_access_grants grant_record
    where grant_record.grant_token_hash=p_grant_token_hash for update;
  if not found or v_grant.session_id<>v_session_id then
    return query select 'NOT_FOUND'::text; return;
  end if;
  if v_grant.last_outcome=p_outcome then
    return query select 'RECORDED'::text; return;
  end if;
  if (v_grant.last_outcome is null and p_outcome<>'STARTED')
     or v_grant.last_outcome in ('SUCCEEDED','FAILED','ABORTED') then
    return query select 'NOT_FOUND'::text; return;
  end if;
  update public.hotel_file_access_grants set last_outcome=p_outcome,
    outcome_recorded_at=pg_catalog.statement_timestamp() where id=v_grant.id;
  -- Access audit deliberately excludes URL, token, key, etag and object/version evidence.
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id)
  values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_OUTCOME_RECORDED',v_grant.issued_by,v_grant.issued_by_type,
    v_grant.session_id,v_grant.company_id,v_grant.branch_id,'HOTEL_FILE_ACCESS_GRANT',v_grant.id,
    pg_catalog.jsonb_build_object('outcome',p_outcome,'disposition',v_grant.disposition),
    case when p_outcome in ('STARTED','SUCCEEDED') then 'SUCCEEDED' else 'FAILED' end,p_trace_id);
  return query select 'RECORDED'::text;
end
$function$;

create function public.hotel_file_record_access_denial_v1(
  p_grant_id uuid, p_reason text, p_trace_id uuid
)
returns table(result_status text)
language plpgsql volatile parallel unsafe security definer
set search_path = pg_catalog
as $function$
declare
  v_actor record; v_grant record; v_now timestamptz:=pg_catalog.statement_timestamp();
begin
  if p_grant_id is null or p_reason not in ('MISSING_OR_MALFORMED_COOKIE') then
    return query select 'NOT_FOUND'::text; return;
  end if;
  select session_record.id as session_id,user_record.id as user_id,user_record.user_type,
         session_record.company_id
    into v_actor
    from public.auth_sessions session_record
    join public.users user_record
      on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id
    join public.companies company_record on company_record.id=session_record.company_id
    where public.runtime_has_capability('API_RUNTIME')
      and session_record.id=nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid
      and session_record.company_id=public.api_current_company_id()
      and session_record.revoked_at is null
      and session_record.idle_expires_at>v_now and session_record.absolute_expires_at>v_now
      and user_record.status='ACTIVE' and company_record.status='ACTIVE';
  if not found then return query select 'NOT_FOUND'::text; return; end if;
  select grant_record.branch_id,grant_record.disposition into v_grant
    from public.hotel_file_access_grants grant_record
    where grant_record.company_id=v_actor.company_id and grant_record.id=p_grant_id;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id)
  values(pg_catalog.gen_random_uuid(),'HOTEL_FILE_ACCESS_DENIED',v_actor.user_id,v_actor.user_type,
    v_actor.session_id,v_actor.company_id,v_grant.branch_id,'HOTEL_FILE_ACCESS_GRANT',p_grant_id,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('reason',p_reason,'disposition',v_grant.disposition)),
    'FAILED',p_trace_id);
  return query select 'RECORDED'::text;
end
$function$;

-- Runtime receives command EXECUTE only; underlying DML is granted to the definer below.
do $ownership_grant$
begin
  execute pg_catalog.format(
    'grant werehere_hotel_file_api_definer to %I with inherit false, set true',
    current_user
  );
end
$ownership_grant$;
grant create on schema public to werehere_hotel_file_api_definer;
alter function public.hotel_file_api_authorized_actor(uuid,text)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_init_upload_v2(uuid,uuid,text,uuid,text,text,bigint,text,integer,text,uuid,text,text,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_authorize_upload_body_v1(uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_complete_upload_v2(uuid,text,text,text,bigint,text,uuid,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_read_status_v2(uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_issue_access_grant_v1(uuid,uuid,text,uuid,text,bytea,integer,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_resolve_access_grant_v1(uuid,bytea,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_record_access_outcome_v1(bytea,text,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_record_access_denial_v1(uuid,text,uuid)
  owner to werehere_hotel_file_api_definer;
revoke create on schema public from werehere_hotel_file_api_definer;

set local role werehere_hotel_file_api_definer;
revoke all on function public.hotel_file_init_upload_v2(uuid,uuid,text,uuid,text,text,bigint,text,integer,text,uuid,text,text,uuid),
  public.hotel_file_authorize_upload_body_v1(uuid),
  public.hotel_file_complete_upload_v2(uuid,text,text,text,bigint,text,uuid,uuid),
  public.hotel_file_read_status_v2(uuid),
  public.hotel_file_issue_access_grant_v1(uuid,uuid,text,uuid,text,bytea,integer,uuid),
  public.hotel_file_resolve_access_grant_v1(uuid,bytea,uuid),
  public.hotel_file_record_access_outcome_v1(bytea,text,uuid),
  public.hotel_file_record_access_denial_v1(uuid,text,uuid)
  from public;
grant execute on function public.hotel_file_api_authorized_actor(uuid,text)
  to werehere_hotel_file_api_definer;
reset role;

do $ownership_revoke$
begin
  execute pg_catalog.format(
    'revoke werehere_hotel_file_api_definer from %I granted by %I',
    current_user,
    current_user
  );
end
$ownership_revoke$;

-- Explicitly retire the unsafe predecessor init/complete/status API authority.
do $runtime_execute$
begin
  if exists(select 1 from pg_catalog.pg_roles where rolname='werehere_api_runtime') then
    revoke execute on function public.hotel_file_init_upload(uuid,uuid,text,uuid,text,text,bigint,text,timestamptz,uuid,text,text,uuid),
      public.hotel_file_complete_upload(uuid,text,text,bigint,text,uuid,uuid),
      public.hotel_file_read_status(uuid) from werehere_api_runtime;
    grant execute on function
      public.hotel_file_init_upload_v2(uuid,uuid,text,uuid,text,text,bigint,text,integer,text,uuid,text,text,uuid),
      public.hotel_file_authorize_upload_body_v1(uuid),
      public.hotel_file_complete_upload_v2(uuid,text,text,text,bigint,text,uuid,uuid),
      public.hotel_file_read_status_v2(uuid),
      public.hotel_file_issue_access_grant_v1(uuid,uuid,text,uuid,text,bytea,integer,uuid),
      public.hotel_file_resolve_access_grant_v1(uuid,bytea,uuid),
      public.hotel_file_record_access_outcome_v1(bytea,text,uuid),
      public.hotel_file_record_access_denial_v1(uuid,text,uuid)
      to werehere_api_runtime;
  end if;
end
$runtime_execute$;

-- The API definer alone receives underlying table authority.
grant select on public.auth_sessions,public.users,public.companies,public.hotel_profiles,
  public.user_role_memberships,public.roles,public.user_group_memberships,public.user_groups,
  public.hotel_staff_assignments,public.housekeeping_hotel_links,public.hotel_owner_assignments,
  public.permission_grants,public.file_attachment_parents,public.hotel_file_uploads,
  public.hotel_file_scan_jobs,public.hotel_file_versions,public.hotel_file_links,
  public.file_scan_attempts,public.idempotency_records,public.hotel_file_access_grants
  to werehere_hotel_file_api_definer;
grant insert on public.hotel_file_uploads,public.hotel_file_scan_jobs,public.idempotency_records,
  public.audit_events,public.hotel_file_access_grants to werehere_hotel_file_api_definer;
grant update on public.hotel_file_uploads,public.idempotency_records,public.hotel_file_access_grants
  to werehere_hotel_file_api_definer;

revoke all on table public.hotel_file_access_grants from public;
insert into public.schema_migrations(version)
values ('0027_hotel_file_api_storage_access');

commit;
