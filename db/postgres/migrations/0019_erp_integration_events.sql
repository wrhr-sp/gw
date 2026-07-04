create table if not exists erp_integration_events (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  provider text not null default 'kyungrinara' check (provider in ('kyungrinara')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound', 'webhook')),
  resource_type text not null check (resource_type in ('vendor', 'expense', 'evidence', 'billing', 'payment', 'accounting_mapping', 'tax_invoice', 'other')),
  resource_id text,
  title text not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'succeeded', 'failed', 'retry_required', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  next_retry_at timestamptz,
  external_reference_id text,
  external_status text,
  failure_code text,
  failure_message text,
  safe_payload_summary text,
  safe_response_summary text,
  requested_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists erp_integration_events_company_status_idx on erp_integration_events(company_id, status, updated_at desc);
create index if not exists erp_integration_events_company_resource_idx on erp_integration_events(company_id, resource_type, resource_id, updated_at desc);
