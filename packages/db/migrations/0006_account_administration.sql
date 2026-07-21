begin;

create extension if not exists btree_gist;

alter table outbox_jobs
  add column claim_token uuid,
  add column dead_lettered_at timestamptz;

alter table outbox_jobs drop constraint outbox_jobs_status_check;
alter table outbox_jobs add constraint outbox_jobs_status_check
  check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTER'));

alter table users drop constraint users_user_type_check;
alter table users add constraint users_user_type_check
  check (user_type in (
    'INTERNAL_STAFF',
    'ROOM_OPERATIONS', 'HOUSEKEEPING',
    'BRANCH_OWNER', 'HOTEL_OWNER'
  ));

alter table users drop constraint users_status_check;
alter table users add constraint users_status_check
  check (status in ('PENDING_SETUP', 'ACTIVE', 'INACTIVE', 'LOCKED'));
alter table users
  add column login_name text,
  add column email text,
  add column must_change_password boolean not null default false;

alter table auth_sessions
  add constraint auth_sessions_company_id_id_user_id_unique
  unique (company_id, id, user_id);

alter table users add constraint users_login_name_nonempty
  check (login_name is null or btrim(login_name) <> '');
alter table users add constraint users_email_nonempty
  check (email is null or btrim(email) <> '');
create unique index users_login_name_unique_idx
  on users (company_id, lower(btrim(login_name))) where login_name is not null;
create unique index users_email_unique_idx
  on users (company_id, lower(btrim(email))) where email is not null;

create table hotel_staff_assignments (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null,
  assignment_type text not null default 'PRIMARY' check (assignment_type in ('PRIMARY', 'SUPPORT')),
  start_date date not null,
  end_date date,
  reason text not null check (btrim(reason) <> ''),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  check (end_date is null or end_date >= start_date)
);

create unique index hotel_staff_assignments_active_primary_user_unique_idx
  on hotel_staff_assignments (company_id, user_id)
  where end_date is null and assignment_type = 'PRIMARY';
create index hotel_staff_assignments_active_lookup_idx
  on hotel_staff_assignments (company_id, user_id, assignment_type, start_date desc)
  include (branch_id)
  where end_date is null;
alter table hotel_staff_assignments
  add constraint hotel_staff_assignments_primary_period_excl
  exclude using gist (
    company_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (assignment_type = 'PRIMARY');

create table housekeeping_hotel_links (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null,
  start_date date not null,
  end_date date,
  reason text not null check (btrim(reason) <> ''),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  check (end_date is null or end_date >= start_date)
);
alter table housekeeping_hotel_links
  add constraint housekeeping_hotel_links_period_excl
  exclude using gist (
    company_id with =,
    branch_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  );

create table hotel_owner_assignments (
  id uuid primary key,
  company_id uuid not null,
  branch_id uuid not null,
  user_id uuid not null,
  start_date date not null,
  end_date date,
  reason text not null check (btrim(reason) <> ''),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, branch_id) references hotel_profiles(company_id, branch_id),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, created_by) references users(company_id, id),
  check (end_date is null or end_date >= start_date)
);
create unique index hotel_owner_assignments_active_hotel_unique_idx
  on hotel_owner_assignments (company_id, branch_id) where end_date is null;
create unique index hotel_owner_assignments_active_user_unique_idx
  on hotel_owner_assignments (company_id, user_id) where end_date is null;
alter table hotel_owner_assignments
  add constraint hotel_owner_assignments_user_period_excl
  exclude using gist (
    company_id with =,
    user_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  );
alter table hotel_owner_assignments
  add constraint hotel_owner_assignments_hotel_period_excl
  exclude using gist (
    company_id with =,
    branch_id with =,
    daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  );

create function public.jsonb_reject_plaintext_password_keys(p_payload jsonb)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $function$
  with recursive nodes(value) as (
    select p_payload
    union all
    select child.value
    from nodes parent
    cross join lateral (
      select object_value.value
      from pg_catalog.jsonb_each(
        case when pg_catalog.jsonb_typeof(parent.value) = 'object' then parent.value else '{}'::jsonb end
      ) object_value
      union all
      select array_value.value
      from pg_catalog.jsonb_array_elements(
        case when pg_catalog.jsonb_typeof(parent.value) = 'array' then parent.value else '[]'::jsonb end
      ) array_value
    ) child
  )
  select not exists (
    select 1
    from nodes node
    cross join lateral pg_catalog.jsonb_object_keys(
      case when pg_catalog.jsonb_typeof(node.value) = 'object' then node.value else '{}'::jsonb end
    ) object_key
    where pg_catalog.lower(object_key) in (
      'initialpassword', 'password', 'plainpassword', 'newpassword'
    )
  )
$function$;
revoke all on function public.jsonb_reject_plaintext_password_keys(jsonb) from public;

alter table outbox_jobs
  add constraint outbox_jobs_account_payload_shape check (
    job_type not in ('ACCOUNT_PROVIDER_DEACTIVATE', 'ACCOUNT_PROVIDER_COMPENSATE')
    or (
      pg_catalog.jsonb_typeof(payload) = 'object'
      and pg_catalog.jsonb_typeof(payload->'userId') = 'string'
      and pg_catalog.btrim(payload->>'userId') <> ''
      and pg_catalog.jsonb_typeof(payload->'providerSubject') = 'string'
      and pg_catalog.btrim(payload->>'providerSubject') <> ''
      and pg_catalog.jsonb_typeof(payload->'action') = 'string'
      and payload->>'action' in ('DEACTIVATE', 'COMPENSATE')
      and public.jsonb_reject_plaintext_password_keys(payload)
    )
  );

create table account_provisioning_attempts (
  id uuid primary key,
  company_id uuid not null,
  actor_user_id uuid not null,
  target_user_id uuid not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  request_hash text not null check (btrim(request_hash) <> ''),
  completion_payload jsonb not null check (
    pg_catalog.jsonb_typeof(completion_payload) = 'object'
    and pg_catalog.jsonb_typeof(completion_payload->'userId') = 'string'
    and pg_catalog.btrim(completion_payload->>'userId') <> ''
    and pg_catalog.jsonb_typeof(completion_payload->'providerSubject') = 'string'
    and pg_catalog.btrim(completion_payload->>'providerSubject') <> ''
    and pg_catalog.jsonb_typeof(completion_payload->'action') = 'string'
    and completion_payload->>'action' = 'CREATE'
    and public.jsonb_reject_plaintext_password_keys(completion_payload)
  ),
  status text not null check (status in (
    'RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_CONFIRMED', 'COMPLETED',
    'RECOVERY_REQUIRED', 'COMPENSATION_REQUIRED', 'COMPENSATED',
    'OPERATOR_REQUIRED', 'DEAD_LETTER'
  )),
  provider_subject text,
  failure_code text,
  operator_reason text,
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dispatched_at timestamptz,
  provider_confirmed_at timestamptz,
  recovery_required_at timestamptz,
  compensation_required_at timestamptz,
  compensated_at timestamptz,
  operator_required_at timestamptz,
  dead_lettered_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  unique (company_id, id),
  unique (company_id, actor_user_id, idempotency_key),
  foreign key (company_id, actor_user_id) references users(company_id, id),
  check (expires_at > created_at),
  check (lease_expires_at <= expires_at),
  check (provider_subject is null or btrim(provider_subject) <> ''),
  check (failure_code is null or btrim(failure_code) <> ''),
  check (operator_reason is null or btrim(operator_reason) <> ''),
  check ((status = 'OPERATOR_REQUIRED') = (operator_reason is not null and operator_required_at is not null)),
  check (status not in ('DISPATCHED', 'PROVIDER_CONFIRMED', 'COMPLETED', 'RECOVERY_REQUIRED',
                        'COMPENSATION_REQUIRED', 'COMPENSATED', 'OPERATOR_REQUIRED', 'DEAD_LETTER')
         or dispatched_at is not null),
  check (status not in ('PROVIDER_CONFIRMED', 'COMPLETED', 'COMPENSATION_REQUIRED', 'COMPENSATED')
         or (provider_subject is not null and provider_confirmed_at is not null)),
  check (status <> 'RECOVERY_REQUIRED' or (failure_code is not null and recovery_required_at is not null)),
  check (status <> 'COMPENSATION_REQUIRED' or (failure_code is not null and compensation_required_at is not null)),
  check (status <> 'COMPENSATED' or (compensated_at is not null and completed_at is not null)),
  check (status <> 'COMPLETED' or completed_at is not null),
  check (status <> 'DEAD_LETTER' or (failure_code is not null and dead_lettered_at is not null))
);

create unique index account_provisioning_attempts_active_user_unique_idx
  on account_provisioning_attempts (company_id, target_user_id)
  where status in ('RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_CONFIRMED', 'RECOVERY_REQUIRED', 'COMPENSATION_REQUIRED');
create index account_provisioning_recovery_idx
  on account_provisioning_attempts (company_id, status, lease_expires_at, updated_at)
  where status in ('RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_CONFIRMED', 'RECOVERY_REQUIRED', 'COMPENSATION_REQUIRED');

create table initial_password_change_attempts (
  id uuid primary key,
  company_id uuid not null,
  user_id uuid not null,
  session_id uuid not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  status text not null check (status in (
    'RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_UPDATED',
    'RECOVERY_REQUIRED', 'OPERATOR_REQUIRED', 'COMPLETED'
  )),
  provider_subject text not null check (btrim(provider_subject) <> ''),
  failure_code text,
  operator_reason text,
  lease_expires_at timestamptz not null,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dispatched_at timestamptz,
  provider_updated_at timestamptz,
  recovery_required_at timestamptz,
  operator_required_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  unique (company_id, id),
  unique (company_id, user_id, idempotency_key),
  foreign key (company_id, user_id) references users(company_id, id),
  foreign key (company_id, session_id, user_id) references auth_sessions(company_id, id, user_id),
  check (lease_expires_at <= expires_at),
  check (expires_at > created_at),
  check (failure_code is null or btrim(failure_code) <> ''),
  check (operator_reason is null or btrim(operator_reason) <> ''),
  check ((status = 'OPERATOR_REQUIRED') = (operator_reason is not null and operator_required_at is not null)),
  check (status not in ('DISPATCHED', 'PROVIDER_UPDATED', 'RECOVERY_REQUIRED', 'OPERATOR_REQUIRED', 'COMPLETED')
         or dispatched_at is not null),
  check (status not in ('PROVIDER_UPDATED', 'COMPLETED') or provider_updated_at is not null),
  check (status <> 'RECOVERY_REQUIRED' or (failure_code is not null and recovery_required_at is not null)),
  check (status <> 'COMPLETED' or completed_at is not null)
);

create unique index initial_password_change_attempts_active_user_unique_idx
  on initial_password_change_attempts (company_id, user_id)
  where status in ('RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_UPDATED', 'RECOVERY_REQUIRED');

create table company_bootstrap_states (
  company_id uuid primary key references companies(id),
  bootstrapped_user_id uuid not null,
  subject_fingerprint char(64) not null check (subject_fingerprint ~ '^[0-9a-f]{64}$'),
  zitadel_organization_id text not null check (btrim(zitadel_organization_id) <> ''),
  approval_reference text not null check (btrim(approval_reference) <> ''),
  completed_at timestamptz not null default now(),
  foreign key (company_id, bootstrapped_user_id) references users(company_id, id)
);

insert into permissions (code, description) values
  ('USER_READ', '회사 사용자 계정 조회'),
  ('USER_CREATE', '회사 사용자 계정 생성'),
  ('USER_SUSPEND', '회사 사용자 계정 중지')
on conflict (code) do update set description = excluded.description;

alter table account_provisioning_attempts enable row level security;
alter table account_provisioning_attempts force row level security;
create policy account_provisioning_attempts_company_isolation on account_provisioning_attempts
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

alter table initial_password_change_attempts enable row level security;
alter table initial_password_change_attempts force row level security;
create policy initial_password_change_attempts_company_isolation on initial_password_change_attempts
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

alter table outbox_jobs enable row level security;
alter table outbox_jobs force row level security;
create policy outbox_jobs_company_isolation on outbox_jobs
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

create index account_provider_outbox_ready_idx
  on outbox_jobs (company_id, status, available_at, created_at)
  where job_type in ('ACCOUNT_PROVIDER_DEACTIVATE', 'ACCOUNT_PROVIDER_COMPENSATE')
    and status in ('PENDING', 'FAILED', 'PROCESSING');

alter table hotel_staff_assignments enable row level security;
alter table hotel_staff_assignments force row level security;
create policy hotel_staff_assignments_company_isolation on hotel_staff_assignments
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

alter table housekeeping_hotel_links enable row level security;
alter table housekeeping_hotel_links force row level security;
create policy housekeeping_hotel_links_company_isolation on housekeeping_hotel_links
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

alter table hotel_owner_assignments enable row level security;
alter table hotel_owner_assignments force row level security;
create policy hotel_owner_assignments_company_isolation on hotel_owner_assignments
  using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

create table reconciliation_company_registry (
  company_id uuid primary key references companies(id) on delete cascade,
  company_status text not null check (company_status in ('ACTIVE', 'SUSPENDED')),
  updated_at timestamptz not null default now()
);
revoke all on reconciliation_company_registry from public;

insert into reconciliation_company_registry (company_id, company_status)
select id, status from companies;

create function public.sync_reconciliation_company_registry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.reconciliation_company_registry (company_id, company_status, updated_at)
  values (new.id, new.status, pg_catalog.statement_timestamp())
  on conflict (company_id) do update
  set company_status = excluded.company_status,
      updated_at = excluded.updated_at;
  return new;
end
$$;
revoke all on function public.sync_reconciliation_company_registry() from public;
create trigger companies_sync_reconciliation_registry
  after insert or update of status on companies
  for each row execute function public.sync_reconciliation_company_registry();

create function public.reconciliation_company_ids()
returns table (company_id uuid)
language sql
security definer
set search_path = pg_catalog
as $$
  select registry.company_id
  from public.reconciliation_company_registry registry
  where registry.company_status = 'ACTIVE'
  order by pg_catalog.md5(
    registry.company_id::text
    || pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.statement_timestamp()) / 300)::bigint::text
  ), registry.company_id
$$;
revoke all on function public.reconciliation_company_ids() from public;

insert into schema_migrations (version) values ('0006_account_administration');

commit;
