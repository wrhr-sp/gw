create table if not exists erp_closing_periods (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'locked' check (status in ('open','locked','closed')),
  locked_at timestamptz,
  closed_at timestamptz,
  memo text,
  created_by_user_id text not null references users(id),
  updated_by_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(company_id, period_start, period_end),
  check (period_start <= period_end),
  check (status <> 'closed' or closed_at is not null),
  check (status = 'open' or locked_at is not null)
);

create index if not exists erp_closing_periods_company_status_idx on erp_closing_periods(company_id, status, period_start desc);
create index if not exists erp_journal_entries_company_date_idx on erp_journal_entries(company_id, entry_date, status);
create index if not exists erp_journal_entry_lines_account_idx on erp_journal_entry_lines(account_subject_id, journal_entry_id);
