create table if not exists erp_expense_requests (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  vendor_id text references erp_vendors(id),
  title text not null,
  expense_category text not null,
  department_id text references departments(id),
  branch_id text references branches(id),
  project_code text,
  payment_method text not null check (payment_method in ('corporate_card', 'bank_transfer', 'cash', 'personal_card', 'other')),
  tax_type text not null default 'taxable' check (tax_type in ('taxable', 'zero_rated', 'tax_exempt', 'non_taxable')),
  supply_amount numeric(14,2) not null default 0 check (supply_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) generated always as (supply_amount + tax_amount) stored,
  spent_at date not null,
  evidence_file_id text references file_objects(id),
  approval_document_id text references approval_documents(id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled')),
  sync_status text not null default 'not_connected' check (sync_status in ('not_connected', 'pending', 'queued', 'synced', 'failed')),
  external_provider text check (external_provider is null or external_provider in ('kyungrinara')),
  external_reference_id text,
  last_synced_at timestamptz,
  memo text,
  requested_by_user_id text not null references users(id),
  requested_by_employee_id text not null references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists erp_expense_requests_company_status_idx on erp_expense_requests(company_id, status, updated_at desc);
create index if not exists erp_expense_requests_company_vendor_idx on erp_expense_requests(company_id, vendor_id, spent_at desc);
create index if not exists erp_expense_requests_company_sync_idx on erp_expense_requests(company_id, sync_status, updated_at desc);
