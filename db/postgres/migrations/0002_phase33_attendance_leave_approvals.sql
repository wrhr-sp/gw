begin;

alter table if exists attendance_correction_requests
  add column if not exists requested_check_in_at timestamptz,
  add column if not exists requested_check_out_at timestamptz,
  add column if not exists note text;

alter table if exists leave_requests
  add column if not exists approval_status text not null default 'pending',
  add column if not exists unit text not null default 'day',
  add column if not exists note text;

alter table if exists leave_balances
  add column if not exists snapshot_note text;

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

alter table if exists approval_documents
  add column if not exists form_id text references approval_forms(id),
  add column if not exists line_id text,
  add column if not exists drafter_employee_id text references employees(id),
  add column if not exists summary text,
  add column if not exists created_by text references users(id);

alter table if exists approval_documents
  alter column form_id set not null,
  alter column line_id set not null,
  alter column drafter_employee_id set not null,
  alter column created_by set not null;

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

alter table if exists approval_lines
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists status text not null default 'active',
  add column if not exists created_by text references users(id),
  add column if not exists updated_at timestamptz not null default now();

update approval_lines
set title = coalesce(title, 'Legacy approval line ' || id),
    description = coalesce(description, 'Legacy approval line retained during Phase 33 preview DB migration'),
    status = coalesce(status, 'active'),
    updated_at = coalesce(updated_at, now())
where title is null or description is null or updated_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'approval_documents_line_id_fkey'
  ) then
    alter table approval_documents
      add constraint approval_documents_line_id_fkey
      foreign key (line_id) references approval_lines(id);
  end if;
end $$;

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
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_approval_steps_document_line_step_order
  on approval_steps (coalesce(document_id, ''), coalesce(line_id, ''), step_order);

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

commit;
