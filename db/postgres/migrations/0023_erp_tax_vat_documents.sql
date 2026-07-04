create table if not exists erp_tax_documents (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  document_type text not null check (document_type in ('sales_tax_invoice','purchase_tax_invoice','cash_receipt','vat_adjustment')),
  issue_date date not null,
  vendor_name text not null,
  business_registration_number_hash text,
  supply_amount numeric(18,2) not null default 0 check (supply_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  linked_evidence_id text references erp_evidence(id),
  linked_billing_id text references erp_billings(id),
  linked_journal_entry_id text references erp_journal_entries(id),
  status text not null default 'draft' check (status in ('draft','matched','review_required','reported','archived')),
  provider_status text not null default 'not_connected' check (provider_status in ('not_connected')),
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (total_amount = supply_amount + tax_amount)
);

create table if not exists erp_tax_report_packages (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','locked','exported')),
  sales_supply_amount numeric(18,2) not null default 0 check (sales_supply_amount >= 0),
  sales_tax_amount numeric(18,2) not null default 0 check (sales_tax_amount >= 0),
  purchase_supply_amount numeric(18,2) not null default 0 check (purchase_supply_amount >= 0),
  purchase_tax_amount numeric(18,2) not null default 0 check (purchase_tax_amount >= 0),
  document_count integer not null default 0 check (document_count >= 0),
  provider_status text not null default 'not_connected' check (provider_status in ('not_connected')),
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(company_id, period_start, period_end),
  check (period_start <= period_end)
);

create index if not exists erp_tax_documents_company_type_date_idx on erp_tax_documents(company_id, document_type, issue_date desc);
create index if not exists erp_tax_documents_company_status_idx on erp_tax_documents(company_id, status, issue_date desc);
create index if not exists erp_tax_report_packages_company_period_idx on erp_tax_report_packages(company_id, period_start desc, period_end desc);
