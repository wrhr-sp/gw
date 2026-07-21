import postgres from "postgres";

export type DatabaseReadiness =
  | { status: "READY" }
  | { status: "NOT_CONFIGURED" }
  | { status: "SCHEMA_NOT_READY" }
  | { status: "UNAVAILABLE" };

const AUTH_CREATE_SESSION_V2_PROSRC_SHA256 =
  "8b1471fab68cd50dbf0905af4a32a9f5d5642eb1d74e1500ec5cb073d4654790";
const AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256 =
  "061a73c1c7114330cebb91eb10546499665aa6d3f5887cedb4da7253e9faa0e1";

async function sourceSha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type RuntimeCapability = "API_RUNTIME" | "RECONCILER";

const REQUIRED_TABLES = [
  "schema_migrations",
  "companies",
  "users",
  "auth_identities",
  "auth_sessions",
  "auth_login_transactions",
  "auth_credential_rate_limits",
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
  "account_provisioning_attempts",
  "initial_password_change_attempts",
  "hotel_staff_assignments",
  "housekeeping_hotel_links",
  "hotel_owner_assignments",
  "company_bootstrap_states",
  "reconciliation_company_registry",
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
  ["auth_login_transactions", "custom_auth_request_hash"],
  ["auth_login_transactions", "custom_csrf_hash"],
  ["auth_login_transactions", "custom_csrf_expires_at"],
  ["auth_login_transactions", "custom_validation_count"],
  ["auth_login_transactions", "custom_attempt_count"],
  ["auth_credential_rate_limits", "scope"],
  ["auth_credential_rate_limits", "subject_hash"],
  ["auth_credential_rate_limits", "window_started_at"],
  ["auth_credential_rate_limits", "attempt_count"],
  ["auth_credential_rate_limits", "expires_at"],
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
  ["users", "login_name"],
  ["users", "email"],
  ["users", "must_change_password"],
  ["account_provisioning_attempts", "target_user_id"],
  ["account_provisioning_attempts", "lease_expires_at"],
  ["initial_password_change_attempts", "status"],
  ["initial_password_change_attempts", "lease_expires_at"],
] as const;

const REQUIRED_CONSTRAINTS = [
  ["auth_sessions", "foreign key (company_id, identity_id, user_id) references auth_identities(company_id, id, user_id)"],
  ["hotel_profiles", "primary key (company_id, branch_id)"],
  ["hotel_profiles", "foreign key (company_id, branch_id) references branches(company_id, id)"],
  ["audit_events", "foreign key (company_id, session_id) references auth_sessions(company_id, id)"],
  ["idempotency_records", "foreign key (company_id, audit_event_id) references audit_events(company_id, id)"],
] as const;

const REQUIRED_EXCLUSION_CONSTRAINTS = [{
  table: "hotel_staff_assignments",
  name: "hotel_staff_assignments_primary_period_excl",
  definition: "exclude using gist (company_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&) where ((assignment_type = 'primary'::text))",
}, {
  table: "housekeeping_hotel_links",
  name: "housekeeping_hotel_links_period_excl",
  definition: "exclude using gist (company_id with =, branch_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&)",
}, {
  table: "hotel_owner_assignments",
  name: "hotel_owner_assignments_user_period_excl",
  definition: "exclude using gist (company_id with =, user_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&)",
}, {
  table: "hotel_owner_assignments",
  name: "hotel_owner_assignments_hotel_period_excl",
  definition: "exclude using gist (company_id with =, branch_id with =, daterange(start_date, coalesce(end_date, 'infinity'::date), '[]'::text) with &&)",
}] as const;

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

const REQUIRED_SECURITY_CHECK_CONSTRAINTS = [
  { table: "auth_login_transactions", name: "auth_login_transactions_custom_auth_request_hash_check", definition: "check (((custom_auth_request_hash is null) or (octet_length(custom_auth_request_hash) = 32)))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_custom_csrf_hash_check", definition: "check (((custom_csrf_hash is null) or (octet_length(custom_csrf_hash) = 32)))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_custom_validation_count_check", definition: "check (((custom_validation_count >= 0) and (custom_validation_count <= 5)))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_custom_attempt_count_check", definition: "check (((custom_attempt_count >= 0) and (custom_attempt_count <= 5)))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_custom_binding_check", definition: "check ((((custom_auth_request_hash is null) and (custom_csrf_hash is null) and (custom_csrf_expires_at is null) and (custom_attempt_count = 0)) or (custom_auth_request_hash is not null)))" },
  { table: "auth_login_transactions", name: "auth_login_transactions_custom_csrf_expiry_check", definition: "check ((((custom_csrf_hash is null) and (custom_csrf_expires_at is null)) or ((custom_csrf_hash is not null) and (custom_csrf_expires_at is not null) and (custom_csrf_expires_at <= expires_at))))" },
  { table: "auth_credential_rate_limits", name: "auth_credential_rate_limits_scope_check", definition: "check ((scope = any (array['ip'::text, 'account'::text])))" },
  { table: "auth_credential_rate_limits", name: "auth_credential_rate_limits_subject_hash_check", definition: "check ((octet_length(subject_hash) = 32))" },
  { table: "auth_credential_rate_limits", name: "auth_credential_rate_limits_attempt_count_check", definition: "check (((attempt_count >= 1) and (attempt_count <= 1000)))" },
  { table: "auth_credential_rate_limits", name: "auth_credential_rate_limits_expiry_after_window_check", definition: "check ((expires_at > window_started_at))" },
  { table: "auth_credential_rate_limits", name: "auth_credential_rate_limits_expiry_max_check", definition: "check ((expires_at <= (window_started_at + '00:15:00'::interval)))" },
] as const;

const REQUIRED_INDEXES = [{
  name: "branches_active_hotel_name_unique_idx",
  fragments: [
    "create unique index",
    "on public.branches using btree (company_id, lower(btrim(name)))",
    "where ((branch_type = 'hotel'::text) and (status = 'active'::text))",
  ],
}, {
  name: "auth_login_transactions_browser_binding_unique_idx",
  fragments: [
    "create unique index",
    "on public.auth_login_transactions using btree (browser_binding_hash)",
  ],
}, {
  name: "auth_login_transactions_custom_request_unique_idx",
  fragments: [
    "create unique index",
    "on public.auth_login_transactions using btree (custom_auth_request_hash)",
    "where (custom_auth_request_hash is not null)",
  ],
}, {
  name: "auth_credential_rate_limits_expiry_idx",
  fragments: [
    "create index",
    "on public.auth_credential_rate_limits using btree (expires_at)",
  ],
}, {
  name: "users_login_name_unique_idx",
  fragments: ["create unique index", "on public.users using btree (company_id, lower(btrim(login_name)))"],
}, {
  name: "users_email_unique_idx",
  fragments: ["create unique index", "on public.users using btree (company_id, lower(btrim(email)))"],
}, {
  name: "hotel_staff_assignments_active_primary_user_unique_idx",
  fragments: ["create unique index", "on public.hotel_staff_assignments using btree (company_id, user_id)"],
}, {
  name: "hotel_staff_assignments_active_lookup_idx",
  fragments: ["create index", "on public.hotel_staff_assignments using btree (company_id, user_id, assignment_type, start_date desc)"],
}, {
  name: "account_provisioning_recovery_idx",
  fragments: ["create index", "on public.account_provisioning_attempts using btree (company_id, status, lease_expires_at, updated_at)"],
}, {
  name: "initial_password_change_attempts_active_user_unique_idx",
  fragments: ["create unique index", "on public.initial_password_change_attempts using btree (company_id, user_id)"],
}, {
  name: "account_provider_outbox_ready_idx",
  fragments: ["create index", "on public.outbox_jobs using btree (company_id, status, available_at, created_at)"],
}] as const;

const REQUIRED_RUNTIME_PRIVILEGES = [
  "users:INSERT",
  "users:UPDATE",
  "auth_identities:INSERT",
  "audit_events:INSERT",
  "idempotency_records:INSERT",
  "idempotency_records:UPDATE",
  "idempotency_records:DELETE",
  "outbox_jobs:INSERT",
  "outbox_jobs:UPDATE",
  "account_provisioning_attempts:INSERT",
  "account_provisioning_attempts:UPDATE",
  "initial_password_change_attempts:INSERT",
  "initial_password_change_attempts:UPDATE",
  "hotel_staff_assignments:INSERT",
  "housekeeping_hotel_links:INSERT",
  "hotel_owner_assignments:INSERT",
] as const;

const FORBIDDEN_RUNTIME_PRIVILEGES = [
  "auth_sessions:INSERT",
  "auth_sessions:UPDATE",
] as const;

const REQUIRED_RECONCILER_PRIVILEGES = [
  "users:INSERT",
  "auth_identities:INSERT",
  "audit_events:INSERT",
  "outbox_jobs:INSERT",
  "outbox_jobs:UPDATE",
  "account_provisioning_attempts:UPDATE",
  "hotel_staff_assignments:INSERT",
  "housekeeping_hotel_links:INSERT",
  "hotel_owner_assignments:INSERT",
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
  { name: "companies_sync_reconciliation_registry", table: "companies", functionName: "sync_reconciliation_company_registry" },
] as const;

const REQUIRED_RLS_POLICIES = [
  { policy: "companies_company_isolation", table: "companies" },
  { policy: "users_company_isolation", table: "users" },
  { policy: "auth_identities_company_isolation", table: "auth_identities" },
  { policy: "auth_sessions_company_isolation", table: "auth_sessions" },
  { policy: "branches_company_isolation", table: "branches" },
  { policy: "hotel_profiles_company_isolation", table: "hotel_profiles" },
  { policy: "roles_company_isolation", table: "roles" },
  { policy: "user_groups_company_isolation", table: "user_groups" },
  { policy: "user_group_memberships_company_isolation", table: "user_group_memberships" },
  { policy: "user_role_memberships_company_isolation", table: "user_role_memberships" },
  { policy: "permission_grants_company_isolation", table: "permission_grants" },
  { policy: "audit_events_company_isolation", table: "audit_events" },
  { policy: "idempotency_records_company_isolation", table: "idempotency_records" },
  { policy: "outbox_jobs_company_isolation", table: "outbox_jobs" },
  { policy: "account_provisioning_attempts_company_isolation", table: "account_provisioning_attempts" },
  { policy: "initial_password_change_attempts_company_isolation", table: "initial_password_change_attempts" },
  { policy: "hotel_staff_assignments_company_isolation", table: "hotel_staff_assignments" },
  { policy: "housekeeping_hotel_links_company_isolation", table: "housekeeping_hotel_links" },
  { policy: "hotel_owner_assignments_company_isolation", table: "hotel_owner_assignments" },
] as const;

function normalizeDefinition(value: string) {
  return value.toLowerCase().replaceAll('"', "").replace(/\s+/g, " ").trim();
}

function isExactTenantPolicyExpression(value: string | null, tenantKey: "company_id" | "id") {
  const normalized = normalizeDefinition(value ?? "")
    .replace(/^\(+/u, "")
    .replace(/\)+$/u, "");
  const count = (fragment: string) => normalized.split(fragment).length - 1;
  const ownerBranch = "when runtime_is_schema_owner() then true";
  const apiBranch = `when runtime_has_capability('api_runtime'::text) then (${tenantKey} = api_current_company_id())`;
  const reconcilerBranch = `when runtime_has_capability('reconciler'::text) then (${tenantKey} = reconciler_current_company_id())`;
  const legacyBranch = `then (${tenantKey} = (nullif(current_setting('app.company_id'::text, true), ''::text))::uuid)`;
  return normalized.startsWith("case")
    && normalized.endsWith("else false end")
    && count(ownerBranch) === 1
    && count(apiBranch) === 1
    && count(reconcilerBranch) === 1
    && count("when ((not runtime_has_capability('api_runtime'::text)) and (not runtime_has_capability('reconciler'::text)))") === 1
    && count(legacyBranch) === 1
    && !normalized.includes("app.session_id")
    && !normalized.includes("app.reconciler_company_id");
}

export async function probeDatabaseReadiness(
  databaseUrl: string | undefined,
  options: { capability: RuntimeCapability } = { capability: "RECONCILER" },
): Promise<DatabaseReadiness> {
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
      select count(*) = 7 as migration_applied
      from public.schema_migrations
      where version in (
        '0001_platform_foundation',
        '0002_auth_session_runtime',
        '0003_hotel_basic_information',
        '0004_custom_login_security',
        '0005_auth_session_definer',
        '0006_account_administration',
        '0007_api_tenant_authority_expand'
      )
    `;
    if (!migrationRows[0]?.migration_applied) return { status: "SCHEMA_NOT_READY" };

    const [authFunction] = await sql<{
      executable: boolean;
      owner_safe: boolean;
      return_signature_safe: boolean;
      safe_search_path: boolean;
      security_definer: boolean;
      source: string;
      non_owner_execute_count: number;
    }[]>`
      select procedure_record.prosecdef as security_definer,
             procedure_record.proconfig = array['search_path=pg_catalog']::text[] as safe_search_path,
             has_function_privilege(
               current_user, procedure_record.oid, 'EXECUTE'
             ) as executable,
             pg_get_function_result(procedure_record.oid) =
               'TABLE(result_status text, company_id uuid, identity_id uuid, session_id uuid, user_id uuid, user_type text, display_name text, must_change_password boolean)'
               as return_signature_safe,
             procedure_record.prosrc as source,
             (
               procedure_owner.rolname = 'werehere_auth_session_definer'
               and not procedure_owner.rolcanlogin
               and not procedure_owner.rolinherit
               and not procedure_owner.rolsuper
               and not procedure_owner.rolcreatedb
               and not procedure_owner.rolcreaterole
               and not procedure_owner.rolreplication
               and not procedure_owner.rolbypassrls
               and not exists (
                 select 1 from pg_auth_members membership
                 where membership.member = procedure_owner.oid
                   or (
                     membership.roleid = procedure_owner.oid
                     and (membership.inherit_option or membership.set_option)
                   )
               )
             ) as owner_safe,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
             ) as non_owner_execute_count
      from pg_proc procedure_record
      join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
      join pg_roles current_role_record on current_role_record.rolname = current_user
      join pg_roles procedure_owner on procedure_owner.oid = procedure_record.proowner
      where procedure_namespace.nspname = 'public'
        and procedure_record.proname = 'auth_create_session_v2'
        and pg_get_function_identity_arguments(procedure_record.oid)
          = 'p_session_id uuid, p_token_hash bytea, p_provider_subject text, p_idle_lifetime_seconds integer, p_absolute_lifetime_seconds integer, p_auth_time timestamp with time zone, p_trace_id uuid'
    `;
    if (
      !authFunction?.security_definer || !authFunction.safe_search_path ||
      authFunction.executable !== (options.capability === "API_RUNTIME") ||
      !authFunction.owner_safe ||
      !authFunction.return_signature_safe
      || authFunction.non_owner_execute_count > 1
      || (options.capability === "API_RUNTIME" && authFunction.non_owner_execute_count !== 1)
      ||
      await sourceSha256(authFunction.source) !== AUTH_CREATE_SESSION_V2_PROSRC_SHA256
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [userSessionRevokeFunction] = await sql<{
      executable: boolean;
      owner_safe: boolean;
      return_signature_safe: boolean;
      safe_search_path: boolean;
      security_definer: boolean;
      source: string;
      non_owner_execute_count: number;
    }[]>`
      select procedure_record.prosecdef as security_definer,
             procedure_record.proconfig = array['search_path=pg_catalog']::text[] as safe_search_path,
             has_function_privilege(current_user, procedure_record.oid, 'EXECUTE') as executable,
             pg_get_function_result(procedure_record.oid) = 'integer' as return_signature_safe,
             procedure_record.prosrc as source,
             (
               procedure_owner.rolname = 'werehere_auth_session_definer'
               and not procedure_owner.rolcanlogin
               and not procedure_owner.rolinherit
               and not procedure_owner.rolsuper
               and not procedure_owner.rolcreatedb
               and not procedure_owner.rolcreaterole
               and not procedure_owner.rolreplication
               and not procedure_owner.rolbypassrls
               and not exists (
                 select 1 from pg_auth_members membership
                 where membership.member = procedure_owner.oid
                   or (
                     membership.roleid = procedure_owner.oid
                     and (membership.inherit_option or membership.set_option)
                   )
               )
             ) as owner_safe,
             (
               select count(*)::integer
               from aclexplode(coalesce(
                 procedure_record.proacl,
                 acldefault('f', procedure_record.proowner)
               )) acl
               where acl.privilege_type = 'EXECUTE'
                 and acl.grantee <> procedure_record.proowner
             ) as non_owner_execute_count
      from pg_proc procedure_record
      join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
      join pg_roles procedure_owner on procedure_owner.oid = procedure_record.proowner
      where procedure_namespace.nspname = 'public'
        and procedure_record.proname = 'auth_revoke_user_sessions_v1'
        and pg_get_function_identity_arguments(procedure_record.oid)
          = 'p_company_id uuid, p_user_id uuid, p_reason text'
    `;
    if (
      !userSessionRevokeFunction?.security_definer
      || !userSessionRevokeFunction.safe_search_path
      || userSessionRevokeFunction.executable !== (options.capability === "API_RUNTIME")
      || !userSessionRevokeFunction.owner_safe
      || !userSessionRevokeFunction.return_signature_safe
      || userSessionRevokeFunction.non_owner_execute_count > 1
      || (options.capability === "API_RUNTIME" && userSessionRevokeFunction.non_owner_execute_count !== 1)
      || await sourceSha256(userSessionRevokeFunction.source) !== AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [runtimeRole] = await sql<{
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolreplication: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
      role_member: boolean;
      table_owner: boolean;
    }[]>`
      select role_record.rolsuper,
             role_record.rolbypassrls,
             role_record.rolcreatedb,
             role_record.rolcreaterole,
             role_record.rolinherit,
             role_record.rolreplication,
             exists (
               select 1 from pg_auth_members membership
               where membership.member = role_record.oid
             ) as role_member,
             exists (
               select 1
               from pg_class table_record
               join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
               where table_namespace.nspname = 'public'
                 and table_record.relkind in ('r', 'p')
                 and pg_get_userbyid(table_record.relowner) = current_user
             ) as table_owner
      from pg_roles role_record
      where role_record.rolname = current_user
    `;
    if (
      !runtimeRole
      || runtimeRole.rolsuper
      || runtimeRole.rolbypassrls
      || runtimeRole.rolcreatedb
      || runtimeRole.rolcreaterole
      || runtimeRole.rolinherit
      || runtimeRole.rolreplication
      || runtimeRole.role_member
      || runtimeRole.table_owner
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [reconciliationDiscovery] = await sql<{
      executable: boolean;
      search_path_safe: boolean;
      security_definer: boolean;
    }[]>`
      select function_record.prosecdef as security_definer,
             function_record.proconfig = array['search_path=pg_catalog']::text[] as search_path_safe,
             has_function_privilege(
               current_user,
               'public.reconciliation_company_ids()',
               'EXECUTE'
             ) as executable
      from pg_proc function_record
      join pg_namespace function_namespace on function_namespace.oid = function_record.pronamespace
      where function_namespace.nspname = 'public'
        and function_record.proname = 'reconciliation_company_ids'
        and function_record.pronargs = 0
    `;
    if (
      !reconciliationDiscovery
      || !reconciliationDiscovery.security_definer
      || !reconciliationDiscovery.search_path_safe
      || reconciliationDiscovery.executable !== (options.capability === "RECONCILER")
    ) {
      return { status: "SCHEMA_NOT_READY" };
    }

    const [registryPrivilege] = await sql<{ direct_access: boolean }[]>`
      select has_table_privilege(current_user, 'public.reconciliation_company_registry', 'SELECT')
          or has_table_privilege(current_user, 'public.reconciliation_company_registry', 'INSERT')
          or has_table_privilege(current_user, 'public.reconciliation_company_registry', 'UPDATE')
          or has_table_privilege(current_user, 'public.reconciliation_company_registry', 'DELETE')
          as direct_access
    `;
    if (!registryPrivilege || registryPrivilege.direct_access) {
      return { status: "SCHEMA_NOT_READY" };
    }

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
    if (REQUIRED_EXCLUSION_CONSTRAINTS.some((required) => !constraints.some((constraint) => (
      constraint.table === required.table
      && constraint.name === required.name
      && constraint.validated
      && constraint.definition === required.definition
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
    if (REQUIRED_SECURITY_CHECK_CONSTRAINTS.some((required) => !constraints.some((constraint) => (
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
      select count(distinct code) = 4 as permission_ready
      from permissions
      where code in ('HOTEL_MANAGE', 'USER_READ', 'USER_CREATE', 'USER_SUSPEND')
    `;
    if (!permissionRows[0]?.permission_ready) return { status: "SCHEMA_NOT_READY" };

    const runtimePrivilegeRows = await sql<{ allowed: boolean; label: string }[]>`
      select requirement.label,
             has_table_privilege(current_user,
               'public.' || requirement.table_name,
               requirement.privilege_name
             ) as allowed
      from (values
        ('users:INSERT', 'users', 'INSERT'),
        ('users:UPDATE', 'users', 'UPDATE'),
        ('auth_identities:INSERT', 'auth_identities', 'INSERT'),
        ('auth_sessions:INSERT', 'auth_sessions', 'INSERT'),
        ('auth_sessions:UPDATE', 'auth_sessions', 'UPDATE'),
        ('audit_events:INSERT', 'audit_events', 'INSERT'),
        ('idempotency_records:INSERT', 'idempotency_records', 'INSERT'),
        ('idempotency_records:UPDATE', 'idempotency_records', 'UPDATE'),
        ('idempotency_records:DELETE', 'idempotency_records', 'DELETE'),
        ('outbox_jobs:INSERT', 'outbox_jobs', 'INSERT'),
        ('outbox_jobs:UPDATE', 'outbox_jobs', 'UPDATE'),
        ('account_provisioning_attempts:INSERT', 'account_provisioning_attempts', 'INSERT'),
        ('account_provisioning_attempts:UPDATE', 'account_provisioning_attempts', 'UPDATE'),
        ('initial_password_change_attempts:INSERT', 'initial_password_change_attempts', 'INSERT'),
        ('initial_password_change_attempts:UPDATE', 'initial_password_change_attempts', 'UPDATE'),
        ('hotel_staff_assignments:INSERT', 'hotel_staff_assignments', 'INSERT'),
        ('housekeeping_hotel_links:INSERT', 'housekeeping_hotel_links', 'INSERT'),
        ('hotel_owner_assignments:INSERT', 'hotel_owner_assignments', 'INSERT')
      ) as requirement(label, table_name, privilege_name)
    `;
    const runtimePrivileges = new Map(runtimePrivilegeRows.map((row) => [row.label, row.allowed]));
    const requiredRuntimePrivileges: readonly string[] = options.capability === "API_RUNTIME"
      ? REQUIRED_RUNTIME_PRIVILEGES
      : REQUIRED_RECONCILER_PRIVILEGES;
    if (
      requiredRuntimePrivileges.some((label) => runtimePrivileges.get(label) !== true)
      || FORBIDDEN_RUNTIME_PRIVILEGES.some((label) => runtimePrivileges.get(label) === true)
    ) {
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
      return policy.policy_name === required.policy
        && policy.table_name === required.table
        && policy.row_security
        && policy.row_security_forced
        && policy.policy_permissive
        && policy.applies_to_current_role
        && policy.policy_command === "*"
        && isExactTenantPolicyExpression(
          policy.using_expression,
          required.table === "companies" ? "id" : "company_id",
        )
        && isExactTenantPolicyExpression(
          policy.check_expression,
          required.table === "companies" ? "id" : "company_id",
        );
    }))) {
      return { status: "SCHEMA_NOT_READY" };
    }
    const protectedRlsTables = new Set(REQUIRED_RLS_POLICIES.map((required) => required.table));
    const approvedRlsPolicies = new Set(
      REQUIRED_RLS_POLICIES.map((required) => `${required.table}\0${required.policy}`),
    );
    if (rlsRows.some((policy) => (
      policy.applies_to_current_role
      && protectedRlsTables.has(policy.table_name as (typeof REQUIRED_RLS_POLICIES)[number]["table"])
      && !approvedRlsPolicies.has(`${policy.table_name}\0${policy.policy_name}`)
    ))) {
      return { status: "SCHEMA_NOT_READY" };
    }

    return { status: "READY" };
  } catch {
    return { status: "UNAVAILABLE" };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}
