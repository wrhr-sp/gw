begin;

-- 0025_hotel_file_quarantine_foundation
-- Private quarantine objects are scanned before a distinct CLEAN object can be linked.

create table public.hotel_file_finalizer_capabilities (
  role_name name primary key,
  provisioned_at timestamptz not null default pg_catalog.statement_timestamp()
);
revoke all on public.hotel_file_finalizer_capabilities from public;

create function public.hotel_file_has_finalizer_capability()
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.hotel_file_finalizer_capabilities capability_record
    where capability_record.role_name = session_user
  )
$function$;
revoke all on function public.hotel_file_has_finalizer_capability() from public;

create function public.hotel_file_finalizer_current_company_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $function$
  select registry.company_id
  from public.reconciliation_company_registry registry
  where public.hotel_file_has_finalizer_capability()
    and registry.company_status = 'ACTIVE'
    and registry.company_id = nullif(
      pg_catalog.current_setting('app.reconciler_company_id', true), ''
    )::uuid
$function$;
revoke all on function public.hotel_file_finalizer_current_company_id() from public;

create table file_attachment_parents (
  company_id uuid not null references companies (id),
  branch_id uuid not null,
  parent_type text not null check (parent_type in (
    'INSPECTION_RESULT',
    'DAILY_SALES',
    'OPERATIONAL_ISSUE',
    'OWNER_INQUIRY',
    'KNOWLEDGE_ARTICLE'
  )),
  parent_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (company_id, branch_id, parent_type, parent_id),
  unique (company_id, branch_id, parent_type, parent_id),
  foreign key (company_id, branch_id)
    references hotel_profiles (company_id, branch_id),
  foreign key (company_id, created_by)
    references users (company_id, id)
);

create table hotel_file_uploads (
  id uuid primary key,
  company_id uuid not null references companies (id),
  branch_id uuid not null,
  parent_type text not null,
  parent_id uuid not null,
  initiated_by uuid not null,
  declared_file_name text not null
    check (declared_file_name = btrim(declared_file_name) and octet_length(declared_file_name) between 1 and 1024),
  declared_mime_type text not null check (declared_mime_type in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  declared_size_bytes bigint not null check (
    declared_size_bytes between 1 and 50000000
    and (parent_type <> 'INSPECTION_RESULT' or declared_size_bytes <= 20000000)
  ),
  reserved_size_bytes bigint not null check (
    reserved_size_bytes between 1 and 50000000
    and reserved_size_bytes = declared_size_bytes
  ),
  quarantine_object_key text not null unique
    check (quarantine_object_key ~ '^quarantine/[0-9a-f]{64}$'),
  source_etag text,
  source_size_bytes bigint,
  source_mime_type text,
  state text not null default 'PENDING_UPLOAD' check (state in (
    'PENDING_UPLOAD',
    'QUARANTINED',
    'SCANNING',
    'CLEAN_PENDING_PROMOTION',
    'READY_UNLINKED',
    'LINKED',
    'REJECTED',
    'SCAN_FAILED',
    'EXPIRED'
  )),
  failure_code text,
  quota_released_at timestamptz,
  upload_completed_at timestamptz,
  expires_at timestamptz not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (company_id, branch_id, id),
  unique (company_id, branch_id, parent_type, parent_id, id),
  foreign key (company_id, branch_id, parent_type, parent_id)
    references file_attachment_parents (company_id, branch_id, parent_type, parent_id),
  foreign key (company_id, initiated_by)
    references users (company_id, id),
  check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  check (
    (state = 'PENDING_UPLOAD' and source_etag is null and source_size_bytes is null and source_mime_type is null and upload_completed_at is null)
    or (state = 'EXPIRED' and (
      (source_etag is null and source_size_bytes is null and source_mime_type is null and upload_completed_at is null)
      or (source_etag is not null and source_size_bytes is not null and source_mime_type is not null and upload_completed_at is not null)
    ))
    or (state not in ('PENDING_UPLOAD', 'EXPIRED')
      and source_etag is not null
      and source_size_bytes = declared_size_bytes
      and source_mime_type = declared_mime_type
      and upload_completed_at is not null)
  ),
  check (
    (state = 'REJECTED' and failure_code in ('MALWARE_DETECTED', 'SOURCE_INTEGRITY_MISMATCH'))
    or (state = 'SCAN_FAILED' and failure_code in ('SCAN_ENGINE_UNAVAILABLE', 'PROMOTION_INTEGRITY_MISMATCH', 'RETRY_EXHAUSTED'))
    or (state = 'EXPIRED' and failure_code = 'UPLOAD_EXPIRED')
    or (state not in ('REJECTED', 'SCAN_FAILED', 'EXPIRED') and failure_code is null)
  ),
  check (
    (state in ('LINKED', 'REJECTED', 'SCAN_FAILED', 'EXPIRED') and quota_released_at is not null)
    or (state not in ('LINKED', 'REJECTED', 'SCAN_FAILED', 'EXPIRED') and quota_released_at is null)
  )
);

create index hotel_file_uploads_parent_state_idx
  on hotel_file_uploads (company_id, branch_id, parent_type, parent_id, state);
create index hotel_file_uploads_expiry_idx
  on hotel_file_uploads (company_id, state, expires_at)
  where state in ('PENDING_UPLOAD', 'QUARANTINED');

create table hotel_file_scan_jobs (
  id uuid primary key,
  company_id uuid not null references companies (id),
  branch_id uuid not null,
  upload_id uuid not null,
  job_type text not null default 'FILE_SCAN' check (job_type = 'FILE_SCAN'),
  state text not null default 'PENDING' check (state in ('PENDING', 'DISPATCHED', 'CANCELLED')),
  available_at timestamptz not null default statement_timestamp(),
  dispatch_generation bigint not null default 0 check (dispatch_generation >= 0),
  dispatched_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (company_id, branch_id, id),
  unique (company_id, branch_id, upload_id),
  foreign key (company_id, branch_id, upload_id)
    references hotel_file_uploads (company_id, branch_id, id),
  check (
    (state = 'PENDING' and dispatched_at is null)
    or (state = 'DISPATCHED' and dispatched_at is not null)
    or state = 'CANCELLED'
  )
);

create index hotel_file_scan_jobs_due_idx
  on hotel_file_scan_jobs (available_at, id)
  where state = 'PENDING';

create table file_scan_attempts (
  id uuid primary key,
  company_id uuid not null references companies (id),
  branch_id uuid not null,
  parent_type text not null,
  parent_id uuid not null,
  upload_id uuid not null,
  dispatch_job_id uuid not null,
  state text not null default 'PENDING' check (state in (
    'PENDING', 'CLAIMED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER'
  )),
  claim_token_hash bytea,
  claim_generation bigint not null default 0 check (claim_generation >= 0),
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  available_at timestamptz not null default statement_timestamp(),
  source_etag text not null,
  source_size_bytes bigint not null check (source_size_bytes between 1 and 50000000),
  scanner_sha256 bytea,
  detected_mime_type text,
  verdict text check (verdict in ('CLEAN', 'MALWARE', 'ERROR')),
  engine_name text,
  engine_version text,
  signature_database_version text,
  failure_code text,
  callback_body_hash bytea,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (company_id, dispatch_job_id),
  unique (company_id, branch_id, id),
  foreign key (company_id, branch_id, parent_type, parent_id, upload_id)
    references hotel_file_uploads (company_id, branch_id, parent_type, parent_id, id),
  foreign key (company_id, branch_id, dispatch_job_id)
    references hotel_file_scan_jobs (company_id, branch_id, id),
  check (claim_token_hash is null or octet_length(claim_token_hash) = 32),
  check (scanner_sha256 is null or octet_length(scanner_sha256) = 32),
  check (callback_body_hash is null or octet_length(callback_body_hash) = 32),
  check (
    (state = 'PENDING'
      and claim_token_hash is null
      and lease_expires_at is null
      and claimed_at is null
      and completed_at is null)
    or (state = 'CLAIMED'
      and claim_token_hash is not null
      and claim_generation >= 1
      and attempt_count between 1 and 5
      and lease_expires_at is not null
      and claimed_at is not null
      and completed_at is null)
    or (state in ('SUCCEEDED', 'FAILED', 'DEAD_LETTER')
      and claim_token_hash is not null
      and claim_generation >= 1
      and lease_expires_at is null
      and completed_at is not null)
  ),
  check (
    (state = 'SUCCEEDED'
      and verdict in ('CLEAN', 'MALWARE')
      and scanner_sha256 is not null
      and detected_mime_type is not null
      and engine_name is not null
      and engine_version is not null
      and signature_database_version is not null
      and callback_body_hash is not null
      and failure_code is null)
    or (state in ('FAILED', 'DEAD_LETTER')
      and verdict = 'ERROR'
      and failure_code in ('SCAN_ENGINE_UNAVAILABLE', 'RETRY_EXHAUSTED')
      and callback_body_hash is not null)
    or (state in ('PENDING', 'CLAIMED')
      and verdict is null
      and scanner_sha256 is null
      and detected_mime_type is null
      and engine_name is null
      and engine_version is null
      and signature_database_version is null
      and failure_code is null
      and callback_body_hash is null)
  )
);

create unique index file_scan_attempts_one_active_per_upload_idx
  on file_scan_attempts (company_id, upload_id)
  where state in ('PENDING', 'CLAIMED');
create index file_scan_attempts_recovery_idx
  on file_scan_attempts (company_id, state, lease_expires_at, available_at);
create index file_scan_attempts_upload_history_idx
  on file_scan_attempts (company_id, upload_id, created_at desc);

create table hotel_file_versions (
  id uuid primary key,
  company_id uuid not null references companies (id),
  branch_id uuid not null,
  parent_type text not null,
  parent_id uuid not null,
  upload_id uuid not null,
  clean_object_key text not null unique
    check (clean_object_key ~ '^clean/[0-9a-f]{64}$'),
  file_name text not null check (file_name = btrim(file_name) and octet_length(file_name) between 1 and 1024),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 50000000),
  sha256 bytea not null check (octet_length(sha256) = 32),
  source_etag text not null,
  promotion_generation bigint not null check (promotion_generation >= 1),
  created_at timestamptz not null default statement_timestamp(),
  unique (company_id, upload_id),
  unique (company_id, branch_id, id),
  unique (company_id, branch_id, parent_type, parent_id, id),
  foreign key (company_id, branch_id, parent_type, parent_id)
    references file_attachment_parents (company_id, branch_id, parent_type, parent_id),
  foreign key (company_id, branch_id, parent_type, parent_id, upload_id)
    references hotel_file_uploads (company_id, branch_id, parent_type, parent_id, id)
);

create index hotel_file_versions_parent_idx
  on hotel_file_versions (company_id, branch_id, parent_type, parent_id, created_at desc);

create table hotel_file_links (
  id uuid primary key,
  company_id uuid not null references companies (id),
  branch_id uuid not null,
  parent_type text not null,
  parent_id uuid not null,
  file_version_id uuid not null,
  linked_by uuid not null,
  linked_at timestamptz not null default statement_timestamp(),
  unique (company_id, file_version_id),
  unique (company_id, branch_id, id),
  foreign key (company_id, branch_id, parent_type, parent_id)
    references file_attachment_parents (company_id, branch_id, parent_type, parent_id),
  foreign key (company_id, branch_id, parent_type, parent_id, file_version_id)
    references hotel_file_versions (company_id, branch_id, parent_type, parent_id, id),
  foreign key (company_id, linked_by)
    references users (company_id, id)
);

create index hotel_file_links_parent_idx
  on hotel_file_links (company_id, branch_id, parent_type, parent_id, linked_at desc);

create function public.reject_hotel_file_append_only_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception using errcode = '23514', message = 'hotel file append-only record cannot be changed';
end
$function$;
revoke all on function public.reject_hotel_file_append_only_change() from public;

create function public.reject_hotel_file_upload_transition()
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
     or new.initiated_by is distinct from old.initiated_by
     or new.declared_file_name is distinct from old.declared_file_name
     or new.declared_mime_type is distinct from old.declared_mime_type
     or new.declared_size_bytes is distinct from old.declared_size_bytes
     or new.reserved_size_bytes is distinct from old.reserved_size_bytes
     or new.quarantine_object_key is distinct from old.quarantine_object_key
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at
  then
    raise exception using errcode = '23514', message = 'hotel file upload identity is immutable';
  end if;

  if old.source_etag is not null and (
    new.source_etag is distinct from old.source_etag
    or new.source_size_bytes is distinct from old.source_size_bytes
    or new.source_mime_type is distinct from old.source_mime_type
    or new.upload_completed_at is distinct from old.upload_completed_at
  ) then
    raise exception using errcode = '23514', message = 'hotel file source identity is immutable';
  end if;

  if not (
    public.runtime_is_schema_owner()
    or current_user in ('werehere_auth_session_definer', 'werehere_tenant_authority_definer')
    or (
      public.runtime_has_capability('API_RUNTIME')
      and (
        (old.state = 'PENDING_UPLOAD' and new.state = 'QUARANTINED')
        or (old.state = 'READY_UNLINKED' and new.state = 'LINKED')
      )
    )
    or (
      public.runtime_has_capability('RECONCILER')
      and (
        (old.state = 'PENDING_UPLOAD' and new.state = 'EXPIRED')
        or (old.state = 'QUARANTINED' and new.state in ('SCANNING', 'REJECTED', 'SCAN_FAILED', 'EXPIRED'))
        or (old.state = 'SCANNING' and new.state in ('CLEAN_PENDING_PROMOTION', 'REJECTED', 'SCAN_FAILED'))
      )
    )
    or (
      public.hotel_file_has_finalizer_capability()
      and old.state = 'CLEAN_PENDING_PROMOTION'
      and new.state in ('READY_UNLINKED', 'SCAN_FAILED')
    )
  ) then
    raise exception using errcode = '42501', message = 'hotel file upload transition authority denied';
  end if;

  if not (
    (old.state = 'PENDING_UPLOAD' and new.state in ('QUARANTINED', 'EXPIRED'))
    or (old.state = 'QUARANTINED' and new.state in ('SCANNING', 'REJECTED', 'SCAN_FAILED', 'EXPIRED'))
    or (old.state = 'SCANNING' and new.state in ('CLEAN_PENDING_PROMOTION', 'REJECTED', 'SCAN_FAILED'))
    or (old.state = 'CLEAN_PENDING_PROMOTION' and new.state in ('READY_UNLINKED', 'SCAN_FAILED'))
    or (old.state = 'READY_UNLINKED' and new.state = 'LINKED')
  ) then
    raise exception using errcode = '23514', message = 'invalid hotel file upload transition';
  end if;

  if new.state = 'SCANNING' and not exists (
    select 1
    from public.hotel_file_scan_jobs job_record
    where job_record.company_id = old.company_id
      and job_record.branch_id = old.branch_id
      and job_record.upload_id = old.id
      and job_record.state = 'DISPATCHED'
  ) then
    raise exception using errcode = '23514', message = 'scanning upload requires dispatched scan job';
  end if;
  if new.state = 'CLEAN_PENDING_PROMOTION' and not exists (
    select 1
    from public.file_scan_attempts attempt_record
    where attempt_record.company_id = old.company_id
      and attempt_record.branch_id = old.branch_id
      and attempt_record.upload_id = old.id
      and attempt_record.state = 'SUCCEEDED'
      and attempt_record.verdict = 'CLEAN'
      and attempt_record.source_etag = old.source_etag
      and attempt_record.source_size_bytes = old.source_size_bytes
  ) then
    raise exception using errcode = '23514', message = 'clean promotion requires successful current scan';
  end if;
  if new.state = 'READY_UNLINKED' and not exists (
    select 1
    from public.hotel_file_versions version_record
    where version_record.company_id = old.company_id
      and version_record.branch_id = old.branch_id
      and version_record.upload_id = old.id
  ) then
    raise exception using errcode = '23514', message = 'ready upload requires clean version';
  end if;
  if new.state = 'LINKED' and not exists (
    select 1
    from public.hotel_file_versions version_record
    join public.hotel_file_links link_record
      on link_record.company_id = version_record.company_id
     and link_record.branch_id = version_record.branch_id
     and link_record.file_version_id = version_record.id
    where version_record.company_id = old.company_id
      and version_record.branch_id = old.branch_id
      and version_record.upload_id = old.id
  ) then
    raise exception using errcode = '23514', message = 'linked upload requires attachment link';
  end if;

  if new.version <> old.version + 1 or new.updated_at <= old.updated_at then
    raise exception using errcode = '23514', message = 'hotel file upload version must advance';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_hotel_file_upload_transition() from public;

create function public.reject_file_scan_attempt_transition()
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
    if old.lease_expires_at >= statement_timestamp()
       or new.claim_generation <> old.claim_generation + 1
       or new.attempt_count <> old.attempt_count + 1
       or new.claim_token_hash is not distinct from old.claim_token_hash then
      raise exception using errcode = '23514', message = 'file scan takeover requires expired lease and new fence';
    end if;
  elsif old.state = 'CLAIMED' and new.state in ('SUCCEEDED', 'FAILED', 'DEAD_LETTER') then
    if old.lease_expires_at <= statement_timestamp()
       or new.claim_generation <> old.claim_generation
       or new.claim_token_hash is distinct from old.claim_token_hash then
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

create function public.reject_hotel_file_scan_job_transition()
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
    raise exception using errcode = '42501', message = 'file scan job transition authority denied';
  end if;

  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.branch_id is distinct from old.branch_id
     or new.upload_id is distinct from old.upload_id
     or new.job_type is distinct from old.job_type
     or new.available_at is distinct from old.available_at
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', message = 'file scan job identity is immutable';
  end if;

  if old.state <> 'PENDING' or new.state not in ('DISPATCHED', 'CANCELLED') then
    raise exception using errcode = '23514', message = 'invalid file scan job transition';
  end if;

  if new.state = 'DISPATCHED' and new.dispatch_generation <> old.dispatch_generation + 1 then
    raise exception using errcode = '23514', message = 'file scan job generation fence mismatch';
  end if;
  if new.state = 'CANCELLED' and new.dispatch_generation <> old.dispatch_generation then
    raise exception using errcode = '23514', message = 'cancelled file scan job cannot advance generation';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_hotel_file_scan_job_transition() from public;

create function public.enforce_hotel_file_upload_quota()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
declare
  active_count bigint;
  active_bytes bigint;
  linked_count bigint;
  linked_bytes bigint;
begin
  if not (
    public.runtime_is_schema_owner()
    or current_user in ('werehere_auth_session_definer', 'werehere_tenant_authority_definer')
    or public.runtime_has_capability('API_RUNTIME')
  ) then
    raise exception using errcode = '42501', message = 'hotel file upload quota authority denied';
  end if;
  if new.state <> 'PENDING_UPLOAD'
     or new.version <> 1
     or new.quota_released_at is not null then
    raise exception using errcode = '23514', message = 'hotel file upload must start as pending reservation';
  end if;

  perform 1
  from public.file_attachment_parents parent_record
  where parent_record.company_id = new.company_id
    and parent_record.branch_id = new.branch_id
    and parent_record.parent_type = new.parent_type
    and parent_record.parent_id = new.parent_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'hotel file parent is unavailable';
  end if;

  select count(*), coalesce(sum(upload_record.reserved_size_bytes), 0)
    into active_count, active_bytes
  from public.hotel_file_uploads upload_record
  where upload_record.company_id = new.company_id
    and upload_record.branch_id = new.branch_id
    and upload_record.parent_type = new.parent_type
    and upload_record.parent_id = new.parent_id
    and upload_record.quota_released_at is null;

  select count(*), coalesce(sum(version_record.size_bytes), 0)
    into linked_count, linked_bytes
  from public.hotel_file_links link_record
  join public.hotel_file_versions version_record
    on version_record.company_id = link_record.company_id
   and version_record.branch_id = link_record.branch_id
   and version_record.id = link_record.file_version_id
  where link_record.company_id = new.company_id
    and link_record.branch_id = new.branch_id
    and link_record.parent_type = new.parent_type
    and link_record.parent_id = new.parent_id;

  if active_count + linked_count + 1 > 20 then
    raise exception using errcode = '23514', message = 'hotel file count quota exceeded';
  end if;
  if active_bytes + linked_bytes + new.reserved_size_bytes > 200000000 then
    raise exception using errcode = '23514', message = 'hotel file byte quota exceeded';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_hotel_file_upload_quota() from public;

create function public.enforce_hotel_file_scan_job_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if not (
    public.runtime_is_schema_owner()
    or current_user in ('werehere_auth_session_definer', 'werehere_tenant_authority_definer')
    or public.runtime_has_capability('API_RUNTIME')
  ) then
    raise exception using errcode = '42501', message = 'file scan job insert authority denied';
  end if;
  if new.state <> 'PENDING'
     or new.dispatch_generation <> 0
     or new.dispatched_at is not null then
    raise exception using errcode = '23514', message = 'file scan job must start pending';
  end if;
  if not exists (
    select 1
    from public.hotel_file_uploads upload_record
    where upload_record.company_id = new.company_id
      and upload_record.branch_id = new.branch_id
      and upload_record.id = new.upload_id
      and upload_record.state = 'QUARANTINED'
  ) then
    raise exception using errcode = '23514', message = 'file scan job requires quarantined upload';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_hotel_file_scan_job_insert() from public;

create function public.enforce_file_scan_attempt_insert()
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
    raise exception using errcode = '42501', message = 'file scan attempt insert authority denied';
  end if;
  if new.state <> 'PENDING'
     or new.claim_generation <> 0
     or new.attempt_count <> 0
     or new.claim_token_hash is not null
     or new.lease_expires_at is not null
     or new.claimed_at is not null then
    raise exception using errcode = '23514', message = 'file scan attempt must start pending and unclaimed';
  end if;
  if not exists (
    select 1
    from public.hotel_file_scan_jobs job_record
    join public.hotel_file_uploads upload_record
      on upload_record.company_id = job_record.company_id
     and upload_record.branch_id = job_record.branch_id
     and upload_record.id = job_record.upload_id
    where job_record.company_id = new.company_id
      and job_record.branch_id = new.branch_id
      and job_record.id = new.dispatch_job_id
      and job_record.upload_id = new.upload_id
      and job_record.state = 'DISPATCHED'
      and upload_record.state = 'SCANNING'
  ) then
    raise exception using errcode = '23514', message = 'file scan attempt requires dispatched job and scanning upload';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_file_scan_attempt_insert() from public;

create function public.enforce_hotel_file_clean_version_insert()
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
    where upload_record.company_id = new.company_id
      and upload_record.branch_id = new.branch_id
      and upload_record.parent_type = new.parent_type
      and upload_record.parent_id = new.parent_id
      and upload_record.id = new.upload_id
      and upload_record.state = 'CLEAN_PENDING_PROMOTION'
      and upload_record.quarantine_object_key <> new.clean_object_key
      and upload_record.declared_file_name = new.file_name
      and upload_record.source_mime_type = new.mime_type
      and upload_record.source_size_bytes = new.size_bytes
      and upload_record.source_etag = new.source_etag
      and attempt_record.state = 'SUCCEEDED'
      and attempt_record.verdict = 'CLEAN'
      and attempt_record.scanner_sha256 = new.sha256
      and attempt_record.detected_mime_type = new.mime_type
      and attempt_record.source_etag = new.source_etag
      and attempt_record.source_size_bytes = new.size_bytes
      and attempt_record.claim_generation = new.promotion_generation
  ) then
    raise exception using errcode = '23514', message = 'clean file version requires current successful scan evidence';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_hotel_file_clean_version_insert() from public;

create function public.enforce_hotel_file_link_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if not (
    public.runtime_is_schema_owner()
    or current_user in ('werehere_auth_session_definer', 'werehere_tenant_authority_definer')
    or public.runtime_has_capability('API_RUNTIME')
  ) then
    raise exception using errcode = '42501', message = 'hotel file link insert authority denied';
  end if;
  perform 1
  from public.file_attachment_parents parent_record
  where parent_record.company_id = new.company_id
    and parent_record.branch_id = new.branch_id
    and parent_record.parent_type = new.parent_type
    and parent_record.parent_id = new.parent_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'hotel file parent is unavailable';
  end if;
  if not exists (
    select 1
    from public.hotel_file_versions version_record
    join public.hotel_file_uploads upload_record
      on upload_record.company_id = version_record.company_id
     and upload_record.branch_id = version_record.branch_id
     and upload_record.id = version_record.upload_id
    where version_record.company_id = new.company_id
      and version_record.branch_id = new.branch_id
      and version_record.parent_type = new.parent_type
      and version_record.parent_id = new.parent_id
      and version_record.id = new.file_version_id
      and upload_record.state = 'READY_UNLINKED'
  ) then
    raise exception using errcode = '23514', message = 'hotel file link requires ready clean version';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_hotel_file_link_insert() from public;

create trigger file_attachment_parents_no_update
before update on file_attachment_parents
for each row execute function public.reject_hotel_file_append_only_change();
create trigger file_attachment_parents_no_delete
before delete on file_attachment_parents
for each row execute function public.reject_hotel_file_append_only_change();
create trigger hotel_file_uploads_quota_guard
before insert on hotel_file_uploads
for each row execute function public.enforce_hotel_file_upload_quota();
create trigger hotel_file_uploads_transition
before update on hotel_file_uploads
for each row execute function public.reject_hotel_file_upload_transition();
create trigger hotel_file_uploads_no_delete
before delete on hotel_file_uploads
for each row execute function public.reject_hotel_file_append_only_change();
create trigger hotel_file_scan_jobs_insert_guard
before insert on hotel_file_scan_jobs
for each row execute function public.enforce_hotel_file_scan_job_insert();
create trigger hotel_file_scan_jobs_transition
before update on hotel_file_scan_jobs
for each row execute function public.reject_hotel_file_scan_job_transition();
create trigger hotel_file_scan_jobs_no_delete
before delete on hotel_file_scan_jobs
for each row execute function public.reject_hotel_file_append_only_change();
create trigger file_scan_attempts_insert_guard
before insert on file_scan_attempts
for each row execute function public.enforce_file_scan_attempt_insert();
create trigger file_scan_attempts_transition
before update on file_scan_attempts
for each row execute function public.reject_file_scan_attempt_transition();
create trigger file_scan_attempts_no_delete
before delete on file_scan_attempts
for each row execute function public.reject_hotel_file_append_only_change();
create trigger hotel_file_versions_insert_guard
before insert on hotel_file_versions
for each row execute function public.enforce_hotel_file_clean_version_insert();
create trigger hotel_file_versions_no_update
before update on hotel_file_versions
for each row execute function public.reject_hotel_file_append_only_change();
create trigger hotel_file_versions_no_delete
before delete on hotel_file_versions
for each row execute function public.reject_hotel_file_append_only_change();
create trigger hotel_file_links_insert_guard
before insert on hotel_file_links
for each row execute function public.enforce_hotel_file_link_insert();
create trigger hotel_file_links_no_update
before update on hotel_file_links
for each row execute function public.reject_hotel_file_append_only_change();
create trigger hotel_file_links_no_delete
before delete on hotel_file_links
for each row execute function public.reject_hotel_file_append_only_change();

alter table file_attachment_parents enable row level security;
alter table file_attachment_parents force row level security;
alter table hotel_file_uploads enable row level security;
alter table hotel_file_uploads force row level security;
alter table hotel_file_scan_jobs enable row level security;
alter table hotel_file_scan_jobs force row level security;
alter table file_scan_attempts enable row level security;
alter table file_scan_attempts force row level security;
alter table hotel_file_versions enable row level security;
alter table hotel_file_versions force row level security;
alter table hotel_file_links enable row level security;
alter table hotel_file_links force row level security;

do $rls$
declare
  table_name text;
begin
  foreach table_name in array array[
    'file_attachment_parents',
    'hotel_file_uploads',
    'hotel_file_scan_jobs',
    'file_scan_attempts',
    'hotel_file_versions',
    'hotel_file_links'
  ] loop
    execute format(
      'create policy %I_company_isolation on %I
       using (
         case
           when public.runtime_is_schema_owner() then true
           when current_user = ''werehere_auth_session_definer'' then true
           when current_user = ''werehere_tenant_authority_definer'' then true
           when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
           when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
           when public.hotel_file_has_finalizer_capability() then company_id = public.hotel_file_finalizer_current_company_id()
           else false
         end
       )
       with check (
         case
           when public.runtime_is_schema_owner() then true
           when current_user = ''werehere_auth_session_definer'' then true
           when current_user = ''werehere_tenant_authority_definer'' then true
           when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
           when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
           when public.hotel_file_has_finalizer_capability() then company_id = public.hotel_file_finalizer_current_company_id()
           else false
         end
       )',
      table_name,
      table_name
    );
  end loop;
end
$rls$;

revoke all on table file_attachment_parents from public;
revoke all on table hotel_file_uploads from public;
revoke all on table hotel_file_scan_jobs from public;
revoke all on table file_scan_attempts from public;
revoke all on table hotel_file_versions from public;
revoke all on table hotel_file_links from public;

insert into permissions (code, description) values
  ('HOTEL_FILE_READ', '호텔 파일 목록과 검역 상태 조회'),
  ('HOTEL_FILE_UPLOAD', '호텔 파일 업로드 및 연결'),
  ('HOTEL_FILE_DOWNLOAD', '검역 완료 호텔 파일 다운로드')
on conflict (code) do update set description = excluded.description;

insert into schema_migrations (version)
values ('0025_hotel_file_quarantine_foundation');

commit;
