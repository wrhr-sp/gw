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
  ["hotel_profiles", "road_address"],
  ["hotel_profiles", "detail_address"],
  ["hotel_profiles", "representative_phone"],
  ["hotel_profiles", "contract_start_date"],
  ["hotel_profiles", "contract_end_date"],
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
  ["hotel_profiles", "primary key (company_id, branch_id)"],
  ["hotel_profiles", "foreign key (company_id, branch_id) references branches(company_id, id)"],
  ["audit_events", "foreign key (company_id, session_id) references auth_sessions(company_id, id)"],
  ["idempotency_records", "foreign key (company_id, audit_event_id) references audit_events(company_id, id)"],
] as const;

const REQUIRED_CHECK_CONSTRAINTS = [
  { table: "auth_sessions", name: "auth_sessions_token_hash_check", definition: "check ((octet_length(token_hash) = 32))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_state_hash_check", definition: "check ((octet_length(state_hash) = 32))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_browser_binding_hash_check", definition: "check ((octet_length(browser_binding_hash) = 32))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_nonce_hash_check", definition: "check ((octet_length(nonce_hash) = 32))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_code_verifier_iv_check", definition: "check ((octet_length(code_verifier_iv) = 12))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_check", definition: "check ((expires_at > created_at))" },
  { table: "auth_sessions", name: "auth_sessions_idle_max_eight_hours", definition: "check ((idle_expires_at <= (last_seen_at + '08:00:00'::interval)))" },
  { table: "auth_sessions", name: "auth_sessions_absolute_max_twenty_four_hours", definition: "check ((absolute_expires_at <= (created_at + '24:00:00'::interval)))" },
  { table: "hotel_profiles", name: "hotel_profiles_contract_period", definition: "check ((contract_end_date >= contract_start_date))" },
  { table: "hotel_profiles", name: "hotel_profiles_road_address_nonempty", definition: "check ((btrim(road_address) <> ''::text))" },
  { table: "hotel_profiles", name: "hotel_profiles_representative_phone_format", definition: "check ((representative_phone ~ '^[0-9+() -]{8,30}$'::text))" },
  { table: "branches", name: "branches_branch_code_canonical_check", definition: "check (((branch_code = upper(btrim(branch_code))) and (branch_code ~ '^[a-z0-9][a-z0-9_-]*$'::text)))" },
  { table: "idempotency_records", name: "idempotency_records_completed_result_check", definition: "check (((status <> 'completed'::text) or ((completed_at is not null) and (resource_type is not null) and (resource_id is not null) and (audit_event_id is not null) and (result_snapshot is not null))))" },
] as const;

const REQUIRED_INDEXES = [{
  name: "branches_active_hotel_name_unique_idx",
  fragments: [
    "create unique index",
    "on public.branches using btree (company_id, lower(btrim(name)))",
    "where ((branch_type = 'hotel'::text) and (status = 'active'::text))",
  ],
}] as const;

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

const REQUIRED_RLS_POLICIES = [
  { policy: "branches_company_isolation", table: "branches" },
  { policy: "hotel_profiles_company_isolation", table: "hotel_profiles" },
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
      select table_record.relname as table_name
      from pg_class table_record
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      where table_namespace.nspname = 'public'
        and table_record.relkind in ('r', 'p')
    `;
    const tables = new Set(tableRows.map((row) => row.table_name));
    if (REQUIRED_TABLES.some((table) => !tables.has(table))) return { status: "SCHEMA_NOT_READY" };

    const columnRows = await sql<{ table_name: string; column_name: string }[]>`
      select table_record.relname as table_name,
             column_record.attname as column_name
      from pg_attribute column_record
      join pg_class table_record on table_record.oid = column_record.attrelid
      join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
      where table_namespace.nspname = 'public'
        and table_record.relkind in ('r', 'p')
        and column_record.attnum > 0
        and not column_record.attisdropped
    `;
    const columns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
    if (REQUIRED_COLUMNS.some(([table, column]) => !columns.has(`${table}.${column}`))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const migrationRows = await sql<{ migration_applied: boolean }[]>`
      select count(*) = 3 as migration_applied
      from public.schema_migrations
      where version in (
        '0001_platform_foundation',
        '0002_auth_session_runtime',
        '0003_hotel_basic_information'
      )
    `;
    if (!migrationRows[0]?.migration_applied) return { status: "SCHEMA_NOT_READY" };

    const constraintRows = await sql<{
      constraint_name: string;
      definition: string;
      table_name: string;
      validated: boolean;
    }[]>`
      select constraint_table.relname as table_name,
             constraint_record.conname as constraint_name,
             constraint_record.convalidated as validated,
             pg_get_constraintdef(constraint_record.oid) as definition
      from pg_constraint constraint_record
      join pg_class constraint_table on constraint_table.oid = constraint_record.conrelid
      join pg_namespace constraint_namespace on constraint_namespace.oid = constraint_table.relnamespace
      where constraint_namespace.nspname = 'public'
    `;
    const constraints = constraintRows.map((row) => ({
      name: row.constraint_name,
      table: row.table_name,
      validated: row.validated,
      definition: normalizeDefinition(row.definition),
    }));
    if (REQUIRED_CONSTRAINTS.some(([table, required]) => !constraints.some((constraint) => (
      constraint.table === table && constraint.definition.includes(required)
    )))) {
      return { status: "SCHEMA_NOT_READY" };
    }
    if (REQUIRED_CHECK_CONSTRAINTS.some((required) => !constraints.some((constraint) => (
      constraint.table === required.table
      && constraint.name === required.name
      && constraint.validated
      && constraint.definition === required.definition
    )))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const indexRows = await sql<{ index_name: string; definition: string }[]>`
      select indexname as index_name, indexdef as definition
      from pg_indexes
      where schemaname = 'public'
    `;
    if (REQUIRED_INDEXES.some((required) => !indexRows.some((index) => {
      const definition = normalizeDefinition(index.definition);
      return index.index_name === required.name
        && required.fragments.every((fragment) => definition.includes(fragment));
    }))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const permissionRows = await sql<{ permission_ready: boolean }[]>`
      select exists (
        select 1 from permissions where code = 'HOTEL_MANAGE'
      ) as permission_ready
    `;
    if (!permissionRows[0]?.permission_ready) return { status: "SCHEMA_NOT_READY" };

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

    const rlsRows = await sql<{
      applies_to_current_role: boolean;
      policy_name: string;
      policy_command: string;
      policy_permissive: boolean;
      row_security: boolean;
      row_security_forced: boolean;
      table_name: string;
      using_expression: string | null;
      check_expression: string | null;
    }[]>`
      select policy_record.polname as policy_name,
             policy_record.polcmd as policy_command,
             policy_record.polpermissive as policy_permissive,
             case
               when 0::oid = any(policy_record.polroles) then true
               else exists (
                 select 1
                 from unnest(policy_record.polroles) policy_role(role_oid)
                 where pg_has_role(current_user, policy_role.role_oid, 'member')
               )
             end as applies_to_current_role,
             policy_table.relrowsecurity as row_security,
             policy_table.relforcerowsecurity as row_security_forced,
             policy_table.relname as table_name,
             pg_get_expr(policy_record.polqual, policy_record.polrelid) as using_expression,
             pg_get_expr(policy_record.polwithcheck, policy_record.polrelid) as check_expression
      from pg_policy policy_record
      join pg_class policy_table on policy_table.oid = policy_record.polrelid
      join pg_namespace policy_namespace on policy_namespace.oid = policy_table.relnamespace
      where policy_namespace.nspname = 'public'
    `;
    if (REQUIRED_RLS_POLICIES.some((required) => !rlsRows.some((policy) => {
      const usingExpression = normalizeDefinition(policy.using_expression ?? "");
      const checkExpression = normalizeDefinition(policy.check_expression ?? "");
      return policy.policy_name === required.policy
        && policy.table_name === required.table
        && policy.row_security
        && policy.row_security_forced
        && policy.policy_permissive
        && policy.applies_to_current_role
        && policy.policy_command === "*"
        && usingExpression.includes("app.company_id")
        && usingExpression.includes("company_id")
        && usingExpression.includes("nullif(current_setting('app.company_id'::text, true), ''::text)")
        && usingExpression.includes("::uuid")
        && !usingExpression.includes(" or ")
        && checkExpression.includes("app.company_id")
        && checkExpression.includes("company_id")
        && checkExpression.includes("nullif(current_setting('app.company_id'::text, true), ''::text)")
        && checkExpression.includes("::uuid")
        && !checkExpression.includes(" or ");
    }))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    return { status: "READY" };
  } catch {
    return { status: "UNAVAILABLE" };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}
