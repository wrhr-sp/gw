-- HR employee reference masters
-- 목적: 그룹/부서/직책/직위/직급을 직원 생성 화면의 하드코딩 값이 아니라 운영 기준정보로 관리한다.
-- 삭제는 직원 이력 보존을 위해 물리삭제 대신 is_active=false/updated_at 갱신으로 처리한다.

begin;

create table if not exists employee_groups (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists employee_job_titles (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists employee_job_positions (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

create table if not exists employee_job_grades (
  id text primary key,
  company_id text not null references companies(id),
  code text not null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, code)
);

alter table employees add column if not exists group_id text references employee_groups(id);
alter table employees add column if not exists job_title_id text references employee_job_titles(id);
alter table employees add column if not exists job_position_id text references employee_job_positions(id);
alter table employees add column if not exists job_grade_id text references employee_job_grades(id);

create index if not exists idx_employee_groups_company_active on employee_groups(company_id, is_active, sort_order);
create index if not exists idx_employee_job_titles_company_active on employee_job_titles(company_id, is_active, sort_order);
create index if not exists idx_employee_job_positions_company_active on employee_job_positions(company_id, is_active, sort_order);
create index if not exists idx_employee_job_grades_company_active on employee_job_grades(company_id, is_active, sort_order);
create index if not exists idx_employees_reference_masters on employees(company_id, group_id, job_title_id, job_position_id, job_grade_id);

insert into employee_groups (id, company_id, code, name, sort_order)
select 'group_demo_hq', 'company_demo', 'HQ', '본사', 10
where exists (select 1 from companies where id = 'company_demo')
on conflict (company_id, code) do update set name = excluded.name, sort_order = excluded.sort_order, is_active = true, updated_at = now(), deleted_at = null;

insert into employee_job_titles (id, company_id, code, name, sort_order)
select 'job_title_demo_member', 'company_demo', 'MEMBER', '팀원', 10
where exists (select 1 from companies where id = 'company_demo')
on conflict (company_id, code) do update set name = excluded.name, sort_order = excluded.sort_order, is_active = true, updated_at = now(), deleted_at = null;

insert into employee_job_positions (id, company_id, code, name, sort_order)
select 'job_position_demo_staff', 'company_demo', 'STAFF', '사원', 10
where exists (select 1 from companies where id = 'company_demo')
on conflict (company_id, code) do update set name = excluded.name, sort_order = excluded.sort_order, is_active = true, updated_at = now(), deleted_at = null;

insert into employee_job_grades (id, company_id, code, name, sort_order)
select 'job_grade_demo_staff', 'company_demo', 'STAFF', '사원', 10
where exists (select 1 from companies where id = 'company_demo')
on conflict (company_id, code) do update set name = excluded.name, sort_order = excluded.sort_order, is_active = true, updated_at = now(), deleted_at = null;

commit;
