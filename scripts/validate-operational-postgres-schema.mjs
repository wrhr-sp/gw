import { readdirSync, readFileSync } from 'node:fs';

const migrationsDir = new URL('../db/postgres/migrations/', import.meta.url);
const sql = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => readFileSync(new URL(fileName, migrationsDir), 'utf8'))
  .join('\n')
  .toLowerCase();

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
  'user_security_settings',
  'user_preferences',
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
  'approval_forms',
  'approval_lines',
  'approval_documents',
  'approval_steps',
  'approval_references',
  'work_items',
  'payroll_runs',
  'compliance_alerts',
  'notifications',
  'mail_messages',
  'mail_attachments',
  'messenger_thread_members',
  'privacy_access_logs',
  'file_access_logs',
  'permission_change_logs',
  'document_file_download_tickets',
  'electronic_contracts',
  'electronic_contract_parties',
  'fleet_vehicles',
  'vehicle_operation_logs',
  'erp_vendors',
  'erp_expense_requests',
  'audit_logs',
];

const requiredFragments = [
  'create index if not exists idx_posts_search',
  'create index if not exists idx_documents_search',
  'jsonb',
  'timestamptz',
  'references companies(id)',
  'unique (company_id, login_id)',
  'unique (company_id, user_id)',
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
