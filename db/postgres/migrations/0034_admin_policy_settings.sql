begin;

create table if not exists admin_policy_settings (
  id text primary key,
  company_id text not null references companies(id),
  category text not null,
  settings_json jsonb not null default '{}'::jsonb,
  reason text not null,
  updated_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, category)
);

create index if not exists idx_admin_policy_settings_company_category
  on admin_policy_settings (company_id, category, updated_at desc);

commit;
