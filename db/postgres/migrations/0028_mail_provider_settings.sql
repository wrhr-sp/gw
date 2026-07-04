create table if not exists mail_provider_settings (
  company_id text primary key references companies(id),
  provider_kind text not null default 'unconfigured' check (provider_kind in ('smtp', 'api', 'unconfigured')),
  provider_name text not null default 'unconfigured',
  from_email text,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean not null default true,
  api_endpoint text,
  dns_spf_status text not null default 'not_checked' check (dns_spf_status in ('not_checked', 'pending', 'verified', 'failed')),
  dns_dkim_status text not null default 'not_checked' check (dns_dkim_status in ('not_checked', 'pending', 'verified', 'failed')),
  dns_dmarc_status text not null default 'not_checked' check (dns_dmarc_status in ('not_checked', 'pending', 'verified', 'failed')),
  secret_status text not null default 'not_connected' check (secret_status in ('not_connected', 'pending', 'connected')),
  notes text,
  updated_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mail_provider_settings_kind
  on mail_provider_settings (provider_kind, secret_status, updated_at desc);
