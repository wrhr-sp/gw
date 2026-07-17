begin;

alter table auth_login_transactions
  add column custom_auth_request_hash bytea,
  add column custom_csrf_hash bytea,
  add column custom_csrf_expires_at timestamptz,
  add column custom_validation_count integer not null default 0,
  add column custom_attempt_count integer not null default 0,
  add constraint auth_login_transactions_custom_auth_request_hash_check
    check (custom_auth_request_hash is null or octet_length(custom_auth_request_hash) = 32),
  add constraint auth_login_transactions_custom_csrf_hash_check
    check (custom_csrf_hash is null or octet_length(custom_csrf_hash) = 32),
  add constraint auth_login_transactions_custom_validation_count_check
    check (custom_validation_count between 0 and 5),
  add constraint auth_login_transactions_custom_attempt_count_check
    check (custom_attempt_count between 0 and 5),
  add constraint auth_login_transactions_custom_binding_check
    check (
      (custom_auth_request_hash is null and custom_csrf_hash is null and custom_csrf_expires_at is null and custom_attempt_count = 0)
      or custom_auth_request_hash is not null
    ),
  add constraint auth_login_transactions_custom_csrf_expiry_check
    check (
      (custom_csrf_hash is null and custom_csrf_expires_at is null)
      or (custom_csrf_hash is not null and custom_csrf_expires_at is not null and custom_csrf_expires_at <= expires_at)
    );

create unique index auth_login_transactions_browser_binding_unique_idx
  on auth_login_transactions (browser_binding_hash);

create unique index auth_login_transactions_custom_request_unique_idx
  on auth_login_transactions (custom_auth_request_hash)
  where custom_auth_request_hash is not null;

create table auth_credential_rate_limits (
  scope text not null
    constraint auth_credential_rate_limits_scope_check check (scope in ('IP', 'ACCOUNT')),
  subject_hash bytea not null
    constraint auth_credential_rate_limits_subject_hash_check check (octet_length(subject_hash) = 32),
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1
    constraint auth_credential_rate_limits_attempt_count_check check (attempt_count between 1 and 1000),
  expires_at timestamptz not null,
  primary key (scope, subject_hash),
  constraint auth_credential_rate_limits_expiry_after_window_check
    check (expires_at > window_started_at),
  constraint auth_credential_rate_limits_expiry_max_check
    check (expires_at <= window_started_at + interval '15 minutes')
);

create index auth_credential_rate_limits_expiry_idx
  on auth_credential_rate_limits (expires_at);

insert into schema_migrations (version)
values ('0004_custom_login_security');

commit;
