begin;

insert into public.permissions(code, description) values
  ('CALENDAR_CONNECTION_MANAGE', '회사 Google Calendar 연결을 관리'),
  ('CALENDAR_PROJECTION_RETRY', 'Google Calendar 반영 실패를 재시도')
on conflict(code) do update set description=excluded.description;

create table public.calendar_connections (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  branch_id uuid,
  status text not null check(status in ('CONNECTED','RECONNECT_REQUIRED','DISCONNECTED')),
  version integer not null default 1 check(version>=1),
  active_credential_id uuid,
  created_by uuid not null,
  disconnected_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(company_id,id),
  unique(company_id),
  foreign key(company_id,created_by) references public.users(company_id,id),
  check(branch_id is null)
);

create table public.calendar_connection_credentials (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid,
  connection_id uuid not null,
  credential_version integer not null check(credential_version>=1),
  lifecycle text not null check(lifecycle in ('ACTIVE','CANDIDATE','ACCESS_VERIFIED','ACCOUNT_CHANGE_REQUIRES_CONFIRMATION','ACTION_REQUIRED','RETIRED')),
  refresh_credential_ciphertext bytea not null,
  refresh_credential_iv bytea not null check(octet_length(refresh_credential_iv)=12),
  encryption_key_version integer not null check(encryption_key_version>=1),
  credential_fingerprint bytea not null check(octet_length(credential_fingerprint)=32),
  fingerprint_key_version integer not null default 1 check(fingerprint_key_version>=1),
  granted_scopes text[] not null check(granted_scopes = array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[]),
  verification_claim_token_hash bytea,
  verification_claim_expires_at timestamptz,
  verification_attempt_count integer not null default 0 check(verification_attempt_count between 0 and 8),
  available_at timestamptz not null default statement_timestamp(),
  row_version integer not null default 1 check(row_version>=1),
  created_by uuid not null,
  originating_session_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(company_id,id),
  unique(company_id,connection_id,credential_version),
  foreign key(company_id,connection_id) references public.calendar_connections(company_id,id),
  foreign key(company_id,created_by) references public.users(company_id,id),
  foreign key(company_id,originating_session_id) references public.auth_sessions(company_id,id),
  check(branch_id is null),
  check((verification_claim_token_hash is null and verification_claim_expires_at is null) or (octet_length(verification_claim_token_hash)=32 and verification_claim_expires_at is not null))
);
create unique index calendar_connection_credentials_one_active on public.calendar_connection_credentials(company_id,connection_id) where lifecycle='ACTIVE';
create unique index calendar_connection_credentials_one_candidate on public.calendar_connection_credentials(company_id,connection_id) where lifecycle in ('CANDIDATE','ACCESS_VERIFIED','ACCOUNT_CHANGE_REQUIRES_CONFIRMATION');
alter table public.calendar_connections add constraint calendar_connections_active_credential_fk foreign key(company_id,active_credential_id) references public.calendar_connection_credentials(company_id,id) deferrable initially deferred;

create table public.calendar_crypto_settings (
  singleton boolean primary key default true check(singleton),
  current_hmac_key_version integer not null check(current_hmac_key_version>=1),
  updated_at timestamptz not null default statement_timestamp()
);
insert into public.calendar_crypto_settings(singleton,current_hmac_key_version) values(true,1);
revoke all on table public.calendar_crypto_settings from public;

create table public.calendar_oauth_transactions (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  branch_id uuid,
  actor_user_id uuid not null,
  session_id uuid not null,
  expected_connection_id uuid,
  expected_connection_version integer,
  state_hash bytea not null unique check(octet_length(state_hash)=32),
  browser_binding_hash bytea not null check(octet_length(browser_binding_hash)=32),
  nonce_hash bytea not null check(octet_length(nonce_hash)=32),
  pkce_verifier_ciphertext bytea not null,
  pkce_verifier_iv bytea not null check(octet_length(pkce_verifier_iv)=12),
  encryption_key_version integer not null check(encryption_key_version>=1),
  return_path text not null check(return_path in ('/admin/calendar','/hotels/calendar')),
  reconnect boolean not null default false,
  status text not null default 'PENDING' check(status in ('PENDING','CLAIMED','SUCCEEDED','FAILED','EXPIRED')),
  claim_token_hash bytea,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  failure_code text,
  created_at timestamptz not null default statement_timestamp(),
  unique(company_id,id),
  foreign key(company_id,actor_user_id) references public.users(company_id,id),
  foreign key(company_id,session_id) references public.auth_sessions(company_id,id),
  foreign key(company_id,expected_connection_id) references public.calendar_connections(company_id,id),
  check(branch_id is null),
  check((expected_connection_id is null and expected_connection_version is null) or (expected_connection_id is not null and expected_connection_version>=1)),
  check((status='CLAIMED' and octet_length(claim_token_hash)=32 and claimed_at is not null) or status<>'CLAIMED'),
  check(expires_at>created_at and expires_at<=created_at+interval '10 minutes')
);

create table public.calendar_hotel_links (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  connection_id uuid not null,
  generation integer not null check(generation>=1),
  status text not null check(status in ('PENDING_CREATE','ACTIVE','ACTION_REQUIRED','DISCONNECTED')),
  lookup_key_ciphertext bytea not null,
  lookup_key_iv bytea not null check(octet_length(lookup_key_iv)=12),
  lookup_key_version integer not null check(lookup_key_version>=1),
  lookup_key_digest bytea not null unique check(octet_length(lookup_key_digest)=32),
  calendar_id_ciphertext bytea,
  calendar_id_iv bytea,
  calendar_id_key_version integer,
  catch_up_cutoff timestamptz,
  connection_version integer not null,
  version integer not null default 1 check(version>=1),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(company_id,branch_id,id),
  unique(company_id,branch_id,id,generation),
  foreign key(company_id,branch_id) references public.hotel_profiles(company_id,branch_id),
  foreign key(company_id,connection_id) references public.calendar_connections(company_id,id),
  foreign key(company_id,created_by) references public.users(company_id,id),
  check((calendar_id_ciphertext is null and calendar_id_iv is null and calendar_id_key_version is null) or (calendar_id_ciphertext is not null and octet_length(calendar_id_iv)=12 and calendar_id_key_version>=1))
);
create unique index calendar_hotel_links_one_current on public.calendar_hotel_links(company_id,branch_id) where status in ('PENDING_CREATE','ACTIVE','ACTION_REQUIRED');

create table public.calendar_event_links (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  hotel_link_id uuid not null,
  visit_id uuid not null,
  generation integer not null,
  stable_event_id text not null check(length(stable_event_id) between 5 and 1024 and stable_event_id ~ '^[0-9a-v]+$'),
  marker_key_version integer not null default 1 check(marker_key_version>=1),
  desired_source_version integer not null check(desired_source_version>=1),
  applied_source_version integer check(applied_source_version is null or applied_source_version>=1),
  applied_exists boolean not null default false,
  status text not null default 'PENDING' check(status in ('PENDING','SYNCED','ACTION_REQUIRED','DISCONNECTED')),
  version integer not null default 1 check(version>=1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(company_id,branch_id,id),
  unique(company_id,branch_id,hotel_link_id,visit_id),
  unique(company_id,branch_id,stable_event_id),
  foreign key(company_id,branch_id,hotel_link_id,generation) references public.calendar_hotel_links(company_id,branch_id,id,generation),
  foreign key(company_id,branch_id,visit_id) references public.hotel_repair_visits(company_id,branch_id,id)
);

create table public.calendar_projection_jobs (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  aggregate_type text not null check(aggregate_type in ('HOTEL_CALENDAR','VISIT_EVENT')),
  hotel_link_id uuid,
  event_link_id uuid,
  status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SUCCEEDED','FAILED','DEAD_LETTER','SUPERSEDED')),
  attempted_source_version integer,
  attempted_starts_at timestamptz,
  attempted_ends_at timestamptz,
  attempted_visit_status text check(attempted_visit_status is null or attempted_visit_status in ('SCHEDULED','COMPLETED','CANCELLED','DELETED')),
  attempted_connection_version integer not null,
  attempted_hotel_link_generation integer,
  attempted_hotel_link_version integer,
  attempted_event_link_version integer,
  attempted_credential_id uuid,
  attempted_credential_version integer,
  create_dispatch_state text not null default 'CREATE_NOT_ATTEMPTED' check(create_dispatch_state in ('CREATE_NOT_ATTEMPTED','CREATE_DISPATCHED_OUTCOME_UNKNOWN','CREATE_CONFIRMED')),
  replay_requested boolean not null default false,
  attempt_count integer not null default 0 check(attempt_count between 0 and 8),
  available_at timestamptz not null default statement_timestamp(),
  claim_token_hash bytea,
  claim_expires_at timestamptz,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(company_id,branch_id,id),
  foreign key(company_id,branch_id,hotel_link_id) references public.calendar_hotel_links(company_id,branch_id,id),
  foreign key(company_id,branch_id,event_link_id) references public.calendar_event_links(company_id,branch_id,id),
  check((aggregate_type='HOTEL_CALENDAR' and hotel_link_id is not null and event_link_id is null) or (aggregate_type='VISIT_EVENT' and hotel_link_id is null and event_link_id is not null)),
  check((status='PROCESSING' and octet_length(claim_token_hash)=32 and claim_expires_at is not null) or status<>'PROCESSING')
);
create unique index calendar_projection_jobs_one_hotel_head on public.calendar_projection_jobs(company_id,branch_id,hotel_link_id) where aggregate_type='HOTEL_CALENDAR' and status in ('PENDING','PROCESSING');
create unique index calendar_projection_jobs_one_event_head on public.calendar_projection_jobs(company_id,branch_id,event_link_id) where aggregate_type='VISIT_EVENT' and status in ('PENDING','PROCESSING');
create index calendar_projection_jobs_claim on public.calendar_projection_jobs(status,available_at) where status in ('PENDING','FAILED','PROCESSING');

create table public.calendar_projection_attempts (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  job_id uuid not null,
  attempt_number integer not null check(attempt_number between 1 and 8),
  operation text not null check(operation in ('CALENDAR_READ_BACK','CALENDAR_CREATE','EVENT_CREATE','EVENT_READ_BACK','EVENT_UPDATE','EVENT_DELETE','NO_OP')),
  result text not null check(result in ('STARTED','SUCCEEDED','RETRYABLE','ACTION_REQUIRED','SUPERSEDED')),
  safe_error_code text,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  unique(company_id,branch_id,id),
  unique(company_id,branch_id,job_id,attempt_number),
  foreign key(company_id,branch_id,job_id) references public.calendar_projection_jobs(company_id,branch_id,id)
);

create table public.calendar_sync_failures (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  job_id uuid not null,
  hotel_link_id uuid,
  event_link_id uuid,
  failure_code text not null check(failure_code ~ '^[A-Z0-9_]{2,100}$'),
  status text not null default 'OPEN' check(status in ('OPEN','RETRY_REQUESTED','RESOLVED')),
  version integer not null default 1 check(version>=1),
  occurred_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  unique(company_id,branch_id,id),
  foreign key(company_id,branch_id,job_id) references public.calendar_projection_jobs(company_id,branch_id,id),
  foreign key(company_id,branch_id,hotel_link_id) references public.calendar_hotel_links(company_id,branch_id,id),
  foreign key(company_id,branch_id,event_link_id) references public.calendar_event_links(company_id,branch_id,id),
  check((hotel_link_id is not null)::integer + (event_link_id is not null)::integer = 1)
);

create table public.calendar_catch_up_items (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  hotel_link_id uuid not null,
  visit_id uuid not null,
  source_version integer not null check(source_version>=1),
  created_at timestamptz not null default statement_timestamp(),
  unique(company_id,branch_id,hotel_link_id,visit_id,source_version),
  foreign key(company_id,branch_id,hotel_link_id) references public.calendar_hotel_links(company_id,branch_id,id),
  foreign key(company_id,branch_id,visit_id) references public.hotel_repair_visits(company_id,branch_id,id)
);

-- Runtime access is policy constrained; public never receives table or routine privileges.
do $policy$
declare table_name text;
begin
  foreach table_name in array array['calendar_connections','calendar_connection_credentials','calendar_oauth_transactions','calendar_hotel_links','calendar_event_links','calendar_projection_jobs','calendar_projection_attempts','calendar_sync_failures','calendar_catch_up_items'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('alter table public.%I force row level security',table_name);
    execute format('create policy %I on public.%I using (case when public.runtime_is_schema_owner() then true when current_user = ''werehere_auth_session_definer''::name then true when current_user = ''werehere_tenant_authority_definer''::name then true when public.runtime_has_capability(''API_RUNTIME''::text) then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER''::text) then company_id=public.reconciler_current_company_id() else false end) with check (case when public.runtime_is_schema_owner() then true when current_user = ''werehere_auth_session_definer''::name then true when current_user = ''werehere_tenant_authority_definer''::name then true when public.runtime_has_capability(''API_RUNTIME''::text) then company_id=public.api_current_company_id() when public.runtime_has_capability(''RECONCILER''::text) then company_id=public.reconciler_current_company_id() else false end)',table_name||'_company_isolation',table_name);
  end loop;
end
$policy$;

create function public.calendar_connection_manage_hotel_allowed_v1(p_company_id uuid,p_branch_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $function$
  select exists(
    select 1 from public.hotel_profiles hotel
    join public.branches branch_record on branch_record.company_id=hotel.company_id and branch_record.id=hotel.branch_id
    where hotel.company_id=p_company_id and hotel.branch_id=p_branch_id and hotel.hotel_status='ACTIVE' and branch_record.status='ACTIVE'
      and exists(select 1 from public.hotel_staff_assignments assignment where assignment.company_id=p_company_id and assignment.branch_id=p_branch_id and assignment.user_id=p_user_id and assignment.terminated_at is null and assignment.start_date<=(statement_timestamp() at time zone 'Asia/Seoul')::date and (assignment.end_date is null or assignment.end_date>=(statement_timestamp() at time zone 'Asia/Seoul')::date))
      and public.hotel_calendar_permission_allowed_v1(p_company_id,p_branch_id,p_user_id,'CALENDAR_CONNECTION_MANAGE')
  )
$function$;
revoke all on function public.calendar_connection_manage_hotel_allowed_v1(uuid,uuid,uuid) from public;

create function public.calendar_connection_status_read_v1(p_company_id uuid,p_session_token text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql stable security definer set search_path=pg_catalog as $function$
declare actor record; snapshot jsonb;
begin
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found or actor.user_type<>'INTERNAL_STAFF' or not public.hotel_calendar_permission_allowed_v1(p_company_id,null,actor.user_id,'CALENDAR_CONNECTION_MANAGE') then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select jsonb_build_object('connectionId',c.id,'connectionStatus',coalesce(c.status,'NOT_CONNECTED'),'credentialStatus',coalesce(candidate_cred.lifecycle,cred.lifecycle),'version',c.version,'candidateId',candidate_cred.id,'candidateRowVersion',candidate_cred.row_version,'hotels',coalesce((select jsonb_agg(jsonb_build_object('hotelId',h.branch_id,'hotelName',hotel_branch.name,'hotelLinkId',l.id,'generation',coalesce(l.generation,(select max(link_history.generation) from public.calendar_hotel_links link_history where link_history.company_id=h.company_id and link_history.branch_id=h.branch_id),0),'linkStatus',case when l.status='PENDING_CREATE' then 'PENDING' else coalesce(l.status,'NOT_CREATED') end,'version',coalesce(l.version,0),'projectionStatus',case when l.status is null then 'NOT_CONNECTED' when exists(select 1 from public.calendar_sync_failures f where f.company_id=p_company_id and (f.hotel_link_id=l.id or exists(select 1 from public.calendar_event_links failed_event where failed_event.company_id=f.company_id and failed_event.id=f.event_link_id and failed_event.hotel_link_id=l.id)) and f.status='OPEN') then 'ACTION_REQUIRED' when exists(select 1 from public.calendar_projection_jobs j where j.company_id=p_company_id and (j.hotel_link_id=l.id or exists(select 1 from public.calendar_event_links pending_event where pending_event.company_id=j.company_id and pending_event.id=j.event_link_id and pending_event.hotel_link_id=l.id)) and j.status in ('PENDING','PROCESSING','FAILED')) then 'PENDING' when l.status='ACTIVE' then 'SYNCED' else 'NOT_CONNECTED' end,'lastFailureCode',(select f.failure_code from public.calendar_sync_failures f where f.company_id=p_company_id and (f.hotel_link_id=l.id or exists(select 1 from public.calendar_event_links failed_event where failed_event.company_id=f.company_id and failed_event.id=f.event_link_id and failed_event.hotel_link_id=l.id)) and f.status='OPEN' order by f.occurred_at desc limit 1)) order by hotel_branch.name,h.branch_id) from public.hotel_profiles h join public.branches hotel_branch on hotel_branch.company_id=h.company_id and hotel_branch.id=h.branch_id left join public.calendar_hotel_links l on l.company_id=h.company_id and l.branch_id=h.branch_id and l.status<>'DISCONNECTED' where h.company_id=p_company_id and h.hotel_status='ACTIVE' and public.calendar_connection_manage_hotel_allowed_v1(p_company_id,h.branch_id,actor.user_id)),'[]'::jsonb)) into snapshot from (select 1) anchor left join public.calendar_connections c on c.company_id=p_company_id left join public.calendar_connection_credentials cred on cred.company_id=c.company_id and cred.id=c.active_credential_id left join lateral (select candidate.id,candidate.lifecycle,candidate.row_version from public.calendar_connection_credentials candidate where candidate.company_id=c.company_id and candidate.connection_id=c.id and candidate.lifecycle in ('CANDIDATE','ACCESS_VERIFIED','ACCOUNT_CHANGE_REQUIRES_CONFIRMATION') order by candidate.credential_version desc limit 1) candidate_cred on true;
  snapshot:=snapshot||jsonb_build_object('failures',coalesce((select jsonb_agg(jsonb_build_object('failureId',failure.id,'version',failure.version,'hotelId',failure.branch_id,'eventLinkId',failure.event_link_id,'failureCode',failure.failure_code,'occurredAt',failure.occurred_at) order by failure.occurred_at,failure.id) from public.calendar_sync_failures failure where failure.company_id=p_company_id and failure.status='OPEN' and public.calendar_connection_manage_hotel_allowed_v1(failure.company_id,failure.branch_id,actor.user_id)),'[]'::jsonb));
  return query select 'OK',snapshot;
end $function$;
revoke all on function public.calendar_connection_status_read_v1(uuid,text) from public;

create function public.calendar_authorization_lock_v1(p_company_id uuid,p_user_id uuid,p_session_id uuid)
returns void
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare affected_branch_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
  for affected_branch_id in
    select distinct affected_link.branch_id
    from public.calendar_hotel_links affected_link
    where affected_link.company_id=p_company_id and affected_link.status<>'DISCONNECTED'
    order by affected_link.branch_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text||':'||affected_branch_id::text,0));
  end loop;
  perform 1 from public.companies company_record where company_record.id=p_company_id for share;
  perform 1 from public.users user_record where user_record.company_id=p_company_id and user_record.id=p_user_id for share;
  perform 1 from public.auth_sessions session_record where session_record.company_id=p_company_id and session_record.id=p_session_id and session_record.user_id=p_user_id for share;
  perform 1 from public.hotel_staff_assignments assignment where assignment.company_id=p_company_id and assignment.user_id=p_user_id for share;
  perform 1
  from public.calendar_hotel_links affected_link
  join public.branches branch_record on branch_record.company_id=affected_link.company_id and branch_record.id=affected_link.branch_id
  join public.hotel_profiles hotel_record on hotel_record.company_id=affected_link.company_id and hotel_record.branch_id=affected_link.branch_id
  where affected_link.company_id=p_company_id and affected_link.status<>'DISCONNECTED'
  for share of affected_link,branch_record,hotel_record;
  lock table public.permission_grants,public.user_role_memberships,public.roles,public.user_group_memberships,public.user_groups in share mode;
end $function$;
revoke all on function public.calendar_authorization_lock_v1(uuid,uuid,uuid) from public;

create function public.calendar_oauth_start_v1(p_company_id uuid,p_session_token text,p_transaction_id uuid,p_state_hash bytea,p_browser_binding_hash bytea,p_nonce_hash bytea,p_verifier_ciphertext bytea,p_verifier_iv bytea,p_key_version integer,p_return_path text,p_reconnect boolean,p_expected_connection_version integer,p_derivation_hmac_key_version integer,p_idempotency_record_id uuid,p_idempotency_key text,p_operation_path text,p_request_hash text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; connection_row public.calendar_connections%rowtype; replay record; audit_id uuid:=gen_random_uuid(); expires_at_value timestamptz:=statement_timestamp()+interval '10 minutes'; result_payload jsonb;
begin
  if not public.runtime_has_capability('API_RUNTIME') or public.api_current_company_id()<>p_company_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash);
  perform public.calendar_authorization_lock_v1(p_company_id,actor.user_id,actor.session_id);
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found or actor.user_type<>'INTERNAL_STAFF' or (select session_record.auth_time from public.auth_sessions session_record where session_record.company_id=p_company_id and session_record.id=actor.session_id) < statement_timestamp()-interval '15 minutes' or not public.hotel_calendar_permission_allowed_v1(p_company_id,null,actor.user_id,'CALENDAR_CONNECTION_MANAGE') then return query select 'FORBIDDEN',null::jsonb; return; end if;
  if replay.command_status='IDEMPOTENCY_CONFLICT' then return query select 'IDEMPOTENCY_CONFLICT',null::jsonb; return; end if;
  if replay.command_status='REPLAYED' then return query select replay.result_snapshot->>'status',replay.result_snapshot->'payload'; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text||':oauth:'||actor.user_id::text,0));
  if exists(select 1 from public.calendar_hotel_links affected_link where affected_link.company_id=p_company_id and affected_link.status<>'DISCONNECTED' and not public.calendar_connection_manage_hotel_allowed_v1(p_company_id,affected_link.branch_id,actor.user_id)) then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into connection_row from public.calendar_connections where company_id=p_company_id;
  if (connection_row.id is null and (p_reconnect or p_expected_connection_version is not null)) or (connection_row.id is not null and (not p_reconnect or p_expected_connection_version is distinct from connection_row.version)) then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  delete from public.calendar_oauth_transactions where id in (select id from public.calendar_oauth_transactions where company_id=p_company_id and (expires_at<=statement_timestamp() or status in ('FAILED','EXPIRED')) order by created_at limit 100);
  if (select count(*) from public.calendar_oauth_transactions where company_id=p_company_id and actor_user_id=actor.user_id and status in ('PENDING','CLAIMED'))>=5 or (select count(*) from public.calendar_oauth_transactions where company_id=p_company_id and status in ('PENDING','CLAIMED'))>=1000 then return query select 'OAUTH_RATE_LIMITED',null::jsonb; return; end if;
  if p_return_path not in ('/admin/calendar','/hotels/calendar') or p_derivation_hmac_key_version<1 or octet_length(p_state_hash)<>32 or octet_length(p_browser_binding_hash)<>32 or octet_length(p_nonce_hash)<>32 or octet_length(p_verifier_iv)<>12 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
  insert into public.calendar_oauth_transactions(id,company_id,actor_user_id,session_id,expected_connection_id,expected_connection_version,state_hash,browser_binding_hash,nonce_hash,pkce_verifier_ciphertext,pkce_verifier_iv,encryption_key_version,return_path,reconnect,expires_at) values(p_transaction_id,p_company_id,actor.user_id,actor.session_id,connection_row.id,connection_row.version,p_state_hash,p_browser_binding_hash,p_nonce_hash,p_verifier_ciphertext,p_verifier_iv,p_key_version,p_return_path,p_reconnect,expires_at_value);
  result_payload:=jsonb_build_object('transactionId',p_transaction_id,'expiresAt',expires_at_value,'derivationHmacKeyVersion',p_derivation_hmac_key_version);
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(audit_id,'CALENDAR_CONNECTION_OAUTH_STARTED',actor.user_id,actor.user_type,actor.session_id,p_company_id,'CALENDAR_OAUTH_TRANSACTION',p_transaction_id,jsonb_build_object('expiresAt',expires_at_value,'reconnect',p_reconnect),'Google Calendar 연결 시작','SUCCEEDED',gen_random_uuid());
  perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash,'CALENDAR_OAUTH_TRANSACTION',p_transaction_id,audit_id,jsonb_build_object('status','CREATED','payload',result_payload));
  return query select 'CREATED',result_payload;
end $function$;
revoke all on function public.calendar_oauth_start_v1(uuid,text,uuid,bytea,bytea,bytea,bytea,bytea,integer,text,boolean,integer,integer,uuid,text,text,text) from public;

create function public.calendar_oauth_claim_v1(p_state_hash bytea,p_browser_binding_hash bytea,p_claim_token_hash bytea)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare transaction_row public.calendar_oauth_transactions%rowtype; transaction_company_id uuid;
begin
  select transaction_record.company_id into transaction_company_id from public.calendar_oauth_transactions transaction_record
   where transaction_record.state_hash=p_state_hash and transaction_record.browser_binding_hash=p_browser_binding_hash and transaction_record.status='PENDING' and transaction_record.expires_at>statement_timestamp();
  if not found then return query select 'OAUTH_FLOW_INVALID',null::jsonb; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(transaction_company_id::text,0));
  select * into transaction_row from public.calendar_oauth_transactions transaction_record
   where transaction_record.company_id=transaction_company_id and transaction_record.state_hash=p_state_hash and transaction_record.browser_binding_hash=p_browser_binding_hash and transaction_record.status='PENDING' and transaction_record.expires_at>statement_timestamp()
   for update;
  if not found then return query select 'OAUTH_FLOW_INVALID',null::jsonb; return; end if;
  perform public.calendar_authorization_lock_v1(transaction_row.company_id,transaction_row.actor_user_id,transaction_row.session_id);
  if not exists(
    select 1 from public.auth_sessions session_record
    join public.users user_record on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id
    join public.companies company_record on company_record.id=session_record.company_id
    where session_record.company_id=transaction_row.company_id and session_record.id=transaction_row.session_id and session_record.user_id=transaction_row.actor_user_id
      and session_record.revoked_at is null and session_record.idle_expires_at>statement_timestamp() and session_record.absolute_expires_at>statement_timestamp() and session_record.auth_time>=statement_timestamp()-interval '15 minutes'
      and user_record.status='ACTIVE' and user_record.user_type='INTERNAL_STAFF' and company_record.status='ACTIVE'
      and public.hotel_calendar_permission_allowed_v1(transaction_row.company_id,null,transaction_row.actor_user_id,'CALENDAR_CONNECTION_MANAGE')
      and not exists(select 1 from public.calendar_hotel_links affected_link where affected_link.company_id=transaction_row.company_id and affected_link.status<>'DISCONNECTED' and not public.calendar_connection_manage_hotel_allowed_v1(transaction_row.company_id,affected_link.branch_id,transaction_row.actor_user_id))
      and ((transaction_row.expected_connection_id is null and not exists(select 1 from public.calendar_connections current_connection where current_connection.company_id=transaction_row.company_id)) or exists(select 1 from public.calendar_connections current_connection where current_connection.company_id=transaction_row.company_id and current_connection.id=transaction_row.expected_connection_id and current_connection.version=transaction_row.expected_connection_version and (current_connection.status='CONNECTED' or (transaction_row.reconnect and current_connection.status='DISCONNECTED'))))
  ) then
    delete from public.calendar_oauth_transactions where id=transaction_row.id;
    return query select 'OAUTH_FLOW_INVALID',null::jsonb;
    return;
  end if;
  update public.calendar_oauth_transactions set status='CLAIMED',claim_token_hash=p_claim_token_hash,claimed_at=statement_timestamp() where id=transaction_row.id returning * into transaction_row;
  return query select 'CLAIMED',jsonb_build_object('transactionId',transaction_row.id,'companyId',transaction_row.company_id,'actorUserId',transaction_row.actor_user_id,'sessionId',transaction_row.session_id,'returnPath',transaction_row.return_path,'reconnect',transaction_row.reconnect,'connectionId',transaction_row.expected_connection_id,'connectionVersion',transaction_row.expected_connection_version,'credentialVersion',(select coalesce(max(cred.credential_version),0)+1 from public.calendar_connection_credentials cred where cred.company_id=transaction_row.company_id),'fingerprintKeyVersion',(select active_credential.fingerprint_key_version from public.calendar_connections active_connection join public.calendar_connection_credentials active_credential on active_credential.company_id=active_connection.company_id and active_credential.id=active_connection.active_credential_id where active_connection.company_id=transaction_row.company_id and active_connection.id=transaction_row.expected_connection_id),'verifierCiphertext',encode(transaction_row.pkce_verifier_ciphertext,'base64'),'verifierIv',encode(transaction_row.pkce_verifier_iv,'base64'),'keyVersion',transaction_row.encryption_key_version,'nonceHash',encode(transaction_row.nonce_hash,'base64'));
end $function$;
revoke all on function public.calendar_oauth_claim_v1(bytea,bytea,bytea) from public;

create function public.calendar_oauth_fail_v1(p_transaction_id uuid,p_claim_token_hash bytea,p_failure_code text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare tx public.calendar_oauth_transactions%rowtype; matched_count integer;
begin
  if not public.runtime_has_capability('API_RUNTIME') or p_failure_code!~'^[A-Z0-9_]{2,100}$' then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select count(*) into matched_count from public.calendar_oauth_transactions where (p_transaction_id is null or id=p_transaction_id) and status in ('CLAIMED','FAILED') and claim_token_hash=p_claim_token_hash;
  if matched_count<>1 then return query select 'OAUTH_FLOW_INVALID',null::jsonb; return; end if;
  select * into tx from public.calendar_oauth_transactions where (p_transaction_id is null or id=p_transaction_id) and status in ('CLAIMED','FAILED') and claim_token_hash=p_claim_token_hash for update;
  if not found then return query select 'OAUTH_FLOW_INVALID',null::jsonb; return; end if;
  delete from public.calendar_oauth_transactions where id=tx.id;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(gen_random_uuid(),'CALENDAR_CONNECTION_OAUTH_FAILED',tx.actor_user_id,'INTERNAL_STAFF',tx.session_id,tx.company_id,'CALENDAR_OAUTH_TRANSACTION',tx.id,jsonb_build_object('failureCode',p_failure_code),'Google Calendar OAuth 실패','FAILED',gen_random_uuid());
  return query select 'FAILED',jsonb_build_object('transactionId',tx.id);
end $function$;
revoke all on function public.calendar_oauth_fail_v1(uuid,bytea,text) from public;

create function public.calendar_oauth_finalize_v1(p_transaction_id uuid,p_claim_token_hash bytea,p_connection_id uuid,p_credential_id uuid,p_credential_version integer,p_ciphertext bytea,p_iv bytea,p_key_version integer,p_fingerprint bytea,p_fingerprint_key_version integer,p_scopes text[])
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare tx public.calendar_oauth_transactions%rowtype; connection_row public.calendar_connections%rowtype; next_version integer; lifecycle text; transaction_company_id uuid;
begin
  select company_id into transaction_company_id from public.calendar_oauth_transactions where id=p_transaction_id and status='CLAIMED' and claim_token_hash=p_claim_token_hash;
  if not found then return query select 'OAUTH_FLOW_INVALID',null::jsonb; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(transaction_company_id::text,0));
  select * into tx from public.calendar_oauth_transactions where company_id=transaction_company_id and id=p_transaction_id and status='CLAIMED' and claim_token_hash=p_claim_token_hash for update;
  if not found then return query select 'OAUTH_FLOW_INVALID',null::jsonb; return; end if;
  perform public.calendar_authorization_lock_v1(tx.company_id,tx.actor_user_id,tx.session_id);
  if tx.expires_at<=statement_timestamp() or not exists(
    select 1 from public.auth_sessions session_record
    join public.users user_record on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id
    join public.companies company_record on company_record.id=session_record.company_id
    where session_record.company_id=tx.company_id and session_record.id=tx.session_id and session_record.user_id=tx.actor_user_id
      and session_record.revoked_at is null and session_record.idle_expires_at>statement_timestamp() and session_record.absolute_expires_at>statement_timestamp() and session_record.auth_time>=statement_timestamp()-interval '15 minutes'
      and user_record.status='ACTIVE' and user_record.user_type='INTERNAL_STAFF' and company_record.status='ACTIVE'
      and public.hotel_calendar_permission_allowed_v1(tx.company_id,null,tx.actor_user_id,'CALENDAR_CONNECTION_MANAGE')
      and not exists(select 1 from public.calendar_hotel_links affected_link where affected_link.company_id=tx.company_id and affected_link.status<>'DISCONNECTED' and not public.calendar_connection_manage_hotel_allowed_v1(tx.company_id,affected_link.branch_id,tx.actor_user_id))
  ) then
    delete from public.calendar_oauth_transactions where id=tx.id;
    return query select 'FORBIDDEN',null::jsonb; return;
  end if;
  if p_scopes<>array['https://www.googleapis.com/auth/calendar.app.created','https://www.googleapis.com/auth/calendar.calendarlist.readonly','openid']::text[] or p_connection_id is null or p_credential_version is null or p_credential_version<1 or octet_length(p_iv)<>12 or octet_length(p_fingerprint)<>32 then delete from public.calendar_oauth_transactions where id=tx.id; return query select 'OAUTH_SCOPE_INVALID',null::jsonb; return; end if;
  select * into connection_row from public.calendar_connections where company_id=tx.company_id for update;
  if not found then
    if tx.expected_connection_id is not null or tx.expected_connection_version is not null then delete from public.calendar_oauth_transactions where id=tx.id; return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
    if p_credential_version<>1 then delete from public.calendar_oauth_transactions where id=tx.id; return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
    insert into public.calendar_connections(id,company_id,status,created_by) values(p_connection_id,tx.company_id,'CONNECTED',tx.actor_user_id) returning * into connection_row;
    lifecycle:='ACTIVE';
  else
    if connection_row.id<>p_connection_id or connection_row.id is distinct from tx.expected_connection_id or connection_row.version is distinct from tx.expected_connection_version or connection_row.status not in ('CONNECTED','DISCONNECTED') or (connection_row.status='DISCONNECTED' and not tx.reconnect) then delete from public.calendar_oauth_transactions where id=tx.id; return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
    lifecycle:=case when connection_row.status='DISCONNECTED' then 'ACTIVE' else 'CANDIDATE' end;
  end if;
  select coalesce(max(credential_version),0)+1 into next_version from public.calendar_connection_credentials where company_id=tx.company_id and connection_id=connection_row.id;
  if next_version<>p_credential_version then delete from public.calendar_oauth_transactions where id=tx.id; return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if p_fingerprint_key_version<1 then delete from public.calendar_oauth_transactions where id=tx.id; return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
  insert into public.calendar_connection_credentials(id,company_id,connection_id,credential_version,lifecycle,refresh_credential_ciphertext,refresh_credential_iv,encryption_key_version,credential_fingerprint,fingerprint_key_version,granted_scopes,created_by,originating_session_id) values(p_credential_id,tx.company_id,connection_row.id,p_credential_version,lifecycle,p_ciphertext,p_iv,p_key_version,p_fingerprint,p_fingerprint_key_version,p_scopes,tx.actor_user_id,tx.session_id);
  if lifecycle='ACTIVE' then update public.calendar_connections set active_credential_id=p_credential_id,status='CONNECTED',version=version+1,updated_at=statement_timestamp() where id=connection_row.id; end if;
  delete from public.calendar_oauth_transactions where id=tx.id;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(gen_random_uuid(),'CALENDAR_CONNECTION_OAUTH_COMPLETED',tx.actor_user_id,'INTERNAL_STAFF',tx.session_id,tx.company_id,'CALENDAR_CONNECTION',connection_row.id,jsonb_build_object('credentialLifecycle',lifecycle,'credentialVersion',next_version),'Google Calendar 연결','SUCCEEDED',gen_random_uuid());
  return query select case when lifecycle='ACTIVE' then 'CONNECTED' else 'CANDIDATE' end,jsonb_build_object('connectionId',connection_row.id,'version',case when lifecycle='ACTIVE' then connection_row.version+1 else connection_row.version end,'credentialStatus',lifecycle);
end $function$;
revoke all on function public.calendar_oauth_finalize_v1(uuid,bytea,uuid,uuid,integer,bytea,bytea,integer,bytea,integer,text[]) from public;

create function public.calendar_candidate_claim_v1(p_company_id uuid,p_claim_token_hash bytea)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare candidate public.calendar_connection_credentials%rowtype; connection_row public.calendar_connections%rowtype; session_valid boolean; snapshot jsonb;
begin
  if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id or octet_length(p_claim_token_hash)<>32 then return query select 'FORBIDDEN',null::jsonb; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
  update public.calendar_connection_credentials set lifecycle='ACTION_REQUIRED',verification_claim_token_hash=null,verification_claim_expires_at=null,row_version=row_version+1,updated_at=statement_timestamp() where company_id=p_company_id and lifecycle='CANDIDATE' and verification_attempt_count>=8 and (verification_claim_token_hash is null or verification_claim_expires_at<=statement_timestamp());
  select * into candidate from public.calendar_connection_credentials where company_id=p_company_id and lifecycle='CANDIDATE' and available_at<=statement_timestamp() and verification_attempt_count<8 and (verification_claim_token_hash is null or verification_claim_expires_at<=statement_timestamp()) order by credential_version limit 1 for update;
  if not found then return query select 'OK',jsonb_build_object('candidate',null); return; end if;
  perform public.calendar_authorization_lock_v1(candidate.company_id,candidate.created_by,candidate.originating_session_id);
  select exists(select 1 from public.auth_sessions session_record join public.users user_record on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id join public.companies company_record on company_record.id=session_record.company_id where session_record.company_id=candidate.company_id and session_record.id=candidate.originating_session_id and session_record.user_id=candidate.created_by and session_record.revoked_at is null and session_record.idle_expires_at>statement_timestamp() and session_record.absolute_expires_at>statement_timestamp() and session_record.auth_time>=statement_timestamp()-interval '15 minutes' and user_record.status='ACTIVE' and user_record.user_type='INTERNAL_STAFF' and company_record.status='ACTIVE' and public.hotel_calendar_permission_allowed_v1(candidate.company_id,null,candidate.created_by,'CALENDAR_CONNECTION_MANAGE') and not exists(select 1 from public.calendar_hotel_links link where link.company_id=candidate.company_id and link.connection_id=candidate.connection_id and link.status<>'DISCONNECTED' and not public.calendar_connection_manage_hotel_allowed_v1(link.company_id,link.branch_id,candidate.created_by))) into session_valid;
  if not session_valid then update public.calendar_connection_credentials set lifecycle='ACTION_REQUIRED',row_version=row_version+1,verification_claim_token_hash=null,verification_claim_expires_at=null,updated_at=statement_timestamp() where id=candidate.id; return query select 'AUTHORIZATION_REQUIRED',null::jsonb; return; end if;
  select * into connection_row from public.calendar_connections where company_id=p_company_id and id=candidate.connection_id and status='CONNECTED' for update; if not found then return query select 'STALE_RESOURCE',null::jsonb; return; end if;
  update public.calendar_connection_credentials set verification_claim_token_hash=p_claim_token_hash,verification_claim_expires_at=statement_timestamp()+interval '2 minutes',verification_attempt_count=verification_attempt_count+1,row_version=row_version+1,updated_at=statement_timestamp() where id=candidate.id returning * into candidate;
  select jsonb_build_object('candidateId',candidate.id,'candidateRowVersion',candidate.row_version,'connectionId',candidate.connection_id,'connectionVersion',connection_row.version,'credentialVersion',candidate.credential_version,'credentialFingerprint',encode(candidate.credential_fingerprint,'base64'),'credentialFingerprintKeyVersion',candidate.fingerprint_key_version,'activeCredentialFingerprint',encode((select active_credential.credential_fingerprint from public.calendar_connection_credentials active_credential where active_credential.company_id=candidate.company_id and active_credential.id=connection_row.active_credential_id),'base64'),'activeCredentialFingerprintKeyVersion',(select active_credential.fingerprint_key_version from public.calendar_connection_credentials active_credential where active_credential.company_id=candidate.company_id and active_credential.id=connection_row.active_credential_id),'credentialCiphertext',encode(candidate.refresh_credential_ciphertext,'base64'),'credentialIv',encode(candidate.refresh_credential_iv,'base64'),'credentialKeyVersion',candidate.encryption_key_version,'links',coalesce((select jsonb_agg(jsonb_build_object('hotelId',link.branch_id,'hotelLinkId',link.id,'generation',link.generation,'lookupCiphertext',encode(link.lookup_key_ciphertext,'base64'),'lookupIv',encode(link.lookup_key_iv,'base64'),'lookupKeyVersion',link.lookup_key_version,'calendarCiphertext',encode(link.calendar_id_ciphertext,'base64'),'calendarIv',encode(link.calendar_id_iv,'base64'),'calendarKeyVersion',link.calendar_id_key_version) order by link.branch_id) from public.calendar_hotel_links link where link.company_id=p_company_id and link.connection_id=candidate.connection_id and link.status='ACTIVE' and link.calendar_id_ciphertext is not null),'[]'::jsonb)) into snapshot;
  return query select 'CLAIMED',jsonb_build_object('candidate',snapshot);
end $function$;
revoke all on function public.calendar_candidate_claim_v1(uuid,bytea) from public;

create function public.calendar_candidate_finalize_v1(p_company_id uuid,p_candidate_id uuid,p_claim_token_hash bytea,p_expected_row_version integer,p_expected_connection_version integer,p_result text,p_safe_error_code text,p_retry_at timestamptz)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare candidate public.calendar_connection_credentials%rowtype; connection_row public.calendar_connections%rowtype; session_valid boolean; next_lifecycle text;
begin
  if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id or p_result not in ('ACCESS_VERIFIED','ACCOUNT_CHANGE_REQUIRES_CONFIRMATION','RETRYABLE','ACTION_REQUIRED') then return query select 'FORBIDDEN',null::jsonb; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
  select * into candidate from public.calendar_connection_credentials where company_id=p_company_id and id=p_candidate_id and lifecycle='CANDIDATE' and verification_claim_token_hash=p_claim_token_hash and verification_claim_expires_at>statement_timestamp() for update; if not found or candidate.row_version<>p_expected_row_version then return query select 'STALE_CLAIM',null::jsonb; return; end if;
  perform public.calendar_authorization_lock_v1(candidate.company_id,candidate.created_by,candidate.originating_session_id);
  select * into connection_row from public.calendar_connections where company_id=p_company_id and id=candidate.connection_id and status='CONNECTED' for update; if not found or connection_row.version<>p_expected_connection_version then return query select 'STALE_RESOURCE',null::jsonb; return; end if;
  select exists(select 1 from public.auth_sessions session_record join public.users user_record on user_record.company_id=session_record.company_id and user_record.id=session_record.user_id join public.companies company_record on company_record.id=session_record.company_id where session_record.company_id=candidate.company_id and session_record.id=candidate.originating_session_id and session_record.user_id=candidate.created_by and session_record.revoked_at is null and session_record.idle_expires_at>statement_timestamp() and session_record.absolute_expires_at>statement_timestamp() and session_record.auth_time>=statement_timestamp()-interval '15 minutes' and user_record.status='ACTIVE' and user_record.user_type='INTERNAL_STAFF' and company_record.status='ACTIVE' and public.hotel_calendar_permission_allowed_v1(candidate.company_id,null,candidate.created_by,'CALENDAR_CONNECTION_MANAGE') and not exists(select 1 from public.calendar_hotel_links link where link.company_id=candidate.company_id and link.connection_id=candidate.connection_id and link.status<>'DISCONNECTED' and not public.calendar_connection_manage_hotel_allowed_v1(link.company_id,link.branch_id,candidate.created_by))) into session_valid;
  if not session_valid then p_result:='ACTION_REQUIRED'; p_safe_error_code:='AUTHORIZATION_REQUIRED'; end if;
  if p_result='RETRYABLE' and candidate.verification_attempt_count<8 then update public.calendar_connection_credentials set verification_claim_token_hash=null,verification_claim_expires_at=null,available_at=coalesce(p_retry_at,statement_timestamp()+interval '30 seconds'),row_version=row_version+1,updated_at=statement_timestamp() where id=candidate.id; return query select 'RETRY',jsonb_build_object('candidateId',candidate.id); return; end if;
  next_lifecycle:=case when p_result in ('ACCESS_VERIFIED','ACCOUNT_CHANGE_REQUIRES_CONFIRMATION') then p_result else 'ACTION_REQUIRED' end;
  update public.calendar_connection_credentials set lifecycle=next_lifecycle,verification_claim_token_hash=null,verification_claim_expires_at=null,row_version=row_version+1,updated_at=statement_timestamp() where id=candidate.id;
  return query select next_lifecycle,jsonb_build_object('candidateId',candidate.id,'credentialStatus',next_lifecycle,'safeErrorCode',p_safe_error_code);
end $function$;
revoke all on function public.calendar_candidate_finalize_v1(uuid,uuid,bytea,integer,integer,text,text,timestamptz) from public;

create function public.calendar_connection_command_v1(p_company_id uuid,p_connection_id uuid,p_session_token text,p_action text,p_expected_version integer,p_candidate_id uuid,p_expected_candidate_row_version integer,p_replacement_links jsonb,p_reason text,p_idempotency_record_id uuid,p_idempotency_key text,p_operation_path text,p_request_hash text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; c public.calendar_connections%rowtype; candidate public.calendar_connection_credentials%rowtype; result_status text; canonical_snapshot jsonb; current_link_count integer; replay record; audit_id uuid:=gen_random_uuid();
begin
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text||':calendar-provider:'||p_connection_id::text,0));
  perform public.calendar_authorization_lock_v1(p_company_id,actor.user_id,actor.session_id);
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found or actor.user_type<>'INTERNAL_STAFF' or (select session_record.auth_time from public.auth_sessions session_record where session_record.company_id=p_company_id and session_record.id=actor.session_id)<statement_timestamp()-interval '15 minutes' or not public.hotel_calendar_permission_allowed_v1(p_company_id,null,actor.user_id,'CALENDAR_CONNECTION_MANAGE') or exists(select 1 from public.calendar_hotel_links affected_link where affected_link.company_id=p_company_id and affected_link.status<>'DISCONNECTED' and not public.calendar_connection_manage_hotel_allowed_v1(p_company_id,affected_link.branch_id,actor.user_id)) then return query select 'FORBIDDEN',null::jsonb; return; end if;
  if replay.command_status='IDEMPOTENCY_CONFLICT' then return query select 'IDEMPOTENCY_CONFLICT',null::jsonb; return; end if;
  if replay.command_status='REPLAYED' then return query select replay.result_snapshot->>'status',replay.result_snapshot->'payload'; return; end if;
  if length(btrim(p_reason)) not between 2 and 500 or jsonb_typeof(p_replacement_links)<>'array' then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
  select * into c from public.calendar_connections where company_id=p_company_id and id=p_connection_id for update;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if c.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if exists(
    select 1 from public.calendar_projection_jobs uncertain_job
    left join public.calendar_event_links uncertain_event on uncertain_event.company_id=uncertain_job.company_id and uncertain_event.id=uncertain_job.event_link_id
    join public.calendar_hotel_links uncertain_hotel on uncertain_hotel.company_id=uncertain_job.company_id and uncertain_hotel.id=coalesce(uncertain_job.hotel_link_id,uncertain_event.hotel_link_id)
    where uncertain_job.company_id=p_company_id and uncertain_hotel.connection_id=c.id and uncertain_job.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' and uncertain_job.status not in ('SUCCEEDED','SUPERSEDED')
      and not (
        uncertain_job.status='DEAD_LETTER' and exists(select 1 from public.calendar_sync_failures resolved_failure where resolved_failure.company_id=uncertain_job.company_id and resolved_failure.job_id=uncertain_job.id and resolved_failure.status='RESOLVED')
        and not exists(select 1 from public.calendar_sync_failures unresolved_failure where unresolved_failure.company_id=uncertain_job.company_id and unresolved_failure.job_id=uncertain_job.id and unresolved_failure.status<>'RESOLVED')
      )
  ) then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if p_action='DISCONNECT' then
    if p_candidate_id is not null or p_expected_candidate_row_version is not null or jsonb_array_length(p_replacement_links)<>0 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
    update public.calendar_connections set status='DISCONNECTED',active_credential_id=null,disconnected_at=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where id=c.id;
    update public.calendar_connection_credentials set lifecycle='RETIRED',row_version=row_version+1,verification_claim_token_hash=null,verification_claim_expires_at=null,updated_at=statement_timestamp() where company_id=p_company_id and connection_id=c.id and lifecycle<>'RETIRED';
    update public.calendar_hotel_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where company_id=p_company_id and connection_id=c.id and status<>'DISCONNECTED';
    update public.calendar_event_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where company_id=p_company_id and status<>'DISCONNECTED';
    update public.calendar_projection_jobs set status='SUPERSEDED',claim_token_hash=null,claim_expires_at=null,replay_requested=false,completed_at=statement_timestamp(),updated_at=statement_timestamp() where company_id=p_company_id and status in ('PENDING','PROCESSING','FAILED');
    result_status:='DISCONNECTED';
  elsif p_action in ('PROMOTE_CANDIDATE','CONFIRM_ACCOUNT_CHANGE') then
    if p_candidate_id is null or p_expected_candidate_row_version is null then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
    select * into candidate from public.calendar_connection_credentials where company_id=p_company_id and connection_id=c.id and id=p_candidate_id and lifecycle in ('ACCESS_VERIFIED','ACCOUNT_CHANGE_REQUIRES_CONFIRMATION') for update;
    if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
    if candidate.row_version<>p_expected_candidate_row_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
    if (p_action='PROMOTE_CANDIDATE' and candidate.lifecycle<>'ACCESS_VERIFIED') or (p_action='CONFIRM_ACCOUNT_CHANGE' and candidate.lifecycle<>'ACCOUNT_CHANGE_REQUIRES_CONFIRMATION') then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
    if p_action='PROMOTE_CANDIDATE' and jsonb_array_length(p_replacement_links)<>0 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
    if p_action='CONFIRM_ACCOUNT_CHANGE' then
      select count(*) into current_link_count from public.calendar_hotel_links where company_id=p_company_id and connection_id=c.id and status<>'DISCONNECTED';
      if jsonb_array_length(p_replacement_links)<>current_link_count or (select count(distinct replacement."hotelId") from jsonb_to_recordset(p_replacement_links) as replacement("hotelId" uuid))<>current_link_count or exists(
        select 1 from public.calendar_hotel_links old_link
        left join jsonb_to_recordset(p_replacement_links) as replacement("hotelId" uuid,"expectedHotelLinkId" uuid,"expectedGeneration" integer,"linkId" uuid,"generation" integer,"lookupCiphertext" text,"lookupIv" text,"keyVersion" integer,"lookupDigest" text)
          on replacement."hotelId"=old_link.branch_id
        where old_link.company_id=p_company_id and old_link.connection_id=c.id and old_link.status<>'DISCONNECTED' and (replacement."expectedHotelLinkId" is distinct from old_link.id or replacement."expectedGeneration" is distinct from old_link.generation or replacement."generation" is distinct from old_link.generation+1 or replacement."linkId" is null or replacement."linkId"=old_link.id or octet_length(decode(replacement."lookupIv",'base64'))<>12 or octet_length(decode(replacement."lookupDigest",'base64'))<>32 or replacement."keyVersion"<1)
      ) then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
      update public.calendar_hotel_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where company_id=p_company_id and connection_id=c.id and status<>'DISCONNECTED';
      update public.calendar_event_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where company_id=p_company_id and status<>'DISCONNECTED';
      update public.calendar_projection_jobs set status='SUPERSEDED',claim_token_hash=null,claim_expires_at=null,replay_requested=false,completed_at=statement_timestamp(),updated_at=statement_timestamp() where company_id=p_company_id and status in ('PENDING','PROCESSING','FAILED');
      insert into public.calendar_hotel_links(id,company_id,branch_id,connection_id,generation,status,lookup_key_ciphertext,lookup_key_iv,lookup_key_version,lookup_key_digest,connection_version,created_by)
        select replacement."linkId",p_company_id,replacement."hotelId",c.id,replacement."generation",'PENDING_CREATE',decode(replacement."lookupCiphertext",'base64'),decode(replacement."lookupIv",'base64'),replacement."keyVersion",decode(replacement."lookupDigest",'base64'),c.version+1,actor.user_id
        from jsonb_to_recordset(p_replacement_links) as replacement("hotelId" uuid,"expectedHotelLinkId" uuid,"expectedGeneration" integer,"linkId" uuid,"generation" integer,"lookupCiphertext" text,"lookupIv" text,"keyVersion" integer,"lookupDigest" text);
      insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,hotel_link_id,attempted_connection_version)
        select gen_random_uuid(),new_link.company_id,new_link.branch_id,'HOTEL_CALENDAR',new_link.id,c.version+1 from public.calendar_hotel_links new_link where new_link.company_id=p_company_id and new_link.connection_id=c.id and new_link.status='PENDING_CREATE';
    end if;
    update public.calendar_connection_credentials set lifecycle='RETIRED',row_version=row_version+1,updated_at=statement_timestamp() where company_id=p_company_id and connection_id=c.id and lifecycle='ACTIVE';
    update public.calendar_connection_credentials set lifecycle='ACTIVE',row_version=row_version+1,updated_at=statement_timestamp() where id=candidate.id;
    update public.calendar_connections set active_credential_id=candidate.id,status='CONNECTED',version=version+1,updated_at=statement_timestamp() where id=c.id;
    if p_action='PROMOTE_CANDIDATE' then update public.calendar_projection_jobs set status='PENDING',claim_token_hash=null,claim_expires_at=null,replay_requested=false,available_at=statement_timestamp(),updated_at=statement_timestamp() where company_id=p_company_id and status in ('PENDING','PROCESSING','FAILED'); end if;
    result_status:='CONNECTED';
  else
    return query select 'VALIDATION_ERROR',null::jsonb; return;
  end if;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(audit_id,'CALENDAR_CONNECTION_'||p_action,actor.user_id,actor.user_type,actor.session_id,p_company_id,'CALENDAR_CONNECTION',c.id,jsonb_build_object('status',result_status,'version',c.version+1,'candidateId',p_candidate_id),p_reason,'SUCCEEDED',gen_random_uuid());
  select status_read.result_snapshot into canonical_snapshot from public.calendar_connection_status_read_v1(p_company_id,p_session_token) status_read where status_read.command_status='OK';
  if canonical_snapshot is null then return query select 'FORBIDDEN',null::jsonb; return; end if;
  perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash,'CALENDAR_CONNECTION',c.id,audit_id,jsonb_build_object('status','UPDATED','payload',canonical_snapshot));
  return query select 'UPDATED',canonical_snapshot;
end $function$;
revoke all on function public.calendar_connection_command_v1(uuid,uuid,text,text,integer,uuid,integer,jsonb,text,uuid,text,text,text) from public;

create function public.calendar_hotel_link_command_v1(p_company_id uuid,p_connection_id uuid,p_branch_id uuid,p_session_token text,p_action text,p_expected_connection_version integer,p_expected_version integer,p_expected_generation integer,p_link_id uuid,p_lookup_ciphertext bytea,p_lookup_iv bytea,p_key_version integer,p_lookup_digest bytea,p_reason text,p_idempotency_record_id uuid,p_idempotency_key text,p_operation_path text,p_request_hash text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; c public.calendar_connections%rowtype; l public.calendar_hotel_links%rowtype; generation_value integer; canonical_snapshot jsonb; replay record; audit_id uuid:=gen_random_uuid();
begin
 select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token); if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
 select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text||':calendar-provider:'||p_connection_id::text,0));
 perform public.calendar_authorization_lock_v1(p_company_id,actor.user_id,actor.session_id);
 select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
 if not found or actor.user_type<>'INTERNAL_STAFF' or (select session_record.auth_time from public.auth_sessions session_record where session_record.company_id=p_company_id and session_record.id=actor.session_id)<statement_timestamp()-interval '15 minutes' or not public.calendar_connection_manage_hotel_allowed_v1(p_company_id,p_branch_id,actor.user_id) then return query select 'FORBIDDEN',null::jsonb; return; end if;
 if replay.command_status='IDEMPOTENCY_CONFLICT' then return query select 'IDEMPOTENCY_CONFLICT',null::jsonb; return; end if;
 if replay.command_status='REPLAYED' then return query select replay.result_snapshot->>'status',replay.result_snapshot->'payload'; return; end if;
 if char_length(btrim(p_reason)) not between 2 and 500 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 select * into c from public.calendar_connections where company_id=p_company_id and id=p_connection_id and version=p_expected_connection_version and status='CONNECTED' and active_credential_id is not null for update; if not found then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
 if p_action='CREATE' then select coalesce(max(generation),0)+1 into generation_value from public.calendar_hotel_links where company_id=p_company_id and branch_id=p_branch_id; if p_expected_generation is distinct from generation_value then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; insert into public.calendar_hotel_links(id,company_id,branch_id,connection_id,generation,status,lookup_key_ciphertext,lookup_key_iv,lookup_key_version,lookup_key_digest,connection_version,created_by) values(p_link_id,p_company_id,p_branch_id,c.id,p_expected_generation,'PENDING_CREATE',p_lookup_ciphertext,p_lookup_iv,p_key_version,p_lookup_digest,c.version,actor.user_id) returning * into l; insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,hotel_link_id,attempted_connection_version) values(gen_random_uuid(),p_company_id,p_branch_id,'HOTEL_CALENDAR',l.id,c.version); insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(audit_id,'CALENDAR_HOTEL_LINK_CREATE',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'CALENDAR_HOTEL_LINK',l.id,jsonb_build_object('status',l.status,'generation',l.generation,'version',l.version),p_reason,'SUCCEEDED',gen_random_uuid()); select status_read.result_snapshot into canonical_snapshot from public.calendar_connection_status_read_v1(p_company_id,p_session_token) status_read where status_read.command_status='OK'; perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash,'CALENDAR_HOTEL_LINK',l.id,audit_id,jsonb_build_object('status','CREATED','payload',canonical_snapshot)); return query select 'CREATED',canonical_snapshot; return; end if;
 select * into l from public.calendar_hotel_links where company_id=p_company_id and branch_id=p_branch_id and status<>'DISCONNECTED' for update; if not found then return query select 'NOT_FOUND',null::jsonb; return; end if; if l.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if; if p_action='DISCONNECT' and exists(select 1 from public.calendar_projection_jobs uncertain_job where uncertain_job.company_id=p_company_id and uncertain_job.hotel_link_id=l.id and uncertain_job.aggregate_type='HOTEL_CALENDAR' and uncertain_job.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' and uncertain_job.status not in ('SUCCEEDED','SUPERSEDED')) then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
 if p_action='DISCONNECT' then
   update public.calendar_hotel_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where id=l.id;
   update public.calendar_event_links set status='DISCONNECTED',version=version+1,updated_at=statement_timestamp() where company_id=p_company_id and branch_id=p_branch_id and hotel_link_id=l.id;
   update public.calendar_projection_jobs job set status='SUPERSEDED',claim_token_hash=null,claim_expires_at=null,replay_requested=false,completed_at=statement_timestamp(),updated_at=statement_timestamp() where job.company_id=p_company_id and job.branch_id=p_branch_id and (job.hotel_link_id=l.id or exists(select 1 from public.calendar_event_links event_record where event_record.company_id=job.company_id and event_record.id=job.event_link_id and event_record.hotel_link_id=l.id)) and job.status in ('PENDING','PROCESSING','FAILED');
   insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,before_summary,after_summary,reason,result,trace_id) values(audit_id,'CALENDAR_HOTEL_LINK_DISCONNECT',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'CALENDAR_HOTEL_LINK',l.id,jsonb_build_object('status',l.status,'version',l.version),jsonb_build_object('status','DISCONNECTED','version',l.version+1),p_reason,'SUCCEEDED',gen_random_uuid());
   select status_read.result_snapshot into canonical_snapshot from public.calendar_connection_status_read_v1(p_company_id,p_session_token) status_read where status_read.command_status='OK'; perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash,'CALENDAR_HOTEL_LINK',l.id,audit_id,jsonb_build_object('status','UPDATED','payload',canonical_snapshot)); return query select 'UPDATED',canonical_snapshot; return;
 elsif p_action='RETRY' then
   return query select 'VALIDATION_ERROR',null::jsonb; return;
 end if;
 return query select 'VALIDATION_ERROR',null::jsonb;
end $function$;
revoke all on function public.calendar_hotel_link_command_v1(uuid,uuid,uuid,text,text,integer,integer,integer,uuid,bytea,bytea,integer,bytea,text,uuid,text,text,text) from public;

create function public.calendar_projection_failure_retry_v1(p_company_id uuid,p_branch_id uuid,p_session_token text,p_failure_id uuid,p_expected_version integer,p_reason text,p_idempotency_record_id uuid,p_idempotency_key text,p_operation_path text,p_request_hash text)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare actor record; failure public.calendar_sync_failures%rowtype; terminal_job public.calendar_projection_jobs%rowtype; retried_event public.calendar_event_links%rowtype; retried_hotel public.calendar_hotel_links%rowtype; inserted_count integer; canonical_snapshot jsonb; replay record; audit_id uuid:=gen_random_uuid();
begin
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into replay from public.repair_idempotency_begin_v1(p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash);
  perform public.calendar_authorization_lock_v1(p_company_id,actor.user_id,actor.session_id);
  select * into actor from public.hotel_calendar_actor_v1(p_company_id,p_session_token);
  if not found or actor.user_type<>'INTERNAL_STAFF' or (select session_record.auth_time from public.auth_sessions session_record where session_record.company_id=p_company_id and session_record.id=actor.session_id)<statement_timestamp()-interval '15 minutes' or not public.hotel_calendar_permission_allowed_v1(p_company_id,p_branch_id,actor.user_id,'CALENDAR_PROJECTION_RETRY') or not public.calendar_connection_manage_hotel_allowed_v1(p_company_id,p_branch_id,actor.user_id) then return query select 'FORBIDDEN',null::jsonb; return; end if;
  if replay.command_status='IDEMPOTENCY_CONFLICT' then return query select 'IDEMPOTENCY_CONFLICT',null::jsonb; return; end if;
  if replay.command_status='REPLAYED' then return query select replay.result_snapshot->>'status',replay.result_snapshot->'payload'; return; end if;
  if char_length(btrim(p_reason)) not between 2 and 500 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
  select * into failure from public.calendar_sync_failures where company_id=p_company_id and branch_id=p_branch_id and id=p_failure_id and status='OPEN' for update;
  if not found then return query select 'NOT_FOUND',null::jsonb; return; end if;
  if failure.version<>p_expected_version then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  select * into terminal_job from public.calendar_projection_jobs where company_id=p_company_id and branch_id=p_branch_id and id=failure.job_id and status in ('FAILED','DEAD_LETTER') for update;
  if not found then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  if exists(select 1 from public.calendar_projection_jobs current_job where current_job.company_id=p_company_id and current_job.branch_id=p_branch_id and current_job.status in ('PENDING','PROCESSING') and ((failure.event_link_id is not null and current_job.event_link_id=failure.event_link_id) or (failure.hotel_link_id is not null and current_job.hotel_link_id=failure.hotel_link_id))) then return query select 'VERSION_CONFLICT',null::jsonb; return; end if;
  update public.calendar_sync_failures set status='RETRY_REQUESTED',version=version+1 where id=failure.id;
  if failure.event_link_id is not null then
    update public.calendar_event_links set status='PENDING',version=version+1,updated_at=statement_timestamp() where id=failure.event_link_id and status='ACTION_REQUIRED' returning * into retried_event;
    if not found then raise exception using errcode='23514',message='CALENDAR_FAILURE_EVENT_STATE'; end if;
  else
    update public.calendar_hotel_links set status=case when calendar_id_ciphertext is null then 'PENDING_CREATE' else 'ACTIVE' end,version=version+1,updated_at=statement_timestamp() where id=failure.hotel_link_id and status='ACTION_REQUIRED' returning * into retried_hotel;
    if not found then raise exception using errcode='23514',message='CALENDAR_FAILURE_HOTEL_STATE'; end if;
  end if;
  insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,hotel_link_id,event_link_id,attempted_source_version,attempted_starts_at,attempted_ends_at,attempted_visit_status,attempted_connection_version,attempted_hotel_link_generation,attempted_hotel_link_version,attempted_event_link_version,attempted_credential_id,attempted_credential_version,create_dispatch_state)
  values(gen_random_uuid(),terminal_job.company_id,terminal_job.branch_id,terminal_job.aggregate_type,terminal_job.hotel_link_id,terminal_job.event_link_id,terminal_job.attempted_source_version,terminal_job.attempted_starts_at,terminal_job.attempted_ends_at,terminal_job.attempted_visit_status,terminal_job.attempted_connection_version,terminal_job.attempted_hotel_link_generation,case when terminal_job.aggregate_type='HOTEL_CALENDAR' then retried_hotel.version else terminal_job.attempted_hotel_link_version end,case when terminal_job.aggregate_type='VISIT_EVENT' then retried_event.version else terminal_job.attempted_event_link_version end,terminal_job.attempted_credential_id,terminal_job.attempted_credential_version,terminal_job.create_dispatch_state);
  get diagnostics inserted_count=row_count;
  if inserted_count<>1 then raise exception using errcode='23514',message='CALENDAR_FAILURE_RETRY_INSERT_COUNT'; end if;
  insert into public.audit_events(id,event_code,actor_user_id,actor_type,session_id,company_id,branch_id,resource_type,resource_id,after_summary,reason,result,trace_id) values(audit_id,'CALENDAR_PROJECTION_FAILURE_RETRY_REQUESTED',actor.user_id,actor.user_type,actor.session_id,p_company_id,p_branch_id,'CALENDAR_SYNC_FAILURE',failure.id,jsonb_build_object('failureVersion',failure.version+1,'eventLinkId',failure.event_link_id,'hotelLinkId',failure.hotel_link_id),p_reason,'SUCCEEDED',gen_random_uuid());
  select status_read.result_snapshot into canonical_snapshot from public.calendar_connection_status_read_v1(p_company_id,p_session_token) status_read where status_read.command_status='OK';
  if canonical_snapshot is null then return query select 'FORBIDDEN',null::jsonb; return; end if;
  perform public.repair_idempotency_store_v1(p_idempotency_record_id,p_company_id,actor.user_id,p_idempotency_key,'POST',p_operation_path,p_request_hash,'CALENDAR_SYNC_FAILURE',failure.id,audit_id,jsonb_build_object('status','UPDATED','payload',canonical_snapshot));
  return query select 'UPDATED',canonical_snapshot;
end $function$;
revoke all on function public.calendar_projection_failure_retry_v1(uuid,uuid,text,uuid,integer,text,uuid,text,text,text) from public;

create function public.calendar_visit_projection_status_v1(p_company_id uuid,p_branch_id uuid,p_visit_id uuid)
returns text language plpgsql stable security definer set search_path=pg_catalog as $function$
declare projection_status text;
begin
  select case
    when hotel_link.id is null then 'NOT_CONNECTED'
    when hotel_link.status='ACTION_REQUIRED' or event_link.status='ACTION_REQUIRED' or exists(select 1 from public.calendar_sync_failures failure where failure.company_id=p_company_id and failure.status='OPEN' and (failure.hotel_link_id=hotel_link.id or failure.event_link_id=event_link.id)) then 'ACTION_REQUIRED'
    when hotel_link.status='PENDING_CREATE' or event_link.id is null or event_link.status='PENDING' or exists(select 1 from public.calendar_projection_jobs job where job.company_id=p_company_id and job.event_link_id=event_link.id and job.status in ('PENDING','PROCESSING','FAILED')) then 'PENDING'
    when hotel_link.status='ACTIVE' and event_link.status='SYNCED' and event_link.applied_source_version=visit.version then 'SYNCED'
    else 'PENDING'
  end into projection_status
  from public.hotel_repair_visits visit
  left join public.calendar_hotel_links hotel_link on hotel_link.company_id=visit.company_id and hotel_link.branch_id=visit.branch_id and hotel_link.status<>'DISCONNECTED'
  left join public.calendar_event_links event_link on event_link.company_id=visit.company_id and event_link.hotel_link_id=hotel_link.id and event_link.visit_id=visit.id
  where visit.company_id=p_company_id and visit.branch_id=p_branch_id and visit.id=p_visit_id;
  return coalesce(projection_status,'NOT_CONNECTED');
end
$function$;
revoke all on function public.calendar_visit_projection_status_v1(uuid,uuid,uuid) from public;

create function public.calendar_repair_projection_status_v1(p_company_id uuid,p_branch_id uuid,p_repair_id uuid)
returns text language plpgsql stable security definer set search_path=pg_catalog as $function$
declare projection_status text;
begin
  with visit_statuses as (
    select public.calendar_visit_projection_status_v1(visit.company_id,visit.branch_id,visit.id) as projection_status
    from public.hotel_repair_visits visit
    where visit.company_id=p_company_id and visit.branch_id=p_branch_id and visit.repair_case_id=p_repair_id
  )
  select case
    when exists(select 1 from visit_statuses where visit_statuses.projection_status='ACTION_REQUIRED') then 'ACTION_REQUIRED'
    when exists(select 1 from visit_statuses where visit_statuses.projection_status='PENDING') then 'PENDING'
    when exists(select 1 from visit_statuses) and not exists(select 1 from visit_statuses where visit_statuses.projection_status<>'SYNCED') then 'SYNCED'
    else 'NOT_CONNECTED'
  end into projection_status;
  return projection_status;
end
$function$;
revoke all on function public.calendar_repair_projection_status_v1(uuid,uuid,uuid) from public;

create function public.calendar_projection_visit_signal_v1() returns trigger language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare link public.calendar_hotel_links%rowtype; event_link public.calendar_event_links%rowtype; connection_version_value integer; marker_key_version_value integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.company_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.company_id::text||':'||new.branch_id::text,0));
 select * into link from public.calendar_hotel_links where company_id=new.company_id and branch_id=new.branch_id and status='ACTIVE' for update;
 if not found then return new; end if;
 select connection_record.version,crypto_settings.current_hmac_key_version into connection_version_value,marker_key_version_value from public.calendar_connections connection_record join public.calendar_connection_credentials credential_record on credential_record.company_id=connection_record.company_id and credential_record.id=connection_record.active_credential_id and credential_record.lifecycle='ACTIVE' cross join public.calendar_crypto_settings crypto_settings where crypto_settings.singleton and connection_record.company_id=new.company_id and connection_record.id=link.connection_id and connection_record.status='CONNECTED'; if not found then return new; end if;
 insert into public.calendar_event_links(id,company_id,branch_id,hotel_link_id,visit_id,generation,stable_event_id,marker_key_version,desired_source_version,status) values(gen_random_uuid(),new.company_id,new.branch_id,link.id,new.id,link.generation,'ca'||substring(encode(pg_catalog.sha256(pg_catalog.convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex') from 1 for 40),marker_key_version_value,new.version,'PENDING') on conflict(company_id,branch_id,hotel_link_id,visit_id) do update set desired_source_version=greatest(public.calendar_event_links.desired_source_version,excluded.desired_source_version),status=case when public.calendar_event_links.status='DISCONNECTED' then public.calendar_event_links.status else 'PENDING' end,version=public.calendar_event_links.version+1,updated_at=statement_timestamp() returning * into event_link;
 update public.calendar_projection_jobs set status='SUPERSEDED',replay_requested=false,claim_token_hash=null,claim_expires_at=null,completed_at=statement_timestamp(),updated_at=statement_timestamp() where company_id=new.company_id and branch_id=new.branch_id and event_link_id=event_link.id and status in ('PENDING','FAILED');
 update public.calendar_projection_jobs set replay_requested=true,updated_at=statement_timestamp() where company_id=new.company_id and branch_id=new.branch_id and event_link_id=event_link.id and status='PROCESSING';
 insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_connection_version) values(gen_random_uuid(),new.company_id,new.branch_id,'VISIT_EVENT',event_link.id,event_link.desired_source_version,connection_version_value) on conflict do nothing;
 return new;
end $function$;
revoke all on function public.calendar_projection_visit_signal_v1() from public;
create trigger calendar_projection_visit_signal after insert or update of title,starts_at,ends_at,status,version on public.hotel_repair_visits for each row execute function public.calendar_projection_visit_signal_v1();

create function public.scheduled_reconciler_invocation_enter_v1()
returns void language plpgsql volatile security definer set search_path=pg_catalog as $function$
begin
  if not public.runtime_has_capability('RECONCILER') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  perform pg_catalog.pg_advisory_lock_shared(pg_catalog.hashtextextended('werehere:scheduled-reconciler:v1',0));
end $function$;
revoke all on function public.scheduled_reconciler_invocation_enter_v1() from public;

create function public.scheduled_reconciler_invocation_exit_v1()
returns void language plpgsql volatile security definer set search_path=pg_catalog as $function$
begin
  if not public.runtime_has_capability('RECONCILER') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if not pg_catalog.pg_advisory_unlock_shared(pg_catalog.hashtextextended('werehere:scheduled-reconciler:v1',0)) then raise exception using errcode='55000',message='RECONCILER_INVOCATION_LOCK_NOT_HELD'; end if;
end $function$;
revoke all on function public.scheduled_reconciler_invocation_exit_v1() from public;

create function public.scheduled_reconciler_drain_barrier_v1()
returns void language plpgsql volatile security definer set search_path=pg_catalog as $function$
begin
  if not public.runtime_has_capability('RECONCILER') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('werehere:scheduled-reconciler:v1',0));
end $function$;
revoke all on function public.scheduled_reconciler_drain_barrier_v1() from public;

create function public.calendar_projection_claim_v1(p_company_id uuid,p_claim_token_hash bytea,p_limit integer)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare snapshot jsonb; exhausted public.calendar_projection_jobs%rowtype;
begin
 if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id or octet_length(p_claim_token_hash)<>32 then return query select 'FORBIDDEN',null::jsonb; return; end if;
 for exhausted in update public.calendar_projection_jobs set status='DEAD_LETTER',claim_token_hash=null,claim_expires_at=null,last_error_code='PROVIDER_RETRY_EXHAUSTED',completed_at=statement_timestamp(),updated_at=statement_timestamp() where company_id=p_company_id and status='PROCESSING' and attempt_count>=8 and claim_expires_at<=statement_timestamp() returning * loop
   insert into public.calendar_sync_failures(id,company_id,branch_id,job_id,hotel_link_id,event_link_id,failure_code) values(gen_random_uuid(),exhausted.company_id,exhausted.branch_id,exhausted.id,exhausted.hotel_link_id,exhausted.event_link_id,'PROVIDER_RETRY_EXHAUSTED');
   if exhausted.hotel_link_id is not null then update public.calendar_hotel_links set status='ACTION_REQUIRED',updated_at=statement_timestamp() where id=exhausted.hotel_link_id; else update public.calendar_event_links set status='ACTION_REQUIRED',updated_at=statement_timestamp() where id=exhausted.event_link_id; end if;
 end loop;
 with claimable as (
   select j.id from public.calendar_projection_jobs j
   left join public.calendar_event_links event_record on event_record.company_id=j.company_id and event_record.id=j.event_link_id
   join public.calendar_hotel_links hotel_record on hotel_record.company_id=j.company_id and hotel_record.id=coalesce(j.hotel_link_id,event_record.hotel_link_id)
   join public.calendar_connections connection_record on connection_record.company_id=j.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED' and connection_record.active_credential_id is not null
   join public.calendar_connection_credentials credential_record on credential_record.company_id=j.company_id and credential_record.id=connection_record.active_credential_id and credential_record.lifecycle='ACTIVE'
   where j.company_id=p_company_id and j.attempt_count<8 and ((j.status in ('PENDING','FAILED') and j.available_at<=statement_timestamp()) or (j.status='PROCESSING' and j.claim_expires_at<=statement_timestamp()))
     and ((j.aggregate_type='HOTEL_CALENDAR' and hotel_record.status='PENDING_CREATE') or (j.aggregate_type='VISIT_EVENT' and hotel_record.status='ACTIVE' and event_record.status<>'DISCONNECTED'))
   order by j.available_at,j.created_at,j.id for update of j skip locked limit least(greatest(p_limit,1),10)
 ), claimed as (
   update public.calendar_projection_jobs j set
     status='PROCESSING',claim_token_hash=p_claim_token_hash,claim_expires_at=statement_timestamp()+interval '2 minutes',attempt_count=attempt_count+1,
     attempted_source_version=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_source_version when j.event_link_id is null then null else (select desired_source_version from public.calendar_event_links where company_id=j.company_id and id=j.event_link_id) end,
    attempted_starts_at=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_starts_at when j.event_link_id is null then null else (select starts_at from public.hotel_repair_visits where company_id=j.company_id and branch_id=j.branch_id and id=(select visit_id from public.calendar_event_links where company_id=j.company_id and id=j.event_link_id)) end,
    attempted_ends_at=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_ends_at when j.event_link_id is null then null else (select ends_at from public.hotel_repair_visits where company_id=j.company_id and branch_id=j.branch_id and id=(select visit_id from public.calendar_event_links where company_id=j.company_id and id=j.event_link_id)) end,
    attempted_visit_status=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_visit_status when j.event_link_id is null then null else (select status from public.hotel_repair_visits where company_id=j.company_id and branch_id=j.branch_id and id=(select visit_id from public.calendar_event_links where company_id=j.company_id and id=j.event_link_id)) end,
     attempted_connection_version=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_connection_version else (select connection_record.version from public.calendar_hotel_links hotel_link join public.calendar_connections connection_record on connection_record.company_id=hotel_link.company_id and connection_record.id=hotel_link.connection_id where hotel_link.company_id=j.company_id and hotel_link.id=coalesce(j.hotel_link_id,(select event_link.hotel_link_id from public.calendar_event_links event_link where event_link.company_id=j.company_id and event_link.id=j.event_link_id))) end,
     attempted_hotel_link_generation=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_hotel_link_generation else (select hotel_link.generation from public.calendar_hotel_links hotel_link where hotel_link.company_id=j.company_id and hotel_link.id=coalesce(j.hotel_link_id,(select event_link.hotel_link_id from public.calendar_event_links event_link where event_link.company_id=j.company_id and event_link.id=j.event_link_id))) end,
     attempted_hotel_link_version=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_hotel_link_version else (select hotel_link.version from public.calendar_hotel_links hotel_link where hotel_link.company_id=j.company_id and hotel_link.id=coalesce(j.hotel_link_id,(select event_link.hotel_link_id from public.calendar_event_links event_link where event_link.company_id=j.company_id and event_link.id=j.event_link_id))) end,
     attempted_event_link_version=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_event_link_version when j.event_link_id is null then null else (select version from public.calendar_event_links where company_id=j.company_id and id=j.event_link_id) end,
     attempted_credential_id=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_credential_id else (select connection_record.active_credential_id from public.calendar_hotel_links hotel_link join public.calendar_connections connection_record on connection_record.company_id=hotel_link.company_id and connection_record.id=hotel_link.connection_id where hotel_link.company_id=j.company_id and hotel_link.id=coalesce(j.hotel_link_id,(select event_link.hotel_link_id from public.calendar_event_links event_link where event_link.company_id=j.company_id and event_link.id=j.event_link_id))) end,
     attempted_credential_version=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.attempted_credential_version else (select credential_record.credential_version from public.calendar_hotel_links hotel_link join public.calendar_connections connection_record on connection_record.company_id=hotel_link.company_id and connection_record.id=hotel_link.connection_id join public.calendar_connection_credentials credential_record on credential_record.company_id=connection_record.company_id and credential_record.id=connection_record.active_credential_id where hotel_link.company_id=j.company_id and hotel_link.id=coalesce(j.hotel_link_id,(select event_link.hotel_link_id from public.calendar_event_links event_link where event_link.company_id=j.company_id and event_link.id=j.event_link_id))) end,
     replay_requested=case when j.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then j.replay_requested else false end,updated_at=statement_timestamp()
   from claimable where j.id=claimable.id returning j.*
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',job.id,'companyId',job.company_id,'hotelId',job.branch_id,'aggregateType',job.aggregate_type,'hotelLinkId',hotel_link.id,'eventLinkId',event_link.id,
   'attemptNumber',job.attempt_count,'attemptedSourceVersion',job.attempted_source_version,'attemptedConnectionVersion',job.attempted_connection_version,'attemptedHotelLinkGeneration',job.attempted_hotel_link_generation,'attemptedHotelLinkVersion',job.attempted_hotel_link_version,'attemptedEventLinkVersion',job.attempted_event_link_version,'attemptedCredentialId',job.attempted_credential_id,'attemptedCredentialVersion',job.attempted_credential_version,'createDispatchState',job.create_dispatch_state,
   'connectionId',connection_record.id,'connectionStatus',connection_record.status,'connectionVersion',connection_record.version,
   'credentialId',credential.id,'credentialVersion',credential.credential_version,'credentialCiphertext',encode(credential.refresh_credential_ciphertext,'base64'),'credentialIv',encode(credential.refresh_credential_iv,'base64'),'credentialKeyVersion',credential.encryption_key_version,
   'hotelLinkStatus',hotel_link.status,'hotelLinkGeneration',hotel_link.generation,'lookupCiphertext',encode(hotel_link.lookup_key_ciphertext,'base64'),'lookupIv',encode(hotel_link.lookup_key_iv,'base64'),'lookupKeyVersion',hotel_link.lookup_key_version,
   'calendarCiphertext',case when hotel_link.calendar_id_ciphertext is null then null else encode(hotel_link.calendar_id_ciphertext,'base64') end,'calendarIv',case when hotel_link.calendar_id_iv is null then null else encode(hotel_link.calendar_id_iv,'base64') end,'calendarKeyVersion',hotel_link.calendar_id_key_version,
   'stableEventId',event_link.stable_event_id,'markerKeyVersion',event_link.marker_key_version,'desiredSourceVersion',event_link.desired_source_version,'appliedSourceVersion',event_link.applied_source_version,'appliedExists',event_link.applied_exists,
   'visit',case when visit.id is null then null else jsonb_build_object('id',visit.id,'startsAt',job.attempted_starts_at,'endsAt',job.attempted_ends_at,'status',job.attempted_visit_status,'version',job.attempted_source_version) end
 )),'[]'::jsonb) into snapshot
 from claimed job
 left join public.calendar_event_links event_link on event_link.company_id=job.company_id and event_link.id=job.event_link_id
 left join public.calendar_hotel_links hotel_link on hotel_link.company_id=job.company_id and hotel_link.id=coalesce(job.hotel_link_id,event_link.hotel_link_id)
 left join public.calendar_connections connection_record on connection_record.company_id=job.company_id and connection_record.id=hotel_link.connection_id
 left join public.calendar_connection_credentials credential on credential.company_id=job.company_id and credential.id=connection_record.active_credential_id
 left join public.hotel_repair_visits visit on visit.company_id=job.company_id and visit.branch_id=job.branch_id and visit.id=event_link.visit_id;
 return query select 'OK',jsonb_build_object('jobs',snapshot);
end $function$;
revoke all on function public.calendar_projection_claim_v1(uuid,bytea,integer) from public;

create function public.calendar_projection_mark_create_dispatched_v1(p_company_id uuid,p_job_id uuid,p_claim_token_hash bytea)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare preflight record;
begin
  if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into preflight from public.calendar_projection_finalize_v1(p_company_id,p_job_id,p_claim_token_hash,'PREFLIGHT','NO_OP',null,null,null,null,null,null);
  if preflight.command_status<>'READY' then return query select preflight.command_status,preflight.result_snapshot; return; end if;
  update public.calendar_projection_jobs set create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN',updated_at=statement_timestamp()
   where company_id=p_company_id and id=p_job_id and status='PROCESSING' and claim_token_hash=p_claim_token_hash and claim_expires_at>statement_timestamp() and create_dispatch_state in ('CREATE_NOT_ATTEMPTED','CREATE_CONFIRMED');
  if not found then return query select 'STALE_CLAIM',null::jsonb; return; end if;
  return query select 'DISPATCH_RECORDED',jsonb_build_object('jobId',p_job_id);
end $function$;
revoke all on function public.calendar_projection_mark_create_dispatched_v1(uuid,uuid,bytea) from public;

create function public.calendar_projection_reset_event_existence_v1(p_company_id uuid,p_job_id uuid,p_claim_token_hash bytea)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare preflight record; job public.calendar_projection_jobs%rowtype; event_record public.calendar_event_links%rowtype;
begin
  if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
  select * into preflight from public.calendar_projection_finalize_v1(p_company_id,p_job_id,p_claim_token_hash,'PREFLIGHT','NO_OP',null,null,null,null,null,null);
  if preflight.command_status<>'READY' then return query select preflight.command_status,preflight.result_snapshot; return; end if;
  select * into job from public.calendar_projection_jobs where company_id=p_company_id and id=p_job_id and status='PROCESSING' and claim_token_hash=p_claim_token_hash and claim_expires_at>statement_timestamp() for update;
  if not found or job.aggregate_type<>'VISIT_EVENT' or job.event_link_id is null then return query select 'STALE_CLAIM',null::jsonb; return; end if;
  select * into event_record from public.calendar_event_links where company_id=job.company_id and id=job.event_link_id and status<>'DISCONNECTED' for update;
  if not found or event_record.version<>job.attempted_event_link_version or not event_record.applied_exists then return query select 'STALE_RESOURCE',null::jsonb; return; end if;
  update public.calendar_event_links set applied_exists=false,status='PENDING',version=version+1,updated_at=statement_timestamp() where id=event_record.id;
  update public.calendar_projection_jobs set attempted_event_link_version=event_record.version+1,create_dispatch_state='CREATE_NOT_ATTEMPTED',updated_at=statement_timestamp() where id=job.id;
  return query select 'EXISTENCE_RESET',jsonb_build_object('jobId',job.id,'attemptedEventLinkVersion',event_record.version+1);
end $function$;
revoke all on function public.calendar_projection_reset_event_existence_v1(uuid,uuid,bytea) from public;

create function public.calendar_projection_repair_stale_v1(p_company_id uuid,p_job_id uuid)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare job public.calendar_projection_jobs%rowtype; event_link public.calendar_event_links%rowtype; hotel_link public.calendar_hotel_links%rowtype; connection_version integer;
begin
  if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
  select * into job from public.calendar_projection_jobs where company_id=p_company_id and id=p_job_id for update;
  if not found or job.status='SUPERSEDED' then return query select 'NO_REPAIR',null::jsonb; return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(job.company_id::text||':'||job.branch_id::text,0));
  if job.aggregate_type='HOTEL_CALENDAR' then
    select hotel_record.* into hotel_link from public.calendar_hotel_links hotel_record where hotel_record.company_id=job.company_id and hotel_record.id=job.hotel_link_id and hotel_record.status='PENDING_CREATE' and hotel_record.generation=job.attempted_hotel_link_generation for update of hotel_record;
    if not found then return query select 'NO_REPAIR',null::jsonb; return; end if;
    select connection_record.version into connection_version from public.calendar_connections connection_record where connection_record.company_id=hotel_link.company_id and connection_record.id=hotel_link.connection_id and connection_record.status='CONNECTED' and connection_record.active_credential_id is not null;
    if not found then return query select 'NO_REPAIR',null::jsonb; return; end if;
    update public.calendar_projection_jobs set replay_requested=case when status='PROCESSING' then true else replay_requested end,attempted_connection_version=case when status='PENDING' and create_dispatch_state<>'CREATE_DISPATCHED_OUTCOME_UNKNOWN' then connection_version else attempted_connection_version end,available_at=case when status='PENDING' then statement_timestamp() else available_at end,updated_at=statement_timestamp() where company_id=job.company_id and branch_id=job.branch_id and hotel_link_id=hotel_link.id and aggregate_type='HOTEL_CALENDAR' and status in ('PENDING','PROCESSING');
    if not found then insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,hotel_link_id,attempted_source_version,attempted_starts_at,attempted_ends_at,attempted_visit_status,attempted_connection_version,attempted_hotel_link_generation,attempted_hotel_link_version,attempted_event_link_version,attempted_credential_id,attempted_credential_version,create_dispatch_state) values(gen_random_uuid(),job.company_id,job.branch_id,'HOTEL_CALENDAR',hotel_link.id,job.attempted_source_version,job.attempted_starts_at,job.attempted_ends_at,job.attempted_visit_status,job.attempted_connection_version,job.attempted_hotel_link_generation,job.attempted_hotel_link_version,job.attempted_event_link_version,job.attempted_credential_id,job.attempted_credential_version,'CREATE_DISPATCHED_OUTCOME_UNKNOWN'); end if;
    return query select 'REPAIR_ENQUEUED',jsonb_build_object('hotelLinkId',hotel_link.id,'generation',hotel_link.generation); return;
  end if;
  if job.aggregate_type<>'VISIT_EVENT' then return query select 'NO_REPAIR',null::jsonb; return; end if;
  select event_record.* into event_link
  from public.calendar_event_links event_record
  where event_record.company_id=job.company_id and event_record.id=job.event_link_id and event_record.status<>'DISCONNECTED'
  for update of event_record;
  if not found then return query select 'NO_REPAIR',null::jsonb; return; end if;
  select connection_record.version into connection_version
  from public.calendar_hotel_links hotel_record
  join public.calendar_connections connection_record on connection_record.company_id=hotel_record.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED'
  where hotel_record.company_id=event_link.company_id and hotel_record.id=event_link.hotel_link_id and hotel_record.status='ACTIVE';
  if not found then return query select 'NO_REPAIR',null::jsonb; return; end if;
  update public.calendar_event_links set status='PENDING',version=version+1,updated_at=statement_timestamp() where id=event_link.id;
  update public.calendar_projection_jobs set
    replay_requested=case when status='PROCESSING' then true else replay_requested end,
    attempted_source_version=case when status='PENDING' then event_link.desired_source_version else attempted_source_version end,
    attempted_connection_version=case when status='PENDING' then connection_version else attempted_connection_version end,
    available_at=case when status='PENDING' then statement_timestamp() else available_at end,
    updated_at=statement_timestamp()
  where company_id=job.company_id and branch_id=job.branch_id and event_link_id=event_link.id and status in ('PENDING','PROCESSING');
  if not found then
    insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_connection_version)
    values(gen_random_uuid(),job.company_id,job.branch_id,'VISIT_EVENT',event_link.id,event_link.desired_source_version,connection_version);
  end if;
  return query select 'REPAIR_ENQUEUED',jsonb_build_object('eventLinkId',event_link.id,'sourceVersion',event_link.desired_source_version);
end $function$;
revoke all on function public.calendar_projection_repair_stale_v1(uuid,uuid) from public;

create function public.calendar_projection_finalize_v1(p_company_id uuid,p_job_id uuid,p_claim_token_hash bytea,p_result text,p_operation text,p_safe_error_code text,p_retry_at timestamptz,p_calendar_ciphertext bytea,p_calendar_iv bytea,p_calendar_key_version integer,p_applied_source_version integer)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare job public.calendar_projection_jobs%rowtype; link public.calendar_hotel_links%rowtype; event_link public.calendar_event_links%rowtype; next_status text; current_connection_version integer; current_source_version integer; current_hotel_link_generation integer; current_hotel_link_version integer; current_event_link_version integer; current_credential_id uuid; current_credential_version integer; current_hotel_link_status text; current_event_link_status text;
begin
 if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id then return query select 'FORBIDDEN',null::jsonb; return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
 select * into job from public.calendar_projection_jobs where company_id=p_company_id and id=p_job_id and status='PROCESSING' and claim_token_hash=p_claim_token_hash and claim_expires_at>statement_timestamp() for update; if not found then return query select 'STALE_CLAIM',null::jsonb; return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(job.company_id::text||':'||job.branch_id::text,0));
 select connection_record.version,event_record.desired_source_version,hotel_record.generation,hotel_record.version,event_record.version,connection_record.active_credential_id,credential_record.credential_version,hotel_record.status,event_record.status
 into current_connection_version,current_source_version,current_hotel_link_generation,current_hotel_link_version,current_event_link_version,current_credential_id,current_credential_version,current_hotel_link_status,current_event_link_status
 from public.calendar_hotel_links hotel_record
 join public.calendar_connections connection_record on connection_record.company_id=hotel_record.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED'
 join public.calendar_connection_credentials credential_record on credential_record.company_id=connection_record.company_id and credential_record.id=connection_record.active_credential_id and credential_record.lifecycle='ACTIVE'
 left join public.calendar_event_links event_record on event_record.company_id=job.company_id and event_record.id=job.event_link_id
 where hotel_record.company_id=job.company_id and hotel_record.id=coalesce(job.hotel_link_id,event_record.hotel_link_id);
 if not found or current_hotel_link_generation is distinct from job.attempted_hotel_link_generation or current_hotel_link_version is distinct from job.attempted_hotel_link_version or current_credential_id is distinct from job.attempted_credential_id or current_credential_version is distinct from job.attempted_credential_version or (job.aggregate_type='HOTEL_CALENDAR' and current_hotel_link_status<>'PENDING_CREATE') or (job.aggregate_type='VISIT_EVENT' and (current_hotel_link_status<>'ACTIVE' or current_event_link_status='DISCONNECTED')) then
   update public.calendar_projection_jobs set status='SUPERSEDED',replay_requested=false,claim_token_hash=null,claim_expires_at=null,completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id;
   return query select 'STALE_RESOURCE',jsonb_build_object('jobId',job.id); return;
 end if;
 if (current_source_version is distinct from job.attempted_source_version or current_event_link_version is distinct from job.attempted_event_link_version)
    and job.aggregate_type='VISIT_EVENT' and job.create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN'
    and p_result='SUCCEEDED' and p_operation='EVENT_READ_BACK' then
   insert into public.calendar_projection_attempts(id,company_id,branch_id,job_id,attempt_number,operation,result,completed_at) values(gen_random_uuid(),job.company_id,job.branch_id,job.id,job.attempt_count,p_operation,p_result,statement_timestamp());
   update public.calendar_event_links set applied_source_version=job.attempted_source_version,applied_exists=true,status='PENDING',version=version+1,updated_at=statement_timestamp() where id=job.event_link_id and status<>'DISCONNECTED';
   update public.calendar_projection_jobs set status='SUPERSEDED',create_dispatch_state='CREATE_CONFIRMED',replay_requested=false,claim_token_hash=null,claim_expires_at=null,completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id;
   insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_connection_version,create_dispatch_state)
    select gen_random_uuid(),event_record.company_id,event_record.branch_id,'VISIT_EVENT',event_record.id,event_record.desired_source_version,connection_record.version,'CREATE_CONFIRMED'
    from public.calendar_event_links event_record join public.calendar_hotel_links hotel_record on hotel_record.company_id=event_record.company_id and hotel_record.id=event_record.hotel_link_id and hotel_record.status='ACTIVE'
    join public.calendar_connections connection_record on connection_record.company_id=hotel_record.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED'
    where event_record.company_id=job.company_id and event_record.id=job.event_link_id and event_record.status='PENDING' on conflict do nothing;
   return query select 'STALE_VERSION',jsonb_build_object('jobId',job.id,'providerOutcomeConfirmed',true); return;
 end if;
 if current_connection_version is distinct from job.attempted_connection_version or current_source_version is distinct from job.attempted_source_version or current_event_link_version is distinct from job.attempted_event_link_version then
   if job.aggregate_type='VISIT_EVENT' then
     update public.calendar_projection_jobs set status='SUPERSEDED',replay_requested=false,claim_token_hash=null,claim_expires_at=null,completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id;
     update public.calendar_event_links set status='PENDING',updated_at=statement_timestamp() where id=job.event_link_id and status<>'DISCONNECTED';
     insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_connection_version)
      select gen_random_uuid(),event_record.company_id,event_record.branch_id,'VISIT_EVENT',event_record.id,event_record.desired_source_version,connection_record.version
      from public.calendar_event_links event_record
      join public.calendar_hotel_links hotel_record on hotel_record.company_id=event_record.company_id and hotel_record.id=event_record.hotel_link_id and hotel_record.status='ACTIVE'
      join public.calendar_connections connection_record on connection_record.company_id=hotel_record.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED'
      where event_record.company_id=job.company_id and event_record.id=job.event_link_id and event_record.status='PENDING'
      on conflict do nothing;
   else
     update public.calendar_projection_jobs set status='PENDING',replay_requested=false,claim_token_hash=null,claim_expires_at=null,available_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id;
   end if;
   return query select 'STALE_VERSION',jsonb_build_object('jobId',job.id); return;
 end if;
 if p_result='PREFLIGHT' then
   update public.calendar_projection_jobs set claim_expires_at=statement_timestamp()+interval '2 minutes',updated_at=statement_timestamp() where id=job.id;
   return query select 'READY',jsonb_build_object('jobId',job.id,'claimExpiresAt',statement_timestamp()+interval '2 minutes'); return;
 end if;
 if p_operation in ('CALENDAR_CREATE','EVENT_CREATE') and job.create_dispatch_state<>'CREATE_DISPATCHED_OUTCOME_UNKNOWN' then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
 insert into public.calendar_projection_attempts(id,company_id,branch_id,job_id,attempt_number,operation,result,safe_error_code,completed_at) values(gen_random_uuid(),job.company_id,job.branch_id,job.id,job.attempt_count,p_operation,p_result,p_safe_error_code,statement_timestamp());
 if p_result='SUCCEEDED' then
   if job.aggregate_type='HOTEL_CALENDAR' then
     select * into link from public.calendar_hotel_links where id=job.hotel_link_id for update;
     if p_calendar_ciphertext is null or octet_length(p_calendar_iv)<>12 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
     update public.calendar_hotel_links set status='ACTIVE',calendar_id_ciphertext=p_calendar_ciphertext,calendar_id_iv=p_calendar_iv,calendar_id_key_version=p_calendar_key_version,catch_up_cutoff=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where id=link.id;
     insert into public.calendar_catch_up_items(id,company_id,branch_id,hotel_link_id,visit_id,source_version)
       select gen_random_uuid(),v.company_id,v.branch_id,link.id,v.id,v.version
       from public.hotel_repair_visits v
       where v.company_id=job.company_id and v.branch_id=job.branch_id and v.status='SCHEDULED' and v.ends_at>=statement_timestamp()
       on conflict do nothing;
     insert into public.calendar_event_links(id,company_id,branch_id,hotel_link_id,visit_id,generation,stable_event_id,marker_key_version,desired_source_version,status)
       select gen_random_uuid(),item.company_id,item.branch_id,item.hotel_link_id,item.visit_id,link.generation,'ca'||substring(encode(pg_catalog.sha256(pg_catalog.convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex') from 1 for 40),(select crypto_settings.current_hmac_key_version from public.calendar_crypto_settings crypto_settings where crypto_settings.singleton),item.source_version,'PENDING'
       from public.calendar_catch_up_items item
       where item.company_id=job.company_id and item.branch_id=job.branch_id and item.hotel_link_id=link.id
       on conflict(company_id,branch_id,hotel_link_id,visit_id) do update
         set desired_source_version=greatest(public.calendar_event_links.desired_source_version,excluded.desired_source_version),
             status=case when public.calendar_event_links.status='DISCONNECTED' then public.calendar_event_links.status else 'PENDING' end,
             version=public.calendar_event_links.version+1,updated_at=statement_timestamp();
     insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_connection_version)
       select gen_random_uuid(),event_record.company_id,event_record.branch_id,'VISIT_EVENT',event_record.id,event_record.desired_source_version,link.connection_version
       from public.calendar_event_links event_record
       where event_record.company_id=job.company_id and event_record.branch_id=job.branch_id and event_record.hotel_link_id=link.id and event_record.status='PENDING'
       on conflict do nothing;
       update public.calendar_sync_failures set status='RESOLVED',resolved_at=statement_timestamp(),version=version+1 where company_id=job.company_id and hotel_link_id=link.id and status='RETRY_REQUESTED';
       else
       select * into event_link from public.calendar_event_links where id=job.event_link_id for update;
       update public.calendar_event_links set applied_source_version=least(coalesce(p_applied_source_version,event_link.desired_source_version),event_link.desired_source_version),applied_exists=p_operation not in ('EVENT_DELETE','NO_OP'),status=case when desired_source_version<=coalesce(p_applied_source_version,desired_source_version) then 'SYNCED' else 'PENDING' end,version=version+1,updated_at=statement_timestamp() where id=event_link.id;
       update public.calendar_sync_failures set status='RESOLVED',resolved_at=statement_timestamp(),version=version+1 where company_id=job.company_id and event_link_id=event_link.id and status='RETRY_REQUESTED';
       end if;
   update public.calendar_projection_jobs set status='SUCCEEDED',create_dispatch_state=case when create_dispatch_state='CREATE_DISPATCHED_OUTCOME_UNKNOWN' then 'CREATE_CONFIRMED' else create_dispatch_state end,replay_requested=false,claim_token_hash=null,claim_expires_at=null,completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id; next_status:='SUCCEEDED';
 elsif job.replay_requested then update public.calendar_projection_jobs set status='SUPERSEDED',replay_requested=false,claim_token_hash=null,claim_expires_at=null,last_error_code=p_safe_error_code,completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id; next_status:='SUPERSEDED';
 elsif p_result='RETRYABLE' and job.attempt_count<8 then update public.calendar_projection_jobs set status='FAILED',available_at=coalesce(p_retry_at,statement_timestamp()+interval '30 seconds'),claim_token_hash=null,claim_expires_at=null,last_error_code=p_safe_error_code,updated_at=statement_timestamp() where id=job.id; next_status:='RETRY';
 elsif p_result='SUPERSEDED' then update public.calendar_projection_jobs set status='SUPERSEDED',claim_token_hash=null,claim_expires_at=null,completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id; next_status:='SUPERSEDED';
 else update public.calendar_projection_jobs set status='DEAD_LETTER',claim_token_hash=null,claim_expires_at=null,last_error_code=coalesce(p_safe_error_code,'PROVIDER_ACTION_REQUIRED'),completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=job.id; insert into public.calendar_sync_failures(id,company_id,branch_id,job_id,hotel_link_id,event_link_id,failure_code) values(gen_random_uuid(),job.company_id,job.branch_id,job.id,job.hotel_link_id,job.event_link_id,coalesce(p_safe_error_code,'PROVIDER_ACTION_REQUIRED')); if job.hotel_link_id is not null then update public.calendar_hotel_links set status='ACTION_REQUIRED',updated_at=statement_timestamp() where id=job.hotel_link_id; else update public.calendar_event_links set status='ACTION_REQUIRED',updated_at=statement_timestamp() where id=job.event_link_id; end if; next_status:='ACTION_REQUIRED'; end if;
 if job.replay_requested and job.aggregate_type='VISIT_EVENT' then
   update public.calendar_event_links set status='PENDING',updated_at=statement_timestamp() where id=job.event_link_id and status<>'DISCONNECTED';
   insert into public.calendar_projection_jobs(id,company_id,branch_id,aggregate_type,event_link_id,attempted_source_version,attempted_connection_version)
    select gen_random_uuid(),event_record.company_id,event_record.branch_id,'VISIT_EVENT',event_record.id,event_record.desired_source_version,connection_record.version
    from public.calendar_event_links event_record
    join public.calendar_hotel_links hotel_record on hotel_record.company_id=event_record.company_id and hotel_record.id=event_record.hotel_link_id and hotel_record.status='ACTIVE'
    join public.calendar_connections connection_record on connection_record.company_id=hotel_record.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED'
    where event_record.company_id=job.company_id and event_record.id=job.event_link_id and event_record.status='PENDING'
    on conflict do nothing;
 end if;
 return query select next_status,jsonb_build_object('jobId',job.id,'status',next_status);
end $function$;
revoke all on function public.calendar_projection_finalize_v1(uuid,uuid,bytea,text,text,text,timestamptz,bytea,bytea,integer,integer) from public;

create function public.calendar_projection_evidence_read_v1(p_company_id uuid,p_mode text,p_state_hash bytea,p_visit_id uuid,p_expected_source_version integer,p_excluded_job_id uuid,p_not_before timestamptz)
returns table(command_status text,result_snapshot jsonb)
language plpgsql volatile security definer set search_path=pg_catalog as $function$
declare evidence jsonb;
begin
  if not public.runtime_has_capability('RECONCILER') or public.reconciler_current_company_id()<>p_company_id then
    return query select 'FORBIDDEN',null::jsonb; return;
  end if;
  if p_mode='OAUTH_REPLAY_ABSENT' then
    if octet_length(p_state_hash)<>32 then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
    if exists(select 1 from public.calendar_oauth_transactions where company_id=p_company_id and state_hash=p_state_hash) then
      return query select 'EVIDENCE_NOT_READY',null::jsonb; return;
    end if;
    return query select 'OK',jsonb_build_object('oauthReplayAbsent',true); return;
  end if;
  if p_mode='EVENT_BASELINE' then
    if p_visit_id is null then return query select 'VALIDATION_ERROR',null::jsonb; return; end if;
    select jsonb_build_object('baselineJobId',job.id,'sourceVersion',event_record.desired_source_version)
      into evidence
      from public.calendar_event_links event_record
      join public.calendar_hotel_links hotel_record on hotel_record.company_id=event_record.company_id and hotel_record.id=event_record.hotel_link_id and hotel_record.status='ACTIVE' and hotel_record.generation=event_record.generation
      left join lateral (
        select candidate_job.id
        from public.calendar_projection_jobs candidate_job
        where candidate_job.company_id=event_record.company_id and candidate_job.event_link_id=event_record.id
        order by candidate_job.created_at desc,candidate_job.id desc
        limit 1
      ) job on true
      where event_record.company_id=p_company_id and event_record.visit_id=p_visit_id;
    return query select 'OK',coalesce(evidence,jsonb_build_object('baselineJobId',null)); return;
  end if;
  if p_mode<>'EVENT_FINAL' or p_visit_id is null or p_expected_source_version is null or p_expected_source_version<1 or p_not_before is null then
    return query select 'VALIDATION_ERROR',null::jsonb; return;
  end if;
  select jsonb_build_object('eventJobId',job.id,'hotelId',event_record.branch_id,'sourceVersion',event_record.desired_source_version,'hotelGeneration',hotel_record.generation,'eventLinkVersion',event_record.version,'connectionVersion',connection_record.version,'credentialVersion',credential_record.credential_version)
    into evidence
    from public.calendar_event_links event_record
    join public.calendar_projection_jobs job on job.company_id=event_record.company_id and job.event_link_id=event_record.id and job.status='SUCCEEDED' and job.id is distinct from p_excluded_job_id and job.created_at>=p_not_before and job.completed_at>=p_not_before and job.attempted_source_version=p_expected_source_version
    join public.calendar_hotel_links hotel_record on hotel_record.company_id=event_record.company_id and hotel_record.id=event_record.hotel_link_id and hotel_record.status='ACTIVE' and hotel_record.generation=event_record.generation and job.attempted_hotel_link_generation=hotel_record.generation and job.attempted_hotel_link_version=hotel_record.version
    join public.calendar_connections connection_record on connection_record.company_id=hotel_record.company_id and connection_record.id=hotel_record.connection_id and connection_record.status='CONNECTED' and connection_record.version=job.attempted_connection_version
    join public.calendar_connection_credentials credential_record on credential_record.company_id=connection_record.company_id and credential_record.id=connection_record.active_credential_id and credential_record.lifecycle='ACTIVE' and credential_record.id=job.attempted_credential_id and credential_record.credential_version=job.attempted_credential_version
    where event_record.company_id=p_company_id and event_record.visit_id=p_visit_id and event_record.status='SYNCED' and event_record.applied_exists and event_record.desired_source_version=p_expected_source_version and event_record.applied_source_version=p_expected_source_version and job.attempted_event_link_version+1=event_record.version
    order by job.completed_at desc limit 1;
  if evidence is null then return query select 'EVIDENCE_NOT_READY',null::jsonb; return; end if;
  return query select 'OK',evidence;
end $function$;
revoke all on function public.calendar_projection_evidence_read_v1(uuid,text,bytea,uuid,integer,uuid,timestamptz) from public;

create or replace function public.repair_snapshot_v1(p_company_id uuid,p_branch_id uuid,p_repair_id uuid,p_show_contact boolean) returns jsonb language sql stable set search_path=pg_catalog as $function$
 select jsonb_build_object(
  'id',c.id,'hotelId',c.branch_id,'status',c.status,'version',c.version,
  'target',jsonb_build_object('type',c.target_type,'id',coalesce(c.room_id,c.common_area_id,c.facility_id),'name',c.target_name_snapshot,'facilityTypeName',c.facility_type_name_snapshot,'locationName',c.location_name_snapshot),
  'priority',jsonb_build_object('id',c.priority_id,'version',c.priority_version_snapshot,'name',c.priority_name_snapshot,'sortOrder',c.priority_sort_order_snapshot,'color',c.priority_color_snapshot),
  'source',case when c.source_type='INSPECTION' then jsonb_build_object('type','INSPECTION','inspectionId',c.inspection_id,'executionTargetId',c.inspection_execution_target_id,'itemSnapshotId',c.inspection_item_snapshot_id,'resultId',c.inspection_result_id,'resultVersion',c.inspection_result_version) else jsonb_build_object('type','DIRECT','description',c.defect_description,'fileVersionIds',to_jsonb(c.defect_file_version_ids),'unavailableReason',c.defect_unavailable_reason) end,
  'process',jsonb_build_object('executionId',p.id,'version',p.version,'state',p.state,'currentStageName',p.current_stage_name),
  'visits',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'repairCaseId',v.repair_case_id,'title',v.title,'startsAt',to_char(v.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'endsAt',to_char(v.ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status',v.status,'version',v.version,'performer',case when pf.performer_type='INTERNAL' then jsonb_build_object('type','INTERNAL','userId',pf.internal_user_id) else jsonb_build_object('type','EXTERNAL','contractorName',pf.contractor_name,'contactName',case when p_show_contact then pf.contact_name else null end,'contactPhone',case when p_show_contact then pf.contact_phone else regexp_replace(pf.contact_phone,'.(?=.{2})','*','g') end) end,'result',v.result,'unavailableReason',v.completion_unavailable_reason,'fileVersionIds',to_jsonb(v.completion_file_version_ids),'calendarProjectionStatus',public.calendar_visit_projection_status_v1(v.company_id,v.branch_id,v.id)) order by v.starts_at,v.id) from public.hotel_repair_visits v join public.hotel_repair_visit_performers pf on pf.company_id=v.company_id and pf.branch_id=v.branch_id and pf.repair_visit_id=v.id where v.company_id=c.company_id and v.branch_id=c.branch_id and v.repair_case_id=c.id),'[]'::jsonb),
  'predecessor',(select jsonb_build_object('id',parent.id,'targetName',parent.target_name_snapshot,'completedAt',to_char(parent.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) from public.hotel_repair_cases parent where parent.company_id=c.company_id and parent.branch_id=c.branch_id and parent.id=c.follow_up_of_repair_case_id),
  'followUpCount',(select count(*) from public.hotel_repair_cases child where child.company_id=c.company_id and child.branch_id=c.branch_id and child.follow_up_of_repair_case_id=c.id),
  'calendarProjectionStatus',public.calendar_repair_projection_status_v1(c.company_id,c.branch_id,c.id),'createdAt',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(c.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ) from public.hotel_repair_cases c join public.process_executions p on p.company_id=c.company_id and p.id=c.process_execution_id where c.company_id=p_company_id and c.branch_id=p_branch_id and c.id=p_repair_id
$function$;
revoke all on function public.repair_snapshot_v1(uuid,uuid,uuid,boolean) from public;

create or replace function public.hotel_calendar_events_read_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_query jsonb,
  p_session_token text
)
returns table(command_status text, result_snapshot jsonb)
language plpgsql volatile security definer set search_path = pg_catalog
as $function$
declare
  v_actor record;
  v_from date;
  v_to date;
  v_page_size integer;
  v_cursor jsonb;
  v_all jsonb;
  v_page jsonb;
  v_visible_page jsonb;
  v_last jsonb;
  v_next_cursor text;
  v_hotels jsonb;
  v_can_all boolean;
  v_can_create boolean;
  v_more boolean;
  v_density integer;
begin
  select * into v_actor
    from public.hotel_calendar_actor_v1(p_company_id, p_session_token);
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  begin
    v_from := (p_query ->> 'from')::date;
    v_to := (p_query ->> 'to')::date;
    v_page_size := coalesce((p_query ->> 'pageSize')::integer, 200);
  exception when others then
    return query select 'CALENDAR_RANGE_INVALID'::text, null::jsonb;
    return;
  end;
  if v_to <= v_from then
    return query select 'CALENDAR_RANGE_INVALID'::text, null::jsonb;
    return;
  end if;
  if v_to - v_from > 42 then
    return query select 'CALENDAR_RANGE_TOO_LARGE'::text, null::jsonb;
    return;
  end if;
  if v_page_size < 1 or v_page_size > 200 then
    return query select 'VALIDATION_ERROR'::text, null::jsonb;
    return;
  end if;

  if nullif(p_query ->> 'cursor', '') is not null then
    begin
      v_cursor := pg_catalog.convert_from(
        pg_catalog.decode(p_query ->> 'cursor', 'hex'), 'UTF8'
      )::jsonb;
      perform (v_cursor ->> 'startsAt')::timestamptz;
      perform (v_cursor ->> 'id')::uuid;
      if v_cursor ->> 'type' not in ('INSPECTION', 'REPAIR_VISIT') then
        raise invalid_text_representation;
      end if;
    exception when others then
      return query select 'CALENDAR_CURSOR_INVALID'::text, null::jsonb;
      return;
    end;
  end if;

  v_can_all := v_actor.user_type = 'INTERNAL_STAFF'
    and public.hotel_calendar_permission_allowed_v1(
      p_company_id, null, v_actor.user_id, 'HOTEL_CALENDAR_ALL_READ'
    );
  if p_branch_id is null and not v_can_all then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.hotel_calendar_accessible_hotels_v1(
      p_company_id, v_actor.user_id, v_actor.user_type
    ) hotel where hotel.branch_id = p_branch_id
  ) then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  select pg_catalog.count(*) into v_density
    from (
      select inspection.id
        from public.hotel_inspections inspection
       where inspection.company_id = p_company_id
         and (p_branch_id is null or inspection.branch_id = p_branch_id)
         and inspection.business_date >= v_from
         and inspection.business_date < v_to
         and exists (
           select 1 from public.hotel_calendar_accessible_hotels_v1(
             p_company_id, v_actor.user_id, v_actor.user_type
           ) hotel where hotel.branch_id = inspection.branch_id
         )
         and public.hotel_calendar_permission_allowed_v1(
           p_company_id, inspection.branch_id, v_actor.user_id, 'HOTEL_INSPECTION_RUN'
         )
      union all
      select visit.id
        from public.hotel_repair_visits visit
       where visit.company_id = p_company_id
         and (p_branch_id is null or visit.branch_id = p_branch_id)
         and visit.status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')
         and visit.starts_at < (v_to::timestamp at time zone 'Asia/Seoul')
         and visit.ends_at > (v_from::timestamp at time zone 'Asia/Seoul')
         and exists (
           select 1 from public.hotel_calendar_accessible_hotels_v1(
             p_company_id, v_actor.user_id, v_actor.user_type
           ) hotel where hotel.branch_id = visit.branch_id
         )
         and public.hotel_calendar_permission_allowed_v1(
           p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_READ'
         )
         and (
           visit.status <> 'CANCELLED'
           or public.hotel_calendar_permission_allowed_v1(
             p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_CANCELLED_READ'
           )
         )
         and (
           v_actor.user_type = 'INTERNAL_STAFF'
           or exists (
             select 1 from public.hotel_repair_visit_performers performer
              where performer.company_id = visit.company_id
                and performer.branch_id = visit.branch_id
                and performer.repair_visit_id = visit.id
                and performer.performer_type = 'INTERNAL'
                and performer.internal_user_id = v_actor.user_id
           )
         )
       limit 5001
    ) bounded_candidates;
  if v_density > 5000 then
    return query select 'CALENDAR_RESULT_TOO_DENSE'::text, null::jsonb;
    return;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    event_record.event_json
    order by event_record.sort_at, event_record.event_type, event_record.event_id
  ), '[]'::jsonb)
  into v_all
  from (
    select inspection.due_at as sort_at,
           'INSPECTION'::text as event_type,
           inspection.id as event_id,
           pg_catalog.jsonb_build_object(
             'id', inspection.id,
             'type', 'INSPECTION',
             'hotelId', inspection.branch_id,
             'hotelName', branch_record.name,
             'title', '점검 마감',
             'businessDate', inspection.business_date,
             'startsAt', pg_catalog.to_char(inspection.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'endsAt', null,
             'status', inspection.status,
             'targetSummary', pg_catalog.concat(
               (select pg_catalog.count(*) from public.inspection_execution_targets target
                 where target.company_id = inspection.company_id
                   and target.branch_id = inspection.branch_id
                   and target.execution_id = inspection.id), '개 대상'
             ),
             'detailHref', '/hotels/' || inspection.branch_id::text || '/inspections'
           ) as event_json
      from public.hotel_inspections inspection
      join public.branches branch_record
        on branch_record.company_id = inspection.company_id
       and branch_record.id = inspection.branch_id
     where inspection.company_id = p_company_id
       and (p_branch_id is null or inspection.branch_id = p_branch_id)
       and inspection.business_date >= v_from
       and inspection.business_date < v_to
       and exists (
         select 1 from public.hotel_calendar_accessible_hotels_v1(
           p_company_id, v_actor.user_id, v_actor.user_type
         ) hotel where hotel.branch_id = inspection.branch_id
       )
       and public.hotel_calendar_permission_allowed_v1(
         p_company_id, inspection.branch_id, v_actor.user_id, 'HOTEL_INSPECTION_RUN'
       )
    union all
    select visit.starts_at as sort_at,
           'REPAIR_VISIT'::text as event_type,
           visit.id as event_id,
           pg_catalog.jsonb_build_object(
             'id', visit.id,
             'type', 'REPAIR_VISIT',
             'hotelId', visit.branch_id,
             'hotelName', branch_record.name,
             'title', visit.title,
             'startsAt', pg_catalog.to_char(visit.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'endsAt', pg_catalog.to_char(visit.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'status', visit.status,
             'targetSummary', repair.target_name_snapshot,
             'priority', pg_catalog.jsonb_build_object(
               'name', repair.priority_name_snapshot,
               'color', repair.priority_color_snapshot
             ),
             'calendarProjectionStatus', public.calendar_visit_projection_status_v1(visit.company_id, visit.branch_id, visit.id),
             'cancellationReason', case
               when visit.status = 'CANCELLED'
                and public.hotel_calendar_permission_allowed_v1(
                  p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_CANCEL_REASON_READ'
                ) then visit.cancel_reason
               else null
             end,
             'canUpdate',
               v_actor.user_type = 'INTERNAL_STAFF'
               and public.hotel_calendar_permission_allowed_v1(
                 p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_UPDATE'
               ),
             'detailHref', '/hotels/' || visit.branch_id::text || '/repairs'
           ) as event_json
      from public.hotel_repair_visits visit
      join public.hotel_repair_cases repair
        on repair.company_id = visit.company_id
       and repair.branch_id = visit.branch_id
       and repair.id = visit.repair_case_id
      join public.branches branch_record
        on branch_record.company_id = visit.company_id
       and branch_record.id = visit.branch_id
     where visit.company_id = p_company_id
       and (p_branch_id is null or visit.branch_id = p_branch_id)
       and visit.status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')
       and visit.starts_at < (v_to::timestamp at time zone 'Asia/Seoul')
       and visit.ends_at > (v_from::timestamp at time zone 'Asia/Seoul')
       and exists (
         select 1 from public.hotel_calendar_accessible_hotels_v1(
           p_company_id, v_actor.user_id, v_actor.user_type
         ) hotel where hotel.branch_id = visit.branch_id
       )
       and public.hotel_calendar_permission_allowed_v1(
         p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_READ'
       )
       and (
         visit.status <> 'CANCELLED'
         or public.hotel_calendar_permission_allowed_v1(
           p_company_id, visit.branch_id, v_actor.user_id, 'REPAIR_VISIT_CANCELLED_READ'
         )
       )
       and (
         v_actor.user_type = 'INTERNAL_STAFF'
         or exists (
           select 1 from public.hotel_repair_visit_performers performer
            where performer.company_id = visit.company_id
              and performer.branch_id = visit.branch_id
              and performer.repair_visit_id = visit.id
              and performer.performer_type = 'INTERNAL'
              and performer.internal_user_id = v_actor.user_id
         )
       )
  ) event_record;

  select coalesce(pg_catalog.jsonb_agg(filtered.event order by filtered.ordinality), '[]'::jsonb)
    into v_page
    from (
      select item.value as event, item.ordinality
        from pg_catalog.jsonb_array_elements(v_all) with ordinality item(value, ordinality)
       where v_cursor is null
          or (
            (item.value ->> 'startsAt')::timestamptz,
            item.value ->> 'type',
            (item.value ->> 'id')::uuid
          ) > (
            (v_cursor ->> 'startsAt')::timestamptz,
            v_cursor ->> 'type',
            (v_cursor ->> 'id')::uuid
          )
       order by (item.value ->> 'startsAt')::timestamptz,
                item.value ->> 'type',
                (item.value ->> 'id')::uuid
       limit v_page_size + 1
    ) filtered;

  v_more := pg_catalog.jsonb_array_length(v_page) > v_page_size;
  select coalesce(pg_catalog.jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
    into v_visible_page
    from pg_catalog.jsonb_array_elements(v_page) with ordinality item(value, ordinality)
   where item.ordinality <= v_page_size;
  if v_more then
    v_last := v_visible_page -> (pg_catalog.jsonb_array_length(v_visible_page) - 1);
    v_next_cursor := pg_catalog.encode(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'startsAt', v_last ->> 'startsAt',
        'type', v_last ->> 'type',
        'id', v_last ->> 'id'
      )::text, 'UTF8'
    ), 'hex');
  else
    v_next_cursor := null;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('id', hotel.branch_id, 'name', hotel.hotel_name)
    order by hotel.hotel_name, hotel.branch_id
  ), '[]'::jsonb),
  coalesce(pg_catalog.bool_or(hotel.branch_id = p_branch_id and hotel.can_create_visit), false)
  into v_hotels, v_can_create
  from public.hotel_calendar_accessible_hotels_v1(
    p_company_id, v_actor.user_id, v_actor.user_type
  ) hotel;

  return query select 'OK'::text, pg_catalog.jsonb_build_object(
    'events', v_visible_page,
    'pagination', pg_catalog.jsonb_build_object('nextCursor', v_next_cursor),
    'range', pg_catalog.jsonb_build_object(
      'from', v_from, 'to', v_to, 'timeZone', 'Asia/Seoul'
    ),
    'hotels', v_hotels,
    'capabilities', pg_catalog.jsonb_build_object(
      'canCreateVisit', case when p_branch_id is null then false else v_can_create end,
      'canViewAllHotels', v_can_all
    )
  );
end
$function$;
revoke all on function public.hotel_calendar_events_read_v1(uuid,uuid,jsonb,text) from public;

insert into public.schema_migrations(version) values('0044_google_calendar_projection') on conflict(version) do nothing;
commit;
