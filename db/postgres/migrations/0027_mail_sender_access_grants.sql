create table if not exists mail_sender_access_grants (
  id text primary key,
  company_id text not null references companies(id),
  mail_account_id text not null references mail_accounts(id) on delete cascade,
  mail_account_alias_id text references mail_account_aliases(id) on delete cascade,
  grantee_type text not null check (grantee_type in ('user', 'department')),
  grantee_id text not null,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ux_mail_sender_grants_account_user_active
  on mail_sender_access_grants (company_id, mail_account_id, grantee_type, grantee_id)
  where mail_account_alias_id is null and deleted_at is null;

create unique index if not exists ux_mail_sender_grants_alias_user_active
  on mail_sender_access_grants (company_id, mail_account_alias_id, grantee_type, grantee_id)
  where mail_account_alias_id is not null and deleted_at is null;

create index if not exists idx_mail_sender_grants_lookup
  on mail_sender_access_grants (company_id, grantee_type, grantee_id, deleted_at);
