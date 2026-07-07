alter table users
  add column if not exists external_auth_provider text,
  add column if not exists external_auth_user_id text,
  add column if not exists user_type text;

create unique index if not exists idx_users_external_auth_provider_user
  on users(external_auth_provider, external_auth_user_id)
  where external_auth_provider is not null
    and external_auth_user_id is not null
    and deleted_at is null;

create table if not exists zitadel_registration_requests (
  id text primary key,
  company_id text not null references companies(id),
  zitadel_user_id text not null unique,
  login_id text not null,
  email text not null,
  display_name text not null,
  user_type text not null,
  registration_status text not null default 'PENDING',
  requested_at timestamptz not null default now(),
  reviewed_by text references users(id),
  reviewed_at timestamptz,
  local_user_id text references users(id),
  local_employee_id text references employees(id),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, email),
  unique (company_id, login_id)
);

create index if not exists idx_zitadel_registration_requests_company_status
  on zitadel_registration_requests(company_id, registration_status, requested_at desc)
  where deleted_at is null;
