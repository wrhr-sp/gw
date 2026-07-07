-- 그룹웨어 초기 운영 DB(PostgreSQL) 스키마
-- 목적: 초기/비용절감 단계에서 PostgreSQL 1개에 기능별 table boundary를 둔다.
-- 외부연동, 실급여 지급, 주민번호/계좌번호 원문 저장은 별도 승인 전 제외한다.

begin;

create table if not exists companies (
  id text primary key,
  name text not null,
  business_registration_number_hash text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists branches (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  branch_type text not null default 'office',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists users (
  id text primary key,
  company_id text not null references companies(id),
  login_id text not null,
  email text,
  password_hash text not null,
  display_name text not null,
  status text not null default 'active',
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, login_id),
  unique (company_id, email)
);

create table if not exists departments (
  id text primary key,
  company_id text not null references companies(id),
  branch_id text references branches(id),
  parent_department_id text references departments(id),
  code text not null,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists positions (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  rank_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists employees (
  id text primary key,
  company_id text not null references companies(id),
  branch_id text references branches(id),
  user_id text references users(id),
  department_id text references departments(id),
  position_id text references positions(id),
  employee_number text not null,
  full_name text not null,
  employment_status text not null default 'active',
  hire_date date,
  leave_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, employee_number)
);

create table if not exists user_department_history (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  department_id text not null references departments(id),
  started_on date not null,
  ended_on date,
  created_at timestamptz not null default now()
);

create table if not exists user_position_history (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  position_id text not null references positions(id),
  started_on date not null,
  ended_on date,
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id text primary key,
  company_id text references companies(id),
  code text not null,
  name text not null,
  role_scope text not null default 'company',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists permissions (
  id text primary key,
  code text not null unique,
  name text not null,
  permission_group text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  id text primary key,
  company_id text not null references companies(id),
  user_id text not null references users(id),
  role_id text not null references roles(id),
  branch_id text references branches(id),
  assigned_by text references users(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, user_id, role_id, branch_id)
);

create table if not exists role_permissions (
  id text primary key,
  role_id text not null references roles(id),
  permission_id text not null references permissions(id),
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists auth_sessions (
  id text primary key,
  company_id text not null references companies(id),
  user_id text not null references users(id),
  session_token_hash text not null unique,
  status text not null default 'active',
  ip_hash text,
  user_agent text,
  last_seen_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists home_shortcuts (
  id text primary key,
  company_id text not null references companies(id),
  user_id text references users(id),
  code text not null,
  label text not null,
  href text not null,
  icon text,
  is_fixed boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id, code)
);

create table if not exists boards (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  board_type text not null default 'general',
  visibility text not null default 'company',
  status text not null default 'active',
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists posts (
  id text primary key,
  company_id text not null references companies(id),
  board_id text not null references boards(id),
  author_user_id text not null references users(id),
  title text not null,
  body text not null,
  status text not null default 'published',
  is_notice boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists comments (
  id text primary key,
  company_id text not null references companies(id),
  post_id text not null references posts(id),
  author_user_id text not null references users(id),
  parent_comment_id text references comments(id),
  body text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists read_receipts (
  id text primary key,
  company_id text not null references companies(id),
  target_type text not null,
  target_id text not null,
  user_id text not null references users(id),
  read_at timestamptz not null default now(),
  unique (company_id, target_type, target_id, user_id)
);

create table if not exists document_spaces (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  visibility text not null default 'company',
  owner_user_id text references users(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists documents (
  id text primary key,
  company_id text not null references companies(id),
  space_id text not null references document_spaces(id),
  owner_user_id text not null references users(id),
  title text not null,
  summary text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists file_objects (
  id text primary key,
  company_id text not null references companies(id),
  document_id text references documents(id),
  bucket text not null,
  object_key text not null,
  file_name text not null,
  content_type text not null,
  file_size bigint not null default 0,
  checksum_sha256 text,
  owner_user_id text references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, object_key)
);

create table if not exists attendance_records (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  work_date date not null,
  status text not null default 'checked_in',
  check_in_at timestamptz,
  check_out_at timestamptz,
  source text not null default 'web',
  note text,
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, employee_id, work_date)
);

create table if not exists attendance_correction_requests (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  attendance_record_id text references attendance_records(id),
  status text not null default 'requested',
  requested_by text not null references users(id),
  reviewed_by text references users(id),
  reviewed_at timestamptz,
  reason text not null,
  requested_check_in_at timestamptz,
  requested_check_out_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists leave_types (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  unit text not null default 'day',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists leave_requests (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  leave_type_id text not null references leave_types(id),
  status text not null default 'pending_approval',
  approval_status text not null default 'pending',
  start_date date not null,
  end_date date not null,
  unit text not null default 'day',
  days numeric(6,2) not null default 1,
  requested_by text not null references users(id),
  reviewed_by text references users(id),
  reviewed_at timestamptz,
  reason text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists leave_balances (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  leave_type_id text not null references leave_types(id),
  as_of_date date not null,
  opening_days numeric(8,2) not null default 0,
  used_days numeric(8,2) not null default 0,
  reserved_days numeric(8,2) not null default 0,
  remaining_days numeric(8,2) not null default 0,
  snapshot_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id, leave_type_id, as_of_date)
);

create table if not exists approval_forms (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  title text not null,
  category text not null,
  field_summary text not null,
  status text not null default 'active',
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists approval_lines (
  id text primary key,
  company_id text not null references companies(id),
  title text not null,
  description text not null,
  status text not null default 'active',
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approval_documents (
  id text primary key,
  company_id text not null references companies(id),
  form_id text not null references approval_forms(id),
  line_id text not null references approval_lines(id),
  drafter_employee_id text not null references employees(id),
  title text not null,
  summary text,
  document_number text not null,
  status text not null default 'draft',
  submitted_at timestamptz,
  completed_at timestamptz,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, document_number)
);

create table if not exists approval_steps (
  id text primary key,
  company_id text not null references companies(id),
  document_id text references approval_documents(id),
  line_id text references approval_lines(id),
  step_order integer not null,
  approver_employee_id text not null references employees(id),
  step_type text not null default 'approve',
  decision_status text not null default 'pending',
  decided_at timestamptz,
  decision_comment text,
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (document_id, line_id, step_order)
);

create table if not exists approval_references (
  id text primary key,
  company_id text not null references companies(id),
  document_id text not null references approval_documents(id),
  employee_id text not null references employees(id),
  reference_type text not null default 'reference',
  read_at timestamptz,
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active',
  unique (document_id, employee_id, reference_type)
);

create table if not exists work_items (
  id text primary key,
  company_id text not null references companies(id),
  branch_id text references branches(id),
  work_type text not null,
  title text not null,
  summary text,
  status text not null default 'open',
  assigned_user_id text references users(id),
  due_date date,
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists payroll_runs (
  id text primary key,
  company_id text not null references companies(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  reviewed_by text references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists compliance_alerts (
  id text primary key,
  company_id text not null references companies(id),
  branch_id text references branches(id),
  category text not null,
  severity text not null default 'notice',
  title text not null,
  message text not null,
  status text not null default 'needs_review',
  assigned_user_id text references users(id),
  reviewed_by text references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  company_id text not null references companies(id),
  user_id text not null references users(id),
  title text not null,
  body text not null,
  notification_type text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  company_id text not null references companies(id),
  branch_id text references branches(id),
  actor_user_id text references users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  before_json jsonb,
  after_json jsonb,
  metadata_json jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_company_status on users(company_id, status);
create index if not exists idx_employees_company_branch_status on employees(company_id, branch_id, employment_status);
create index if not exists idx_user_roles_company_user on user_roles(company_id, user_id, status);
create index if not exists idx_auth_sessions_user_status on auth_sessions(company_id, user_id, status, expires_at desc);
create index if not exists idx_posts_search on posts using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,'')));
create index if not exists idx_documents_search on documents using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'')));
create index if not exists idx_work_items_company_type_status on work_items(company_id, work_type, status, created_at desc);
create index if not exists idx_audit_logs_company_created_at on audit_logs(company_id, created_at desc);
create index if not exists idx_notifications_user_created_at on notifications(company_id, user_id, created_at desc);

commit;
