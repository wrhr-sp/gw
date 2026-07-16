begin;

create table auth_login_transactions (
  id uuid primary key,
  state_hash bytea not null unique,
  browser_binding_hash bytea not null,
  nonce_hash bytea not null,
  code_verifier_ciphertext bytea not null,
  code_verifier_iv bytea not null,
  encryption_key_version integer not null default 1 check (encryption_key_version >= 1),
  redirect_uri text not null check (btrim(redirect_uri) <> ''),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (octet_length(state_hash) = 32),
  check (octet_length(browser_binding_hash) = 32),
  check (octet_length(nonce_hash) = 32),
  check (octet_length(code_verifier_ciphertext) >= 59),
  check (octet_length(code_verifier_iv) = 12),
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '10 minutes')
);

alter table auth_sessions
  add constraint auth_sessions_last_seen_not_before_create
    check (last_seen_at >= created_at),
  add constraint auth_sessions_idle_after_last_seen
    check (idle_expires_at > last_seen_at),
  add constraint auth_sessions_idle_max_eight_hours
    check (idle_expires_at <= last_seen_at + interval '8 hours'),
  add constraint auth_sessions_idle_within_absolute
    check (idle_expires_at <= absolute_expires_at),
  add constraint auth_sessions_absolute_max_twenty_four_hours
    check (absolute_expires_at <= created_at + interval '24 hours'),
  add constraint auth_sessions_auth_time_not_future
    check (auth_time <= created_at + interval '5 minutes');

create index auth_login_transactions_expiry_idx
  on auth_login_transactions (expires_at, created_at);

create index auth_login_transactions_created_idx
  on auth_login_transactions (created_at);

insert into schema_migrations (version)
values ('0002_auth_session_runtime');

commit;
