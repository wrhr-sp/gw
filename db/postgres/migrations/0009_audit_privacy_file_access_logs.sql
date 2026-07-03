begin;

create table if not exists privacy_access_logs (
  id text primary key,
  company_id text not null references companies(id),
  actor_user_id text references users(id),
  subject_user_id text references users(id),
  resource_type text not null,
  resource_id text not null,
  access_type text not null,
  purpose text not null,
  legal_basis text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists file_access_logs (
  id text primary key,
  company_id text not null references companies(id),
  actor_user_id text references users(id),
  file_id text not null,
  version_id text,
  action text not null,
  outcome text not null,
  storage_provider text not null,
  object_key text,
  checksum_sha256 text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists permission_change_logs (
  id text primary key,
  company_id text not null references companies(id),
  actor_user_id text references users(id),
  target_role_code text not null,
  target_feature_key text not null,
  permission_codes text[] not null default '{}',
  enabled boolean not null,
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_privacy_access_logs_company_created_at on privacy_access_logs(company_id, created_at desc);
create index if not exists idx_privacy_access_logs_subject_created_at on privacy_access_logs(company_id, subject_user_id, created_at desc);
create index if not exists idx_file_access_logs_company_created_at on file_access_logs(company_id, created_at desc);
create index if not exists idx_file_access_logs_file_created_at on file_access_logs(company_id, file_id, created_at desc);
create index if not exists idx_permission_change_logs_company_created_at on permission_change_logs(company_id, created_at desc);
create index if not exists idx_permission_change_logs_role_created_at on permission_change_logs(company_id, target_role_code, created_at desc);

commit;
