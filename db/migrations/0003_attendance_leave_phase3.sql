begin;

create table if not exists attendance_records (
  id text primary key,
  company_id text not null references companies (id),
  employee_id text not null references employees (id),
  status text not null default 'checked_in',
  work_date text not null,
  check_in_at text,
  check_out_at text,
  source text not null default 'web',
  note text,
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists attendance_correction_requests (
  id text primary key,
  company_id text not null references companies (id),
  employee_id text not null references employees (id),
  attendance_record_id text not null references attendance_records (id),
  status text not null default 'requested',
  requested_by text not null references users (id),
  reviewed_by text references users (id),
  reviewed_at text,
  reason text not null,
  requested_check_in_at text,
  requested_check_out_at text,
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists leave_types (
  id text primary key,
  company_id text not null references companies (id),
  code text not null,
  name text not null,
  unit text not null default 'day',
  status text not null default 'active',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text,
  unique (company_id, code)
);

create table if not exists leave_requests (
  id text primary key,
  company_id text not null references companies (id),
  employee_id text not null references employees (id),
  leave_type_id text not null references leave_types (id),
  status text not null default 'pending_approval',
  approval_status text not null default 'pending',
  start_date text not null,
  end_date text not null,
  unit text not null default 'day',
  days real not null default 1,
  requested_by text not null references users (id),
  reviewed_by text references users (id),
  reviewed_at text,
  reason text not null,
  note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);

create table if not exists leave_balances (
  id text primary key,
  company_id text not null references companies (id),
  employee_id text not null references employees (id),
  leave_type_id text not null references leave_types (id),
  as_of_date text not null,
  opening_days real not null default 0,
  used_days real not null default 0,
  reserved_days real not null default 0,
  remaining_days real not null default 0,
  snapshot_note text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, employee_id, leave_type_id, as_of_date)
);

create index if not exists idx_attendance_records_company_employee_work_date
  on attendance_records (company_id, employee_id, work_date desc);
create index if not exists idx_attendance_records_company_status
  on attendance_records (company_id, status);
create index if not exists idx_attendance_corrections_company_status
  on attendance_correction_requests (company_id, status, created_at desc);
create index if not exists idx_leave_types_company_status
  on leave_types (company_id, status);
create index if not exists idx_leave_requests_company_employee_status
  on leave_requests (company_id, employee_id, approval_status, start_date desc);
create index if not exists idx_leave_requests_company_review_queue
  on leave_requests (company_id, approval_status, created_at desc);
create index if not exists idx_leave_balances_company_employee_type
  on leave_balances (company_id, employee_id, leave_type_id, as_of_date desc);

commit;
