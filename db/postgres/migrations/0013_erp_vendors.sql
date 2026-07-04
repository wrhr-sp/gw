create table if not exists erp_vendors (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  business_registration_number text not null,
  name text not null,
  representative_name text,
  address text,
  business_type text,
  business_item text,
  contact_name text,
  contact_phone text,
  contact_email text,
  tax_invoice_email text,
  settlement_term text,
  memo text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  external_provider text check (external_provider is null or external_provider in ('kyungrinara')),
  external_reference_id text,
  sync_status text not null default 'not_connected' check (sync_status in ('not_connected', 'pending', 'queued', 'synced', 'failed')),
  last_synced_at timestamptz,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, business_registration_number)
);

create index if not exists erp_vendors_company_status_idx on erp_vendors(company_id, status, updated_at desc);
create index if not exists erp_vendors_company_sync_idx on erp_vendors(company_id, sync_status, updated_at desc);
