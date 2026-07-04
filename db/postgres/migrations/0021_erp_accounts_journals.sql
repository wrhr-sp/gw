create table if not exists erp_account_subjects (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense')),
  parent_id text references erp_account_subjects(id),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(company_id, code)
);

create table if not exists erp_journal_entries (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  entry_number text not null,
  entry_date date not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','posted','reversed','cancelled')),
  source_type text not null default 'manual' check (source_type in ('manual','expense','billing','payment','closing')),
  source_id text,
  total_debit_amount numeric(18,2) not null default 0 check (total_debit_amount >= 0),
  total_credit_amount numeric(18,2) not null default 0 check (total_credit_amount >= 0),
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(company_id, entry_number),
  check (total_debit_amount = total_credit_amount)
);

create table if not exists erp_journal_entry_lines (
  id text primary key,
  journal_entry_id text not null references erp_journal_entries(id) on delete cascade,
  account_subject_id text not null references erp_account_subjects(id),
  debit_amount numeric(18,2) not null default 0 check (debit_amount >= 0),
  credit_amount numeric(18,2) not null default 0 check (credit_amount >= 0),
  memo text,
  created_at timestamptz not null default now(),
  check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0))
);

create index if not exists erp_account_subjects_company_status_idx on erp_account_subjects(company_id, status, code);
create index if not exists erp_journal_entries_company_status_idx on erp_journal_entries(company_id, status, entry_date desc);
create index if not exists erp_journal_entry_lines_entry_idx on erp_journal_entry_lines(journal_entry_id);
