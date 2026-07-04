create table if not exists erp_accounting_mappings (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  mapping_type text not null check (mapping_type in ('expense_category', 'revenue_category', 'department', 'branch', 'project', 'tax_type', 'payment_method', 'vendor_type')),
  internal_code text not null,
  internal_name text not null,
  external_provider text check (external_provider is null or external_provider in ('kyungrinara')),
  external_code text,
  external_name text,
  mapping_status text not null default 'unmapped' check (mapping_status in ('unmapped', 'mapped', 'review_required', 'disabled')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, mapping_type, internal_code)
);

create index if not exists erp_accounting_mappings_company_type_idx on erp_accounting_mappings(company_id, mapping_type, updated_at desc);
create index if not exists erp_accounting_mappings_company_status_idx on erp_accounting_mappings(company_id, mapping_status, status, updated_at desc);
