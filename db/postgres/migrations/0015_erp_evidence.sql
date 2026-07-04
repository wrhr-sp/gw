create table if not exists erp_evidence (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  expense_id text references erp_expense_requests(id),
  vendor_id text references erp_vendors(id),
  file_id text not null references file_objects(id),
  evidence_type text not null check (evidence_type in ('receipt', 'tax_invoice', 'transaction_statement', 'contract', 'business_registration', 'other')),
  title text not null,
  issued_at date,
  supply_amount numeric(14, 2),
  tax_amount numeric(14, 2),
  total_amount numeric(14, 2),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'accepted', 'rework_requested', 'archived')),
  rework_reason text,
  memo text,
  sync_status text not null default 'not_connected' check (sync_status in ('not_connected', 'pending', 'queued', 'synced', 'failed')),
  external_provider text check (external_provider is null or external_provider in ('kyungrinara')),
  external_reference_id text,
  last_synced_at timestamptz,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, file_id)
);

create index if not exists erp_evidence_company_status_idx on erp_evidence(company_id, status, updated_at desc);
create index if not exists erp_evidence_company_expense_idx on erp_evidence(company_id, expense_id, updated_at desc);
create index if not exists erp_evidence_company_vendor_idx on erp_evidence(company_id, vendor_id, updated_at desc);
