alter table if exists employees
  add column if not exists employee_classification text not null default 'employee';

alter table if exists employees
  drop constraint if exists employees_employee_classification_check;

alter table if exists employees
  add constraint employees_employee_classification_check
  check (employee_classification in ('employee', 'executive', 'ceo'));

alter table if exists payroll_profiles
  add column if not exists monthly_salary numeric(14,2) not null default 0,
  add column if not exists fixed_allowances_json jsonb not null default '[]'::jsonb,
  add column if not exists salary_bank text not null default 'kb',
  add column if not exists salary_account_number text not null default '',
  add column if not exists income_tax_dependent_count integer not null default 1,
  add column if not exists child_tax_credit_count integer not null default 0,
  add column if not exists durunuri_enabled boolean not null default false,
  add column if not exists durunuri_pension_reduction_rate numeric(5,2) not null default 0,
  add column if not exists durunuri_employment_reduction_rate numeric(5,2) not null default 0,
  add column if not exists sme_income_tax_reduction_enabled boolean not null default false,
  add column if not exists sme_income_tax_reduction_mode text not null default 'year_end',
  add column if not exists sme_income_tax_reduction_rate numeric(5,2) not null default 0,
  add column if not exists sme_income_tax_reduction_start_date date,
  add column if not exists sme_income_tax_reduction_end_date date;

alter table if exists payroll_profiles
  drop constraint if exists payroll_profiles_salary_bank_check;

alter table if exists payroll_profiles
  add constraint payroll_profiles_salary_bank_check
  check (salary_bank in ('kb', 'shinhan', 'woori', 'hana', 'nh', 'ibk', 'kakao', 'toss', 'other'));

alter table if exists payroll_profiles
  drop constraint if exists payroll_profiles_sme_income_tax_reduction_mode_check;

alter table if exists payroll_profiles
  add constraint payroll_profiles_sme_income_tax_reduction_mode_check
  check (sme_income_tax_reduction_mode in ('year_end', 'payroll'));

create index if not exists idx_payroll_profiles_employee_effective
  on payroll_profiles (company_id, employee_id, effective_from desc, created_at desc);
