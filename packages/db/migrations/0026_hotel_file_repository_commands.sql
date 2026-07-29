begin;

-- 0026_hotel_file_repository_commands
-- Atomic, capability-bound command authority for the hotel-file lifecycle.
-- Every command validates capability helpers that bind role_name = session_user;
-- tenant, actor, and active session identities are never accepted as arguments.

alter table public.hotel_file_uploads
  add column source_object_version text;
alter table public.file_scan_attempts
  add column source_object_version text,
  add column actual_size_bytes bigint;
alter table public.hotel_file_versions
  add column source_object_version text,
  add column destination_etag text,
  add column destination_object_version text;

alter table public.hotel_file_uploads
  add constraint hotel_file_uploads_source_object_version_state_check check (
    state in ('PENDING_UPLOAD', 'EXPIRED', 'CANCELLED')
    or (
      source_object_version is not null
      and pg_catalog.btrim(source_object_version) <> ''
      and pg_catalog.octet_length(source_object_version) <= 1024
    )
  );
alter table public.file_scan_attempts
  add constraint file_scan_attempts_source_object_version_check check (
    source_object_version is not null
    and pg_catalog.btrim(source_object_version) <> ''
    and pg_catalog.octet_length(source_object_version) <= 1024
  );
alter table public.hotel_file_versions
  add constraint hotel_file_versions_source_object_version_check check (
    source_object_version is not null
    and pg_catalog.btrim(source_object_version) <> ''
    and pg_catalog.octet_length(source_object_version) <= 1024
  );

create table public.hotel_file_scan_completion_receipts (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  branch_id uuid not null,
  attempt_id uuid not null,
  claim_generation bigint not null check (claim_generation >= 1),
  claim_token_hash bytea not null check (pg_catalog.octet_length(claim_token_hash) = 32),
  callback_body_hash bytea check (
    callback_body_hash is null or pg_catalog.octet_length(callback_body_hash) = 32
  ),
  outcome text not null check (outcome in (
    'CLEAN_ACCEPTED', 'MALWARE_REJECTED', 'RETRY_SCHEDULED', 'DEAD_LETTERED',
    'LEASE_EXPIRED_DEAD_LETTERED'
  )),
  failure_code text,
  completed_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (company_id, attempt_id, claim_generation),
  foreign key (company_id, branch_id, attempt_id)
    references public.file_scan_attempts(company_id, branch_id, id),
  check (
    (outcome in ('CLEAN_ACCEPTED', 'MALWARE_REJECTED')
      and failure_code is null and callback_body_hash is not null)
    or (outcome = 'RETRY_SCHEDULED'
      and failure_code = 'SCAN_ENGINE_UNAVAILABLE' and callback_body_hash is not null)
    or (outcome = 'DEAD_LETTERED'
      and failure_code = 'RETRY_EXHAUSTED' and callback_body_hash is not null)
    or (outcome = 'LEASE_EXPIRED_DEAD_LETTERED'
      and failure_code = 'RETRY_EXHAUSTED' and callback_body_hash is null)
  )
);

create table public.hotel_file_clean_promotion_reservations (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  branch_id uuid not null,
  upload_id uuid not null,
  attempt_id uuid not null,
  file_version_id uuid not null,
  promotion_generation bigint not null check (promotion_generation >= 1),
  promotion_token_hash bytea not null
    check (pg_catalog.octet_length(promotion_token_hash) = 32),
  lease_expires_at timestamptz not null,
  source_etag text not null,
  source_object_version text not null,
  scanner_sha256 bytea not null check (pg_catalog.octet_length(scanner_sha256) = 32),
  actual_size_bytes bigint not null check (actual_size_bytes between 1 and 50000000),
  detected_mime_type text not null check (pg_catalog.btrim(detected_mime_type) <> ''),
  clean_object_key text not null unique
    check (clean_object_key ~ '^clean/[0-9a-f]{64}$'),
  state text not null default 'RESERVED' check (state in ('RESERVED', 'COMPLETED')),
  destination_etag text,
  destination_object_version text,
  destination_sha256 bytea,
  destination_size_bytes bigint,
  destination_mime_type text,
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (company_id, upload_id),
  unique (company_id, file_version_id),
  unique (company_id, branch_id, id),
  foreign key (company_id, branch_id, upload_id)
    references public.hotel_file_uploads(company_id, branch_id, id),
  foreign key (company_id, branch_id, attempt_id)
    references public.file_scan_attempts(company_id, branch_id, id),
  check (
    (state = 'RESERVED' and destination_etag is null and destination_object_version is null
      and destination_sha256 is null and destination_size_bytes is null
      and destination_mime_type is null and completed_at is null)
    or
    (state = 'COMPLETED' and destination_etag is not null and destination_object_version is not null
      and pg_catalog.octet_length(destination_sha256) = 32
      and destination_size_bytes = actual_size_bytes
      and destination_mime_type = detected_mime_type and completed_at is not null)
  )
);

create function public.reject_hotel_file_scan_completion_receipt_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception using errcode = '55000', message = 'hotel file scan completion receipts are append-only';
end
$function$;
revoke all on function public.reject_hotel_file_scan_completion_receipt_change() from public;

create trigger hotel_file_scan_completion_receipts_no_update
before update on public.hotel_file_scan_completion_receipts
for each row execute function public.reject_hotel_file_scan_completion_receipt_change();
create trigger hotel_file_scan_completion_receipts_no_delete
before delete on public.hotel_file_scan_completion_receipts
for each row execute function public.reject_hotel_file_scan_completion_receipt_change();

create function public.reject_hotel_file_clean_promotion_reservation_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.branch_id is distinct from old.branch_id
     or new.upload_id is distinct from old.upload_id
     or new.attempt_id is distinct from old.attempt_id
     or new.file_version_id is distinct from old.file_version_id
     or new.source_etag is distinct from old.source_etag
     or new.source_object_version is distinct from old.source_object_version
     or new.scanner_sha256 is distinct from old.scanner_sha256
     or new.actual_size_bytes is distinct from old.actual_size_bytes
     or new.detected_mime_type is distinct from old.detected_mime_type
     or new.clean_object_key is distinct from old.clean_object_key
     or new.created_at is distinct from old.created_at
  then
    raise exception using errcode = '23514', message = 'invalid clean promotion reservation transition';
  end if;

  if old.state = 'RESERVED' and new.state = 'RESERVED' then
    if old.lease_expires_at > pg_catalog.statement_timestamp()
       or new.promotion_generation <> old.promotion_generation + 1
       or new.promotion_token_hash is not distinct from old.promotion_token_hash
       or new.lease_expires_at <= pg_catalog.statement_timestamp()
       or new.destination_etag is not null
       or new.destination_object_version is not null
       or new.destination_sha256 is not null
       or new.destination_size_bytes is not null
       or new.destination_mime_type is not null
       or new.completed_at is not null then
      raise exception using errcode = '23514', message = 'invalid clean promotion lease takeover';
    end if;
  elsif old.state = 'RESERVED' and new.state = 'COMPLETED' then
    if old.lease_expires_at <= pg_catalog.statement_timestamp()
       or new.promotion_generation <> old.promotion_generation
       or new.promotion_token_hash is distinct from old.promotion_token_hash
       or new.lease_expires_at is distinct from old.lease_expires_at then
      raise exception using errcode = '23514', message = 'stale clean promotion completion';
    end if;
  else
    raise exception using errcode = '23514', message = 'invalid clean promotion reservation transition';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_hotel_file_clean_promotion_reservation_change() from public;

create trigger hotel_file_clean_promotion_reservations_transition
before update on public.hotel_file_clean_promotion_reservations
for each row execute function public.reject_hotel_file_clean_promotion_reservation_change();
create trigger hotel_file_clean_promotion_reservations_no_delete
before delete on public.hotel_file_clean_promotion_reservations
for each row execute function public.reject_hotel_file_scan_completion_receipt_change();

-- Close the successor source identity column independently of the 0025 transition guard.
create function public.reject_hotel_file_upload_source_object_version_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if new.source_object_version is distinct from old.source_object_version
     and not (
       old.state = 'PENDING_UPLOAD'
       and new.state = 'QUARANTINED'
       and old.source_object_version is null
       and new.source_object_version is not null
     ) then
    raise exception using errcode = '23514', message = 'hotel file source object version is immutable';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_hotel_file_upload_source_object_version_change() from public;

create trigger hotel_file_uploads_source_object_version_immutable
before update on public.hotel_file_uploads
for each row execute function public.reject_hotel_file_upload_source_object_version_change();

alter table public.hotel_file_scan_completion_receipts enable row level security;
alter table public.hotel_file_scan_completion_receipts force row level security;
alter table public.hotel_file_clean_promotion_reservations enable row level security;
alter table public.hotel_file_clean_promotion_reservations force row level security;

create policy hotel_file_scan_completion_receipts_company_isolation
on public.hotel_file_scan_completion_receipts
using (
  case
    when public.runtime_is_schema_owner() then true
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    else false
  end
)
with check (
  case
    when public.runtime_is_schema_owner() then true
    when public.runtime_has_capability('RECONCILER') then company_id = public.reconciler_current_company_id()
    else false
  end
);

create policy hotel_file_clean_promotion_reservations_company_isolation
on public.hotel_file_clean_promotion_reservations
using (
  case
    when public.runtime_is_schema_owner() then true
    when public.hotel_file_has_finalizer_capability() then company_id = public.hotel_file_finalizer_current_company_id()
    else false
  end
)
with check (
  case
    when public.runtime_is_schema_owner() then true
    when public.hotel_file_has_finalizer_capability() then company_id = public.hotel_file_finalizer_current_company_id()
    else false
  end
);

create policy hotel_file_finalizer_audit_insert
on public.audit_events
for insert
with check (
  public.hotel_file_has_finalizer_capability()
  and company_id = public.hotel_file_finalizer_current_company_id()
  and actor_user_id is null
  and session_id is null
  and actor_type = 'FILE_FINALIZER'
);

revoke all on table public.hotel_file_scan_completion_receipts from public;
revoke all on table public.hotel_file_clean_promotion_reservations from public;

-- A retry clears per-claim evidence after its receipt has made that evidence durable.
create or replace function public.reject_file_scan_attempt_transition()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if not (
    public.runtime_is_schema_owner()
    or current_user in ('werehere_auth_session_definer', 'werehere_tenant_authority_definer')
    or public.runtime_has_capability('RECONCILER')
  ) then
    raise exception using errcode = '42501', message = 'file scan transition authority denied';
  end if;

  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.branch_id is distinct from old.branch_id
     or new.parent_type is distinct from old.parent_type
     or new.parent_id is distinct from old.parent_id
     or new.upload_id is distinct from old.upload_id
     or new.dispatch_job_id is distinct from old.dispatch_job_id
     or new.source_etag is distinct from old.source_etag
     or new.source_object_version is distinct from old.source_object_version
     or new.source_size_bytes is distinct from old.source_size_bytes
     or new.created_at is distinct from old.created_at
  then
    raise exception using errcode = '23514', message = 'file scan attempt identity is immutable';
  end if;

  if old.state = 'PENDING' and new.state = 'CLAIMED' then
    if new.claim_generation <> old.claim_generation + 1
       or new.attempt_count <> old.attempt_count + 1 then
      raise exception using errcode = '23514', message = 'file scan claim fence must advance';
    end if;
  elsif old.state = 'CLAIMED' and new.state = 'CLAIMED' then
    if old.lease_expires_at >= pg_catalog.statement_timestamp()
       or new.claim_generation <> old.claim_generation + 1
       or new.attempt_count <> old.attempt_count + 1
       or new.claim_token_hash is not distinct from old.claim_token_hash then
      raise exception using errcode = '23514', message = 'file scan takeover requires expired lease and new fence';
    end if;
  elsif old.state = 'CLAIMED' and new.state = 'PENDING' then
    if old.lease_expires_at <= pg_catalog.statement_timestamp()
       or new.claim_generation <> old.claim_generation
       or new.attempt_count <> old.attempt_count
       or new.claim_token_hash is not null
       or new.lease_expires_at is not null
       or new.claimed_at is not null
       or new.completed_at is not null
       or new.callback_body_hash is not null
       or new.verdict is not null
       or new.failure_code is not null then
      raise exception using errcode = '23514', message = 'invalid file scan retry transition';
    end if;
  elsif old.state = 'CLAIMED' and new.state in ('SUCCEEDED', 'FAILED', 'DEAD_LETTER') then
    if new.claim_generation <> old.claim_generation
       or new.claim_token_hash is distinct from old.claim_token_hash
       or (
         old.lease_expires_at <= pg_catalog.statement_timestamp()
         and not (
           new.state = 'DEAD_LETTER'
           and old.attempt_count >= 5
           and new.verdict = 'ERROR'
           and new.failure_code = 'RETRY_EXHAUSTED'
           and new.callback_body_hash = pg_catalog.sha256(
             pg_catalog.convert_to('LEASE_EXPIRED', 'UTF8')
           )
         )
       ) then
      raise exception using errcode = '23514', message = 'stale file scan completion rejected';
    end if;
  else
    raise exception using errcode = '23514', message = 'invalid file scan attempt transition';
  end if;

  if new.updated_at <= old.updated_at then
    raise exception using errcode = '23514', message = 'file scan timestamp must advance';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_file_scan_attempt_transition() from public;

-- Rebind CLEAN-version insertion to the immutable scanner evidence and promotion fence.
create or replace function public.enforce_hotel_file_clean_version_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if not (
    public.runtime_is_schema_owner()
    or current_user in ('werehere_auth_session_definer', 'werehere_tenant_authority_definer')
    or public.hotel_file_has_finalizer_capability()
  ) then
    raise exception using errcode = '42501', message = 'clean file version insert authority denied';
  end if;
  if not exists (
    select 1
    from public.hotel_file_uploads upload_record
    join public.file_scan_attempts attempt_record
      on attempt_record.company_id = upload_record.company_id
     and attempt_record.branch_id = upload_record.branch_id
     and attempt_record.upload_id = upload_record.id
    join public.hotel_file_clean_promotion_reservations reservation_record
      on reservation_record.company_id = upload_record.company_id
     and reservation_record.branch_id = upload_record.branch_id
     and reservation_record.upload_id = upload_record.id
     and reservation_record.attempt_id = attempt_record.id
    where upload_record.company_id = new.company_id
      and upload_record.branch_id = new.branch_id
      and upload_record.parent_type = new.parent_type
      and upload_record.parent_id = new.parent_id
      and upload_record.id = new.upload_id
      and upload_record.state = 'CLEAN_PENDING_PROMOTION'
      and upload_record.quarantine_object_key <> new.clean_object_key
      and upload_record.declared_file_name = new.file_name
      and upload_record.source_size_bytes = new.size_bytes
      and upload_record.source_etag = new.source_etag
      and upload_record.source_object_version = new.source_object_version
      and attempt_record.state = 'SUCCEEDED'
      and attempt_record.verdict = 'CLEAN'
      and attempt_record.scanner_sha256 = new.sha256
      and attempt_record.detected_mime_type = new.mime_type
      and attempt_record.source_etag = new.source_etag
      and attempt_record.source_object_version = new.source_object_version
      and attempt_record.source_size_bytes = new.size_bytes
      and reservation_record.state = 'RESERVED'
      and reservation_record.file_version_id = new.id
      and reservation_record.clean_object_key = new.clean_object_key
      and reservation_record.detected_mime_type = new.mime_type
      and reservation_record.promotion_generation = new.promotion_generation
  ) then
    raise exception using errcode = '23514', message = 'clean file version requires current successful scan evidence';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_hotel_file_clean_version_insert() from public;

-- API_RUNTIME command: hotel_file_init_upload
create function public.hotel_file_init_upload(
  p_upload_id uuid,
  p_branch_id uuid,
  p_parent_type text,
  p_parent_id uuid,
  p_declared_file_name text,
  p_declared_mime_type text,
  p_declared_size_bytes bigint,
  p_quarantine_object_key text,
  p_expires_at timestamptz,
  p_idempotency_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_trace_id uuid
)
returns table (result_status text, upload_id uuid, state text)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid := public.api_current_company_id();
  v_actor record;
  v_existing record;
  v_audit_id uuid := pg_catalog.gen_random_uuid();
begin
  if not public.runtime_has_capability('API_RUNTIME') or v_company_id is null then
    return query select 'FORBIDDEN'::text, null::uuid, null::text;
    return;
  end if;
  select s.id as session_id, s.user_id, u.user_type
    into v_actor
  from public.auth_sessions s
  join public.users u on u.company_id = s.company_id and u.id = s.user_id
  where s.company_id = v_company_id
    and s.id = nullif(pg_catalog.current_setting('app.session_id', true), '')::uuid
    and s.revoked_at is null
    and s.idle_expires_at > pg_catalog.statement_timestamp()
    and s.absolute_expires_at > pg_catalog.statement_timestamp();
  if not found then
    return query select 'FORBIDDEN'::text, null::uuid, null::text;
    return;
  end if;

  perform 1 from public.file_attachment_parents p
  where p.company_id = v_company_id and p.branch_id = p_branch_id
    and p.parent_type = p_parent_type and p.parent_id = p_parent_id;
  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::text;
    return;
  end if;

  select i.request_hash, i.resource_id into v_existing
  from public.idempotency_records i
  where i.company_id = v_company_id and i.actor_user_id = v_actor.user_id
    and i.idempotency_key = p_idempotency_key and i.http_method = 'POST'
    and i.operation_path = '/api/hotel-files/uploads'
  for update;
  if found then
    if v_existing.request_hash <> p_request_hash then
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid, null::text;
    else
      return query
      select 'REPLAYED'::text, u.id, u.state
      from public.hotel_file_uploads u
      where u.company_id = v_company_id and u.id = v_existing.resource_id;
    end if;
    return;
  end if;

  insert into public.hotel_file_uploads (
    id, company_id, branch_id, parent_type, parent_id, initiated_by,
    declared_file_name, declared_mime_type, declared_size_bytes,
    reserved_size_bytes, quarantine_object_key, expires_at
  ) values (
    p_upload_id, v_company_id, p_branch_id, p_parent_type, p_parent_id, v_actor.user_id,
    p_declared_file_name, p_declared_mime_type, p_declared_size_bytes,
    p_declared_size_bytes, p_quarantine_object_key, p_expires_at
  );
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id, branch_id,
    resource_type, resource_id, after_summary, result, trace_id
  ) values (
    v_audit_id, 'HOTEL_FILE_UPLOAD_INITIATED', v_actor.user_id, v_actor.user_type,
    v_actor.session_id, v_company_id, p_branch_id, 'HOTEL_FILE_UPLOAD', p_upload_id,
    pg_catalog.jsonb_build_object('state', 'PENDING_UPLOAD', 'reservedSizeBytes', p_declared_size_bytes),
    'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method, operation_path,
    request_hash, status, resource_type, resource_id, audit_event_id,
    result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_id, v_company_id, v_actor.user_id, p_idempotency_key, 'POST',
    '/api/hotel-files/uploads', p_request_hash, 'COMPLETED', 'HOTEL_FILE_UPLOAD',
    p_upload_id, v_audit_id, pg_catalog.jsonb_build_object('uploadId', p_upload_id),
    pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp() + interval '24 hours'
  );
  return query select 'CREATED'::text, p_upload_id, 'PENDING_UPLOAD'::text;
end
$function$;

-- API_RUNTIME command: hotel_file_complete_upload
create function public.hotel_file_complete_upload(
  p_upload_id uuid,
  p_source_etag text,
  p_source_object_version text,
  p_source_size_bytes bigint,
  p_source_mime_type text,
  p_scan_job_id uuid,
  p_trace_id uuid
)
returns table (result_status text, upload_id uuid, scan_job_id uuid, state text)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid := public.api_current_company_id();
  v_actor record;
  v_upload record;
  v_job_id uuid;
begin
  if not public.runtime_has_capability('API_RUNTIME') or v_company_id is null then
    return query select 'FORBIDDEN'::text, null::uuid, null::uuid, null::text;
    return;
  end if;
  select s.id session_id, s.user_id, u.user_type into v_actor
  from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id
  where s.company_id=v_company_id and s.id=nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid;
  select * into v_upload from public.hotel_file_uploads u
  where u.company_id=v_company_id and u.id=p_upload_id for update;
  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::uuid, null::text; return;
  end if;
  if v_upload.state = 'QUARANTINED' then
    select j.id into v_job_id from public.hotel_file_scan_jobs j
    where j.company_id=v_company_id and j.upload_id=p_upload_id;
    if v_upload.source_etag = p_source_etag
       and v_upload.source_object_version is not distinct from p_source_object_version
       and v_upload.source_size_bytes = p_source_size_bytes
       and v_upload.source_mime_type = p_source_mime_type then
      return query select 'REPLAYED'::text, p_upload_id, v_job_id, 'QUARANTINED'::text;
    else
      return query select 'VERSION_CONFLICT'::text, p_upload_id, v_job_id, v_upload.state;
    end if;
    return;
  end if;
  if v_upload.state <> 'PENDING_UPLOAD' or v_upload.expires_at <= pg_catalog.statement_timestamp() then
    return query select 'VERSION_CONFLICT'::text, p_upload_id, null::uuid, v_upload.state; return;
  end if;
  if p_source_size_bytes <> v_upload.declared_size_bytes
     or p_source_mime_type <> v_upload.declared_mime_type
     or p_source_etag is null or p_source_object_version is null then
    return query select 'VERSION_CONFLICT'::text, p_upload_id, null::uuid, v_upload.state; return;
  end if;
  update public.hotel_file_uploads set
    source_etag=p_source_etag, source_object_version=p_source_object_version,
    source_size_bytes=p_source_size_bytes, source_mime_type=p_source_mime_type,
    upload_completed_at=pg_catalog.statement_timestamp(), state='QUARANTINED',
    version=version+1, updated_at=pg_catalog.statement_timestamp()
  where company_id=v_company_id and id=p_upload_id;
  insert into public.hotel_file_scan_jobs(id,company_id,branch_id,upload_id,state)
  values(p_scan_job_id,v_company_id,v_upload.branch_id,p_upload_id,'PENDING');
  insert into public.audit_events(
    id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id
  ) values (
    pg_catalog.gen_random_uuid(),'HOTEL_FILE_UPLOAD_COMPLETED',v_actor.user_id,v_actor.user_type,
    v_actor.session_id,v_company_id,v_upload.branch_id,'HOTEL_FILE_UPLOAD',p_upload_id,
    pg_catalog.jsonb_build_object('state','QUARANTINED'),'SUCCEEDED',p_trace_id
  );
  return query select 'CREATED'::text,p_upload_id,p_scan_job_id,'QUARANTINED'::text;
end
$function$;

-- RECONCILER command: hotel_file_claim_scan_attempt
create function public.hotel_file_claim_scan_attempt(
  p_scan_job_id uuid,
  p_attempt_id uuid,
  p_raw_claim_token text,
  p_lease_seconds integer
)
returns table (
  result_status text, attempt_id uuid, claim_generation bigint,
  lease_expires_at timestamptz, upload_id uuid, quarantine_key text,
  source_etag text, source_object_version text, source_size_bytes bigint
)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid := public.reconciler_current_company_id();
  v_job record;
  v_attempt record;
  v_token_hash bytea;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_expiry_callback_hash bytea := pg_catalog.sha256(
    pg_catalog.convert_to('LEASE_EXPIRED', 'UTF8')
  );
begin
  if not public.runtime_has_capability('RECONCILER') or v_company_id is null then
    return query select 'FORBIDDEN'::text,null::uuid,null::bigint,null::timestamptz,
      null::uuid,null::text,null::text,null::text,null::bigint; return;
  end if;
  if p_raw_claim_token is null or pg_catalog.octet_length(p_raw_claim_token) < 32
     or p_lease_seconds not between 30 and 900 then
    raise exception using errcode='22023', message='invalid file scan claim request';
  end if;
  v_token_hash := pg_catalog.sha256(pg_catalog.convert_to(p_raw_claim_token,'UTF8'));
  select j.*,u.parent_type,u.parent_id,u.quarantine_object_key,u.source_etag,
         u.source_object_version,u.source_size_bytes,u.state upload_state
    into v_job
  from public.hotel_file_scan_jobs j
  join public.hotel_file_uploads u on u.company_id=j.company_id and u.branch_id=j.branch_id and u.id=j.upload_id
  where j.company_id=v_company_id and j.id=p_scan_job_id
  for update of j,u;
  if not found then
    return query select 'NOT_FOUND'::text,null::uuid,null::bigint,null::timestamptz,
      null::uuid,null::text,null::text,null::text,null::bigint; return;
  end if;

  select * into v_attempt from public.file_scan_attempts a
  where a.company_id=v_company_id and a.dispatch_job_id=p_scan_job_id for update;
  if not found then
    if v_job.state <> 'PENDING' or v_job.upload_state <> 'QUARANTINED'
       or v_job.available_at > v_now then
      return query select 'BUSY'::text,null::uuid,null::bigint,null::timestamptz,
        v_job.upload_id,null::text,null::text,null::text,null::bigint; return;
    end if;
    update public.hotel_file_scan_jobs set state='DISPATCHED',dispatch_generation=dispatch_generation+1,
      dispatched_at=v_now,updated_at=v_now where company_id=v_company_id and id=p_scan_job_id;
    update public.hotel_file_uploads set state='SCANNING',version=version+1,updated_at=v_now
      where company_id=v_company_id and id=v_job.upload_id;
    insert into public.file_scan_attempts(
      id,company_id,branch_id,parent_type,parent_id,upload_id,dispatch_job_id,
      source_etag,source_object_version,source_size_bytes
    ) values (
      p_attempt_id,v_company_id,v_job.branch_id,v_job.parent_type,v_job.parent_id,
      v_job.upload_id,p_scan_job_id,v_job.source_etag,v_job.source_object_version,v_job.source_size_bytes
    );
    select * into v_attempt from public.file_scan_attempts a
      where a.company_id=v_company_id and a.id=p_attempt_id for update;
  end if;
  if v_attempt.state='CLAIMED' and v_attempt.lease_expires_at > v_now then
    return query select 'BUSY'::text,v_attempt.id,v_attempt.claim_generation,v_attempt.lease_expires_at,
      v_attempt.upload_id,null::text,null::text,null::text,null::bigint; return;
  end if;
  if v_attempt.state='CLAIMED' and v_attempt.lease_expires_at <= v_now
     and v_attempt.attempt_count >= 5 then
    update public.file_scan_attempts set state='DEAD_LETTER',lease_expires_at=null,
      actual_size_bytes=null,scanner_sha256=null,detected_mime_type=null,
      verdict='ERROR',engine_name=null,engine_version=null,signature_database_version=null,
      failure_code='RETRY_EXHAUSTED',callback_body_hash=v_expiry_callback_hash,
      completed_at=v_now,updated_at=pg_catalog.clock_timestamp()
    where company_id=v_company_id and id=v_attempt.id;
    update public.hotel_file_uploads set state='SCAN_FAILED',failure_code='RETRY_EXHAUSTED',
      quota_released_at=v_now,version=version+1,updated_at=pg_catalog.clock_timestamp()
    where company_id=v_company_id and id=v_attempt.upload_id;
    insert into public.hotel_file_scan_completion_receipts(
      id,company_id,branch_id,attempt_id,claim_generation,claim_token_hash,
      callback_body_hash,outcome,failure_code
    ) values (
      pg_catalog.gen_random_uuid(),v_company_id,v_attempt.branch_id,v_attempt.id,
      v_attempt.claim_generation,v_attempt.claim_token_hash,null,
      'LEASE_EXPIRED_DEAD_LETTERED','RETRY_EXHAUSTED'
    );
    insert into public.audit_events(
      id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
      resource_type,resource_id,after_summary,result,trace_id
    ) values (
      pg_catalog.gen_random_uuid(),'HOTEL_FILE_SCAN_DEAD_LETTERED',null,'RECONCILER',null,
      v_company_id,v_attempt.branch_id,'FILE_SCAN_ATTEMPT',v_attempt.id,
      pg_catalog.jsonb_build_object('outcome','LEASE_EXPIRED','state','DEAD_LETTER',
        'claimGeneration',v_attempt.claim_generation),'SUCCEEDED',pg_catalog.gen_random_uuid()
    );
    return query select 'DEAD_LETTERED'::text,v_attempt.id,v_attempt.claim_generation,
      null::timestamptz,v_attempt.upload_id,null::text,null::text,null::text,null::bigint;
    return;
  end if;
  if v_attempt.state not in ('PENDING','CLAIMED')
     or v_attempt.attempt_count >= 5
     or (v_attempt.state='PENDING' and v_attempt.available_at > v_now) then
    return query select 'BUSY'::text,v_attempt.id,v_attempt.claim_generation,v_attempt.lease_expires_at,
      v_attempt.upload_id,null::text,null::text,null::text,null::bigint; return;
  end if;
  update public.file_scan_attempts as attempt_record
  set state='CLAIMED',claim_token_hash=v_token_hash,
    claim_generation=attempt_record.claim_generation+1,
    attempt_count=attempt_record.attempt_count+1,
    lease_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds),
    claimed_at=v_now,updated_at=pg_catalog.clock_timestamp()
  where attempt_record.company_id=v_company_id and attempt_record.id=v_attempt.id
  returning attempt_record.* into v_attempt;
  insert into public.audit_events(
    id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id
  ) values (
    pg_catalog.gen_random_uuid(),'HOTEL_FILE_SCAN_CLAIMED',null,'RECONCILER',null,
    v_company_id,v_attempt.branch_id,'FILE_SCAN_ATTEMPT',v_attempt.id,
    pg_catalog.jsonb_build_object('state','CLAIMED','claimGeneration',v_attempt.claim_generation),
    'SUCCEEDED',pg_catalog.gen_random_uuid()
  );
  return query select 'CLAIMED'::text,v_attempt.id,v_attempt.claim_generation,v_attempt.lease_expires_at,
    v_attempt.upload_id,v_job.quarantine_object_key,v_attempt.source_etag,
    v_attempt.source_object_version,v_attempt.source_size_bytes;
end
$function$;

-- RECONCILER command: hotel_file_complete_scan_attempt
create function public.hotel_file_complete_scan_attempt(
  p_attempt_id uuid,
  p_claim_generation bigint,
  p_raw_claim_token text,
  p_callback_body_hash bytea,
  p_verdict text,
  p_actual_size_bytes bigint,
  p_scanner_sha256 bytea,
  p_detected_mime_type text,
  p_engine_name text,
  p_engine_version text,
  p_signature_database_version text,
  p_failure_code text,
  p_retry_delay_seconds integer
)
returns table (result_status text, upload_id uuid, upload_state text)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid := public.reconciler_current_company_id();
  v_attempt record;
  v_receipt record;
  v_upload record;
  v_token_hash bytea := pg_catalog.sha256(pg_catalog.convert_to(p_raw_claim_token,'UTF8'));
  v_outcome text;
  v_receipt_failure_code text;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if not public.runtime_has_capability('RECONCILER') or v_company_id is null then
    return query select 'FORBIDDEN'::text,null::uuid,null::text; return;
  end if;
  if p_callback_body_hash is null or pg_catalog.octet_length(p_callback_body_hash)<>32 then
    raise exception using errcode='22023',message='invalid scan completion evidence';
  end if;
  select * into v_receipt from public.hotel_file_scan_completion_receipts r
  where r.company_id=v_company_id and r.attempt_id=p_attempt_id
    and r.claim_generation=p_claim_generation;
  if found then
    if v_receipt.claim_token_hash=v_token_hash and v_receipt.callback_body_hash=p_callback_body_hash then
      select u.id,u.state into v_upload from public.file_scan_attempts a
      join public.hotel_file_uploads u on u.company_id=a.company_id and u.id=a.upload_id
      where a.company_id=v_company_id and a.id=p_attempt_id;
      return query select 'REPLAYED'::text,v_upload.id,v_upload.state;
    else
      return query select 'COMPLETION_CONFLICT'::text,null::uuid,null::text;
    end if;
    return;
  end if;
  select * into v_attempt from public.file_scan_attempts a
  where a.company_id=v_company_id and a.id=p_attempt_id for update;
  if not found then
    return query select 'STALE_FENCE'::text,null::uuid,null::text; return;
  end if;
  -- A callback that waited on the attempt lock must converge on the durable receipt.
  select * into v_receipt from public.hotel_file_scan_completion_receipts r
  where r.company_id=v_company_id and r.attempt_id=p_attempt_id
    and r.claim_generation=p_claim_generation;
  if found then
    if v_receipt.claim_token_hash=v_token_hash and v_receipt.callback_body_hash=p_callback_body_hash then
      select u.id,u.state into v_upload from public.hotel_file_uploads u
      where u.company_id=v_company_id and u.id=v_attempt.upload_id;
      return query select 'REPLAYED'::text,v_upload.id,v_upload.state;
    else
      return query select 'COMPLETION_CONFLICT'::text,null::uuid,null::text;
    end if;
    return;
  end if;
  if v_attempt.state<>'CLAIMED'
     or v_attempt.claim_generation<>p_claim_generation
     or v_attempt.claim_token_hash<>v_token_hash then
    return query select 'STALE_FENCE'::text,null::uuid,null::text; return;
  end if;
  if not (v_attempt.lease_expires_at > pg_catalog.statement_timestamp()) then
    return query select 'LEASE_EXPIRED'::text,null::uuid,null::text; return;
  end if;
  select * into v_upload from public.hotel_file_uploads u
  where u.company_id=v_company_id and u.id=v_attempt.upload_id for update;
  if p_actual_size_bytes is distinct from v_attempt.source_size_bytes then
    p_verdict := 'ERROR'; p_failure_code := 'RETRY_EXHAUSTED';
  end if;

  if p_verdict='CLEAN' then
    if p_scanner_sha256 is null or pg_catalog.octet_length(p_scanner_sha256)<>32
       or p_detected_mime_type is null
       or pg_catalog.btrim(p_detected_mime_type)=''
       or pg_catalog.octet_length(p_detected_mime_type)>255 then
      raise exception using errcode='22023',message='invalid CLEAN evidence';
    end if;
    v_outcome := 'CLEAN_ACCEPTED';
    update public.file_scan_attempts set state='SUCCEEDED',lease_expires_at=null,
      scanner_sha256=p_scanner_sha256,actual_size_bytes=p_actual_size_bytes,
      detected_mime_type=p_detected_mime_type,verdict='CLEAN',engine_name=p_engine_name,
      engine_version=p_engine_version,signature_database_version=p_signature_database_version,
      callback_body_hash=p_callback_body_hash,completed_at=v_now,updated_at=v_now
    where company_id=v_company_id and id=p_attempt_id;
    update public.hotel_file_uploads set state='CLEAN_PENDING_PROMOTION',version=version+1,updated_at=v_now
    where company_id=v_company_id and id=v_attempt.upload_id;
  elsif p_verdict='MALWARE' then
    v_outcome := 'MALWARE_REJECTED';
    update public.file_scan_attempts set state='SUCCEEDED',lease_expires_at=null,
      scanner_sha256=p_scanner_sha256,actual_size_bytes=p_actual_size_bytes,
      detected_mime_type=p_detected_mime_type,verdict='MALWARE',engine_name=p_engine_name,
      engine_version=p_engine_version,signature_database_version=p_signature_database_version,
      callback_body_hash=p_callback_body_hash,completed_at=v_now,updated_at=v_now
    where company_id=v_company_id and id=p_attempt_id;
    update public.hotel_file_uploads set state='REJECTED',failure_code='MALWARE_DETECTED',
      quota_released_at=v_now,version=version+1,updated_at=v_now
    where company_id=v_company_id and id=v_attempt.upload_id;
  elsif p_verdict='ERROR' and v_attempt.attempt_count<5 and p_failure_code='SCAN_ENGINE_UNAVAILABLE' then
    v_outcome := 'RETRY_SCHEDULED';
    v_receipt_failure_code := 'SCAN_ENGINE_UNAVAILABLE';
    update public.file_scan_attempts set state='PENDING',claim_token_hash=null,lease_expires_at=null,
      claimed_at=null,available_at=v_now+pg_catalog.make_interval(
        secs=>pg_catalog.least(3600,pg_catalog.greatest(30,pg_catalog.coalesce(p_retry_delay_seconds,30)))
      ),
      scanner_sha256=null,actual_size_bytes=null,detected_mime_type=null,verdict=null,
      engine_name=null,engine_version=null,signature_database_version=null,failure_code=null,
      callback_body_hash=null,completed_at=null,updated_at=v_now
    where company_id=v_company_id and id=p_attempt_id;
  else
    v_outcome := 'DEAD_LETTERED';
    v_receipt_failure_code := 'RETRY_EXHAUSTED';
    update public.file_scan_attempts set state='DEAD_LETTER',lease_expires_at=null,
      actual_size_bytes=p_actual_size_bytes,verdict='ERROR',failure_code='RETRY_EXHAUSTED',
      callback_body_hash=p_callback_body_hash,completed_at=v_now,updated_at=v_now
    where company_id=v_company_id and id=p_attempt_id;
    update public.hotel_file_uploads set state='SCAN_FAILED',failure_code='RETRY_EXHAUSTED',
      quota_released_at=v_now,version=version+1,updated_at=v_now
    where company_id=v_company_id and id=v_attempt.upload_id;
  end if;
  insert into public.hotel_file_scan_completion_receipts(
    id,company_id,branch_id,attempt_id,claim_generation,claim_token_hash,
    callback_body_hash,outcome,failure_code
  ) values (
    pg_catalog.gen_random_uuid(),v_company_id,v_attempt.branch_id,p_attempt_id,p_claim_generation,
    v_token_hash,p_callback_body_hash,v_outcome,v_receipt_failure_code
  );
  insert into public.audit_events(
    id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id
  ) values (
    pg_catalog.gen_random_uuid(),
    case when v_outcome='DEAD_LETTERED' then 'HOTEL_FILE_SCAN_DEAD_LETTERED'
         else 'HOTEL_FILE_SCAN_COMPLETED' end,
    null,'RECONCILER',null,v_company_id,v_attempt.branch_id,'FILE_SCAN_ATTEMPT',p_attempt_id,
    pg_catalog.jsonb_build_object('outcome',v_outcome,'claimGeneration',p_claim_generation),
    'SUCCEEDED',pg_catalog.gen_random_uuid()
  );
  return query select case v_outcome when 'RETRY_SCHEDULED' then 'RETRY_SCHEDULED'
    when 'DEAD_LETTERED' then 'DEAD_LETTERED' else 'CREATED' end,
    v_attempt.upload_id,(select u.state from public.hotel_file_uploads u
      where u.company_id=v_company_id and u.id=v_attempt.upload_id);
end
$function$;

-- FILE_FINALIZER command: hotel_file_reserve_clean_promotion
create function public.hotel_file_reserve_clean_promotion(
  p_upload_id uuid,
  p_reservation_id uuid,
  p_file_version_id uuid,
  p_clean_object_key text,
  p_raw_promotion_token text,
  p_lease_seconds integer
)
returns table (
  result_status text, reservation_id uuid, source_etag text,
  source_object_version text, scanner_sha256 bytea, actual_size_bytes bigint,
  detected_mime_type text, clean_object_key text, promotion_generation bigint,
  lease_expires_at timestamptz
)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid := public.hotel_file_finalizer_current_company_id();
  v_upload record;
  v_attempt record;
  v_reservation record;
  v_token_hash bytea;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_audit_outcome text;
begin
  if not public.hotel_file_has_finalizer_capability() or v_company_id is null then
    return query select 'FORBIDDEN'::text,null::uuid,null::text,null::text,null::bytea,
      null::bigint,null::text,null::text,null::bigint,null::timestamptz; return;
  end if;
  if p_raw_promotion_token is null or pg_catalog.octet_length(p_raw_promotion_token)<32
     or p_lease_seconds not between 30 and 900 then
    raise exception using errcode='22023',message='invalid clean promotion reservation request';
  end if;
  v_token_hash:=pg_catalog.sha256(pg_catalog.convert_to(p_raw_promotion_token,'UTF8'));
  select * into v_upload from public.hotel_file_uploads u
  where u.company_id=v_company_id and u.id=p_upload_id for update;
  if not found then
    return query select 'NOT_FOUND'::text,null::uuid,null::text,null::text,null::bytea,
      null::bigint,null::text,null::text,null::bigint,null::timestamptz; return;
  end if;
  select * into v_reservation from public.hotel_file_clean_promotion_reservations r
  where r.company_id=v_company_id and r.upload_id=p_upload_id for update;
  if found then
    if v_reservation.clean_object_key<>p_clean_object_key
       or v_reservation.file_version_id<>p_file_version_id then
      return query select 'VERSION_CONFLICT'::text,v_reservation.id,null::text,null::text,null::bytea,
        null::bigint,null::text,null::text,null::bigint,null::timestamptz; return;
    end if;
    if v_reservation.promotion_token_hash=v_token_hash then
      return query select 'REPLAYED'::text,v_reservation.id,v_reservation.source_etag,
        v_reservation.source_object_version,v_reservation.scanner_sha256,
        v_reservation.actual_size_bytes,v_reservation.detected_mime_type,
        v_reservation.clean_object_key,v_reservation.promotion_generation,
        v_reservation.lease_expires_at;
      return;
    end if;
    if v_reservation.state<>'RESERVED' or v_reservation.lease_expires_at>v_now then
      return query select 'BUSY'::text,v_reservation.id,null::text,null::text,null::bytea,
        null::bigint,null::text,null::text,null::bigint,v_reservation.lease_expires_at; return;
    end if;
    update public.hotel_file_clean_promotion_reservations as reservation_record set
      promotion_generation=reservation_record.promotion_generation+1,
      promotion_token_hash=v_token_hash,
      lease_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds)
    where reservation_record.company_id=v_company_id
      and reservation_record.id=v_reservation.id
    returning reservation_record.* into v_reservation;
    v_audit_outcome:='TAKEN_OVER';
  else
    select * into v_attempt from public.file_scan_attempts a
    where a.company_id=v_company_id and a.upload_id=p_upload_id
      and a.state='SUCCEEDED' and a.verdict='CLEAN'
      and a.source_etag=v_upload.source_etag
      and a.source_object_version=v_upload.source_object_version
      and a.actual_size_bytes=v_upload.source_size_bytes
    order by a.claim_generation desc limit 1;
    if not found or v_upload.state<>'CLEAN_PENDING_PROMOTION' then
      return query select 'VERSION_CONFLICT'::text,null::uuid,null::text,null::text,null::bytea,
        null::bigint,null::text,null::text,null::bigint,null::timestamptz; return;
    end if;
    insert into public.hotel_file_clean_promotion_reservations(
      id,company_id,branch_id,upload_id,attempt_id,file_version_id,promotion_generation,
      promotion_token_hash,lease_expires_at,source_etag,source_object_version,
      scanner_sha256,actual_size_bytes,detected_mime_type,clean_object_key
    ) values (
      p_reservation_id,v_company_id,v_upload.branch_id,p_upload_id,v_attempt.id,
      p_file_version_id,1,v_token_hash,v_now+pg_catalog.make_interval(secs=>p_lease_seconds),
      v_upload.source_etag,v_upload.source_object_version,v_attempt.scanner_sha256,
      v_attempt.actual_size_bytes,v_attempt.detected_mime_type,p_clean_object_key
    ) returning * into v_reservation;
    v_audit_outcome:='RESERVED';
  end if;
  insert into public.audit_events(
    id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id
  ) values (
    pg_catalog.gen_random_uuid(),'HOTEL_FILE_PROMOTION_RESERVED',null,'FILE_FINALIZER',null,
    v_company_id,v_reservation.branch_id,'HOTEL_FILE_PROMOTION',v_reservation.id,
    pg_catalog.jsonb_build_object('outcome',v_audit_outcome,
      'promotionGeneration',v_reservation.promotion_generation),
    'SUCCEEDED',pg_catalog.gen_random_uuid()
  );
  return query select 'CREATED'::text,v_reservation.id,v_reservation.source_etag,
    v_reservation.source_object_version,v_reservation.scanner_sha256,
    v_reservation.actual_size_bytes,v_reservation.detected_mime_type,
    v_reservation.clean_object_key,v_reservation.promotion_generation,v_reservation.lease_expires_at;
end
$function$;

-- FILE_FINALIZER command: hotel_file_complete_clean_promotion
create function public.hotel_file_complete_clean_promotion(
  p_reservation_id uuid,
  p_promotion_generation bigint,
  p_raw_promotion_token text,
  p_file_version_id uuid,
  p_destination_etag text,
  p_destination_object_version text,
  p_destination_sha256 bytea,
  p_destination_size_bytes bigint,
  p_destination_mime_type text
)
returns table (result_status text, upload_id uuid, file_version_id uuid, state text)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid := public.hotel_file_finalizer_current_company_id();
  v_reservation record;
  v_upload record;
  v_version record;
  v_token_hash bytea;
  v_now timestamptz:=pg_catalog.statement_timestamp();
begin
  if not public.hotel_file_has_finalizer_capability() or v_company_id is null then
    return query select 'FORBIDDEN'::text,null::uuid,null::uuid,null::text; return;
  end if;
  if p_raw_promotion_token is null or pg_catalog.octet_length(p_raw_promotion_token)<32 then
    raise exception using errcode='22023',message='invalid clean promotion completion request';
  end if;
  v_token_hash:=pg_catalog.sha256(pg_catalog.convert_to(p_raw_promotion_token,'UTF8'));
  select * into v_reservation from public.hotel_file_clean_promotion_reservations r
  where r.company_id=v_company_id and r.id=p_reservation_id for update;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::uuid,null::text; return; end if;
  select * into v_upload from public.hotel_file_uploads u
  where u.company_id=v_company_id and u.id=v_reservation.upload_id for update;
  if v_reservation.promotion_generation<>p_promotion_generation
     or v_reservation.promotion_token_hash<>v_token_hash
     or v_reservation.file_version_id<>p_file_version_id then
    return query select 'VERSION_CONFLICT'::text,v_reservation.upload_id,null::uuid,v_upload.state; return;
  end if;
  if v_reservation.state='COMPLETED' then
    select * into v_version from public.hotel_file_versions v
      where v.company_id=v_company_id and v.upload_id=v_reservation.upload_id;
    if v_reservation.destination_etag=p_destination_etag
       and v_reservation.destination_object_version=p_destination_object_version
       and v_reservation.destination_sha256=p_destination_sha256
       and v_reservation.destination_size_bytes=p_destination_size_bytes
       and v_reservation.destination_mime_type=p_destination_mime_type
       and v_version.id=p_file_version_id
       and v_version.destination_etag=p_destination_etag
       and v_version.destination_object_version=p_destination_object_version
       and v_version.sha256=p_destination_sha256
       and v_version.size_bytes=p_destination_size_bytes
       and v_version.mime_type=p_destination_mime_type then
      return query select 'REPLAYED'::text,v_reservation.upload_id,v_version.id,v_upload.state;
    else
      return query select 'VERSION_CONFLICT'::text,v_reservation.upload_id,v_version.id,v_upload.state;
    end if;
    return;
  end if;
  if v_reservation.lease_expires_at<=v_now
     or v_upload.state<>'CLEAN_PENDING_PROMOTION'
     or p_destination_sha256 is distinct from v_reservation.scanner_sha256
     or p_destination_size_bytes is distinct from v_reservation.actual_size_bytes
     or p_destination_mime_type is distinct from v_reservation.detected_mime_type
     or p_destination_etag is null or p_destination_object_version is null then
    return query select 'VERSION_CONFLICT'::text,v_reservation.upload_id,null::uuid,v_upload.state; return;
  end if;
  insert into public.hotel_file_versions(
    id,company_id,branch_id,parent_type,parent_id,upload_id,clean_object_key,
    file_name,mime_type,size_bytes,sha256,source_etag,source_object_version,
    destination_etag,destination_object_version,promotion_generation
  ) values (
    v_reservation.file_version_id,v_company_id,v_upload.branch_id,v_upload.parent_type,v_upload.parent_id,
    v_upload.id,v_reservation.clean_object_key,v_upload.declared_file_name,v_reservation.detected_mime_type,
    p_destination_size_bytes,p_destination_sha256,v_reservation.source_etag,
    v_reservation.source_object_version,p_destination_etag,p_destination_object_version,
    v_reservation.promotion_generation
  );
  update public.hotel_file_clean_promotion_reservations set state='COMPLETED',
    destination_etag=p_destination_etag,destination_object_version=p_destination_object_version,
    destination_sha256=p_destination_sha256,destination_size_bytes=p_destination_size_bytes,
    destination_mime_type=p_destination_mime_type,completed_at=v_now
    where company_id=v_company_id and id=p_reservation_id;
  update public.hotel_file_uploads set state='READY_UNLINKED',version=version+1,updated_at=v_now
    where company_id=v_company_id and id=v_upload.id;
  insert into public.audit_events(
    id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id
  ) values (
    pg_catalog.gen_random_uuid(),'HOTEL_FILE_PROMOTION_COMPLETED',null,'FILE_FINALIZER',null,
    v_company_id,v_reservation.branch_id,'HOTEL_FILE_PROMOTION',v_reservation.id,
    pg_catalog.jsonb_build_object('state','READY_UNLINKED',
      'promotionGeneration',v_reservation.promotion_generation),
    'SUCCEEDED',pg_catalog.gen_random_uuid()
  );
  return query select 'READY_UNLINKED'::text,v_upload.id,v_reservation.file_version_id,'READY_UNLINKED'::text;
end
$function$;

-- API_RUNTIME command: hotel_file_link_clean_version
create function public.hotel_file_link_clean_version(
  p_file_version_id uuid,
  p_link_id uuid,
  p_idempotency_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_trace_id uuid
)
returns table (result_status text, upload_id uuid, file_version_id uuid, state text)
language plpgsql
volatile
parallel unsafe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid:=public.api_current_company_id();
  v_actor record;
  v_version record;
  v_upload record;
  v_existing record;
  v_audit_id uuid:=pg_catalog.gen_random_uuid();
  v_now timestamptz:=pg_catalog.statement_timestamp();
begin
  if not public.runtime_has_capability('API_RUNTIME') or v_company_id is null then
    return query select 'FORBIDDEN'::text,null::uuid,null::uuid,null::text; return;
  end if;
  select s.id session_id,s.user_id,u.user_type into v_actor
  from public.auth_sessions s join public.users u on u.company_id=s.company_id and u.id=s.user_id
  where s.company_id=v_company_id and s.id=nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid;
  select v.* into v_version from public.hotel_file_versions v
  where v.company_id=v_company_id and v.id=p_file_version_id;
  if not found then return query select 'NOT_FOUND'::text,null::uuid,null::uuid,null::text; return; end if;
  select * into v_upload from public.hotel_file_uploads u
  where u.company_id=v_company_id and u.id=v_version.upload_id for update;
  perform 1 from public.file_attachment_parents p where p.company_id=v_company_id
    and p.branch_id=v_upload.branch_id and p.parent_type=v_upload.parent_type
    and p.parent_id=v_upload.parent_id for update;
  select i.request_hash,i.resource_id into v_existing from public.idempotency_records i
  where i.company_id=v_company_id and i.actor_user_id=v_actor.user_id
    and i.idempotency_key=p_idempotency_key and i.http_method='POST'
    and i.operation_path='/api/hotel-files/links' for update;
  if found then
    if v_existing.request_hash<>p_request_hash then
      return query select 'IDEMPOTENCY_CONFLICT'::text,v_upload.id,p_file_version_id,v_upload.state;
    else
      return query select 'REPLAYED'::text,v_upload.id,p_file_version_id,v_upload.state;
    end if;
    return;
  end if;
  if v_upload.state<>'READY_UNLINKED' then
    if v_upload.state='LINKED' and exists(select 1 from public.hotel_file_links l
      where l.company_id=v_company_id and l.file_version_id=p_file_version_id) then
      return query select 'LINKED'::text,v_upload.id,p_file_version_id,'LINKED'::text;
    end if;
    return query select 'VERSION_CONFLICT'::text,v_upload.id,p_file_version_id,v_upload.state; return;
  end if;
  insert into public.hotel_file_links(id,company_id,branch_id,parent_type,parent_id,file_version_id,linked_by)
  values(p_link_id,v_company_id,v_upload.branch_id,v_upload.parent_type,v_upload.parent_id,p_file_version_id,v_actor.user_id);
  update public.hotel_file_uploads set state='LINKED',quota_released_at=v_now,
    version=version+1,updated_at=v_now where company_id=v_company_id and id=v_upload.id;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,
    resource_type,resource_id,after_summary,result,trace_id)
  values(v_audit_id,'HOTEL_FILE_LINKED',v_actor.user_id,v_actor.user_type,v_actor.session_id,
    v_company_id,v_upload.branch_id,'HOTEL_FILE_VERSION',p_file_version_id,
    pg_catalog.jsonb_build_object('state','LINKED'),'SUCCEEDED',p_trace_id);
  insert into public.idempotency_records(id,company_id,actor_user_id,idempotency_key,http_method,
    operation_path,request_hash,status,resource_type,resource_id,audit_event_id,result_snapshot,
    completed_at,expires_at)
  values(p_idempotency_id,v_company_id,v_actor.user_id,p_idempotency_key,'POST','/api/hotel-files/links',
    p_request_hash,'COMPLETED','HOTEL_FILE_LINK',p_link_id,v_audit_id,
    pg_catalog.jsonb_build_object('fileVersionId',p_file_version_id),v_now,v_now+interval '24 hours');
  return query select 'LINKED'::text,v_upload.id,p_file_version_id,'LINKED'::text;
end
$function$;

-- API_RUNTIME command: hotel_file_read_status
create function public.hotel_file_read_status(p_upload_id uuid)
returns table (result_status text, upload_id uuid, state text, file_version_id uuid, failure_code text)
language plpgsql
stable
parallel safe
security definer
set search_path = pg_catalog
as $function$
declare
  v_company_id uuid:=public.api_current_company_id();
begin
  if not public.runtime_has_capability('API_RUNTIME') or v_company_id is null then
    return query select 'NOT_FOUND'::text,null::uuid,'NOT_FOUND'::text,null::uuid,null::text; return;
  end if;
  return query
  select case when u.id is null then 'NOT_FOUND' else 'CREATED' end,
    u.id,
    case
      when u.id is null then 'NOT_FOUND'
      when u.state in ('PENDING_UPLOAD','QUARANTINED') then 'PENDING_UPLOAD'
      when u.state in ('SCANNING','CLEAN_PENDING_PROMOTION') then 'SCANNING'
      when u.state='READY_UNLINKED' then 'READY_UNLINKED'
      when u.state='LINKED' then 'LINKED'
      when u.state='REJECTED' then 'REJECTED'
      when u.state in ('SCAN_FAILED','EXPIRED') then 'SCAN_FAILED'
      else 'SCAN_FAILED'
    end,
    case when u.state in ('READY_UNLINKED','LINKED') then
      (select v.id from public.hotel_file_versions v
       where v.company_id=v_company_id and v.upload_id=u.id)
    else null::uuid end,
    case when u.state in ('REJECTED','SCAN_FAILED','EXPIRED') then u.failure_code else null::text end
  from (select 1) anchor
  left join public.hotel_file_uploads u on u.company_id=v_company_id and u.id=p_upload_id;
end
$function$;

-- Dedicated NOLOGIN owners keep each command family at least privilege.
do $roles$
declare
  v_name text;
begin
  foreach v_name in array array[
    'werehere_hotel_file_api_definer',
    'werehere_hotel_file_reconciler_definer',
    'werehere_hotel_file_finalizer_definer'
  ] loop
    if not exists(select 1 from pg_catalog.pg_roles where rolname=v_name) then
      execute pg_catalog.format('create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',v_name);
    end if;
    execute pg_catalog.format('grant %I to %I with inherit false, set true',v_name,current_user);
  end loop;
end
$roles$;

alter policy hotel_file_finalizer_audit_insert on public.audit_events
  to werehere_hotel_file_finalizer_definer;

-- Runtime roles are provisioned outside migrations; grant only EXECUTE when they already exist.
-- Keep this block before all underlying DML grants so source ACL checks cannot conflate them.
do $runtime_execute$
begin
  if exists(select 1 from pg_catalog.pg_roles where rolname='werehere_api_runtime') then
    grant execute on function public.hotel_file_init_upload(uuid,uuid,text,uuid,text,text,bigint,text,timestamptz,uuid,text,text,uuid),
      public.hotel_file_complete_upload(uuid,text,text,bigint,text,uuid,uuid),
      public.hotel_file_link_clean_version(uuid,uuid,uuid,text,text,uuid),
      public.hotel_file_read_status(uuid) to werehere_api_runtime;
  end if;
  if exists(select 1 from pg_catalog.pg_roles where rolname='werehere_reconciler') then
    grant execute on function public.hotel_file_claim_scan_attempt(uuid,uuid,text,integer),
      public.hotel_file_complete_scan_attempt(uuid,bigint,text,bytea,text,bigint,bytea,text,text,text,text,text,integer)
      to werehere_reconciler;
  end if;
  if exists(select 1 from pg_catalog.pg_roles where rolname='werehere_file_finalizer') then
    grant execute on function public.hotel_file_reserve_clean_promotion(uuid,uuid,uuid,text,text,integer),
      public.hotel_file_complete_clean_promotion(uuid,bigint,text,uuid,text,text,bytea,bigint,text)
      to werehere_file_finalizer;
  end if;
end
$runtime_execute$;

grant usage on schema public to werehere_hotel_file_api_definer,
  werehere_hotel_file_reconciler_definer, werehere_hotel_file_finalizer_definer;

grant select on public.auth_sessions,public.users,public.file_attachment_parents,
  public.hotel_file_uploads,public.hotel_file_scan_jobs,public.hotel_file_versions,
  public.hotel_file_links,public.idempotency_records
  to werehere_hotel_file_api_definer;
grant insert on public.hotel_file_uploads,public.hotel_file_scan_jobs,public.hotel_file_links,
  public.audit_events,public.idempotency_records to werehere_hotel_file_api_definer;
grant update on public.file_attachment_parents,public.hotel_file_uploads,
  public.idempotency_records to werehere_hotel_file_api_definer;

grant select on public.hotel_file_scan_jobs,public.hotel_file_uploads,public.file_scan_attempts,
  public.hotel_file_scan_completion_receipts to werehere_hotel_file_reconciler_definer;
grant insert on public.file_scan_attempts,public.hotel_file_scan_completion_receipts,
  public.audit_events to werehere_hotel_file_reconciler_definer;
grant update on public.hotel_file_scan_jobs,public.hotel_file_uploads,public.file_scan_attempts
  to werehere_hotel_file_reconciler_definer;

grant select on public.hotel_file_uploads,public.file_scan_attempts,public.hotel_file_versions,
  public.hotel_file_clean_promotion_reservations,public.hotel_file_finalizer_capabilities,
  public.reconciliation_company_registry to werehere_hotel_file_finalizer_definer;
grant insert on public.hotel_file_versions,public.hotel_file_clean_promotion_reservations,
  public.audit_events to werehere_hotel_file_finalizer_definer;
grant update on public.hotel_file_uploads,public.hotel_file_clean_promotion_reservations
  to werehere_hotel_file_finalizer_definer;

grant execute on function public.runtime_is_schema_owner(),
  public.runtime_has_capability(text),public.api_current_company_id(),
  public.reconciler_current_company_id(),
  public.hotel_file_has_finalizer_capability(),
  public.hotel_file_finalizer_current_company_id()
  to werehere_hotel_file_api_definer;
grant execute on function public.runtime_is_schema_owner(),
  public.runtime_has_capability(text),public.api_current_company_id(),
  public.reconciler_current_company_id(),
  public.hotel_file_has_finalizer_capability(),
  public.hotel_file_finalizer_current_company_id()
  to werehere_hotel_file_reconciler_definer;
grant execute on function public.runtime_is_schema_owner(),
  public.runtime_has_capability(text),public.api_current_company_id(),
  public.reconciler_current_company_id(),
  public.hotel_file_has_finalizer_capability(),
  public.hotel_file_finalizer_current_company_id() to werehere_hotel_file_finalizer_definer;

grant create on schema public to werehere_hotel_file_api_definer,
  werehere_hotel_file_reconciler_definer, werehere_hotel_file_finalizer_definer;

alter function public.hotel_file_init_upload(uuid,uuid,text,uuid,text,text,bigint,text,timestamptz,uuid,text,text,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_complete_upload(uuid,text,text,bigint,text,uuid,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_link_clean_version(uuid,uuid,uuid,text,text,uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_read_status(uuid)
  owner to werehere_hotel_file_api_definer;
alter function public.hotel_file_claim_scan_attempt(uuid,uuid,text,integer)
  owner to werehere_hotel_file_reconciler_definer;
alter function public.hotel_file_complete_scan_attempt(uuid,bigint,text,bytea,text,bigint,bytea,text,text,text,text,text,integer)
  owner to werehere_hotel_file_reconciler_definer;
alter function public.hotel_file_reserve_clean_promotion(uuid,uuid,uuid,text,text,integer)
  owner to werehere_hotel_file_finalizer_definer;
alter function public.hotel_file_complete_clean_promotion(uuid,bigint,text,uuid,text,text,bytea,bigint,text)
  owner to werehere_hotel_file_finalizer_definer;

revoke create on schema public from werehere_hotel_file_api_definer,
  werehere_hotel_file_reconciler_definer, werehere_hotel_file_finalizer_definer;

set local role werehere_hotel_file_api_definer;
revoke all on function public.hotel_file_init_upload(uuid,uuid,text,uuid,text,text,bigint,text,timestamptz,uuid,text,text,uuid) from public;
revoke all on function public.hotel_file_complete_upload(uuid,text,text,bigint,text,uuid,uuid) from public;
revoke all on function public.hotel_file_link_clean_version(uuid,uuid,uuid,text,text,uuid) from public;
revoke all on function public.hotel_file_read_status(uuid) from public;
reset role;
set local role werehere_hotel_file_reconciler_definer;
revoke all on function public.hotel_file_claim_scan_attempt(uuid,uuid,text,integer) from public;
revoke all on function public.hotel_file_complete_scan_attempt(uuid,bigint,text,bytea,text,bigint,bytea,text,text,text,text,text,integer) from public;
reset role;
set local role werehere_hotel_file_finalizer_definer;
revoke all on function public.hotel_file_reserve_clean_promotion(uuid,uuid,uuid,text,text,integer) from public;
revoke all on function public.hotel_file_complete_clean_promotion(uuid,bigint,text,uuid,text,text,bytea,bigint,text) from public;
reset role;

do $ownership_revoke$
declare v_name text;
begin
  foreach v_name in array array[
    'werehere_hotel_file_api_definer','werehere_hotel_file_reconciler_definer',
    'werehere_hotel_file_finalizer_definer'
  ] loop
    execute pg_catalog.format('revoke %I from %I granted by %I',v_name,current_user,current_user);
  end loop;
end
$ownership_revoke$;
revoke create on schema public from werehere_hotel_file_api_definer,
  werehere_hotel_file_reconciler_definer,werehere_hotel_file_finalizer_definer;

insert into public.schema_migrations(version)
values ('0026_hotel_file_repository_commands');

commit;
