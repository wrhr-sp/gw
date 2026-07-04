create table if not exists erp_payment_records (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  billing_id text references erp_billings(id),
  vendor_id text references erp_vendors(id),
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'card', 'cash', 'virtual_account', 'other')),
  amount numeric(14, 2) not null check (amount >= 0),
  expected_at date,
  occurred_at date,
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'partially_matched', 'matched', 'overpaid', 'cancelled')),
  receivable_status text not null default 'not_due' check (receivable_status in ('not_due', 'due', 'partial', 'paid', 'overdue', 'write_off', 'cancelled')),
  bank_account_label text,
  transaction_memo text,
  sync_status text not null default 'not_connected' check (sync_status in ('not_connected', 'pending', 'queued', 'synced', 'failed')),
  external_provider text check (external_provider is null or external_provider in ('kyungrinara')),
  external_reference_id text,
  last_synced_at timestamptz,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists erp_payment_records_company_status_idx on erp_payment_records(company_id, receivable_status, match_status, updated_at desc);
create index if not exists erp_payment_records_company_billing_idx on erp_payment_records(company_id, billing_id, updated_at desc);
create index if not exists erp_payment_records_company_vendor_idx on erp_payment_records(company_id, vendor_id, updated_at desc);
