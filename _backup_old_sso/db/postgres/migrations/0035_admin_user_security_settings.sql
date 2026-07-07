-- Admin user security settings extension.
-- Stores policy flags and safe counters only. Passwords, tokens, and secrets are not stored here.

begin;

alter table user_security_settings
  add column if not exists two_factor_required boolean not null default false,
  add column if not exists failed_login_count integer not null default 0 check (failed_login_count >= 0);

update user_security_settings
set two_factor_required = true
where secondary_password_hash is not null
  and two_factor_required = false;

commit;
