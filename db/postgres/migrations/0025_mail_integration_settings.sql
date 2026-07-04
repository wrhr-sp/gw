begin;

create table if not exists mail_accounts (
  id text primary key,
  company_id text not null references companies(id),
  owner_user_id text references users(id),
  owner_department_id text references departments(id),
  account_type text not null check (account_type in ('personal', 'virtual')),
  email text not null,
  display_name text not null,
  reply_to_email text,
  provider_kind text not null default 'unconfigured' check (provider_kind in ('smtp', 'api', 'unconfigured')),
  provider_name text not null default 'unconfigured',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint mail_accounts_owner_required check (
    (account_type = 'personal' and owner_user_id is not null)
    or account_type = 'virtual'
  )
);

create unique index if not exists ux_mail_accounts_company_email_active
  on mail_accounts (company_id, lower(email))
  where deleted_at is null;

create unique index if not exists ux_mail_accounts_personal_default
  on mail_accounts (company_id, owner_user_id)
  where account_type = 'personal' and is_default = true and deleted_at is null;

create table if not exists mail_account_aliases (
  id text primary key,
  company_id text not null references companies(id),
  mail_account_id text not null references mail_accounts(id) on delete cascade,
  alias_email text not null,
  display_name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ux_mail_account_aliases_company_email_active
  on mail_account_aliases (company_id, lower(alias_email))
  where deleted_at is null;

create index if not exists idx_mail_accounts_company_owner
  on mail_accounts (company_id, account_type, owner_user_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_mail_aliases_account
  on mail_account_aliases (company_id, mail_account_id, created_at desc)
  where deleted_at is null;

commit;
