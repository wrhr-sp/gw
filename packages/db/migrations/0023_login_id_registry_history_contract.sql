begin;

-- One user may accumulate immutable historical login ID claims after an
-- approved rotation. The active login remains exact through users.login_name
-- and users_login_name_registry_fk; registry rows themselves stay immutable.
alter table public.login_id_registry
  drop constraint login_id_registry_company_id_target_user_id_key;

create index login_id_registry_company_target_history_idx
  on public.login_id_registry (company_id, target_user_id, claimed_at desc, login_id);

create table public.preview_bootstrap_operations (
  operation_key text primary key check (pg_catalog.btrim(operation_key) <> ''),
  operation_type text not null check (
    operation_type = 'PASSWORD_RESET_EMAIL'
  ),
  subject_fingerprint text not null check (
    subject_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  request_fingerprint text not null check (
    request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  status text not null check (
    status in ('REQUESTING', 'REQUESTED', 'INDETERMINATE')
  ),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);

revoke all privileges on table public.preview_bootstrap_operations from public;

insert into public.schema_migrations (version)
values ('0023_login_id_registry_history_contract');

commit;
