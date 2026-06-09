begin;

create table if not exists companies (
  id text primary key,
  name text not null,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists users (
  id text primary key,
  company_id text not null references companies (id),
  email text not null,
  password_hash text not null,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique (company_id, email)
);

create table if not exists employees (
  id text primary key,
  company_id text not null references companies (id),
  user_id text references users (id),
  employee_number text not null,
  full_name text not null,
  employment_status text not null default 'active',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, employee_number)
);

-- TODO: attendance, leave, approvals, files, audit_logs 테이블은 후속 phase에서 확장

commit;
