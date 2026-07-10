-- Organization info code policies
-- 목적: 관리자페이지 조직정보 > 코드정보에서 코드 자동생성 정책을 관리한다.

begin;

create table if not exists organization_code_policies (
  id text primary key,
  company_id text not null references companies(id),
  target_kind text not null,
  prefix text not null,
  number_digits integer not null default 3,
  next_sequence integer not null default 1,
  format_pattern text not null default '{PREFIX}-{SEQ}',
  auto_generate_enabled boolean not null default true,
  manual_edit_allowed boolean not null default false,
  reuse_retired_code_allowed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, target_kind)
);

alter table employee_groups add column if not exists system_permission_scope text;
alter table employee_groups add column if not exists notification_scope text;
alter table employee_groups add column if not exists approval_scope text;
alter table employee_groups add column if not exists visibility_scope text;

insert into organization_code_policies (id, company_id, target_kind, prefix, number_digits, next_sequence, format_pattern, auto_generate_enabled, manual_edit_allowed, reuse_retired_code_allowed, is_active)
values
  ('org_code_policy_demo_branches', 'company_demo', 'branches', 'BR', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true),
  ('org_code_policy_demo_departments', 'company_demo', 'departments', 'DEPT', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true),
  ('org_code_policy_demo_job_grades', 'company_demo', 'jobGrades', 'GRADE', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true),
  ('org_code_policy_demo_job_positions', 'company_demo', 'jobPositions', 'POSITION', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true),
  ('org_code_policy_demo_job_titles', 'company_demo', 'jobTitles', 'TITLE', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true),
  ('org_code_policy_demo_department_duties', 'company_demo', 'departmentDuties', 'DUTY', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true),
  ('org_code_policy_demo_groups', 'company_demo', 'groups', 'GROUP', 3, 1, '{PREFIX}-{SEQ}', true, false, false, true)
on conflict (company_id, target_kind) do nothing;

commit;
