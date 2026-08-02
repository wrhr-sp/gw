begin;

create table process_definitions (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid,
  application_type text not null check (application_type = 'ROOM_INSPECTION'),
  scope text not null check (scope in ('COMPANY', 'HOTEL')),
  name text not null check (btrim(name) <> '' and char_length(name) <= 100),
  current_revision_id uuid,
  version integer not null default 1 check (version >= 1),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, created_by) references users(company_id, id),
  foreign key (company_id, updated_by) references users(company_id, id),
  check ((scope = 'COMPANY' and branch_id is null) or (scope = 'HOTEL' and branch_id is not null))
);

create table process_definition_revisions (
  id uuid primary key,
  company_id uuid not null,
  definition_id uuid not null,
  version integer not null check (version >= 1),
  start_stage_key text not null check (start_stage_key ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, definition_id, version),
  foreign key (company_id, definition_id) references process_definitions(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id)
);

alter table process_definitions
  add constraint process_definitions_current_revision_fk
  foreign key (company_id, current_revision_id)
  references process_definition_revisions(company_id, id)
  deferrable initially deferred;

create table process_stage_snapshots (
  id uuid primary key,
  company_id uuid not null,
  revision_id uuid not null,
  stage_key text not null check (stage_key ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  stage_name text not null check (btrim(stage_name) <> '' and char_length(stage_name) <= 100),
  reviewer_user_id uuid not null,
  delegate_user_id uuid,
  delegate_starts_at timestamptz,
  delegate_ends_at timestamptz,
  due_amount integer check (due_amount between 1 and 365),
  due_unit text check (due_unit in ('HOURS', 'DAYS')),
  is_final boolean not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, stage_key),
  foreign key (company_id, revision_id) references process_definition_revisions(company_id, id),
  foreign key (company_id, reviewer_user_id) references users(company_id, id),
  foreign key (company_id, delegate_user_id) references users(company_id, id),
  check ((delegate_user_id is null and delegate_starts_at is null and delegate_ends_at is null)
      or (delegate_user_id is not null and delegate_starts_at is not null
          and (delegate_ends_at is null or delegate_ends_at > delegate_starts_at))),
  check ((due_amount is null and due_unit is null) or (due_amount is not null and due_unit is not null))
);

create unique index process_stage_snapshots_one_final_idx
  on process_stage_snapshots (company_id, revision_id)
  where is_final;

create table process_transition_snapshots (
  id uuid primary key,
  company_id uuid not null,
  revision_id uuid not null,
  from_stage_key text not null,
  event text not null check (event in ('APPROVE', 'SELECT')),
  choice_value text,
  to_stage_key text not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique nulls not distinct (company_id, revision_id, from_stage_key, event, choice_value),
  foreign key (company_id, revision_id, from_stage_key)
    references process_stage_snapshots(company_id, revision_id, stage_key),
  foreign key (company_id, revision_id, to_stage_key)
    references process_stage_snapshots(company_id, revision_id, stage_key),
  check (from_stage_key <> to_stage_key),
  check ((event = 'SELECT' and btrim(choice_value) <> '') or (event = 'APPROVE' and choice_value is null))
);

create table hotel_process_defaults (
  company_id uuid not null,
  branch_id uuid not null,
  application_type text not null check (application_type = 'ROOM_INSPECTION'),
  definition_id uuid not null,
  revision_id uuid not null,
  version integer not null default 1 check (version >= 1),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, branch_id, application_type),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, definition_id) references process_definitions(company_id, id),
  foreign key (company_id, revision_id) references process_definition_revisions(company_id, id),
  foreign key (company_id, updated_by) references users(company_id, id)
);

create table inspection_checklist_revisions (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  version integer not null check (version >= 1),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, branch_id, version),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, created_by) references users(company_id, id)
);

create table inspection_checklist_items (
  id uuid primary key,
  company_id uuid not null,
  revision_id uuid not null,
  source_item_id uuid not null,
  source text not null check (source in ('HOTEL_COMMON', 'ROOM_TYPE_ADDED')),
  room_type_id uuid,
  name text not null check (btrim(name) <> '' and char_length(name) <= 150),
  description text check (description is null or char_length(btrim(description)) between 1 and 1000),
  is_required boolean not null,
  display_order integer not null check (display_order between 0 and 100000),
  default_severity text not null check (default_severity in ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL')),
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, source_item_id),
  foreign key (company_id, revision_id) references inspection_checklist_revisions(company_id, id),
  foreign key (company_id, room_type_id) references hotel_room_types(company_id, id),
  check ((source = 'HOTEL_COMMON' and room_type_id is null)
      or (source = 'ROOM_TYPE_ADDED' and room_type_id is not null))
);

create table inspection_checklist_item_exclusions (
  id uuid primary key,
  company_id uuid not null,
  revision_id uuid not null,
  checklist_item_id uuid not null,
  room_type_id uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, checklist_item_id, room_type_id),
  foreign key (company_id, revision_id) references inspection_checklist_revisions(company_id, id),
  foreign key (company_id, checklist_item_id) references inspection_checklist_items(company_id, id),
  foreign key (company_id, room_type_id) references hotel_room_types(company_id, id)
);

create table inspection_routines (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  name text not null check (btrim(name) <> '' and char_length(name) <= 100),
  status text not null check (status in ('ACTIVE', 'INACTIVE')),
  current_revision_id uuid,
  version integer not null default 1 check (version >= 1),
  next_due_date date,
  materialized_through_date date,
  claim_token_hash bytea,
  claim_generation bigint not null default 0 check (claim_generation >= 0),
  claim_expires_at timestamptz,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, branch_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, created_by) references users(company_id, id),
  foreign key (company_id, updated_by) references users(company_id, id),
  check ((claim_token_hash is null and claim_expires_at is null)
      or (octet_length(claim_token_hash) = 32 and claim_expires_at is not null))
);

create table inspection_routine_revisions (
  id uuid primary key,
  company_id uuid not null,
  routine_id uuid not null,
  version integer not null check (version >= 1),
  mode text not null check (mode in ('FIXED', 'ROTATING')),
  recurrence_type text not null check (recurrence_type in ('DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL_DAYS', 'INTERVAL_WEEKS', 'INTERVAL_MONTHS')),
  day_of_week text check (day_of_week in ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
  day_of_month integer check (day_of_month between 1 and 31),
  recurrence_interval integer check (recurrence_interval between 1 and 365),
  start_date date not null,
  end_date date,
  local_due_time time not null,
  process_definition_id uuid,
  process_revision_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, routine_id, version),
  foreign key (company_id, routine_id) references inspection_routines(company_id, id),
  foreign key (company_id, process_definition_id) references process_definitions(company_id, id),
  foreign key (company_id, process_revision_id) references process_definition_revisions(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  check (end_date is null or end_date >= start_date),
  check ((recurrence_type = 'WEEKLY') = (day_of_week is not null)),
  check ((recurrence_type = 'MONTHLY') = (day_of_month is not null)),
  check ((recurrence_type like 'INTERVAL_%') = (recurrence_interval is not null))
);

alter table inspection_routines
  add constraint inspection_routines_current_revision_fk
  foreign key (company_id, current_revision_id)
  references inspection_routine_revisions(company_id, id)
  deferrable initially deferred;

create table inspection_routine_rounds (
  id uuid primary key,
  company_id uuid not null,
  revision_id uuid not null,
  round_order integer not null check (round_order between 1 and 100),
  target_type text not null check (target_type in ('HOTEL', 'FLOOR', 'ROOM_TYPE', 'ROOMS')),
  target_value jsonb not null check (jsonb_typeof(target_value) = 'object'),
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, round_order),
  foreign key (company_id, revision_id) references inspection_routine_revisions(company_id, id)
);

create table process_executions (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  application_type text not null check (application_type = 'ROOM_INSPECTION'),
  resource_id uuid not null,
  definition_id uuid not null,
  revision_id uuid not null,
  state text not null check (state in ('PENDING_INPUT', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED')),
  current_stage_key text,
  current_stage_name text,
  current_reviewer_user_id uuid,
  current_delegate_user_id uuid,
  current_due_at timestamptz,
  version integer not null default 1 check (version >= 1),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, application_type, resource_id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, definition_id) references process_definitions(company_id, id),
  foreign key (company_id, revision_id) references process_definition_revisions(company_id, id),
  foreign key (company_id, current_reviewer_user_id) references users(company_id, id),
  foreign key (company_id, current_delegate_user_id) references users(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  check ((state = 'PENDING_INPUT' and current_stage_key is null and completed_at is null)
      or (state = 'IN_REVIEW' and current_stage_key is not null and current_reviewer_user_id is not null and completed_at is null)
      or (state in ('COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED') and completed_at is not null))
);

create table hotel_inspections (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  source text not null check (source in ('MANUAL', 'ROUTINE')),
  routine_id uuid,
  routine_revision_id uuid,
  routine_round_order integer,
  business_date date not null,
  due_at timestamptz not null,
  status text not null check (status in ('PENDING_INPUT', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED')),
  process_execution_id uuid not null,
  version integer not null default 1 check (version >= 1),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, branch_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, routine_id) references inspection_routines(company_id, id),
  foreign key (company_id, routine_revision_id) references inspection_routine_revisions(company_id, id),
  foreign key (company_id, process_execution_id) references process_executions(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  check ((source = 'MANUAL' and routine_id is null and routine_revision_id is null and routine_round_order is null)
      or (source = 'ROUTINE' and routine_id is not null and routine_revision_id is not null and routine_round_order is not null))
);

create unique index hotel_inspections_routine_occurrence_idx
  on hotel_inspections (company_id, routine_id, business_date, routine_round_order)
  where source = 'ROUTINE';

create table inspection_item_snapshots (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  inspection_id uuid not null,
  room_id uuid not null,
  source_item_id uuid not null,
  checklist_revision_id uuid not null,
  name text not null,
  description text,
  is_required boolean not null,
  display_order integer not null,
  default_severity text not null check (default_severity in ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL')),
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, inspection_id, room_id, source_item_id),
  foreign key (company_id, branch_id, inspection_id) references hotel_inspections(company_id, branch_id, id),
  foreign key (company_id, branch_id, room_id) references hotel_rooms(company_id, branch_id, id),
  foreign key (company_id, checklist_revision_id) references inspection_checklist_revisions(company_id, id)
);

create table inspection_item_results (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  inspection_id uuid not null,
  item_snapshot_id uuid not null,
  result text not null check (result in ('NORMAL', 'CAUTION', 'ABNORMAL')),
  description text,
  severity text check (severity in ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL')),
  version integer not null default 1 check (version >= 1),
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, inspection_id, item_snapshot_id),
  foreign key (company_id, branch_id, inspection_id) references hotel_inspections(company_id, branch_id, id),
  foreign key (company_id, item_snapshot_id) references inspection_item_snapshots(company_id, id),
  foreign key (company_id, updated_by) references users(company_id, id),
  check ((result = 'NORMAL' and description is null and severity is null)
      or (result = 'CAUTION' and char_length(btrim(description)) between 2 and 2000 and severity is null)
      or (result = 'ABNORMAL' and char_length(btrim(description)) between 2 and 2000 and severity is not null))
);

create table inspection_item_result_history (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  inspection_id uuid not null,
  item_snapshot_id uuid not null,
  result_id uuid not null,
  version integer not null,
  result text not null check (result in ('NORMAL', 'CAUTION', 'ABNORMAL')),
  description text,
  severity text,
  file_version_ids uuid[] not null default '{}',
  change_reason text not null check (char_length(btrim(change_reason)) between 2 and 500),
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, result_id, version),
  foreign key (company_id, result_id) references inspection_item_results(company_id, id),
  foreign key (company_id, changed_by) references users(company_id, id)
);

create table process_execution_history (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  execution_id uuid not null,
  previous_state text not null,
  next_state text not null,
  previous_stage_key text,
  next_stage_key text,
  event text not null check (event in ('SUBMIT', 'APPROVE', 'REJECT', 'SELECT', 'CANCEL', 'UNFINISHED_CLOSE')),
  choice_value text,
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, execution_id) references process_executions(company_id, id),
  foreign key (company_id, actor_user_id) references users(company_id, id)
);

create table hotel_file_uploads (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  parent_type text not null check (parent_type = 'INSPECTION_ITEM_EVIDENCE'),
  inspection_id uuid not null,
  item_snapshot_id uuid not null,
  display_name text not null check (btrim(display_name) <> ''),
  declared_mime text not null check (declared_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  reserved_size bigint not null check (reserved_size between 1 and 20971520),
  quarantine_object_key text not null unique check (btrim(quarantine_object_key) <> ''),
  reservation_fingerprint text not null check (btrim(reservation_fingerprint) <> ''),
  status text not null check (status in ('PENDING_UPLOAD', 'QUARANTINED', 'SCANNING', 'CLEAN_PENDING_PROMOTION', 'READY_UNLINKED', 'LINKED', 'EXPIRED', 'REJECTED', 'SCAN_FAILED')),
  source_etag text,
  source_object_version text,
  failure_code text,
  initiated_by uuid not null,
  initiated_session_id uuid not null,
  expires_at timestamptz not null,
  quota_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, branch_id, inspection_id) references hotel_inspections(company_id, branch_id, id),
  foreign key (company_id, item_snapshot_id) references inspection_item_snapshots(company_id, id),
  foreign key (company_id, initiated_by) references users(company_id, id),
  foreign key (company_id, initiated_session_id) references auth_sessions(company_id, id),
  check (expires_at > created_at),
  check ((status = 'PENDING_UPLOAD' and source_etag is null)
      or (status <> 'PENDING_UPLOAD' and source_etag is not null)
      or status = 'EXPIRED')
);

create table hotel_file_scan_jobs (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  upload_id uuid not null,
  dispatch_job_id uuid not null unique,
  status text not null check (status in ('PENDING', 'CLAIMED', 'CLEAN_PENDING_PROMOTION', 'COMPLETED', 'FAILED', 'EXPIRED')),
  claim_token_hash bytea,
  claim_generation bigint not null default 0 check (claim_generation >= 0),
  claim_expires_at timestamptz,
  scanner_sha256 bytea,
  detected_mime text,
  file_version_id uuid,
  clean_object_key text,
  clean_etag text,
  clean_object_version text,
  clean_sha256 bytea,
  clean_size bigint,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  available_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, upload_id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, upload_id) references hotel_file_uploads(company_id, id),
  foreign key (dispatch_job_id) references outbox_jobs(id),
  check ((claim_token_hash is null and claim_expires_at is null)
      or (octet_length(claim_token_hash) = 32 and claim_expires_at is not null)),
  check (scanner_sha256 is null or octet_length(scanner_sha256) = 32),
  check (clean_sha256 is null or octet_length(clean_sha256) = 32),
  check ((status in ('PENDING', 'CLAIMED', 'FAILED', 'EXPIRED')
          and file_version_id is null and clean_object_key is null)
      or (status in ('CLEAN_PENDING_PROMOTION', 'COMPLETED')
          and file_version_id is not null and clean_object_key is not null))
);

create table hotel_file_versions (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  upload_id uuid not null,
  version integer not null default 1 check (version >= 1),
  clean_object_key text not null unique,
  clean_etag text not null,
  clean_object_version text not null,
  clean_sha256 bytea not null check (octet_length(clean_sha256) = 32),
  clean_size bigint not null check (clean_size between 1 and 20971520),
  detected_mime text not null check (detected_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  display_name text not null,
  exif_location_removed boolean not null check (exif_location_removed),
  original_retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, upload_id, version),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, upload_id) references hotel_file_uploads(company_id, id),
  check (original_retention_until >= created_at + interval '1 year')
);

create table hotel_file_links (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  file_version_id uuid not null,
  parent_type text not null check (parent_type = 'INSPECTION_ITEM_EVIDENCE'),
  inspection_id uuid not null,
  item_snapshot_id uuid not null,
  result_id uuid not null,
  result_version integer not null check (result_version >= 1),
  linked_by uuid not null,
  linked_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, file_version_id),
  foreign key (company_id, file_version_id) references hotel_file_versions(company_id, id),
  foreign key (company_id, result_id) references inspection_item_results(company_id, id),
  foreign key (company_id, linked_by) references users(company_id, id)
);

create table hotel_file_finalizer_capabilities (
  role_name name primary key,
  created_at timestamptz not null default now()
);
revoke all on hotel_file_finalizer_capabilities from public;

create function public.file_finalizer_has_capability()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1 from public.hotel_file_finalizer_capabilities capability
     where capability.role_name = session_user
  )
$function$;
revoke all on function public.file_finalizer_has_capability() from public;

create function public.reject_hotel_immutable_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'hotel immutable record cannot be changed' using errcode = '55000';
end
$$;
revoke all on function public.reject_hotel_immutable_change() from public;

create trigger process_definition_revisions_append_only before update or delete on process_definition_revisions for each row execute function public.reject_hotel_immutable_change();
create trigger process_stage_snapshots_append_only before update or delete on process_stage_snapshots for each row execute function public.reject_hotel_immutable_change();
create trigger process_transition_snapshots_append_only before update or delete on process_transition_snapshots for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_checklist_revisions_append_only before update or delete on inspection_checklist_revisions for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_checklist_items_append_only before update or delete on inspection_checklist_items for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_checklist_item_exclusions_append_only before update or delete on inspection_checklist_item_exclusions for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_routine_revisions_append_only before update or delete on inspection_routine_revisions for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_routine_rounds_append_only before update or delete on inspection_routine_rounds for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_item_snapshots_append_only before update or delete on inspection_item_snapshots for each row execute function public.reject_hotel_immutable_change();
create trigger inspection_item_result_history_append_only before update or delete on inspection_item_result_history for each row execute function public.reject_hotel_immutable_change();
create trigger process_execution_history_append_only before update or delete on process_execution_history for each row execute function public.reject_hotel_immutable_change();
create trigger hotel_file_versions_append_only before update or delete on hotel_file_versions for each row execute function public.reject_hotel_immutable_change();
create trigger hotel_file_links_append_only before update or delete on hotel_file_links for each row execute function public.reject_hotel_immutable_change();

-- Terminal inspection states make the current result and its evidence immutable.
create function public.guard_inspection_terminal_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_status text;
begin
  select inspection.status into v_status
    from public.hotel_inspections inspection
   where inspection.company_id = coalesce(new.company_id, old.company_id)
     and inspection.id = coalesce(new.inspection_id, old.inspection_id);
  if v_status in ('COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED') then
    raise exception 'INSPECTION_FINAL_LOCKED' using errcode = '55000';
  end if;
  return coalesce(new, old);
end
$$;
revoke all on function public.guard_inspection_terminal_mutation() from public;
create trigger inspection_item_results_terminal_guard before update or delete on inspection_item_results for each row execute function public.guard_inspection_terminal_mutation();

-- All new tenant data uses the same runtime-derived company boundary.
do $tenant_security$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'process_definitions', 'process_definition_revisions', 'process_stage_snapshots',
    'process_transition_snapshots', 'hotel_process_defaults',
    'inspection_checklist_revisions', 'inspection_checklist_items',
    'inspection_checklist_item_exclusions', 'inspection_routines',
    'inspection_routine_revisions', 'inspection_routine_rounds',
    'hotel_inspections', 'inspection_item_snapshots', 'inspection_item_results',
    'inspection_item_result_history', 'process_executions',
    'process_execution_history', 'hotel_file_uploads', 'hotel_file_scan_jobs',
    'hotel_file_versions', 'hotel_file_links'
  ] loop
    execute format('alter table %I enable row level security', tenant_table);
    execute format('alter table %I force row level security', tenant_table);
    execute format(
      'create policy %I_company_isolation on %I using (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          when not public.runtime_has_capability(''API_RUNTIME'')
            and not public.runtime_has_capability(''RECONCILER'')
            then company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid
          else false
        end
      ) with check (
        case
          when public.runtime_is_schema_owner() then true
          when current_user = ''werehere_auth_session_definer'' then true
          when current_user = ''werehere_tenant_authority_definer'' then true
          when public.runtime_has_capability(''API_RUNTIME'') then company_id = public.api_current_company_id()
          when public.runtime_has_capability(''RECONCILER'') then company_id = public.reconciler_current_company_id()
          when not public.runtime_has_capability(''API_RUNTIME'')
            and not public.runtime_has_capability(''RECONCILER'')
            then company_id = nullif(current_setting(''app.company_id'', true), '''')::uuid
          else false
        end
      )', tenant_table, tenant_table
    );
  end loop;
end
$tenant_security$;

insert into permissions (code, description) values
  ('PROCESS_DEFINITION_MANAGE', '공통·호텔 업무 프로세스 설정'),
  ('HOTEL_INSPECTION_CONFIG', '호텔 점검항목·정기루틴 설정'),
  ('HOTEL_INSPECTION_RUN', '호텔 점검 생성·현장결과 입력'),
  ('HOTEL_INSPECTION_REVIEW', '호텔 점검 단계 검토·처리'),
  ('HOTEL_FILE_UPLOAD', '호텔 자료 비공개 업로드'),
  ('HOTEL_FILE_READ', '호텔 자료 보기'),
  ('HOTEL_FILE_DOWNLOAD', '호텔 자료 다운로드')
on conflict (code) do update set description = excluded.description;

create function public.hotel_command_actor_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_session_token text,
  p_permission_code text,
  p_require_assignment boolean
)
returns table (session_id uuid, user_id uuid, user_type text)
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  with actor as (
    select session_record.id as session_id,
           app_user.id as user_id,
           app_user.user_type
      from public.auth_sessions session_record
      join public.users app_user
        on app_user.company_id = session_record.company_id
       and app_user.id = session_record.user_id
      join public.companies company_record
        on company_record.id = session_record.company_id
     where public.runtime_has_capability('API_RUNTIME')
       and p_session_token ~ '^[A-Za-z0-9_-]{43}$'
       and session_record.id = nullif(
             pg_catalog.current_setting('app.session_id', true), ''
           )::uuid
       and session_record.company_id = p_company_id
       and session_record.token_hash = pg_catalog.sha256(
             pg_catalog.convert_to(p_session_token, 'UTF8')
           )
       and session_record.revoked_at is null
       and session_record.idle_expires_at > pg_catalog.statement_timestamp()
       and session_record.absolute_expires_at > pg_catalog.statement_timestamp()
       and app_user.status = 'ACTIVE'
       and app_user.user_type = 'INTERNAL_STAFF'
       and company_record.status = 'ACTIVE'
  ), effective_subjects as (
    select 'USER'::text as subject_type, actor.user_id as subject_id from actor
    union all
    select 'ROLE', membership.role_id
      from actor
      join public.user_role_memberships membership
        on membership.company_id = p_company_id
       and membership.user_id = actor.user_id
      join public.roles role_record
        on role_record.company_id = membership.company_id
       and role_record.id = membership.role_id
     where membership.valid_from <= pg_catalog.statement_timestamp()
       and (membership.valid_until is null or membership.valid_until > pg_catalog.statement_timestamp())
       and role_record.status = 'ACTIVE'
    union all
    select 'GROUP', membership.group_id
      from actor
      join public.user_group_memberships membership
        on membership.company_id = p_company_id
       and membership.user_id = actor.user_id
      join public.user_groups group_record
        on group_record.company_id = membership.company_id
       and group_record.id = membership.group_id
     where membership.valid_from <= pg_catalog.statement_timestamp()
       and (membership.valid_until is null or membership.valid_until > pg_catalog.statement_timestamp())
       and group_record.status = 'ACTIVE'
  ), effects as (
    select grant_record.effect
      from public.permission_grants grant_record
      join effective_subjects subject_record
        on subject_record.subject_type = grant_record.subject_type
       and subject_record.subject_id = grant_record.subject_id
     where grant_record.company_id = p_company_id
       and grant_record.permission_code = p_permission_code
       and (grant_record.branch_id is null or grant_record.branch_id = p_branch_id)
       and grant_record.valid_from <= pg_catalog.statement_timestamp()
       and (grant_record.valid_until is null or grant_record.valid_until > pg_catalog.statement_timestamp())
  )
  select actor.session_id, actor.user_id, actor.user_type
    from actor
   where not exists (select 1 from effects where effect = 'DENY')
     and exists (select 1 from effects where effect = 'ALLOW')
     and (
       not p_require_assignment
       or exists (
         select 1 from public.hotel_staff_assignments assignment
          where assignment.company_id = p_company_id
            and assignment.branch_id = p_branch_id
            and assignment.user_id = actor.user_id
            and assignment.terminated_at is null
            and assignment.start_date <= pg_catalog.statement_timestamp()::date
            and (assignment.end_date is null or assignment.end_date >= pg_catalog.statement_timestamp()::date)
       )
     )
$function$;
revoke all on function public.hotel_command_actor_v1(uuid, uuid, text, text, boolean) from public;

create function public.process_definition_snapshot_v1(
  p_company_id uuid,
  p_definition_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'id', definition.id,
    'revisionId', revision.id,
    'name', definition.name,
    'applicationType', definition.application_type,
    'scope', definition.scope,
    'hotelId', definition.branch_id,
    'version', definition.version,
    'startStageKey', revision.start_stage_key,
    'stages', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'key', stage.stage_key,
          'name', stage.stage_name,
          'reviewerUserId', stage.reviewer_user_id,
          'delegate', case when stage.delegate_user_id is null then null else
            pg_catalog.jsonb_build_object(
              'userId', stage.delegate_user_id,
              'startsAt', pg_catalog.to_char(stage.delegate_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'endsAt', case when stage.delegate_ends_at is null then null else
                pg_catalog.to_char(stage.delegate_ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
            ) end,
          'due', case when stage.due_amount is null then null else
            pg_catalog.jsonb_build_object('amount', stage.due_amount, 'unit', stage.due_unit) end,
          'isFinal', stage.is_final
        ) order by stage.created_at, stage.stage_key
      )
        from public.process_stage_snapshots stage
       where stage.company_id = definition.company_id
         and stage.revision_id = revision.id
    ), '[]'::jsonb),
    'transitions', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'fromStageKey', transition.from_stage_key,
          'event', transition.event,
          'choiceValue', transition.choice_value,
          'toStageKey', transition.to_stage_key
        ) order by transition.from_stage_key, transition.event, transition.choice_value
      )
        from public.process_transition_snapshots transition
       where transition.company_id = definition.company_id
         and transition.revision_id = revision.id
    ), '[]'::jsonb),
    'createdAt', pg_catalog.to_char(definition.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', pg_catalog.to_char(definition.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
    from public.process_definitions definition
    join public.process_definition_revisions revision
      on revision.company_id = definition.company_id
     and revision.id = definition.current_revision_id
   where definition.company_id = p_company_id
     and definition.id = p_definition_id
$function$;
revoke all on function public.process_definition_snapshot_v1(uuid, uuid) from public;

create function public.hotel_process_command_v1(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_definition_id uuid;
  v_current_revision_id uuid;
  v_current_version integer;
  v_revision_id uuid;
  v_snapshot jsonb;
  v_scope text;
  v_target_branch_id uuid;
  v_stage jsonb;
  v_transition jsonb;
  v_next_version integer;
  v_reachable_count integer;
  v_has_cycle boolean;
begin
  if p_action not in ('SAVE_DEFINITION', 'SET_DEFAULT', 'LIST_DEFINITIONS', 'READ_DEFAULT') then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  v_scope := coalesce(p_value ->> 'scope', 'HOTEL');
  v_target_branch_id := case
    when p_action = 'SAVE_DEFINITION' and v_scope = 'COMPANY' then null
    else p_branch_id
  end;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, v_target_branch_id, p_session_token,
      'PROCESS_DEFINITION_MANAGE', v_target_branch_id is not null
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_action = 'LIST_DEFINITIONS' then
    select pg_catalog.jsonb_build_object(
      'definitions', coalesce(pg_catalog.jsonb_agg(
        public.process_definition_snapshot_v1(p_company_id, definition.id)
        order by definition.updated_at desc
      ), '[]'::jsonb)
    ) into v_snapshot
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and (definition.branch_id is null or definition.branch_id = p_branch_id);
    return query select 'OK'::text, v_snapshot;
    return;
  end if;

  if p_action = 'READ_DEFAULT' then
    select public.process_definition_snapshot_v1(p_company_id, default_record.definition_id)
      into v_snapshot
      from public.hotel_process_defaults default_record
     where default_record.company_id = p_company_id
       and default_record.branch_id = p_branch_id
       and default_record.application_type = 'ROOM_INSPECTION';
    if not found then
      return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb;
    else
      return query select 'OK'::text, v_snapshot;
    end if;
    return;
  end if;

  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method not in ('POST', 'PUT')
     or p_operation_path not like '/api/%'
     or pg_catalog.btrim(coalesce(p_request_hash, '')) = '' then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path, 0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where company_id = p_company_id
     and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key
     and http_method = p_http_method
     and operation_path = p_operation_path
     and status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if p_action = 'SAVE_DEFINITION' then
    if v_scope not in ('COMPANY', 'HOTEL')
       or (v_scope = 'COMPANY' and p_branch_id is not null)
       or (v_scope = 'HOTEL' and p_branch_id is null)
       or p_value ->> 'applicationType' <> 'ROOM_INSPECTION'
       or pg_catalog.btrim(coalesce(p_value ->> 'name', '')) = ''
       or pg_catalog.jsonb_typeof(p_value -> 'stages') <> 'array'
       or pg_catalog.jsonb_array_length(p_value -> 'stages') < 1
       or pg_catalog.jsonb_typeof(p_value -> 'transitions') <> 'array'
       or coalesce(p_value ->> 'startStageKey', '') !~ '^[A-Z][A-Z0-9_]{0,39}$'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p_value -> 'stages') item where (item ->> 'isFinal')::boolean) <> 1
       or not exists (
         select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') item
          where item ->> 'key' = p_value ->> 'startStageKey'
       ) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'stages') item
       where coalesce(item ->> 'key', '') !~ '^[A-Z][A-Z0-9_]{0,39}$'
          or not exists (
            select 1 from public.users app_user
             where app_user.company_id = p_company_id
               and app_user.id = (item ->> 'reviewerUserId')::uuid
               and app_user.status = 'ACTIVE'
               and app_user.user_type = 'INTERNAL_STAFF'
          )
          or (
            item -> 'delegate' <> 'null'::jsonb
            and not exists (
              select 1 from public.users delegate_user
               where delegate_user.company_id = p_company_id
                 and delegate_user.id = (item -> 'delegate' ->> 'userId')::uuid
                 and delegate_user.status = 'ACTIVE'
                 and delegate_user.user_type = 'INTERNAL_STAFF'
            )
          )
    ) then
      return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge
       where edge ->> 'fromStageKey' = edge ->> 'toStageKey'
          or not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'fromStageKey')
          or not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'toStageKey')
          or exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage where stage ->> 'key' = edge ->> 'fromStageKey' and (stage ->> 'isFinal')::boolean)
    ) or exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_value -> 'stages') stage
       where not (stage ->> 'isFinal')::boolean
         and not exists (select 1 from pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge where edge ->> 'fromStageKey' = stage ->> 'key')
    ) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;
    with recursive reachable(stage_key, path, cyclic) as (
      select p_value ->> 'startStageKey', array[p_value ->> 'startStageKey'], false
      union all
      select edge ->> 'toStageKey', reachable.path || (edge ->> 'toStageKey'),
             (edge ->> 'toStageKey') = any(reachable.path)
        from reachable
        join lateral pg_catalog.jsonb_array_elements(p_value -> 'transitions') edge
          on edge ->> 'fromStageKey' = reachable.stage_key
       where not reachable.cyclic
    )
    select pg_catalog.count(distinct stage_key), pg_catalog.bool_or(cyclic)
      into v_reachable_count, v_has_cycle
      from reachable;
    if v_reachable_count <> pg_catalog.jsonb_array_length(p_value -> 'stages')
       or coalesce(v_has_cycle, false) then
      return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
      return;
    end if;

    if p_expected_version = 0 then
      insert into public.process_definitions (
        id, company_id, branch_id, application_type, scope, name,
        created_by, updated_by
      ) values (
        p_resource_id, p_company_id, p_branch_id, 'ROOM_INSPECTION', v_scope,
        p_value ->> 'name', v_actor.user_id, v_actor.user_id
      );
      v_next_version := 1;
    else
      select definition.version into v_current_version
        from public.process_definitions definition
       where definition.company_id = p_company_id
         and definition.id = p_resource_id
       for update;
      if not found then
        return query select 'NOT_FOUND'::text, null::jsonb;
        return;
      end if;
      if v_current_version <> p_expected_version then
        return query select 'PROCESS_VERSION_CONFLICT'::text, null::jsonb;
        return;
      end if;
      update public.process_definitions
         set name = p_value ->> 'name', version = version + 1,
             updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
      v_next_version := p_expected_version + 1;
    end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    insert into public.process_definition_revisions (
      id, company_id, definition_id, version, start_stage_key, reason, created_by
    ) values (
      v_revision_id, p_company_id, p_resource_id, v_next_version,
      p_value ->> 'startStageKey', '프로세스 설정 저장', v_actor.user_id
    );
    for v_stage in select * from pg_catalog.jsonb_array_elements(p_value -> 'stages') loop
      insert into public.process_stage_snapshots (
        id, company_id, revision_id, stage_key, stage_name, reviewer_user_id,
        delegate_user_id, delegate_starts_at, delegate_ends_at,
        due_amount, due_unit, is_final
      ) values (
        (v_stage ->> 'id')::uuid, p_company_id, v_revision_id,
        v_stage ->> 'key', v_stage ->> 'name', (v_stage ->> 'reviewerUserId')::uuid,
        case when v_stage -> 'delegate' = 'null'::jsonb then null else (v_stage -> 'delegate' ->> 'userId')::uuid end,
        case when v_stage -> 'delegate' = 'null'::jsonb then null else (v_stage -> 'delegate' ->> 'startsAt')::timestamptz end,
        case when v_stage -> 'delegate' = 'null'::jsonb or v_stage -> 'delegate' ->> 'endsAt' is null then null else (v_stage -> 'delegate' ->> 'endsAt')::timestamptz end,
        case when v_stage -> 'due' = 'null'::jsonb then null else (v_stage -> 'due' ->> 'amount')::integer end,
        case when v_stage -> 'due' = 'null'::jsonb then null else v_stage -> 'due' ->> 'unit' end,
        (v_stage ->> 'isFinal')::boolean
      );
    end loop;
    for v_transition in select * from pg_catalog.jsonb_array_elements(p_value -> 'transitions') loop
      insert into public.process_transition_snapshots (
        id, company_id, revision_id, from_stage_key, event, choice_value, to_stage_key
      ) values (
        (v_transition ->> 'id')::uuid, p_company_id, v_revision_id,
        v_transition ->> 'fromStageKey', v_transition ->> 'event',
        v_transition ->> 'choiceValue', v_transition ->> 'toStageKey'
      );
    end loop;
    update public.process_definitions
       set current_revision_id = v_revision_id
     where company_id = p_company_id and id = p_resource_id;
    v_snapshot := public.process_definition_snapshot_v1(p_company_id, p_resource_id);
  else
    select definition.id, definition.current_revision_id
      into v_definition_id, v_current_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = (p_value ->> 'processDefinitionId')::uuid
       and (definition.branch_id is null or definition.branch_id = p_branch_id)
     for share;
    if not found then
      return query select 'NOT_FOUND'::text, null::jsonb;
      return;
    end if;
    if exists (
      select 1 from public.process_stage_snapshots stage
       where stage.company_id = p_company_id
         and stage.revision_id = v_current_revision_id
         and (
           not exists (
             select 1 from public.hotel_staff_assignments assignment
              where assignment.company_id = p_company_id
                and assignment.branch_id = p_branch_id
                and assignment.user_id = stage.reviewer_user_id
                and assignment.terminated_at is null
                and assignment.start_date <= v_now::date
                and (assignment.end_date is null or assignment.end_date >= v_now::date)
           )
           or (
             stage.delegate_user_id is not null
             and not exists (
               select 1 from public.hotel_staff_assignments assignment
                where assignment.company_id = p_company_id
                  and assignment.branch_id = p_branch_id
                  and assignment.user_id = stage.delegate_user_id
                  and assignment.terminated_at is null
                  and assignment.start_date <= v_now::date
                  and (assignment.end_date is null or assignment.end_date >= v_now::date)
             )
           )
         )
    ) then
      return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb;
      return;
    end if;
    insert into public.hotel_process_defaults (
      company_id, branch_id, application_type, definition_id, revision_id,
      version, updated_by, updated_at
    ) values (
      p_company_id, p_branch_id, 'ROOM_INSPECTION', v_definition_id,
      v_current_revision_id, 1, v_actor.user_id, v_now
    )
    on conflict (company_id, branch_id, application_type) do update
      set definition_id = excluded.definition_id,
          revision_id = excluded.revision_id,
          version = hotel_process_defaults.version + 1,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      where hotel_process_defaults.version = p_expected_version;
    if not found then
      return query select 'PROCESS_VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    v_snapshot := public.process_definition_snapshot_v1(p_company_id, v_definition_id);
  end if;

  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id,
    case when p_action = 'SAVE_DEFINITION' then 'PROCESS_DEFINITION_SAVED' else 'HOTEL_PROCESS_DEFAULT_SET' end,
    v_actor.user_id, v_actor.user_type, v_actor.session_id, p_company_id,
    p_branch_id, 'PROCESS_DEFINITION', p_resource_id,
    pg_catalog.jsonb_build_object('resourceId', p_resource_id),
    '프로세스 설정 저장', 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'PROCESS_DEFINITION', p_resource_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select
    case when p_action = 'SAVE_DEFINITION' and p_expected_version = 0 then 'CREATED' else 'UPDATED' end::text,
    v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation or unique_violation then
    return query select 'PROCESS_GRAPH_INVALID'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_process_command_v1(uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid) from public;

create function public.inspection_checklist_snapshot_v1(
  p_company_id uuid,
  p_branch_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'id', revision.id,
    'hotelId', revision.branch_id,
    'version', revision.version,
    'reason', revision.reason,
    'items', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'itemId', item.source_item_id,
          'source', item.source,
          'roomTypeId', item.room_type_id,
          'excludedRoomTypeIds', coalesce((
            select pg_catalog.jsonb_agg(exclusion.room_type_id order by exclusion.room_type_id)
              from public.inspection_checklist_item_exclusions exclusion
             where exclusion.company_id = item.company_id
               and exclusion.checklist_item_id = item.id
          ), '[]'::jsonb),
          'name', item.name,
          'description', item.description,
          'isRequired', item.is_required,
          'displayOrder', item.display_order,
          'defaultSeverity', item.default_severity
        ) order by item.display_order, item.source_item_id
      )
        from public.inspection_checklist_items item
       where item.company_id = revision.company_id
         and item.revision_id = revision.id
    ), '[]'::jsonb),
    'createdBy', revision.created_by,
    'createdAt', pg_catalog.to_char(revision.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
    from public.inspection_checklist_revisions revision
   where revision.company_id = p_company_id
     and revision.branch_id = p_branch_id
   order by revision.version desc
   limit 1
$function$;
revoke all on function public.inspection_checklist_snapshot_v1(uuid, uuid) from public;

create function public.inspection_execution_snapshot_v1(
  p_company_id uuid,
  p_branch_id uuid,
  p_inspection_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object(
    'id', inspection.id,
    'hotelId', inspection.branch_id,
    'source', inspection.source,
    'businessDate', inspection.business_date,
    'dueAt', pg_catalog.to_char(inspection.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status', inspection.status,
    'version', inspection.version,
    'process', pg_catalog.jsonb_build_object(
      'executionId', execution.id,
      'definitionId', execution.definition_id,
      'revisionId', execution.revision_id,
      'currentStageKey', execution.current_stage_key,
      'currentStageName', execution.current_stage_name,
      'state', execution.state,
      'version', execution.version
    ),
    'items', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', snapshot.id,
          'roomId', snapshot.room_id,
          'itemId', snapshot.source_item_id,
          'name', snapshot.name,
          'description', snapshot.description,
          'isRequired', snapshot.is_required,
          'displayOrder', snapshot.display_order,
          'defaultSeverity', snapshot.default_severity,
          'result', case when result_record.id is null then null else
            pg_catalog.jsonb_build_object(
              'result', result_record.result,
              'description', result_record.description,
              'severity', result_record.severity,
              'fileVersionIds', coalesce((
                select pg_catalog.jsonb_agg(link.file_version_id order by link.linked_at)
                  from public.hotel_file_links link
                 where link.company_id = snapshot.company_id
                   and link.result_id = result_record.id
                   and link.result_version = result_record.version
              ), '[]'::jsonb),
              'version', result_record.version
            ) end
        ) order by room.room_number, snapshot.display_order, snapshot.id
      )
        from public.inspection_item_snapshots snapshot
        join public.hotel_rooms room
          on room.company_id = snapshot.company_id
         and room.id = snapshot.room_id
        left join public.inspection_item_results result_record
          on result_record.company_id = snapshot.company_id
         and result_record.inspection_id = snapshot.inspection_id
         and result_record.item_snapshot_id = snapshot.id
       where snapshot.company_id = inspection.company_id
         and snapshot.inspection_id = inspection.id
    ), '[]'::jsonb),
    'createdAt', pg_catalog.to_char(inspection.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', pg_catalog.to_char(inspection.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
    from public.hotel_inspections inspection
    join public.process_executions execution
      on execution.company_id = inspection.company_id
     and execution.id = inspection.process_execution_id
   where inspection.company_id = p_company_id
     and inspection.branch_id = p_branch_id
     and inspection.id = p_inspection_id
$function$;
revoke all on function public.inspection_execution_snapshot_v1(uuid, uuid, uuid) from public;

create function public.hotel_inspection_command_v1(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_current_version integer;
  v_inspection_status text;
  v_inspection_process_execution_id uuid;
  v_current_result_id uuid;
  v_current_result_version integer;
  v_process_definition_id uuid;
  v_process_revision_id uuid;
  v_process_execution public.process_executions%rowtype;
  v_start_stage_key text;
  v_stage public.process_stage_snapshots%rowtype;
  v_transition public.process_transition_snapshots%rowtype;
  v_revision_id uuid;
  v_checklist_revision_id uuid;
  v_process_execution_id uuid;
  v_result_id uuid;
  v_effective_resource_id uuid;
  v_snapshot jsonb;
  v_item jsonb;
  v_exclusion jsonb;
  v_round jsonb;
  v_target jsonb;
  v_file_id text;
  v_permission text;
  v_mutation boolean;
  v_next_version integer;
  v_count integer;
  v_business_date date;
  v_due_at timestamptz;
  v_result text;
  v_description text;
  v_severity text;
  v_reason text;
begin
  if p_action not in (
    'READ_CHECKLIST', 'SAVE_CHECKLIST', 'LIST_ROUTINES', 'SAVE_ROUTINE',
    'LIST_INSPECTIONS', 'READ_INSPECTION', 'CREATE_MANUAL', 'SAVE_RESULT',
    'SUBMIT', 'TRANSITION'
  ) then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  v_permission := case
    when p_action in ('SAVE_CHECKLIST', 'SAVE_ROUTINE') then 'HOTEL_INSPECTION_CONFIG'
    when p_action = 'TRANSITION' then 'HOTEL_INSPECTION_REVIEW'
    else 'HOTEL_INSPECTION_RUN'
  end;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token, v_permission, true
    );
  if not found then
    return query select 'FORBIDDEN'::text, null::jsonb;
    return;
  end if;

  if p_action = 'READ_CHECKLIST' then
    v_snapshot := public.inspection_checklist_snapshot_v1(p_company_id, p_branch_id);
    return query select 'OK'::text, v_snapshot;
    return;
  elsif p_action = 'LIST_ROUTINES' then
    select pg_catalog.jsonb_build_object(
      'routines', coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', routine.id, 'hotelId', routine.branch_id, 'name', routine.name,
          'status', routine.status, 'version', routine.version,
          'nextDueDate', routine.next_due_date,
          'createdAt', pg_catalog.to_char(routine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'updatedAt', pg_catalog.to_char(routine.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) order by routine.updated_at desc
      ), '[]'::jsonb)
    ) into v_snapshot
      from public.inspection_routines routine
     where routine.company_id = p_company_id and routine.branch_id = p_branch_id;
    return query select 'OK'::text, v_snapshot;
    return;
  elsif p_action = 'READ_INSPECTION' then
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);
    return query select case when v_snapshot is null then 'NOT_FOUND' else 'OK' end::text, v_snapshot;
    return;
  elsif p_action = 'LIST_INSPECTIONS' then
    select pg_catalog.jsonb_build_object(
      'inspections', coalesce(pg_catalog.jsonb_agg(
        public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, inspection.id)
        order by inspection.business_date desc, inspection.created_at desc
      ), '[]'::jsonb),
      'total', pg_catalog.count(*)
    ) into v_snapshot
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id
       and inspection.branch_id = p_branch_id
       and (p_value ->> 'status' is null or inspection.status = p_value ->> 'status')
       and (p_value ->> 'startDate' is null or inspection.business_date >= (p_value ->> 'startDate')::date)
       and (p_value ->> 'endDate' is null or inspection.business_date <= (p_value ->> 'endDate')::date);
    return query select 'OK'::text, v_snapshot;
    return;
  end if;

  v_mutation := true;
  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method not in ('POST', 'PUT', 'PATCH')
     or p_operation_path not like '/api/%'
     or pg_catalog.btrim(coalesce(p_request_hash, '')) = '' then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path, 0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if p_action = 'SAVE_CHECKLIST' then
    select revision.version into v_current_version
      from public.inspection_checklist_revisions revision
     where revision.company_id = p_company_id and revision.branch_id = p_branch_id
     order by revision.version desc limit 1 for update;
    if (not found and p_expected_version <> 0)
       or (found and v_current_version <> p_expected_version) then
      return query select 'VERSION_CONFLICT'::text, null::jsonb;
      return;
    end if;
    if pg_catalog.jsonb_typeof(p_value -> 'items') <> 'array'
       or pg_catalog.jsonb_array_length(p_value -> 'items') < 1
       or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_value ->> 'reason', ''))) not between 2 and 500 then
      return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb;
      return;
    end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    v_next_version := p_expected_version + 1;
    insert into public.inspection_checklist_revisions (
      id, company_id, branch_id, version, reason, created_by
    ) values (
      v_revision_id, p_company_id, p_branch_id, v_next_version,
      p_value ->> 'reason', v_actor.user_id
    );
    for v_item in select * from pg_catalog.jsonb_array_elements(p_value -> 'items') loop
      if (v_item ->> 'source' = 'HOTEL_COMMON' and v_item ->> 'roomTypeId' is not null)
         or (v_item ->> 'source' = 'ROOM_TYPE_ADDED' and not exists (
           select 1 from public.hotel_room_types room_type
            where room_type.company_id = p_company_id
              and room_type.id = (v_item ->> 'roomTypeId')::uuid
              and room_type.is_active
              and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
         )) then
        return query select 'INVALID_TARGET'::text, null::jsonb;
        return;
      end if;
      insert into public.inspection_checklist_items (
        id, company_id, revision_id, source_item_id, source, room_type_id,
        name, description, is_required, display_order, default_severity
      ) values (
        (v_item ->> 'snapshotId')::uuid, p_company_id, v_revision_id,
        (v_item ->> 'itemId')::uuid, v_item ->> 'source',
        nullif(v_item ->> 'roomTypeId', '')::uuid,
        v_item ->> 'name', v_item ->> 'description',
        (v_item ->> 'isRequired')::boolean, (v_item ->> 'displayOrder')::integer,
        v_item ->> 'defaultSeverity'
      );
      for v_exclusion in select * from pg_catalog.jsonb_array_elements(v_item -> 'excludedRoomTypeIds') loop
        if not exists (
          select 1 from public.hotel_room_types room_type
           where room_type.company_id = p_company_id
             and room_type.id = (v_exclusion #>> '{}')::uuid
             and room_type.is_active
             and (room_type.branch_id is null or room_type.branch_id = p_branch_id)
        ) then
          return query select 'INVALID_TARGET'::text, null::jsonb;
          return;
        end if;
        insert into public.inspection_checklist_item_exclusions (
          id, company_id, revision_id, checklist_item_id, room_type_id
        ) values (
          pg_catalog.gen_random_uuid(), p_company_id, v_revision_id,
          (v_item ->> 'snapshotId')::uuid, (v_exclusion #>> '{}')::uuid
        );
      end loop;
    end loop;
    v_snapshot := public.inspection_checklist_snapshot_v1(p_company_id, p_branch_id);

  elsif p_action = 'SAVE_ROUTINE' then
    if p_expected_version = 0 then
      insert into public.inspection_routines (
        id, company_id, branch_id, name, status, next_due_date,
        created_by, updated_by
      ) values (
        p_resource_id, p_company_id, p_branch_id, p_value ->> 'name',
        p_value ->> 'status', (p_value ->> 'startDate')::date,
        v_actor.user_id, v_actor.user_id
      );
      v_next_version := 1;
    else
      select routine.version into v_current_version
        from public.inspection_routines routine
       where routine.company_id = p_company_id and routine.branch_id = p_branch_id
         and routine.id = p_resource_id for update;
      if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
      if v_current_version <> p_expected_version then
        return query select 'INSPECTION_ROUTINE_VERSION_CONFLICT'::text, null::jsonb; return;
      end if;
      update public.inspection_routines
         set name = p_value ->> 'name', status = p_value ->> 'status',
             next_due_date = greatest(next_due_date, (p_value ->> 'startDate')::date),
             version = version + 1, updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
      v_next_version := p_expected_version + 1;
    end if;
    select definition.id, definition.current_revision_id
      into v_process_definition_id, v_process_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = coalesce(
         nullif(p_value ->> 'processDefinitionId', '')::uuid,
         (select default_record.definition_id from public.hotel_process_defaults default_record
           where default_record.company_id = p_company_id and default_record.branch_id = p_branch_id
             and default_record.application_type = 'ROOM_INSPECTION')
       )
       and (definition.branch_id is null or definition.branch_id = p_branch_id);
    if not found then return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb; return; end if;
    v_revision_id := (p_value ->> 'revisionId')::uuid;
    insert into public.inspection_routine_revisions (
      id, company_id, routine_id, version, mode, recurrence_type,
      day_of_week, day_of_month, recurrence_interval, start_date, end_date,
      local_due_time, process_definition_id, process_revision_id, created_by
    ) values (
      v_revision_id, p_company_id, p_resource_id, v_next_version,
      p_value ->> 'mode', p_value -> 'recurrence' ->> 'type',
      p_value -> 'recurrence' ->> 'dayOfWeek',
      nullif(p_value -> 'recurrence' ->> 'dayOfMonth', '')::integer,
      nullif(p_value -> 'recurrence' ->> 'interval', '')::integer,
      (p_value ->> 'startDate')::date, nullif(p_value ->> 'endDate', '')::date,
      (p_value ->> 'localDueTime')::time, v_process_definition_id,
      v_process_revision_id, v_actor.user_id
    );
    for v_round in select * from pg_catalog.jsonb_array_elements(p_value -> 'rounds') loop
      insert into public.inspection_routine_rounds (
        id, company_id, revision_id, round_order, target_type, target_value
      ) values (
        (v_round ->> 'id')::uuid, p_company_id, v_revision_id,
        (v_round ->> 'order')::integer, v_round -> 'target' ->> 'type',
        v_round -> 'target'
      );
    end loop;
    update public.inspection_routines set current_revision_id = v_revision_id
     where company_id = p_company_id and id = p_resource_id;
    select pg_catalog.jsonb_build_object(
      'id', routine.id, 'hotelId', routine.branch_id, 'name', routine.name,
      'status', routine.status, 'version', routine.version,
      'nextDueDate', routine.next_due_date
    ) into v_snapshot from public.inspection_routines routine
     where routine.company_id = p_company_id and routine.id = p_resource_id;

  elsif p_action = 'CREATE_MANUAL' then
    v_business_date := (v_now at time zone 'Asia/Seoul')::date;
    v_due_at := ((v_business_date + 1)::timestamp at time zone 'Asia/Seoul') - interval '1 millisecond';
    select definition.id, definition.current_revision_id
      into v_process_definition_id, v_process_revision_id
      from public.process_definitions definition
     where definition.company_id = p_company_id
       and definition.id = coalesce(
         nullif(p_value ->> 'processDefinitionId', '')::uuid,
         (select default_record.definition_id from public.hotel_process_defaults default_record
           where default_record.company_id = p_company_id and default_record.branch_id = p_branch_id
             and default_record.application_type = 'ROOM_INSPECTION')
       )
       and (definition.branch_id is null or definition.branch_id = p_branch_id);
    if not found then return query select 'PROCESS_DEFAULT_REQUIRED'::text, null::jsonb; return; end if;
    select revision.id into v_checklist_revision_id
      from public.inspection_checklist_revisions revision
     where revision.company_id = p_company_id and revision.branch_id = p_branch_id
     order by revision.version desc limit 1;
    if not found then return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb; return; end if;
    v_process_execution_id := (p_value ->> 'processExecutionId')::uuid;
    insert into public.process_executions (
      id, company_id, branch_id, application_type, resource_id,
      definition_id, revision_id, state, created_by
    ) values (
      v_process_execution_id, p_company_id, p_branch_id, 'ROOM_INSPECTION',
      p_resource_id, v_process_definition_id, v_process_revision_id,
      'PENDING_INPUT', v_actor.user_id
    );
    insert into public.hotel_inspections (
      id, company_id, branch_id, source, business_date, due_at, status,
      process_execution_id, created_by
    ) values (
      p_resource_id, p_company_id, p_branch_id, 'MANUAL', v_business_date,
      v_due_at, 'PENDING_INPUT', v_process_execution_id, v_actor.user_id
    );
    for v_target in select * from pg_catalog.jsonb_array_elements(p_value -> 'targets') loop
      if not exists (
        select 1 from public.hotel_rooms room
         where room.company_id = p_company_id and room.branch_id = p_branch_id
           and room.id = (v_target ->> 'roomId')::uuid and room.status = 'ACTIVE'
      ) then return query select 'INVALID_TARGET'::text, null::jsonb; return; end if;
      insert into public.inspection_item_snapshots (
        id, company_id, branch_id, inspection_id, room_id, source_item_id,
        checklist_revision_id, name, description, is_required, display_order,
        default_severity
      )
      select pg_catalog.gen_random_uuid(), p_company_id, p_branch_id, p_resource_id,
             (v_target ->> 'roomId')::uuid, item.source_item_id,
             v_checklist_revision_id, item.name, item.description,
             item.is_required, item.display_order, item.default_severity
        from public.inspection_checklist_items item
        join public.hotel_rooms room
          on room.company_id = p_company_id and room.branch_id = p_branch_id
         and room.id = (v_target ->> 'roomId')::uuid
       where item.company_id = p_company_id and item.revision_id = v_checklist_revision_id
         and item.source_item_id in (
           select (selected #>> '{}')::uuid
             from pg_catalog.jsonb_array_elements(v_target -> 'selectedItemIds') selected
         )
         and (
           (item.source = 'HOTEL_COMMON' and not exists (
             select 1 from public.inspection_checklist_item_exclusions exclusion
              where exclusion.company_id = p_company_id
                and exclusion.checklist_item_id = item.id
                and exclusion.room_type_id = room.room_type_id
           ))
           or (item.source = 'ROOM_TYPE_ADDED' and item.room_type_id = room.room_type_id)
         );
      get diagnostics v_count = row_count;
      if v_count <> pg_catalog.jsonb_array_length(v_target -> 'selectedItemIds') then
        return query select 'INVALID_TARGET'::text, null::jsonb; return;
      end if;
    end loop;
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);

  elsif p_action = 'SAVE_RESULT' then
    select inspection.status into v_inspection_status
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id and inspection.branch_id = p_branch_id
       and inspection.id = p_resource_id for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if v_inspection_status in ('COMPLETED', 'CANCELLED', 'UNFINISHED_CLOSED') then
      return query select 'INSPECTION_FINAL_LOCKED'::text, null::jsonb; return;
    end if;
    if not exists (
      select 1 from public.inspection_item_snapshots item
       where item.company_id = p_company_id and item.inspection_id = p_resource_id
         and item.id = (p_value ->> 'itemSnapshotId')::uuid
    ) then return query select 'INVALID_TARGET'::text, null::jsonb; return; end if;
    v_result := p_value ->> 'result';
    v_description := p_value ->> 'description';
    v_severity := p_value ->> 'severity';
    v_reason := p_value ->> 'changeReason';
    if (v_result = 'NORMAL' and (v_description is not null or v_severity is not null or pg_catalog.jsonb_array_length(p_value -> 'fileVersionIds') <> 0))
       or (v_result = 'CAUTION' and (pg_catalog.char_length(pg_catalog.btrim(coalesce(v_description, ''))) < 2 or v_severity is not null or pg_catalog.jsonb_array_length(p_value -> 'fileVersionIds') <> 0))
       or (v_result = 'ABNORMAL' and (pg_catalog.char_length(pg_catalog.btrim(coalesce(v_description, ''))) < 2 or v_severity not in ('OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL') or pg_catalog.jsonb_array_length(p_value -> 'fileVersionIds') not between 1 and 5)) then
      return query select 'INSPECTION_RESULT_EVIDENCE_REQUIRED'::text, null::jsonb; return;
    end if;
    if v_result = 'ABNORMAL' and exists (
      select 1 from pg_catalog.jsonb_array_elements_text(p_value -> 'fileVersionIds') file_id
       where not exists (
         select 1 from public.hotel_file_versions version_record
         join public.hotel_file_uploads upload
           on upload.company_id = version_record.company_id and upload.id = version_record.upload_id
        where version_record.company_id = p_company_id
          and version_record.id = file_id::uuid
          and upload.branch_id = p_branch_id
          and upload.inspection_id = p_resource_id
          and upload.item_snapshot_id = (p_value ->> 'itemSnapshotId')::uuid
          and upload.status = 'READY_UNLINKED'
       )
    ) then return query select 'INSPECTION_RESULT_EVIDENCE_REQUIRED'::text, null::jsonb; return; end if;
    select result_record.id, result_record.version
      into v_current_result_id, v_current_result_version
      from public.inspection_item_results result_record
     where result_record.company_id = p_company_id and result_record.inspection_id = p_resource_id
       and result_record.item_snapshot_id = (p_value ->> 'itemSnapshotId')::uuid
     for update;
    if not found then
      if p_expected_version <> 0 then return query select 'VERSION_CONFLICT'::text, null::jsonb; return; end if;
      v_result_id := (p_value ->> 'resultId')::uuid;
      v_next_version := 1;
      insert into public.inspection_item_results (
        id, company_id, branch_id, inspection_id, item_snapshot_id,
        result, description, severity, updated_by
      ) values (
        v_result_id, p_company_id, p_branch_id, p_resource_id,
        (p_value ->> 'itemSnapshotId')::uuid, v_result, v_description,
        v_severity, v_actor.user_id
      );
      v_reason := coalesce(v_reason, '점검 결과 최초 저장');
    else
      if v_current_result_version <> p_expected_version
         or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_reason, ''))) not between 2 and 500 then
        return query select 'VERSION_CONFLICT'::text, null::jsonb; return;
      end if;
      v_result_id := v_current_result_id;
      v_next_version := p_expected_version + 1;
      update public.inspection_item_results
         set result = v_result, description = v_description, severity = v_severity,
             version = version + 1, updated_by = v_actor.user_id, updated_at = v_now
       where company_id = p_company_id and id = v_result_id;
    end if;
    if v_result = 'ABNORMAL' then
      for v_file_id in select * from pg_catalog.jsonb_array_elements_text(p_value -> 'fileVersionIds') loop
        insert into public.hotel_file_links (
          id, company_id, branch_id, file_version_id, parent_type,
          inspection_id, item_snapshot_id, result_id, result_version, linked_by
        ) values (
          pg_catalog.gen_random_uuid(), p_company_id, p_branch_id, v_file_id::uuid,
          'INSPECTION_ITEM_EVIDENCE', p_resource_id,
          (p_value ->> 'itemSnapshotId')::uuid, v_result_id, v_next_version,
          v_actor.user_id
        );
        update public.hotel_file_uploads upload set status = 'LINKED', updated_at = v_now
         where upload.company_id = p_company_id
           and upload.id = (select version_record.upload_id from public.hotel_file_versions version_record where version_record.company_id = p_company_id and version_record.id = v_file_id::uuid)
           and upload.status = 'READY_UNLINKED';
      end loop;
    end if;
    insert into public.inspection_item_result_history (
      id, company_id, branch_id, inspection_id, item_snapshot_id, result_id,
      version, result, description, severity, file_version_ids,
      change_reason, changed_by
    ) values (
      (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id, p_resource_id,
      (p_value ->> 'itemSnapshotId')::uuid, v_result_id, v_next_version,
      v_result, v_description, v_severity,
      array(select value::uuid from pg_catalog.jsonb_array_elements_text(p_value -> 'fileVersionIds')),
      v_reason, v_actor.user_id
    );
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);

  elsif p_action = 'SUBMIT' then
    select inspection.status, inspection.version, inspection.process_execution_id
      into v_inspection_status, v_current_version, v_inspection_process_execution_id
      from public.hotel_inspections inspection
     where inspection.company_id = p_company_id and inspection.branch_id = p_branch_id
       and inspection.id = p_resource_id for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if v_inspection_status <> 'PENDING_INPUT' or v_current_version <> p_expected_version then
      return query select 'VERSION_CONFLICT'::text, null::jsonb; return;
    end if;
    if exists (
      select 1 from public.inspection_item_snapshots item
       left join public.inspection_item_results result_record
         on result_record.company_id = item.company_id
        and result_record.inspection_id = item.inspection_id
        and result_record.item_snapshot_id = item.id
      where item.company_id = p_company_id and item.inspection_id = p_resource_id
        and item.is_required and result_record.id is null
    ) then return query select 'INSPECTION_CHECKLIST_EMPTY'::text, null::jsonb; return; end if;
    select execution.* into v_process_execution
      from public.process_executions execution
     where execution.company_id = p_company_id and execution.id = v_inspection_process_execution_id
     for update of execution;
    select revision.start_stage_key into v_start_stage_key
      from public.process_definition_revisions revision
     where revision.company_id = p_company_id
       and revision.id = v_process_execution.revision_id;
    select stage.* into v_stage from public.process_stage_snapshots stage
     where stage.company_id = p_company_id and stage.revision_id = v_process_execution.revision_id
       and stage.stage_key = v_start_stage_key;
    if not exists (
      select 1 from public.hotel_staff_assignments assignment
       where assignment.company_id = p_company_id and assignment.branch_id = p_branch_id
         and assignment.user_id = (v_stage).reviewer_user_id and assignment.terminated_at is null
         and assignment.start_date <= v_now::date and (assignment.end_date is null or assignment.end_date >= v_now::date)
    ) then return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb; return; end if;
    update public.process_executions set state = 'IN_REVIEW',
      current_stage_key = (v_stage).stage_key, current_stage_name = (v_stage).stage_name,
      current_reviewer_user_id = (v_stage).reviewer_user_id,
      current_delegate_user_id = case when (v_stage).delegate_starts_at <= v_now and ((v_stage).delegate_ends_at is null or (v_stage).delegate_ends_at > v_now) then (v_stage).delegate_user_id else null end,
      current_due_at = case when (v_stage).due_unit = 'HOURS' then v_now + pg_catalog.make_interval(hours => (v_stage).due_amount) when (v_stage).due_unit = 'DAYS' then v_now + pg_catalog.make_interval(days => (v_stage).due_amount) else null end,
      version = version + 1, started_at = v_now, updated_at = v_now
     where company_id = p_company_id and id = v_inspection_process_execution_id;
    update public.hotel_inspections set status = 'IN_REVIEW', version = version + 1, updated_at = v_now
     where company_id = p_company_id and id = p_resource_id;
    insert into public.process_execution_history (
      id, company_id, branch_id, execution_id, previous_state, next_state,
      previous_stage_key, next_stage_key, event, reason, actor_user_id
    ) values (
      (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id,
      v_inspection_process_execution_id, 'PENDING_INPUT', 'IN_REVIEW', null,
      (v_stage).stage_key, 'SUBMIT', p_value ->> 'reason', v_actor.user_id
    );
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);

  else
    select execution.* into v_process_execution
      from public.process_executions execution
     where execution.company_id = p_company_id and execution.branch_id = p_branch_id
       and execution.resource_id = p_resource_id for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if v_process_execution.state <> 'IN_REVIEW' or v_process_execution.version <> p_expected_version then
      return query select 'VERSION_CONFLICT'::text, null::jsonb; return;
    end if;
    if v_actor.user_id not in (v_process_execution.current_reviewer_user_id, v_process_execution.current_delegate_user_id) then
      return query select 'FORBIDDEN'::text, null::jsonb; return;
    end if;
    select stage.* into v_stage from public.process_stage_snapshots stage
     where stage.company_id = p_company_id and stage.revision_id = v_process_execution.revision_id
       and stage.stage_key = v_process_execution.current_stage_key;
    if p_value ->> 'event' = 'REJECT' then
      update public.process_executions set state = 'PENDING_INPUT', current_stage_key = null,
        current_stage_name = null, current_reviewer_user_id = null,
        current_delegate_user_id = null, current_due_at = null,
        version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = v_process_execution.id;
      update public.hotel_inspections set status = 'PENDING_INPUT', version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
    elsif (v_stage).is_final then
      update public.process_executions set state = 'COMPLETED', current_stage_key = null,
        current_stage_name = null, current_reviewer_user_id = null,
        current_delegate_user_id = null, current_due_at = null,
        version = version + 1, completed_at = v_now, updated_at = v_now
       where company_id = p_company_id and id = v_process_execution.id;
      update public.hotel_inspections set status = 'COMPLETED', version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
    else
      select transition.* into v_transition
        from public.process_transition_snapshots transition
       where transition.company_id = p_company_id and transition.revision_id = v_process_execution.revision_id
         and transition.from_stage_key = v_process_execution.current_stage_key
         and transition.event = p_value ->> 'event'
         and transition.choice_value is not distinct from p_value ->> 'choiceValue';
      if not found then return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb; return; end if;
      select stage.* into v_stage from public.process_stage_snapshots stage
       where stage.company_id = p_company_id and stage.revision_id = v_process_execution.revision_id
         and stage.stage_key = (v_transition).to_stage_key;
      if not exists (
        select 1 from public.hotel_staff_assignments assignment
         where assignment.company_id = p_company_id and assignment.branch_id = p_branch_id
           and assignment.user_id = (v_stage).reviewer_user_id and assignment.terminated_at is null
           and assignment.start_date <= v_now::date and (assignment.end_date is null or assignment.end_date >= v_now::date)
      ) then return query select 'PROCESS_ASSIGNEE_INVALID'::text, null::jsonb; return; end if;
      update public.process_executions set current_stage_key = (v_stage).stage_key,
        current_stage_name = (v_stage).stage_name,
        current_reviewer_user_id = (v_stage).reviewer_user_id,
        current_delegate_user_id = case when (v_stage).delegate_starts_at <= v_now and ((v_stage).delegate_ends_at is null or (v_stage).delegate_ends_at > v_now) then (v_stage).delegate_user_id else null end,
        current_due_at = case when (v_stage).due_unit = 'HOURS' then v_now + pg_catalog.make_interval(hours => (v_stage).due_amount) when (v_stage).due_unit = 'DAYS' then v_now + pg_catalog.make_interval(days => (v_stage).due_amount) else null end,
        version = version + 1, updated_at = v_now
       where company_id = p_company_id and id = v_process_execution.id;
    end if;
    insert into public.process_execution_history (
      id, company_id, branch_id, execution_id, previous_state, next_state,
      previous_stage_key, next_stage_key, event, choice_value, reason, actor_user_id
    ) select (p_value ->> 'historyId')::uuid, p_company_id, p_branch_id,
      v_process_execution.id, 'IN_REVIEW', execution.state, v_process_execution.current_stage_key,
      execution.current_stage_key, p_value ->> 'event', p_value ->> 'choiceValue',
      p_value ->> 'reason', v_actor.user_id
      from public.process_executions execution
     where execution.company_id = p_company_id and execution.id = v_process_execution.id;
    v_snapshot := public.inspection_execution_snapshot_v1(p_company_id, p_branch_id, p_resource_id);
  end if;

  v_effective_resource_id := coalesce(p_resource_id, nullif(v_snapshot ->> 'id', '')::uuid);
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, 'HOTEL_INSPECTION_' || p_action, v_actor.user_id,
    v_actor.user_type, v_actor.session_id, p_company_id, p_branch_id,
    case when p_action = 'SAVE_ROUTINE' then 'INSPECTION_ROUTINE' when p_action = 'SAVE_CHECKLIST' then 'INSPECTION_CHECKLIST' else 'HOTEL_INSPECTION' end,
    v_effective_resource_id, pg_catalog.jsonb_build_object('resourceId', v_effective_resource_id),
    coalesce(p_value ->> 'reason', p_value ->> 'changeReason', '점검 업무 처리'),
    'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'HOTEL_INSPECTION', v_effective_resource_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select case when p_expected_version = 0 then 'CREATED' else 'UPDATED' end::text, v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
  when unique_violation then
    return query select 'DUPLICATE'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_inspection_command_v1(uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid) from public;

create function public.hotel_file_status_snapshot_v1(
  p_company_id uuid,
  p_upload_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select case
    when upload.status in ('READY_UNLINKED', 'LINKED') then
      pg_catalog.jsonb_build_object(
        'id', upload.id, 'status', upload.status,
        'fileVersionId', version_record.id
      )
    when upload.status in ('EXPIRED', 'REJECTED', 'SCAN_FAILED') then
      pg_catalog.jsonb_build_object(
        'id', upload.id, 'status', upload.status,
        'failureCode', upload.failure_code
      )
    else pg_catalog.jsonb_build_object('id', upload.id, 'status', upload.status)
  end
    from public.hotel_file_uploads upload
    left join public.hotel_file_versions version_record
      on version_record.company_id = upload.company_id
     and version_record.upload_id = upload.id
   where upload.company_id = p_company_id
     and upload.id = p_upload_id
$function$;
revoke all on function public.hotel_file_status_snapshot_v1(uuid, uuid) from public;

create function public.hotel_file_command_v1(
  p_company_id uuid, p_branch_id uuid, p_resource_id uuid, p_action text,
  p_expected_version integer, p_value jsonb, p_session_token text,
  p_idempotency_record_id uuid, p_idempotency_key text, p_http_method text,
  p_operation_path text, p_request_hash text, p_audit_event_id uuid, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_actor record;
  v_existing record;
  v_upload public.hotel_file_uploads%rowtype;
  v_snapshot jsonb;
  v_scan_job_id uuid;
  v_permission text := 'HOTEL_FILE_UPLOAD';
  v_total_size bigint;
  v_total_count integer;
  v_mutation boolean;
begin
  if p_action not in ('UPLOAD_INIT', 'UPLOAD_AUTHORIZE', 'UPLOAD_COMPLETE', 'STATUS') then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
    return;
  end if;
  select * into v_actor
    from public.hotel_command_actor_v1(
      p_company_id, p_branch_id, p_session_token, 'HOTEL_FILE_UPLOAD', true
    );
  if not found and p_action = 'STATUS' then
    v_permission := 'HOTEL_FILE_READ';
    select * into v_actor
      from public.hotel_command_actor_v1(
        p_company_id, p_branch_id, p_session_token, 'HOTEL_FILE_READ', true
      );
  end if;
  if not found then
    return query select 'NOT_FOUND'::text, null::jsonb;
    return;
  end if;

  if p_action = 'STATUS' then
    select upload.* into v_upload
      from public.hotel_file_uploads upload
     where upload.company_id = p_company_id and upload.branch_id = p_branch_id
       and upload.id = p_resource_id
       and (upload.initiated_by = v_actor.user_id or v_permission = 'HOTEL_FILE_READ');
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    v_snapshot := public.hotel_file_status_snapshot_v1(p_company_id, p_resource_id);
    return query select 'OK'::text, v_snapshot;
    return;
  elsif p_action = 'UPLOAD_AUTHORIZE' then
    select upload.* into v_upload
      from public.hotel_file_uploads upload
     where upload.company_id = p_company_id and upload.branch_id = p_branch_id
       and upload.id = p_resource_id and upload.initiated_by = v_actor.user_id
       and upload.initiated_session_id = v_actor.session_id
     for share;
    if not found or (v_upload).status <> 'PENDING_UPLOAD' or (v_upload).expires_at <= v_now then
      return query select 'NOT_FOUND'::text, null::jsonb; return;
    end if;
    return query select 'OK'::text, pg_catalog.jsonb_build_object(
      'id', (v_upload).id,
      'quarantineObjectKey', (v_upload).quarantine_object_key,
      'reservationFingerprint', (v_upload).reservation_fingerprint,
      'sizeBytes', (v_upload).reserved_size,
      'mimeType', (v_upload).declared_mime,
      'expiresAt', pg_catalog.to_char((v_upload).expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
    return;
  end if;

  if pg_catalog.btrim(coalesce(p_idempotency_key, '')) = ''
     or p_http_method <> 'POST' or p_operation_path not like '/api/%'
     or pg_catalog.btrim(coalesce(p_request_hash, '')) = '' then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_company_id::text || ':' || v_actor.user_id::text || ':' || p_idempotency_key || ':' ||
    p_http_method || ':' || p_operation_path, 0
  ));
  delete from public.idempotency_records
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and expires_at <= v_now;
  select idempotency.request_hash, idempotency.result_snapshot into v_existing
    from public.idempotency_records idempotency
   where company_id = p_company_id and actor_user_id = v_actor.user_id
     and idempotency_key = p_idempotency_key and http_method = p_http_method
     and operation_path = p_operation_path and status = 'COMPLETED';
  if found then
    return query select
      case when v_existing.request_hash = p_request_hash then 'REPLAYED' else 'IDEMPOTENCY_CONFLICT' end::text,
      case when v_existing.request_hash = p_request_hash then v_existing.result_snapshot else null::jsonb end;
    return;
  end if;

  if p_action = 'UPLOAD_INIT' then
    if not exists (
      select 1 from public.inspection_item_snapshots snapshot
      join public.hotel_inspections inspection
        on inspection.company_id = snapshot.company_id and inspection.id = snapshot.inspection_id
       where snapshot.company_id = p_company_id and snapshot.branch_id = p_branch_id
         and snapshot.inspection_id = (p_value ->> 'inspectionId')::uuid
         and snapshot.id = (p_value ->> 'itemSnapshotId')::uuid
         and inspection.status = 'PENDING_INPUT'
    ) then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    select pg_catalog.count(*), coalesce(pg_catalog.sum(upload.reserved_size), 0)
      into v_total_count, v_total_size
      from public.hotel_file_uploads upload
     where upload.company_id = p_company_id and upload.branch_id = p_branch_id
       and upload.item_snapshot_id = (p_value ->> 'itemSnapshotId')::uuid
       and upload.status not in ('EXPIRED', 'REJECTED', 'SCAN_FAILED');
    if v_total_count >= 20
       or v_total_size + (p_value ->> 'sizeBytes')::bigint > 209715200 then
      return query select 'FILE_QUOTA_EXCEEDED'::text, null::jsonb; return;
    end if;
    if (p_value ->> 'quarantineObjectKey') !~ '^quarantine/[0-9a-f-]{36}/[A-Za-z0-9_-]{43}$'
       or (p_value ->> 'reservationFingerprint') !~ '^[a-f0-9]{64}$'
       or (p_value ->> 'mimeType') not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')
       or (p_value ->> 'sizeBytes')::bigint not between 1 and 20971520 then
      return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb; return;
    end if;
    insert into public.hotel_file_uploads (
      id, company_id, branch_id, parent_type, inspection_id, item_snapshot_id,
      display_name, declared_mime, reserved_size, quarantine_object_key,
      reservation_fingerprint, status, initiated_by, initiated_session_id,
      expires_at
    ) values (
      p_resource_id, p_company_id, p_branch_id, 'INSPECTION_ITEM_EVIDENCE',
      (p_value ->> 'inspectionId')::uuid, (p_value ->> 'itemSnapshotId')::uuid,
      p_value ->> 'fileName', p_value ->> 'mimeType', (p_value ->> 'sizeBytes')::bigint,
      p_value ->> 'quarantineObjectKey', p_value ->> 'reservationFingerprint',
      'PENDING_UPLOAD', v_actor.user_id, v_actor.session_id, v_now + interval '5 minutes'
    );
    v_snapshot := pg_catalog.jsonb_build_object(
      'id', p_resource_id, 'status', 'PENDING_UPLOAD',
      'expiresAt', pg_catalog.to_char((v_now + interval '5 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  else
    select upload.* into v_upload
      from public.hotel_file_uploads upload
     where upload.company_id = p_company_id and upload.branch_id = p_branch_id
       and upload.id = p_resource_id and upload.initiated_by = v_actor.user_id
       and upload.initiated_session_id = v_actor.session_id
     for update;
    if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
    if (v_upload).status = 'QUARANTINED'
       and (v_upload).source_etag = p_value ->> 'etag'
       and (v_upload).source_object_version = p_value ->> 'objectVersion' then
      v_snapshot := public.hotel_file_status_snapshot_v1(p_company_id, p_resource_id);
    elsif (v_upload).status <> 'PENDING_UPLOAD' or (v_upload).expires_at <= v_now then
      if (v_upload).status = 'PENDING_UPLOAD' and (v_upload).expires_at <= v_now then
        update public.hotel_file_uploads set status = 'EXPIRED', failure_code = 'UPLOAD_EXPIRED',
          quota_released_at = v_now, updated_at = v_now
         where company_id = p_company_id and id = p_resource_id;
      end if;
      return query select 'FILE_UPLOAD_EXPIRED'::text, null::jsonb; return;
    elsif (p_value ->> 'reservationFingerprint') <> (v_upload).reservation_fingerprint
       or (p_value ->> 'etag') !~ '^"[a-f0-9]{32}"$'
       or pg_catalog.btrim(coalesce(p_value ->> 'objectVersion', '')) = ''
       or (p_value ->> 'sizeBytes')::bigint <> (v_upload).reserved_size
       or p_value ->> 'mimeType' <> (v_upload).declared_mime then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    else
      v_scan_job_id := (p_value ->> 'scanJobId')::uuid;
      update public.hotel_file_uploads set status = 'QUARANTINED',
        source_etag = p_value ->> 'etag', source_object_version = p_value ->> 'objectVersion',
        updated_at = v_now
       where company_id = p_company_id and id = p_resource_id;
      insert into public.outbox_jobs (
        id, company_id, branch_id, job_type, payload, status, available_at
      ) values (
        v_scan_job_id, p_company_id, p_branch_id, 'HOTEL_FILE_SCAN',
        pg_catalog.jsonb_build_object('schemaVersion', 1, 'jobId', v_scan_job_id::text),
        'PENDING', v_now
      );
      insert into public.hotel_file_scan_jobs (
        id, company_id, branch_id, upload_id, dispatch_job_id, status
      ) values (
        v_scan_job_id, p_company_id, p_branch_id, p_resource_id, v_scan_job_id, 'PENDING'
      );
      v_snapshot := public.hotel_file_status_snapshot_v1(p_company_id, p_resource_id);
    end if;
  end if;

  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, reason, result, trace_id
  ) values (
    p_audit_event_id, case when p_action = 'UPLOAD_INIT' then 'HOTEL_FILE_UPLOAD_INITIATED' else 'HOTEL_FILE_UPLOAD_COMPLETED' end,
    v_actor.user_id, v_actor.user_type, v_actor.session_id, p_company_id,
    p_branch_id, 'HOTEL_FILE_UPLOAD', p_resource_id,
    pg_catalog.jsonb_build_object('resourceId', p_resource_id), null, 'SUCCEEDED', p_trace_id
  );
  insert into public.idempotency_records (
    id, company_id, actor_user_id, idempotency_key, http_method,
    operation_path, request_hash, status, resource_type, resource_id,
    audit_event_id, result_snapshot, completed_at, expires_at
  ) values (
    p_idempotency_record_id, p_company_id, v_actor.user_id, p_idempotency_key,
    p_http_method, p_operation_path, p_request_hash, 'COMPLETED',
    'HOTEL_FILE_UPLOAD', p_resource_id, p_audit_event_id, v_snapshot,
    v_now, v_now + interval '24 hours'
  );
  return query select case when p_action = 'UPLOAD_INIT' then 'CREATED' else 'UPDATED' end::text, v_snapshot;
exception
  when invalid_text_representation or foreign_key_violation or check_violation then
    return query select 'INVALID_STATE_TRANSITION'::text, null::jsonb;
  when unique_violation then
    return query select 'DUPLICATE'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_file_command_v1(uuid, uuid, uuid, text, integer, jsonb, text, uuid, text, text, text, text, uuid, uuid) from public;

create function public.hotel_file_scan_command_v1(
  p_upload_id uuid, p_action text, p_claim_token text, p_generation bigint,
  p_value jsonb, p_trace_id uuid
)
returns table (command_status text, result_snapshot jsonb)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_job public.hotel_file_scan_jobs%rowtype;
  v_upload public.hotel_file_uploads%rowtype;
  v_file_version_id uuid;
  v_token_hash bytea;
  v_snapshot jsonb;
begin
  if not public.file_finalizer_has_capability()
     or p_action not in ('CLAIM', 'SCAN_CLEAN', 'PROMOTE_COMPLETE', 'REJECT', 'FAIL')
     or p_claim_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'FORBIDDEN'::text, null::jsonb; return;
  end if;
  v_token_hash := pg_catalog.sha256(pg_catalog.convert_to(p_claim_token, 'UTF8'));
  select job.* into v_job
    from public.hotel_file_scan_jobs job
   where job.upload_id = p_upload_id
   for update;
  if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;
  select upload.* into v_upload
    from public.hotel_file_uploads upload
   where upload.company_id = v_job.company_id
     and upload.id = v_job.upload_id
   for update;
  if not found then return query select 'NOT_FOUND'::text, null::jsonb; return; end if;

  if p_action = 'CLAIM' then
    if (v_job).status = 'CLAIMED' and (v_job).claim_token_hash = v_token_hash
       and (v_job).claim_expires_at > v_now then
      return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
        'jobId', (v_job).id, 'generation', (v_job).claim_generation,
        'quarantineObjectKey', v_upload.quarantine_object_key,
        'sourceEtag', v_upload.source_etag,
        'sourceObjectVersion', v_upload.source_object_version,
        'sizeBytes', v_upload.reserved_size, 'mimeType', v_upload.declared_mime
      );
      return;
    end if;
    if (v_job).status not in ('PENDING', 'CLAIMED')
       or (v_job).status = 'CLAIMED' and (v_job).claim_expires_at > v_now
       or (v_job).available_at > v_now then
      return query select 'BUSY'::text, null::jsonb; return;
    end if;
    update public.hotel_file_scan_jobs job set status = 'CLAIMED',
      claim_token_hash = v_token_hash, claim_generation = job.claim_generation + 1,
      claim_expires_at = v_now + interval '5 minutes',
      attempt_count = job.attempt_count + 1, updated_at = v_now
     where job.id = (v_job).id
     returning job.claim_generation into p_generation;
    update public.hotel_file_uploads set status = 'SCANNING', updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    return query select 'CLAIMED'::text, pg_catalog.jsonb_build_object(
      'jobId', (v_job).id, 'generation', p_generation,
      'quarantineObjectKey', v_upload.quarantine_object_key,
      'sourceEtag', v_upload.source_etag,
      'sourceObjectVersion', v_upload.source_object_version,
      'sizeBytes', v_upload.reserved_size, 'mimeType', v_upload.declared_mime
    );
    return;
  end if;

  if (v_job).claim_token_hash <> v_token_hash
     or (v_job).claim_generation <> p_generation
     or (v_job).claim_expires_at <= v_now then
    return query select 'STALE_CLAIM'::text, null::jsonb; return;
  end if;

  if p_action = 'SCAN_CLEAN' then
    if (v_job).status = 'CLEAN_PENDING_PROMOTION' then
      if (p_value ->> 'fileVersionId')::uuid is distinct from (v_job).file_version_id then
        return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
      end if;
      return query select 'REPLAYED'::text, pg_catalog.jsonb_build_object(
        'fileVersionId', (v_job).file_version_id,
        'cleanObjectKey', (v_job).clean_object_key,
        'generation', (v_job).claim_generation
      );
      return;
    end if;
    if (v_job).status <> 'CLAIMED'
       or (p_value ->> 'scannerSha256') !~ '^[a-f0-9]{64}$'
       or (p_value ->> 'detectedMime') not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic')
       or (p_value ->> 'cleanObjectKey') is distinct from ('clean/' || (p_value ->> 'fileVersionId')) then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    end if;
    update public.hotel_file_scan_jobs set status = 'CLEAN_PENDING_PROMOTION',
      scanner_sha256 = pg_catalog.decode(p_value ->> 'scannerSha256', 'hex'),
      detected_mime = p_value ->> 'detectedMime',
      file_version_id = (p_value ->> 'fileVersionId')::uuid,
      clean_object_key = p_value ->> 'cleanObjectKey', updated_at = v_now
     where id = (v_job).id;
    update public.hotel_file_uploads set status = 'CLEAN_PENDING_PROMOTION', updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    return query select 'RECORDED'::text, pg_catalog.jsonb_build_object(
      'fileVersionId', p_value ->> 'fileVersionId',
      'cleanObjectKey', p_value ->> 'cleanObjectKey', 'generation', p_generation
    );
    return;
  elsif p_action = 'PROMOTE_COMPLETE' then
    if (v_job).status = 'COMPLETED' then
      v_snapshot := public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id);
      return query select 'REPLAYED'::text, v_snapshot; return;
    end if;
    if (v_job).status <> 'CLEAN_PENDING_PROMOTION'
       or (p_value ->> 'fileVersionId')::uuid is distinct from (v_job).file_version_id
       or (p_value ->> 'cleanSha256') !~ '^[a-f0-9]{64}$'
       or (p_value ->> 'cleanEtag') !~ '^"[a-f0-9]{32}"$'
       or pg_catalog.btrim(coalesce(p_value ->> 'cleanObjectVersion', '')) = ''
       or (p_value ->> 'cleanSize')::bigint not between 1 and 20971520
       or (p_value ->> 'exifLocationRemoved')::boolean is not true then
      return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb; return;
    end if;
    v_file_version_id := (v_job).file_version_id;
    insert into public.hotel_file_versions (
      id, company_id, branch_id, upload_id, clean_object_key, clean_etag,
      clean_object_version, clean_sha256, clean_size, detected_mime,
      display_name, exif_location_removed, original_retention_until
    ) values (
      v_file_version_id, (v_job).company_id, (v_job).branch_id, p_upload_id,
      (v_job).clean_object_key, p_value ->> 'cleanEtag',
      p_value ->> 'cleanObjectVersion', pg_catalog.decode(p_value ->> 'cleanSha256', 'hex'),
      (p_value ->> 'cleanSize')::bigint, (v_job).detected_mime,
      v_upload.display_name, true, v_now + interval '1 year'
    );
    update public.hotel_file_scan_jobs set status = 'COMPLETED',
      clean_etag = p_value ->> 'cleanEtag', clean_object_version = p_value ->> 'cleanObjectVersion',
      clean_sha256 = pg_catalog.decode(p_value ->> 'cleanSha256', 'hex'),
      clean_size = (p_value ->> 'cleanSize')::bigint,
      completed_at = v_now, updated_at = v_now
     where id = (v_job).id;
    update public.hotel_file_uploads set status = 'READY_UNLINKED',
      quota_released_at = v_now, updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    update public.outbox_jobs set status = 'SUCCEEDED', completed_at = v_now, updated_at = v_now
     where id = (v_job).dispatch_job_id;
    v_snapshot := public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id);
    return query select 'COMPLETED'::text, v_snapshot; return;
  elsif p_action = 'REJECT' then
    update public.hotel_file_scan_jobs set status = 'FAILED',
      scanner_sha256 = null, detected_mime = null, file_version_id = null,
      clean_object_key = null, clean_etag = null, clean_object_version = null,
      clean_sha256 = null, clean_size = null,
      failure_code = case when p_value ->> 'failureCode' = 'MALWARE_DETECTED' then 'MALWARE_DETECTED' else 'SOURCE_INTEGRITY' end,
      completed_at = v_now, updated_at = v_now where id = (v_job).id;
    update public.hotel_file_uploads set status = 'REJECTED',
      failure_code = case when p_value ->> 'failureCode' = 'MALWARE_DETECTED' then 'MALWARE_DETECTED' else 'SOURCE_INTEGRITY' end,
      quota_released_at = v_now, updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    update public.outbox_jobs set status = 'CANCELLED', completed_at = v_now,
      last_error_code = 'FILE_REJECTED', updated_at = v_now
     where id = (v_job).dispatch_job_id;
    return query select 'REJECTED'::text, public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id); return;
  else
    if (v_job).attempt_count >= 5 then
      update public.hotel_file_scan_jobs set status = 'FAILED', failure_code = 'SCAN_ENGINE',
        scanner_sha256 = null, detected_mime = null, file_version_id = null,
        clean_object_key = null, clean_etag = null, clean_object_version = null,
        clean_sha256 = null, clean_size = null,
        completed_at = v_now, updated_at = v_now where id = (v_job).id;
      update public.hotel_file_uploads set status = 'SCAN_FAILED', failure_code = 'SCAN_ENGINE',
        quota_released_at = v_now, updated_at = v_now
       where company_id = (v_job).company_id and id = p_upload_id;
      update public.outbox_jobs set status = 'CANCELLED', completed_at = v_now,
        last_error_code = 'SCAN_ENGINE', updated_at = v_now where id = (v_job).dispatch_job_id;
      return query select 'SCAN_FAILED'::text, public.hotel_file_status_snapshot_v1((v_job).company_id, p_upload_id); return;
    end if;
    update public.hotel_file_scan_jobs set status = 'PENDING', claim_token_hash = null,
      claim_expires_at = null, available_at = v_now + pg_catalog.make_interval(secs => least(300, 5 * (2 ^ (v_job).attempt_count)::integer)),
      scanner_sha256 = null, detected_mime = null, file_version_id = null,
      clean_object_key = null, clean_etag = null, clean_object_version = null,
      clean_sha256 = null, clean_size = null,
      updated_at = v_now where id = (v_job).id;
    update public.hotel_file_uploads set status = 'QUARANTINED', updated_at = v_now
     where company_id = (v_job).company_id and id = p_upload_id;
    update public.outbox_jobs set status = 'FAILED', attempt_count = attempt_count + 1,
      available_at = v_now + interval '30 seconds', last_error_code = 'SCAN_ENGINE', updated_at = v_now
     where id = (v_job).dispatch_job_id;
    return query select 'RETRY_SCHEDULED'::text, null::jsonb; return;
  end if;
exception
  when invalid_text_representation or check_violation or foreign_key_violation then
    return query select 'FILE_INTEGRITY_MISMATCH'::text, null::jsonb;
end
$function$;
revoke all on function public.hotel_file_scan_command_v1(uuid, text, text, bigint, jsonb, uuid) from public;

create function public.hotel_inspection_claim_materialization_v1(
  p_routine_id uuid, p_claim_token bytea, p_lease_seconds integer
)
returns table (result_status text, claim_generation bigint, from_date date, through_date date)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_company_id uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_today date := (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date;
  v_routine public.inspection_routines%rowtype;
  v_revision public.inspection_routine_revisions%rowtype;
  v_from date;
  v_through date;
  v_generation bigint;
begin
  if not public.runtime_has_capability('RECONCILER')
     or pg_catalog.octet_length(p_claim_token) <> 32
     or p_lease_seconds not between 30 and 900 then
    return query select 'FORBIDDEN'::text, null::bigint, null::date, null::date; return;
  end if;
  v_company_id := public.reconciler_current_company_id();
  if v_company_id is null then
    return query select 'FORBIDDEN'::text, null::bigint, null::date, null::date; return;
  end if;
  select routine.* into v_routine
    from public.inspection_routines routine
   where routine.company_id = v_company_id and routine.id = p_routine_id
   for update;
  if not found then
    return query select 'NOT_FOUND'::text, null::bigint, null::date, null::date; return;
  end if;
  select revision.* into v_revision
    from public.inspection_routine_revisions revision
   where revision.company_id = v_company_id
     and revision.id = v_routine.current_revision_id;
  if not found or v_routine.status <> 'ACTIVE' then
    return query select 'NOT_FOUND'::text, null::bigint, null::date, null::date; return;
  end if;
  if v_routine.claim_token_hash is not null and v_routine.claim_expires_at > v_now then
    return query select 'BUSY'::text, v_routine.claim_generation, null::date, null::date; return;
  end if;
  v_from := greatest(
    v_revision.start_date,
    coalesce(v_routine.materialized_through_date + 1, v_revision.start_date),
    v_today - 31
  );
  v_through := least(v_today, coalesce(v_revision.end_date, v_today));
  if v_from > v_through then
    return query select 'NOT_DUE'::text, v_routine.claim_generation, v_from, v_through; return;
  end if;
  update public.inspection_routines routine set claim_token_hash = p_claim_token,
    claim_generation = routine.claim_generation + 1,
    claim_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
    updated_at = v_now
   where routine.company_id = v_company_id and routine.id = p_routine_id
   returning routine.claim_generation into v_generation;
  return query select 'CLAIMED'::text, v_generation, v_from, v_through;
end
$function$;
revoke all on function public.hotel_inspection_claim_materialization_v1(uuid, bytea, integer) from public;

create function public.hotel_inspection_complete_materialization_v1(
  p_routine_id uuid, p_claim_generation bigint, p_claim_token bytea, p_trace_id uuid
)
returns table (result_status text, created_count integer)
language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  v_company_id uuid;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_today date := (pg_catalog.statement_timestamp() at time zone 'Asia/Seoul')::date;
  v_routine public.inspection_routines%rowtype;
  v_revision public.inspection_routine_revisions%rowtype;
  v_business_date date;
  v_from date;
  v_through date;
  v_due boolean;
  v_round_count integer;
  v_round_order integer;
  v_round public.inspection_routine_rounds%rowtype;
  v_occurrence_index integer := 0;
  v_inspection_id uuid;
  v_execution_id uuid;
  v_checklist_revision_id uuid;
  v_created integer := 0;
begin
  if not public.runtime_has_capability('RECONCILER')
     or pg_catalog.octet_length(p_claim_token) <> 32 then
    return query select 'FORBIDDEN'::text, 0; return;
  end if;
  v_company_id := public.reconciler_current_company_id();
  select routine.* into v_routine
    from public.inspection_routines routine
   where routine.company_id = v_company_id and routine.id = p_routine_id
   for update;
  if not found then return query select 'NOT_FOUND'::text, 0; return; end if;
  select revision.* into v_revision
    from public.inspection_routine_revisions revision
   where revision.company_id = v_company_id
     and revision.id = v_routine.current_revision_id;
  if not found then return query select 'NOT_FOUND'::text, 0; return; end if;
  if v_routine.claim_generation <> p_claim_generation
     or v_routine.claim_token_hash <> p_claim_token
     or v_routine.claim_expires_at <= v_now then
    return query select 'STALE_CLAIM'::text, 0; return;
  end if;
  select revision.id into v_checklist_revision_id
    from public.inspection_checklist_revisions revision
   where revision.company_id = v_company_id and revision.branch_id = v_routine.branch_id
   order by revision.version desc limit 1;
  if not found then return query select 'INSPECTION_CHECKLIST_EMPTY'::text, 0; return; end if;
  if not exists (
    select 1 from public.process_definition_revisions revision
     where revision.company_id = v_company_id and revision.id = v_revision.process_revision_id
  ) then return query select 'PROCESS_DEFAULT_REQUIRED'::text, 0; return; end if;
  select pg_catalog.count(*) into v_round_count
    from public.inspection_routine_rounds round_record
   where round_record.company_id = v_company_id
     and round_record.revision_id = v_revision.id;
  v_from := greatest(
    v_revision.start_date,
    coalesce(v_routine.materialized_through_date + 1, v_revision.start_date),
    v_today - 31
  );
  v_through := least(v_today, coalesce(v_revision.end_date, v_today));

  for v_business_date in select value::date from pg_catalog.generate_series(v_from, v_through, interval '1 day') value loop
    v_due := case v_revision.recurrence_type
      when 'DAILY' then true
      when 'WEEKLY' then extract(isodow from v_business_date)::integer = case v_revision.day_of_week
        when 'MONDAY' then 1 when 'TUESDAY' then 2 when 'WEDNESDAY' then 3
        when 'THURSDAY' then 4 when 'FRIDAY' then 5 when 'SATURDAY' then 6 else 7 end
      when 'MONTHLY' then (
        v_revision.day_of_month <= extract(day from (date_trunc('month', v_business_date) + interval '1 month - 1 day'))
        and extract(day from v_business_date)::integer = v_revision.day_of_month
      )
      when 'INTERVAL_DAYS' then (v_business_date - v_revision.start_date) % v_revision.recurrence_interval = 0
      when 'INTERVAL_WEEKS' then (v_business_date - v_revision.start_date) % (7 * v_revision.recurrence_interval) = 0
      when 'INTERVAL_MONTHS' then
        ((extract(year from v_business_date)::integer * 12 + extract(month from v_business_date)::integer)
         - (extract(year from v_revision.start_date)::integer * 12 + extract(month from v_revision.start_date)::integer))
          % v_revision.recurrence_interval = 0
        and extract(day from v_business_date) = extract(day from v_revision.start_date)
      else false
    end;
    if not v_due then continue; end if;
    v_occurrence_index := v_occurrence_index + 1;
    v_round_order := case when v_revision.mode = 'FIXED' then 1 else ((v_occurrence_index - 1) % v_round_count) + 1 end;
    select round_record.* into v_round
      from public.inspection_routine_rounds round_record
     where round_record.company_id = v_company_id
       and round_record.revision_id = v_revision.id
       and round_record.round_order = v_round_order;
    if not exists (
      select 1 from public.hotel_rooms room
       where room.company_id = v_company_id and room.branch_id = v_routine.branch_id
         and room.status = 'ACTIVE'
         and (
           v_round.target_type = 'HOTEL'
           or (v_round.target_type = 'FLOOR' and room.floor_label in (select value #>> '{}' from pg_catalog.jsonb_array_elements(v_round.target_value -> 'floorLabels')))
           or (v_round.target_type = 'ROOM_TYPE' and room.room_type_id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomTypeIds')))
           or (v_round.target_type = 'ROOMS' and room.id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomIds')))
         )
    ) then continue; end if;
    v_inspection_id := pg_catalog.gen_random_uuid();
    v_execution_id := pg_catalog.gen_random_uuid();
    insert into public.process_executions (
      id, company_id, branch_id, application_type, resource_id,
      definition_id, revision_id, state, created_by
    ) values (
      v_execution_id, v_company_id, v_routine.branch_id, 'ROOM_INSPECTION',
      v_inspection_id, v_revision.process_definition_id,
      v_revision.process_revision_id, 'PENDING_INPUT', null
    );
    insert into public.hotel_inspections (
      id, company_id, branch_id, source, routine_id, routine_revision_id,
      routine_round_order, business_date, due_at, status, process_execution_id,
      created_by
    ) values (
      v_inspection_id, v_company_id, v_routine.branch_id, 'ROUTINE',
      p_routine_id, v_revision.id, v_round_order, v_business_date,
      (v_business_date::timestamp + v_revision.local_due_time) at time zone 'Asia/Seoul',
      'PENDING_INPUT', v_execution_id, null
    ) on conflict do nothing;
    if not found then
      delete from public.process_executions where company_id = v_company_id and id = v_execution_id;
      continue;
    end if;
    insert into public.inspection_item_snapshots (
      id, company_id, branch_id, inspection_id, room_id, source_item_id,
      checklist_revision_id, name, description, is_required, display_order,
      default_severity
    )
    select pg_catalog.gen_random_uuid(), v_company_id, v_routine.branch_id,
           v_inspection_id, room.id, item.source_item_id, v_checklist_revision_id,
           item.name, item.description, item.is_required, item.display_order,
           item.default_severity
      from public.hotel_rooms room
      join public.inspection_checklist_items item
        on item.company_id = room.company_id and item.revision_id = v_checklist_revision_id
     where room.company_id = v_company_id and room.branch_id = v_routine.branch_id
       and room.status = 'ACTIVE'
       and (
         v_round.target_type = 'HOTEL'
         or (v_round.target_type = 'FLOOR' and room.floor_label in (select value #>> '{}' from pg_catalog.jsonb_array_elements(v_round.target_value -> 'floorLabels')))
         or (v_round.target_type = 'ROOM_TYPE' and room.room_type_id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomTypeIds')))
         or (v_round.target_type = 'ROOMS' and room.id in (select (value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_round.target_value -> 'roomIds')))
       )
       and (
         (item.source = 'HOTEL_COMMON' and not exists (
           select 1 from public.inspection_checklist_item_exclusions exclusion
            where exclusion.company_id = v_company_id and exclusion.checklist_item_id = item.id
              and exclusion.room_type_id = room.room_type_id
         ))
         or (item.source = 'ROOM_TYPE_ADDED' and item.room_type_id = room.room_type_id)
       );
    v_created := v_created + 1;
  end loop;
  update public.inspection_routines set materialized_through_date = v_through,
    next_due_date = v_through + 1, claim_token_hash = null, claim_expires_at = null,
    updated_at = v_now
   where company_id = v_company_id and id = p_routine_id;
  insert into public.audit_events (
    id, event_code, actor_user_id, actor_type, session_id, company_id,
    branch_id, resource_type, resource_id, after_summary, result, trace_id
  ) values (
    pg_catalog.gen_random_uuid(), 'HOTEL_INSPECTION_MATERIALIZED', null,
    'SYSTEM', null, v_company_id, v_routine.branch_id,
    'INSPECTION_ROUTINE', p_routine_id,
    pg_catalog.jsonb_build_object('createdCount', v_created, 'throughDate', v_through),
    'SUCCEEDED', p_trace_id
  );
  return query select 'COMPLETED'::text, v_created;
exception
  when unique_violation then
    return query select 'REPLAYED'::text, v_created;
end
$function$;
revoke all on function public.hotel_inspection_complete_materialization_v1(uuid, bigint, bytea, uuid) from public;

insert into schema_migrations (version)
values ('0026_hotel_inspection_process_and_files');

commit;
