import { readFileSync } from 'node:fs';

const schemaPath = new URL('../db/postgres/migrations/0001_initial_operational_schema.sql', import.meta.url);
const sql = readFileSync(schemaPath, 'utf8').toLowerCase();

const requiredTables = [
  'companies',
  'branches',
  'users',
  'employees',
  'departments',
  'positions',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
  'auth_sessions',
  'home_shortcuts',
  'boards',
  'posts',
  'comments',
  'read_receipts',
  'document_spaces',
  'documents',
  'file_objects',
  'attendance_records',
  'attendance_correction_requests',
  'leave_types',
  'leave_requests',
  'leave_balances',
  'approval_documents',
  'approval_lines',
  'work_items',
  'payroll_runs',
  'compliance_alerts',
  'notifications',
  'audit_logs',
];

const requiredFragments = [
  'create index if not exists idx_posts_search',
  'create index if not exists idx_documents_search',
  'jsonb',
  'timestamptz',
  'references companies(id)',
  'unique (company_id, login_id)',
  'unique (bucket, object_key)',
];

const missing = [];
for (const tableName of requiredTables) {
  if (!sql.includes(`create table if not exists ${tableName}`)) {
    missing.push(`table:${tableName}`);
  }
}

for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) {
    missing.push(`fragment:${fragment}`);
  }
}

if (missing.length > 0) {
  throw new Error(`운영 PostgreSQL 초기 스키마 누락: ${missing.join(', ')}`);
}

console.log(`운영 PostgreSQL 초기 스키마 정적 검증 통과: tables=${requiredTables.length}, fragments=${requiredFragments.length}`);
