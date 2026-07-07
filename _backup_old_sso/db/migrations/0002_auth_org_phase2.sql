begin;

create table if not exists departments (
  id text primary key,
  company_id text not null references companies (id),
  parent_department_id text references departments (id),
  code text not null,
  name text not null,
  status text not null default 'active',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique (company_id, code)
);

create table if not exists roles (
  id text primary key,
  company_id text references companies (id),
  code text not null,
  name text not null,
  scope text not null default 'company',
  status text not null default 'active',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique (company_id, code)
);

create table if not exists user_roles (
  id text primary key,
  company_id text not null references companies (id),
  user_id text not null references users (id),
  employee_id text references employees (id),
  role_id text not null references roles (id),
  assigned_by text references users (id),
  status text not null default 'active',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique (company_id, user_id, role_id)
);

create table if not exists invites (
  id text primary key,
  company_id text not null references companies (id),
  email text not null,
  role_id text references roles (id),
  department_id text references departments (id),
  invite_token_hash text not null,
  status text not null default 'pending_delivery',
  expires_at text not null,
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists auth_sessions (
  id text primary key,
  company_id text not null references companies (id),
  user_id text not null references users (id),
  session_token_hash text not null,
  status text not null default 'active',
  last_seen_at text,
  expires_at text not null,
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  revoked_at text,
  unique (session_token_hash)
);

create table if not exists audit_logs (
  id text primary key,
  company_id text not null references companies (id),
  actor_user_id text references users (id),
  actor_employee_id text references employees (id),
  action text not null,
  target_type text not null,
  target_id text,
  metadata_json text,
  created_at text not null default current_timestamp
);

create index if not exists idx_departments_company_status on departments (company_id, status);
create index if not exists idx_roles_company_status on roles (company_id, status);
create index if not exists idx_user_roles_company_user on user_roles (company_id, user_id);
create index if not exists idx_invites_company_status on invites (company_id, status);
create index if not exists idx_auth_sessions_company_user on auth_sessions (company_id, user_id, status);
create index if not exists idx_audit_logs_company_created_at on audit_logs (company_id, created_at desc);

commit;
