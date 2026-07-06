begin;

create table if not exists payroll_profiles (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  employee_name text not null,
  branch_id text references branches(id),
  branch_label text,
  pay_type text not null default 'monthly',
  base_pay numeric(12,2),
  hourly_rate numeric(12,2),
  daily_rate numeric(12,2),
  annual_salary numeric(12,2),
  inclusive_allowance numeric(12,2),
  standard_work_hours numeric(8,2) not null default 0,
  pay_day integer not null default 25,
  effective_from date not null,
  effective_to date,
  scope_note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id, effective_from)
);
create index if not exists idx_payroll_profiles_company_employee on payroll_profiles (company_id, employee_id, effective_from desc);

create table if not exists payroll_periods (
  id text primary key,
  company_id text not null references companies(id),
  title text not null,
  branch_scope_label text not null,
  starts_on date not null,
  ends_on date not null,
  pay_date date not null,
  status text not null default 'draft',
  source_summary text not null,
  locked_fields_note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, title, starts_on)
);
create index if not exists idx_payroll_periods_company_dates on payroll_periods (company_id, starts_on desc, ends_on desc);

create table if not exists payroll_input_snapshots (
  id text primary key,
  company_id text not null references companies(id),
  period_id text not null references payroll_periods(id),
  employee_id text not null references employees(id),
  attendance_hours numeric(8,2) not null default 0,
  overtime_hours numeric(8,2) not null default 0,
  night_hours numeric(8,2) not null default 0,
  holiday_hours numeric(8,2) not null default 0,
  paid_leave_days numeric(8,2) not null default 0,
  unpaid_leave_days numeric(8,2) not null default 0,
  absence_days numeric(8,2) not null default 0,
  lateness_count integer not null default 0,
  early_leave_count integer not null default 0,
  source_note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, period_id, employee_id)
);
create index if not exists idx_payroll_input_snapshots_company_period on payroll_input_snapshots (company_id, period_id, employee_id);

create table if not exists payroll_drafts (
  id text primary key,
  company_id text not null references companies(id),
  period_id text not null references payroll_periods(id),
  profile_id text not null references payroll_profiles(id),
  employee_id text not null references employees(id),
  employee_name text not null,
  branch_label text,
  pay_type text not null default 'monthly',
  status text not null default 'draft',
  gross_pay numeric(12,2) not null default 0,
  estimated_deductions numeric(12,2) not null default 0,
  net_pay_preview numeric(12,2) not null default 0,
  review_note text not null,
  approval_gate text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, period_id, employee_id)
);
create index if not exists idx_payroll_drafts_company_period on payroll_drafts (company_id, period_id, employee_id);

create table if not exists payroll_line_items (
  id text primary key,
  company_id text not null references companies(id),
  period_id text not null references payroll_periods(id),
  code text not null,
  label text not null,
  classification text not null default 'earning',
  source text not null default 'manual',
  quantity numeric(10,2),
  unit_amount numeric(12,2),
  premium_rate numeric(10,4),
  amount numeric(12,2) not null default 0,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payroll_line_items_company_period on payroll_line_items (company_id, period_id, code);

create table if not exists payroll_review_steps (
  id text primary key,
  company_id text not null references companies(id),
  period_id text not null references payroll_periods(id),
  scope text not null,
  status text not null default 'pending',
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, period_id, scope)
);
create index if not exists idx_payroll_review_steps_company_period on payroll_review_steps (company_id, period_id, scope);

create table if not exists work_items (
  id text primary key,
  company_id text not null references companies(id),
  branch_id text references branches(id),
  branch_label text,
  module text not null,
  category text not null,
  title text not null,
  description_preview text not null,
  status text not null default 'requested',
  priority text not null default 'medium',
  assignee_json jsonb not null default '{}'::jsonb,
  requester_user_id text references users(id),
  due_at timestamptz,
  review_required boolean not null default false,
  contains_sensitive_data boolean not null default true,
  access_json jsonb not null default '{}'::jsonb,
  hr_context_json jsonb,
  labor_context_json jsonb,
  tax_context_json jsonb,
  legal_context_json jsonb,
  tags_json jsonb not null default '[]'::jsonb,
  audit_summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table work_items add column if not exists branch_label text;
alter table work_items add column if not exists module text;
alter table work_items add column if not exists category text;
alter table work_items add column if not exists description_preview text;
alter table work_items add column if not exists priority text default 'medium';
alter table work_items add column if not exists assignee_json jsonb default '{}'::jsonb;
alter table work_items add column if not exists requester_user_id text references users(id);
alter table work_items add column if not exists due_at timestamptz;
alter table work_items add column if not exists review_required boolean default false;
alter table work_items add column if not exists contains_sensitive_data boolean default true;
alter table work_items add column if not exists access_json jsonb default '{}'::jsonb;
alter table work_items add column if not exists hr_context_json jsonb;
alter table work_items add column if not exists labor_context_json jsonb;
alter table work_items add column if not exists tax_context_json jsonb;
alter table work_items add column if not exists legal_context_json jsonb;
alter table work_items add column if not exists tags_json jsonb default '[]'::jsonb;
alter table work_items add column if not exists audit_summary text;
alter table work_items add column if not exists closed_at timestamptz;

update work_items
set
  module = coalesce(module, work_type, 'general'),
  category = coalesce(category, work_type, 'general'),
  description_preview = coalesce(description_preview, summary, title, ''),
  priority = coalesce(priority, 'medium'),
  assignee_json = coalesce(assignee_json, '{}'::jsonb),
  requester_user_id = coalesce(requester_user_id, created_by),
  due_at = coalesce(due_at, due_date::timestamptz),
  review_required = coalesce(review_required, false),
  contains_sensitive_data = coalesce(contains_sensitive_data, true),
  access_json = coalesce(access_json, '{}'::jsonb),
  tags_json = coalesce(tags_json, '[]'::jsonb),
  audit_summary = coalesce(audit_summary, summary, title, '')
where module is null
   or category is null
   or description_preview is null
   or priority is null
   or assignee_json is null
   or review_required is null
   or contains_sensitive_data is null
   or access_json is null
   or tags_json is null
   or audit_summary is null;

alter table work_items alter column module set not null;
alter table work_items alter column category set not null;
alter table work_items alter column description_preview set not null;
alter table work_items alter column priority set not null;
alter table work_items alter column assignee_json set not null;
alter table work_items alter column review_required set not null;
alter table work_items alter column contains_sensitive_data set not null;
alter table work_items alter column access_json set not null;
alter table work_items alter column tags_json set not null;
alter table work_items alter column audit_summary set not null;

create index if not exists idx_work_items_company_module on work_items (company_id, module, updated_at desc);
create index if not exists idx_work_items_company_branch on work_items (company_id, branch_id, updated_at desc);

create table if not exists work_item_documents (
  id text primary key,
  company_id text not null references companies(id),
  work_item_id text not null references work_items(id) on delete cascade,
  document_type text not null,
  title text not null,
  status text not null default 'draft',
  visibility text not null default 'company',
  contains_sensitive_data boolean not null default false,
  access_note text not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_work_item_documents_company_item on work_item_documents (company_id, work_item_id, updated_at desc);

create table if not exists work_item_attachments (
  id text primary key,
  company_id text not null references companies(id),
  work_item_id text not null references work_items(id) on delete cascade,
  file_name text not null,
  category text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  sensitivity_label text not null default 'general'
);
create index if not exists idx_work_item_attachments_company_item on work_item_attachments (company_id, work_item_id, uploaded_at desc);

create table if not exists work_item_reviews (
  id text primary key,
  company_id text not null references companies(id),
  work_item_id text not null references work_items(id) on delete cascade,
  reviewer_role_code text not null,
  decision text not null,
  summary text not null,
  reviewed_at timestamptz not null default now()
);
create index if not exists idx_work_item_reviews_company_item on work_item_reviews (company_id, work_item_id, reviewed_at desc);

create table if not exists work_item_deadlines (
  id text primary key,
  company_id text not null references companies(id),
  work_item_id text not null references work_items(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'scheduled',
  owner_scope text not null,
  escalation_note text not null
);
create index if not exists idx_work_item_deadlines_company_due on work_item_deadlines (company_id, due_at asc);

create table if not exists work_item_audit_logs (
  id text primary key,
  company_id text not null references companies(id),
  work_item_id text not null references work_items(id) on delete cascade,
  action text not null,
  actor_role_code text not null,
  summary text not null,
  happened_at timestamptz not null default now()
);
create index if not exists idx_work_item_audit_logs_company_item on work_item_audit_logs (company_id, work_item_id, happened_at desc);

create table if not exists compliance_alerts (
  id text primary key,
  company_id text not null references companies(id),
  module text not null default 'compliance',
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  summary text not null,
  linked_resource_type text,
  linked_resource_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists idx_compliance_alerts_company_status on compliance_alerts (company_id, status, created_at desc);

commit;
