create table if not exists employee_fixed_allowance_masters (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  default_amount numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create index if not exists idx_employee_fixed_allowance_masters_company_active
  on employee_fixed_allowance_masters (company_id, is_active, sort_order, name)
  where deleted_at is null;
