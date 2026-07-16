begin;

create table schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table companies (
  id uuid primary key,
  legal_name text not null check (btrim(legal_name) <> ''),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  company_id uuid not null references companies(id),
  user_type text not null check (user_type in ('INTERNAL_STAFF', 'ROOM_OPERATIONS', 'BRANCH_OWNER')),
  display_name text not null check (btrim(display_name) <> ''),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'LOCKED')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);

create table auth_identities (
  id uuid primary key,
  company_id uuid not null,
  user_id uuid not null,
  provider text not null check (provider = 'ZITADEL'),
  provider_subject text not null check (btrim(provider_subject) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (company_id, id),
  unique (company_id, id, user_id),
  foreign key (company_id, user_id) references users(company_id, id)
);

create table auth_sessions (
  id uuid primary key,
  company_id uuid not null,
  user_id uuid not null,
  identity_id uuid not null,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text,
  auth_time timestamptz not null,
  authentication_method text not null,
  session_version integer not null default 1 check (session_version >= 1),
  unique (company_id, id),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, identity_id, user_id) references auth_identities(company_id, id, user_id),
  check (octet_length(token_hash) = 32),
  check (idle_expires_at > created_at),
  check (absolute_expires_at >= idle_expires_at),
  check (
    (revoked_at is null and revoke_reason is null)
    or (revoked_at is not null and coalesce(btrim(revoke_reason), '') <> '')
  )
);

create index auth_sessions_active_lookup_idx
  on auth_sessions (token_hash, idle_expires_at, absolute_expires_at)
  where revoked_at is null;

create table branches (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_type text not null check (branch_type = 'HOTEL'),
  branch_code text not null check (btrim(branch_code) <> ''),
  name text not null check (btrim(name) <> ''),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, branch_code)
);

create table hotel_profiles (
  company_id uuid not null,
  branch_id uuid not null,
  hotel_status text not null default 'PREPARING' check (hotel_status in ('PREPARING', 'ACTIVE', 'SUSPENDED')),
  business_timezone text not null default 'Asia/Seoul' check (business_timezone = 'Asia/Seoul'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, branch_id),
  foreign key (company_id, branch_id) references branches(company_id, id)
);

create table roles (
  id uuid primary key,
  company_id uuid not null references companies(id),
  name text not null check (btrim(name) <> ''),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  is_system boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);

create table permissions (
  code text primary key check (code ~ '^[A-Z][A-Z0-9_]+$'),
  description text not null,
  created_at timestamptz not null default now()
);

create table user_groups (
  id uuid primary key,
  company_id uuid not null references companies(id),
  name text not null check (btrim(name) <> ''),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by uuid not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name),
  foreign key (company_id, created_by) references users(company_id, id)
);

create table user_group_memberships (
  id uuid primary key,
  company_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  granted_by uuid not null,
  reason text not null check (btrim(reason) <> ''),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, group_id) references user_groups(company_id, id),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, granted_by) references users(company_id, id),
  check (valid_until is null or valid_from < valid_until)
);

create index user_group_memberships_effective_idx
  on user_group_memberships (company_id, user_id, valid_from, valid_until);

create function reject_access_subject_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'access subjects are deactivated, not deleted' using errcode = '55000';
end;
$$;

create trigger users_no_delete
before delete on users
for each row execute function reject_access_subject_delete();

create trigger roles_no_delete
before delete on roles
for each row execute function reject_access_subject_delete();

create trigger user_groups_no_delete
before delete on user_groups
for each row execute function reject_access_subject_delete();

create trigger users_no_rekey
before update of id, company_id on users
for each row execute function reject_access_subject_delete();

create trigger roles_no_rekey
before update of id, company_id on roles
for each row execute function reject_access_subject_delete();

create trigger user_groups_no_rekey
before update of id, company_id on user_groups
for each row execute function reject_access_subject_delete();

create table user_role_memberships (
  id uuid primary key,
  company_id uuid not null,
  user_id uuid not null,
  role_id uuid not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  granted_by uuid not null,
  reason text not null check (btrim(reason) <> ''),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, role_id) references roles(company_id, id),
  foreign key (company_id, granted_by) references users(company_id, id),
  check (valid_until is null or valid_from < valid_until)
);

create index user_role_memberships_effective_idx
  on user_role_memberships (company_id, user_id, valid_from, valid_until);

create table permission_grants (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid,
  subject_type text not null check (subject_type in ('ROLE', 'GROUP', 'USER')),
  subject_id uuid not null,
  permission_code text not null references permissions(code),
  effect text not null check (effect in ('ALLOW', 'DENY')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  granted_by uuid not null,
  reason text not null check (btrim(reason) <> ''),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, granted_by) references users(company_id, id),
  check (valid_until is null or valid_from < valid_until)
);

create function enforce_permission_grant_subject()
returns trigger
language plpgsql
as $$
begin
  if new.subject_type = 'ROLE' and not exists (
    select 1 from roles where company_id = new.company_id and id = new.subject_id
  ) then
    raise foreign_key_violation using message = 'permission role subject does not exist';
  elsif new.subject_type = 'GROUP' and not exists (
    select 1 from user_groups where company_id = new.company_id and id = new.subject_id
  ) then
    raise foreign_key_violation using message = 'permission group subject does not exist';
  elsif new.subject_type = 'USER' and not exists (
    select 1 from users where company_id = new.company_id and id = new.subject_id
  ) then
    raise foreign_key_violation using message = 'permission user subject does not exist';
  end if;
  return new;
end;
$$;

create trigger permission_grants_subject_guard
before insert or update of company_id, subject_type, subject_id on permission_grants
for each row execute function enforce_permission_grant_subject();

create unique index permission_grants_unique_scope_idx
  on permission_grants (
    company_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    subject_type,
    subject_id,
    permission_code,
    effect,
    valid_from
  );

create table audit_events (
  id uuid primary key,
  event_code text not null check (btrim(event_code) <> ''),
  actor_user_id uuid,
  actor_type text not null,
  session_id uuid,
  company_id uuid not null references companies(id),
  branch_id uuid,
  resource_type text not null check (btrim(resource_type) <> ''),
  resource_id uuid,
  before_summary jsonb,
  after_summary jsonb,
  reason text,
  result text not null check (result in ('SUCCEEDED', 'DENIED', 'FAILED')),
  trace_id uuid not null,
  occurred_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, actor_user_id) references users(company_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, session_id) references auth_sessions(company_id, id)
);

create index audit_events_scope_time_idx
  on audit_events (company_id, branch_id, occurred_at desc);

create function reject_audit_event_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are append-only' using errcode = '55000';
end;
$$;

create trigger audit_events_no_update
before update or delete on audit_events
for each row execute function reject_audit_event_change();

create table idempotency_records (
  id uuid primary key,
  company_id uuid not null references companies(id),
  actor_user_id uuid not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  http_method text not null check (http_method in ('POST', 'PUT', 'PATCH', 'DELETE')),
  operation_path text not null check (operation_path like '/api/%'),
  request_hash text not null check (btrim(request_hash) <> ''),
  status text not null check (status in ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  resource_type text,
  resource_id uuid,
  audit_event_id uuid,
  result_schema_version integer not null default 1 check (result_schema_version >= 1),
  result_snapshot jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  foreign key (company_id, actor_user_id) references users(company_id, id),
  foreign key (company_id, audit_event_id) references audit_events(company_id, id),
  unique (company_id, actor_user_id, idempotency_key, http_method, operation_path),
  check (expires_at > created_at),
  check ((status = 'COMPLETED' and completed_at is not null) or status <> 'COMPLETED')
);

create index idempotency_records_expiry_idx on idempotency_records (expires_at);

create table outbox_jobs (
  id uuid primary key,
  company_id uuid not null references companies(id),
  branch_id uuid,
  job_type text not null check (btrim(job_type) <> ''),
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id)
);

create index outbox_jobs_ready_idx
  on outbox_jobs (status, available_at)
  where status in ('PENDING', 'FAILED');

insert into schema_migrations (version) values ('0001_platform_foundation');

commit;
