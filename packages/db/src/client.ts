import postgres from "postgres";

export type DatabaseReadiness =
  | { status: "READY" }
  | { status: "NOT_CONFIGURED" }
  | { status: "SCHEMA_NOT_READY" }
  | { status: "UNAVAILABLE" };

const REQUIRED_TABLES = [
  "schema_migrations",
  "companies",
  "users",
  "auth_identities",
  "auth_sessions",
  "auth_login_transactions",
  "branches",
  "hotel_profiles",
  "roles",
  "permissions",
  "user_groups",
  "user_group_memberships",
  "user_role_memberships",
  "permission_grants",
  "audit_events",
  "idempotency_records",
  "outbox_jobs",
] as const;

const REQUIRED_COLUMNS = [
  ["schema_migrations", "version"],
  ["auth_sessions", "company_id"],
  ["auth_sessions", "user_id"],
  ["auth_sessions", "identity_id"],
  ["auth_sessions", "token_hash"],
  ["auth_login_transactions", "state_hash"],
  ["auth_login_transactions", "browser_binding_hash"],
  ["auth_login_transactions", "nonce_hash"],
  ["auth_login_transactions", "code_verifier_ciphertext"],
  ["auth_login_transactions", "code_verifier_iv"],
  ["auth_login_transactions", "encryption_key_version"],
  ["auth_login_transactions", "expires_at"],
  ["hotel_profiles", "company_id"],
  ["hotel_profiles", "branch_id"],
  ["permission_grants", "subject_type"],
  ["permission_grants", "subject_id"],
  ["audit_events", "company_id"],
  ["audit_events", "session_id"],
  ["idempotency_records", "company_id"],
  ["idempotency_records", "audit_event_id"],
  ["idempotency_records", "request_hash"],
] as const;

const REQUIRED_CONSTRAINTS = [
  ["auth_sessions", "foreign key (company_id, identity_id, user_id) references auth_identities(company_id, id, user_id)"],
  ["auth_sessions", "check ((octet_length(token_hash) = 32))"],
  ["auth_login_transactions", "check ((octet_length(state_hash) = 32))"],
  ["auth_login_transactions", "check ((octet_length(browser_binding_hash) = 32))"],
  ["auth_login_transactions", "check ((octet_length(nonce_hash) = 32))"],
  ["auth_login_transactions", "check ((octet_length(code_verifier_iv) = 12))"],
  ["auth_login_transactions", "check ((expires_at > created_at))"],
  ["auth_sessions", "check ((idle_expires_at <= (last_seen_at + '08:00:00'::interval)))"],
  ["auth_sessions", "check ((absolute_expires_at <= (created_at + '24:00:00'::interval)))"],
  ["hotel_profiles", "primary key (company_id, branch_id)"],
  ["hotel_profiles", "foreign key (company_id, branch_id) references branches(company_id, id)"],
  ["audit_events", "foreign key (company_id, session_id) references auth_sessions(company_id, id)"],
  ["idempotency_records", "foreign key (company_id, audit_event_id) references audit_events(company_id, id)"],
] as const;

const REQUIRED_TRIGGERS = [
  { name: "audit_events_no_update", table: "audit_events", functionName: "reject_audit_event_change" },
  { name: "permission_grants_subject_guard", table: "permission_grants", functionName: "enforce_permission_grant_subject" },
  { name: "users_no_delete", table: "users", functionName: "reject_access_subject_delete" },
  { name: "roles_no_delete", table: "roles", functionName: "reject_access_subject_delete" },
  { name: "user_groups_no_delete", table: "user_groups", functionName: "reject_access_subject_delete" },
  { name: "users_no_rekey", table: "users", functionName: "reject_access_subject_delete" },
  { name: "roles_no_rekey", table: "roles", functionName: "reject_access_subject_delete" },
  { name: "user_groups_no_rekey", table: "user_groups", functionName: "reject_access_subject_delete" },
] as const;

function normalizeDefinition(value: string) {
  return value.toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

export async function probeDatabaseReadiness(databaseUrl: string | undefined): Promise<DatabaseReadiness> {
  if (!databaseUrl?.trim()) return { status: "NOT_CONFIGURED" };

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 2,
    prepare: false,
  });

  try {
    const tableRows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
    `;
    const tables = new Set(tableRows.map((row) => row.table_name));
    if (REQUIRED_TABLES.some((table) => !tables.has(table))) return { status: "SCHEMA_NOT_READY" };

    const columnRows = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    `;
    const columns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
    if (REQUIRED_COLUMNS.some(([table, column]) => !columns.has(`${table}.${column}`))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const migrationRows = await sql<{ migration_applied: boolean }[]>`
      select count(*) = 2 as migration_applied
      from public.schema_migrations
      where version in ('0001_platform_foundation', '0002_auth_session_runtime')
    `;
    if (!migrationRows[0]?.migration_applied) return { status: "SCHEMA_NOT_READY" };

    const constraintRows = await sql<{ table_name: string; definition: string }[]>`
      select constraint_table.relname as table_name,
             pg_get_constraintdef(constraint_record.oid) as definition
      from pg_constraint constraint_record
      join pg_class constraint_table on constraint_table.oid = constraint_record.conrelid
      join pg_namespace constraint_namespace on constraint_namespace.oid = constraint_table.relnamespace
      where constraint_namespace.nspname = 'public'
    `;
    const constraints = constraintRows.map((row) => ({
      table: row.table_name,
      definition: normalizeDefinition(row.definition),
    }));
    if (REQUIRED_CONSTRAINTS.some(([table, required]) => !constraints.some((constraint) => (
      constraint.table === table && constraint.definition.includes(required)
    )))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const triggerRows = await sql<{
      trigger_name: string;
      enabled: string;
      table_name: string;
      function_name: string;
    }[]>`
      select trigger_record.tgname as trigger_name,
             trigger_record.tgenabled as enabled,
             trigger_table.relname as table_name,
             trigger_function.proname as function_name
      from pg_trigger trigger_record
      join pg_class trigger_table on trigger_table.oid = trigger_record.tgrelid
      join pg_namespace trigger_namespace on trigger_namespace.oid = trigger_table.relnamespace
      join pg_proc trigger_function on trigger_function.oid = trigger_record.tgfoid
      where trigger_namespace.nspname = 'public'
        and not trigger_record.tgisinternal
    `;
    if (REQUIRED_TRIGGERS.some((required) => !triggerRows.some((trigger) => (
      trigger.trigger_name === required.name
      && trigger.table_name === required.table
      && trigger.function_name === required.functionName
      && (trigger.enabled === "O" || trigger.enabled === "A")
    )))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    return { status: "READY" };
  } catch {
    return { status: "UNAVAILABLE" };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}
