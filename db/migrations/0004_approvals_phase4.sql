begin;

create table if not exists approval_forms (
  id text primary key,
  company_id text not null references companies (id),
  code text not null,
  title text not null,
  category text not null,
  field_summary text not null,
  status text not null default 'active',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, code)
);

create table if not exists approval_lines (
  id text primary key,
  company_id text not null references companies (id),
  title text not null,
  description text not null,
  status text not null default 'active',
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists approval_documents (
  id text primary key,
  company_id text not null references companies (id),
  form_id text not null references approval_forms (id),
  line_id text not null references approval_lines (id),
  drafter_employee_id text not null references employees (id),
  title text not null,
  summary text,
  document_number text not null,
  status text not null default 'draft',
  submitted_at text,
  completed_at text,
  created_by text not null references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (company_id, document_number)
);

create table if not exists approval_steps (
  id text primary key,
  company_id text not null references companies (id),
  document_id text not null references approval_documents (id),
  line_id text references approval_lines (id),
  step_order integer not null,
  approver_employee_id text not null references employees (id),
  step_type text not null default 'approve',
  decision_status text not null default 'pending',
  decided_at text,
  decision_comment text,
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  unique (document_id, step_order)
);

create table if not exists approval_references (
  id text primary key,
  company_id text not null references companies (id),
  document_id text not null references approval_documents (id),
  employee_id text not null references employees (id),
  reference_type text not null default 'reference',
  read_at text,
  created_by text references users (id),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  status text not null default 'active',
  unique (document_id, employee_id, reference_type)
);

create index if not exists idx_approval_forms_company_status
  on approval_forms (company_id, status, updated_at desc);
create index if not exists idx_approval_lines_company_status
  on approval_lines (company_id, status, updated_at desc);
create index if not exists idx_approval_documents_company_status
  on approval_documents (company_id, status, submitted_at desc);
create index if not exists idx_approval_documents_company_drafter
  on approval_documents (company_id, drafter_employee_id, created_at desc);
create index if not exists idx_approval_steps_company_queue
  on approval_steps (company_id, approver_employee_id, decision_status, step_order);
create index if not exists idx_approval_references_company_employee
  on approval_references (company_id, employee_id, reference_type, created_at desc);

commit;
