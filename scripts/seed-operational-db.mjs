import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.argv[2] || 'preview';
const envName = target.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'PREVIEW';
const url = process.env[`DATABASE_URL_${envName}`] || (envName === 'PRODUCTION' ? process.env.DATABASE_URL : '');

if (!url) {
  console.error(`DATABASE_URL_${envName} is not set`);
  process.exit(1);
}

const initialPassword = process.env.GW_INITIAL_ADMIN_PASSWORD || '1234';
const salt = process.env.GW_INITIAL_ADMIN_PASSWORD_SALT || randomBytes(16).toString('hex');
const passwordHash = `sha256:${salt}:${createHash('sha256').update(`${salt}:${initialPassword}`).digest('hex')}`;
const now = new Date().toISOString();

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const sql = `
begin;

insert into companies (id, name, status, created_at, updated_at)
values ('company_demo', '데모 주식회사', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into branches (id, company_id, code, name, branch_type, status, created_at, updated_at)
values
  ('branch_hq', 'company_demo', 'HQ', '본사 운영센터', 'office', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('branch_hotel_seoul', 'company_demo', 'SEL', '서울 시티 호텔', 'hotel', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into departments (id, company_id, branch_id, code, name, status, created_at, updated_at)
values
  ('department_exec', 'company_demo', 'branch_hq', 'EXEC', '경영지원', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('department_ops', 'company_demo', 'branch_hotel_seoul', 'OPS', '운영팀', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('department_hr', 'company_demo', 'branch_hq', 'HR', '인사팀', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into positions (id, company_id, code, name, rank_order, status, created_at, updated_at)
values
  ('position_admin', 'company_demo', 'ADMIN', '관리자', 100, 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('position_staff', 'company_demo', 'STAFF', '구성원', 10, 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into users (id, company_id, login_id, email, password_hash, display_name, status, must_change_password, created_at, updated_at)
values ('user_company_admin', 'company_demo', 'admin', 'admin@example.com', ${sqlString(passwordHash)}, '관리자 테스트', 'active', true, ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, login_id) do update set password_hash = excluded.password_hash, must_change_password = true, updated_at = excluded.updated_at;

insert into employees (id, company_id, branch_id, user_id, department_id, position_id, employee_number, full_name, employment_status, hire_date, created_at, updated_at)
values ('employee_admin', 'company_demo', 'branch_hq', 'user_company_admin', 'department_exec', 'position_admin', 'A-0001', '관리자 테스트', 'active', current_date, ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, employee_number) do update set user_id = excluded.user_id, updated_at = excluded.updated_at;

insert into roles (id, company_id, code, name, role_scope, status, created_at, updated_at)
values
  ('role_company_admin', 'company_demo', 'COMPANY_ADMIN', '회사 운영 총괄', 'company', 'active', ${sqlString(now)}, ${sqlString(now)}),
  ('role_employee', 'company_demo', 'EMPLOYEE', '일반 구성원', 'self', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, code) do update set name = excluded.name, updated_at = excluded.updated_at;

insert into user_roles (id, company_id, user_id, role_id, branch_id, assigned_by, status, created_at, updated_at)
values ('user_role_company_admin', 'company_demo', 'user_company_admin', 'role_company_admin', 'branch_hq', 'user_company_admin', 'active', ${sqlString(now)}, ${sqlString(now)})
on conflict (company_id, user_id, role_id, branch_id) do update set status = 'active', updated_at = excluded.updated_at;

insert into audit_logs (id, company_id, branch_id, actor_user_id, action, resource_type, resource_id, metadata_json, created_at)
values ('audit_initial_seed_admin', 'company_demo', 'branch_hq', 'user_company_admin', 'db.initial_seed.admin', 'user', 'user_company_admin', '{"mustChangePassword":true}'::jsonb, ${sqlString(now)})
on conflict (id) do nothing;

commit;
`;

const dir = mkdtempSync(join(tmpdir(), 'gw-seed-'));
const file = join(dir, 'seed.sql');
writeFileSync(file, sql);
const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8' });
rmSync(dir, { recursive: true, force: true });

if (result.status !== 0) {
  console.error(result.stderr.replace(/postgresql:\/\/\S+/g, '[REDACTED_URL]'));
  process.exit(result.status ?? 1);
}

console.log(`초기 관리자 seed 완료: target=${envName}, loginId=admin, mustChangePassword=true`);
