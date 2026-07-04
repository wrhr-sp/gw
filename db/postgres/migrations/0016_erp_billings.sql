create table if not exists erp_billings (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  vendor_id text not null references erp_vendors(id),
  contract_id text,
  title text not null,
  billing_category text not null,
  department_id text,
  branch_id text,
  project_code text,
  supply_amount numeric(14, 2) not null check (supply_amount >= 0),
  tax_amount numeric(14, 2) not null check (tax_amount >= 0),
  total_amount numeric(14, 2) generated always as (supply_amount + tax_amount) stored,
  billing_due_date date not null,
  payment_due_date date,
  issued_at date,
  paid_at date,
  status text not null default 'draft' check (status in ('draft', 'requested', 'approved', 'issued', 'paid', 'overdue', 'cancelled')),
  payment_status text not null default 'not_due' check (payment_status in ('not_due', 'scheduled', 'partial', 'paid', 'overdue', 'cancelled')),
  tax_invoice_status text not null default 'not_requested' check (tax_invoice_status in ('not_requested', 'requested', 'issued', 'failed', 'cancelled')),
  sync_status text not null default 'not_connected' check (sync_status in ('not_connected', 'pending', 'queued', 'synced', 'failed')),
  external_provider text check (external_provider is null or external_provider in ('kyungrinara')),
  external_reference_id text,
  last_synced_at timestamptz,
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists erp_billings_company_status_idx on erp_billings(company_id, status, updated_at desc);
create index if not exists erp_billings_company_vendor_idx on erp_billings(company_id, vendor_id, updated_at desc);
create index if not exists erp_billings_company_due_idx on erp_billings(company_id, billing_due_date, payment_due_date);
