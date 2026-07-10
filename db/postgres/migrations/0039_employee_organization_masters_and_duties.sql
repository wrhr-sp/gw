-- Employee organization master management and department duties
-- 목적: 관리자페이지에서 사원 조직정보 기준값과 부서별 담당업무를 운영 DB로 관리한다.

begin;

alter table employee_groups add column if not exists description text;
alter table employee_job_titles add column if not exists description text;
alter table employee_job_positions add column if not exists description text;
alter table employee_job_grades add column if not exists description text;
alter table departments add column if not exists description text;
alter table departments add column if not exists sort_order integer not null default 0;
alter table branches add column if not exists description text;
alter table branches add column if not exists sort_order integer not null default 0;

create table if not exists department_duties (
  id text primary key,
  company_id text not null references companies(id),
  department_id text not null references departments(id),
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, department_id, code)
);

create table if not exists employee_department_duties (
  id text primary key,
  company_id text not null references companies(id),
  employee_id text not null references employees(id),
  department_id text not null references departments(id),
  department_duty_id text not null references department_duties(id),
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, employee_id, department_duty_id)
);

create index if not exists idx_department_duties_department_active on department_duties(company_id, department_id, is_active, sort_order) where deleted_at is null;
create index if not exists idx_employee_department_duties_employee_active on employee_department_duties(company_id, employee_id, is_active, sort_order) where deleted_at is null;

insert into department_duties (id, company_id, department_id, code, name, description, sort_order)
select 'department_duty_demo_hr_payroll', 'company_demo', d.id, 'PAYROLL', '급여', '경영지원팀 급여 담당업무', 10
from departments d
where d.company_id = 'company_demo' and d.name = '경영지원팀'
on conflict (company_id, department_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = true, updated_at = now(), deleted_at = null;

insert into department_duties (id, company_id, department_id, code, name, description, sort_order)
select 'department_duty_demo_hr_insurance', 'company_demo', d.id, 'INSURANCE', '4대보험', '경영지원팀 4대보험 담당업무', 20
from departments d
where d.company_id = 'company_demo' and d.name = '경영지원팀'
on conflict (company_id, department_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = true, updated_at = now(), deleted_at = null;

commit;
