import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../src/client.ts", import.meta.url),
  "utf8",
);
const accountSource = readFileSync(
  new URL("../src/accounts.ts", import.meta.url),
  "utf8",
);
const provisionSource = readFileSync(
  new URL("../scripts/provision-preview.ts", import.meta.url),
  "utf8",
);
const foundationIntegrationSource = readFileSync(
  new URL("./run-foundation-integration.sh", import.meta.url),
  "utf8",
);
const previewProvisioningIntegrationSource = readFileSync(
  new URL("./run-preview-provisioning-integration.sh", import.meta.url),
  "utf8",
);

describe("account administration readiness contract", () => {
  it("requires exact EXPAND and CONTRACT migration marker sets", () => {
    expect(source).toContain("expand_marker_count");
    expect(source).toContain("contract_marker_count");
    expect(source).toContain("migrationRows[0]?.expand_marker_count === 11");
    expect(source).toContain("migrationRows[0].contract_marker_count === 0");
    expect(source).toContain("migrationRows[0].contract_marker_count === 4");
    expect(source).toContain(
      "migrationRows[0]?.hotel_relationship_marker_count !== 1",
    );
    expect(source).toContain(
      "migrationRows[0].hotel_integrity_marker_count !== 1",
    );
    expect(source).toContain(
      "migrationRows[0].hotel_support_overlap_marker_count !== 1",
    );
    expect(source).toContain("HOTEL_RELATIONSHIP_REQUIRED_COLUMNS");
    expect(provisionSource).toContain(
      '"0016_hotel_relationship_management.sql"',
    );
    expect(provisionSource).toContain(
      '"0017_hotel_relationship_integrity_hardening.sql"',
    );
    expect(provisionSource).toContain(
      '"0018_hotel_support_assignment_overlap.sql"',
    );
    expect(provisionSource).toContain('"0019_hotel_room_management.sql"');
    expect(provisionSource).toContain(
      '"0022_hotel_room_contract_hardening.sql"',
    );
    expect(provisionSource).not.toContain(
      '"0015_neon_definer_contract_hardening",\n    "0016_hotel_relationship_management",',
    );
  });

  it("tracks a new room rollout independently from an already contracted base", () => {
    expect(source).toContain("requiredRoomSchemaPhase?:");
    expect(source).toContain("const roomSchemaPhase =");
    expect(source).toContain(
      'roomSchemaPhase === "CONTRACT" && schemaPhase !== "CONTRACT"',
    );
    expect(source).toContain("const roomPolicyPhase =");
    expect(source).toContain(
      "migrationRows[0].hotel_room_contract_marker_count <= 1",
    );
    expect(source).toContain(
      'labels.filter((label) => !label.startsWith("hotel_rooms:"))',
    );
    expect(source).toContain('candidate.startsWith("hotel_rooms:")');
    expect(source).toContain("HOTEL_ROOM_LIFECYCLE_COMMAND_V1_PROSRC_SHA256");
    expect(source).toContain(
      '"21f348f7571c10c82d93696d6cbef2d897b8a2f8fb8f794c60ae05d32246a87e"',
    );
    expect(source).toContain(
      '"e89b59f47f3b7901ee89f66d33ca0545e5df96719508c0eb26d216abc9bacd50"',
    );
    expect(source).toContain("execute_acl_safe");
    expect(source).toContain("name_unique");
    expect(source).toContain(
      "procedure_record.oid = pg_catalog.to_regprocedure(",
    );
    expect(provisionSource).toContain("$exact_room_command_acl$");
    expect(provisionSource).toContain("roomLifecycleState.contracted");
    expect(provisionSource).toContain(
      "requiredRoomSchemaPhase: requiredRoomRolloutPhase",
    );
  });

  it("tracks login ID registry history independently during mixed base rollout", () => {
    expect(source).toContain("requiredLoginIdHistoryPhase?:");
    expect(source).toContain("login_id_history_contract_marker_count");
    expect(source).toContain("const loginIdHistoryPhase =");
    expect(source).toContain(
      'loginIdHistoryPhase === "CONTRACT" && schemaPhase !== "CONTRACT"',
    );
    expect(source).toContain(
      'name: "login_id_registry_company_target_history_idx"',
    );
    expect(provisionSource).toContain(
      '"0023_login_id_registry_history_contract.sql"',
    );
    expect(provisionSource).toContain(
      "requiredLoginIdHistoryPhase: requiredLoginIdHistoryRolloutPhase",
    );
    expect(provisionSource).toContain(
      'provisionPhase === "EXPAND_IDENTITY_LOCK" || contractPhase',
    );
    expect(source).toContain("LOGIN_ID_HISTORY_REQUIRED_COLUMNS");
    for (const columnContract of [
      'name: "created_at"',
      'name: "updated_at"',
      'type: "timestamp with time zone"',
      'default: "statement_timestamp()"',
      "pg_catalog.format_type",
      "pg_catalog.pg_get_expr",
      "operationColumns.length !== LOGIN_ID_HISTORY_REQUIRED_COLUMNS.length",
    ]) {
      expect(source).toContain(columnContract);
    }
    expect(source).toContain("LOGIN_ID_HISTORY_REQUIRED_CONSTRAINTS");
    for (const constraint of [
      "preview_bootstrap_operations_pkey",
      "preview_bootstrap_operations_operation_key_check",
      "preview_bootstrap_operations_operation_type_check",
      "preview_bootstrap_operations_subject_fingerprint_check",
      "preview_bootstrap_operations_request_fingerprint_check",
      "preview_bootstrap_operations_status_check",
    ]) {
      expect(source).toContain(constraint);
    }
    expect(source).toContain("preview_bootstrap_operations");
    expect(accountSource).toContain("LOGIN_ID_TARGET_CLAIM_SERIALIZATION");
  });

  it.each([
    "users_login_name_unique_idx",
    "users_login_name_global_unique_idx",
    "users_email_unique_idx",
    "hotel_staff_assignments_active_primary_user_unique_idx",
    "hotel_staff_assignments_active_lookup_idx",
    "account_provisioning_attempts_active_user_unique_idx",
    "account_provisioning_recovery_idx",
    "initial_password_change_attempts_active_user_unique_idx",
    "account_provider_outbox_ready_idx",
  ])("requires critical index %s", (name) => {
    expect(source).toContain(`name: "${name}"`);
  });

  it("matches complete critical index definitions including partial predicates", () => {
    expect(source).toContain("REQUIRED_PRIMARY_KEY_CONSTRAINTS");
    expect(source).toContain("REQUIRED_FOREIGN_KEY_CONSTRAINTS");
    expect(source).toContain('name: "login_id_registry_company_id_fkey"');
    expect(source).toContain(
      'name: "login_id_registry_company_id_actor_user_id_fkey"',
    );
    expect(source).toContain('name: "login_id_registry_pkey"');
    for (const name of [
      "hotel_room_types_pkey",
      "hotel_rooms_pkey",
      "hotel_room_status_history_pkey",
      "hotel_room_types_company_id_id_key",
      "hotel_rooms_company_id_id_key",
      "hotel_room_types_company_id_created_by_fkey",
      "hotel_rooms_company_id_updated_by_fkey",
      "hotel_room_status_history_company_id_changed_by_fkey",
      "hotel_room_types_name_check",
      "hotel_rooms_internal_note_check",
      "hotel_room_status_history_reason_check",
    ]) {
      expect(source).toContain(`name: "${name}"`);
    }
    expect(source).toContain('name: "hotel_room_types_scope_immutable"');
    expect(source).toContain(
      'functionName: "reject_hotel_room_type_scope_change"',
    );
    expect(source).toContain(
      "REJECT_HOTEL_ROOM_TYPE_SCOPE_CHANGE_PROSRC_SHA256",
    );
    expect(source).toContain(
      'name: "login_id_registry_company_id_target_user_id_key"',
    );
    expect(source).toContain(
      'name: "login_id_registry_login_id_company_id_target_user_id_key"',
    );
    expect(source).toContain(
      'name: "login_id_registry_company_id_actor_user_id_idempotency_key_key"',
    );
    expect(source).toContain('name: "login_id_registry_login_id_check"');
    expect(source).toContain('name: "login_id_registry_check"');
    expect(source).toContain('name: "users_login_name_format_check"');
    expect(source).toContain('name: "users_login_name_reserved_check"');
    expect(source).toContain('name: "users_login_name_registry_fk"');
    expect(source).toContain(
      "normalizeDefinition(index.definition) === required.definition",
    );
    expect(source).not.toContain("required.fragments.every");
    for (const predicate of [
      "where (login_name is not null)",
      "where (email is not null)",
      "assignment_type = 'PRIMARY'::text",
      "RESERVED_NOT_DISPATCHED",
      "PROVIDER_UPDATED",
      "ACCOUNT_PROVIDER_DEACTIVATE",
      "payload -> 'userId'::text",
      "payload -> 'providerSubject'::text",
      "payload ->> 'action'::text) = 'COMPENSATE'::text",
    ]) {
      expect(source).toContain(predicate);
    }
  });

  it("rejects privileged runtime roles that bypass tenant RLS", () => {
    expect(source).toContain("rolsuper");
    expect(source).toContain("rolbypassrls");
    expect(source).toContain("table_owner");
    expect(source).toContain("current_user");
  });

  it("damage-probes exact room CHECK literals, trigger columns, and PUBLIC RLS roles", () => {
    expect(foundationIntegrationSource).toContain(
      "check (status in ('ACTIVE', 'INACTIVE', 'DELETED', 'BROKEN'))",
    );
    expect(foundationIntegrationSource).toContain(
      "before update of company_id on hotel_room_types",
    );
    expect(foundationIntegrationSource).toContain(
      "before insert or update of company_id on hotel_rooms",
    );
    expect(foundationIntegrationSource).toContain(
      "alter policy hotel_rooms_company_isolation on hotel_rooms to gw_runtime_probe",
    );
    expect(foundationIntegrationSource).toContain(
      "alter policy hotel_rooms_company_isolation on hotel_rooms to public",
    );
    expect(
      foundationIntegrationSource.match(/assert_room_fingerprint_damage /gu),
    ).toHaveLength(2);
  });

  it("uses complete table privilege allowlists and rejects public, stale named-role, or grantable ACLs", () => {
    expect(source).toContain("EXPECTED_API_RUNTIME_TABLE_PRIVILEGES");
    expect(source).toContain("EXPECTED_RECONCILER_TABLE_PRIVILEGES");
    const apiRuntimeAllowlist = source.slice(
      source.indexOf("const EXPECTED_API_RUNTIME_TABLE_PRIVILEGES"),
      source.indexOf("const EXPECTED_RECONCILER_TABLE_PRIVILEGES"),
    );
    expect(apiRuntimeAllowlist).not.toContain('"auth_sessions:INSERT"');
    expect(apiRuntimeAllowlist).not.toContain('"auth_sessions:UPDATE"');
    expect(apiRuntimeAllowlist).not.toContain('"hotel_room_types:UPDATE"');
    expect(apiRuntimeAllowlist).not.toContain('"hotel_rooms:UPDATE"');
    expect(apiRuntimeAllowlist).toContain('"hotel_room_status_history:INSERT"');
    expect(apiRuntimeAllowlist).toContain('"login_id_registry:SELECT"');
    expect(apiRuntimeAllowlist).toContain('"login_id_registry:INSERT"');
    expect(apiRuntimeAllowlist).not.toContain('"login_id_registry:UPDATE"');
    expect(apiRuntimeAllowlist).not.toContain('"login_id_registry:DELETE"');
    expect(source).toContain("EXPECTED_API_RUNTIME_EXPAND_COLUMN_PRIVILEGES");
    expect(source).toContain(
      "EXPECTED_API_RUNTIME_IDENTITY_LOCK_COLUMN_PRIVILEGES",
    );
    expect(source).toContain("EXPECTED_API_RUNTIME_CONTRACT_COLUMN_PRIVILEGES");
    expect(source).toContain('"auth_identities:updated_at:UPDATE"');
    expect(source).toContain('"branches:updated_at:UPDATE"');
    expect(source).toContain('"hotel_profiles:updated_at:UPDATE"');
    expect(source).toContain('"hotel_profiles:version:UPDATE"');
    expect(source).toContain('"hotel_staff_assignments:terminated_at:UPDATE"');
    expect(source).toContain('"housekeeping_hotel_links:terminated_at:UPDATE"');
    expect(source).toContain('"hotel_owner_assignments:terminated_at:UPDATE"');
    const expandColumnAllowlist = source.slice(
      source.indexOf("const EXPECTED_API_RUNTIME_EXPAND_COLUMN_PRIVILEGES"),
      source.indexOf("const EXPECTED_API_RUNTIME_CONTRACT_COLUMN_PRIVILEGES"),
    );
    expect(expandColumnAllowlist).toContain(
      '"housekeeping_hotel_links:terminated_at:UPDATE"',
    );
    for (const privilege of [
      "hotel_room_types:name:UPDATE",
      "hotel_room_types:is_active:UPDATE",
      "hotel_rooms:room_number:UPDATE",
      "hotel_rooms:room_type_id:UPDATE",
      "hotel_rooms:status:UPDATE",
      "hotel_rooms:internal_note:UPDATE",
      "hotel_rooms:owner_visible_note:UPDATE",
    ]) {
      expect(expandColumnAllowlist).toContain(`"${privilege}"`);
    }
    expect(expandColumnAllowlist).not.toContain(
      '"hotel_room_types:scope:UPDATE"',
    );
    expect(expandColumnAllowlist).not.toContain(
      '"hotel_room_types:branch_id:UPDATE"',
    );
    expect(provisionSource).toContain(
      "grant update (name, display_order, is_active, version, updated_by, updated_at)",
    );
    expect(provisionSource).not.toContain(
      "grant update on hotel_room_types, hotel_rooms",
    );
    expect(source).toContain("const columnPhaseDefinitions = [");
    expect(source).toContain('phase: "EXPAND_IDENTITY_LOCK" as const');
    expect(source).toContain("const observedSchemaAclPhase");
    expect(source).toContain("const observedColumnAclPhase");
    expect(source).toContain("const approvedAclTuple");
    expect(source).toContain(
      'observedSchemaAclPhase === "CONTRACT" &&\n          observedColumnAclPhase === "CONTRACT"',
    );
    expect(source).not.toContain("options.requiredSchemaPhase !== schemaPhase");
    expect(expandColumnAllowlist).toContain("hotel_profiles:version:UPDATE");
    expect(source).toContain("expectedColumnPrivilegeCandidates.filter");
    expect(source).toContain("matchingColumnAclPhases.length === 1");
    expect(source).toContain("matchingColumnAclPhases.length === 2");
    expect(source).toContain(
      'requiredRolloutPhase === "CONTRACT"\n            ? "CONTRACT"\n            : requiredRolloutPhase === "EXPAND_IDENTITY_LOCK"',
    );
    expect(source).toContain(
      'requiredRolloutPhase === undefined\n                ? observedSchemaAclPhase === "CONTRACT"',
    );
    expect(provisionSource).toContain(
      'provisionPhase === "EXPAND_IDENTITY_LOCK" || contractPhase',
    );
    expect(provisionSource).toContain(
      "const requiredRolloutPhase = contractCompatibleAclPhase",
    );
    expect(provisionSource).toContain('if (provisionPhase === "EXPAND")');
    expect(provisionSource).toContain(
      "contract_marker_count: contractMarkerCount",
    );
    expect(provisionSource).toContain(
      "contractBaseState.contract_marker_count !== 0",
    );
    expect(provisionSource).toContain(
      'fail("Preview contract markers are partial")',
    );
    expect(provisionSource).toContain(
      "const latestContractBaseState = await readContractBaseState()",
    );
    expect(provisionSource).toContain(
      'fail("Preview contract base changed before ACL reconciliation")',
    );
    expect(provisionSource).toContain(
      "pg_advisory_lock(hashtextextended('werehere-preview-migration', 0))",
    );
    expect(provisionSource).toContain(
      "PREVIEW_DATABASE_CONTRACT_COMPATIBLE_EXPAND",
    );
    expect(provisionSource).toContain(
      'provisionPhase === "EXPAND" && contractCompatibleAclPhase',
    );
    expect(provisionSource).toContain(
      'contractCompatibleAclPhase ? "revoke usage on schema public from public;"',
    );
    expect(provisionSource).toContain(
      "requiredSchemaPhase: requiredRolloutPhase",
    );
    expect(provisionSource).toContain(
      "revoke update (updated_at) on auth_identities\n      from ${apiRuntimeTableGrantees}, ${reconcilerRole};",
    );
    expect(provisionSource).toContain(
      "grant update (version) on hotel_profiles to ${apiRuntimeTableGrantees};",
    );
    expect(provisionSource).not.toContain(
      "contractCompatibleAclPhase\n        ? `grant update (version)",
    );
    expect(provisionSource).toContain(
      "grant update (end_date, terminated_at, termination_reason, terminated_by, version, updated_at)\n      on hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments",
    );
    expect(provisionSource).toContain(
      "grant update (updated_at) on auth_identities to ${apiRuntimeTableGrantees};",
    );
    expect(provisionSource).toContain(
      "revoke update (updated_at) on branches, hotel_profiles\n      from ${reconcilerRole};",
    );
    expect(source).toContain('name: "login_id_registry_immutable"');
    expect(source).toContain('policy: "login_id_registry_company_isolation"');
    expect(source).toContain(
      "actualTablePrivileges.size !== expectedTablePrivileges.size",
    );
    expect(source).toContain("row.grantable || !row.role_name");
    expect(source).toContain("acl.is_grantable");
    expect(source).toContain("for (const role of capabilityRoleRows)");
    expect(source).toContain("werehere_auth_session_definer");
    expect(source).toContain("auth_revoke_hotel_owner_sessions_v1");
    expect(source).toContain("0017_hotel_relationship_integrity_hardening");
    expect(source).toContain("0018_hotel_support_assignment_overlap");
    expect(source).toContain("0019_hotel_room_management");
    expect(source).toContain("0022_hotel_room_contract_hardening");
    expect(source).toContain(
      "hotel_staff_assignments_support_hotel_period_excl",
    );
    expect(source).toContain("REJECT_HOTEL_RELATIONSHIP_DELETE_PROSRC_SHA256");
    expect(source).toContain("trigger.trigger_type === 11");
    expect(source).toContain(
      'trigger.function_name === "reject_hotel_relationship_delete"',
    );
    expect(source).toContain(
      "pg_get_function_result(procedure_record.oid) = 'integer'",
    );
    expect(source).toContain("function_language.lanname = 'plpgsql'");
    expect(source).toContain("procedure_record.provolatile = 'v'");
    expect(source).toContain("werehere_tenant_authority_definer");
    expect(source).toContain("migrationOwner.role_name");
    expect(source).toContain("matchesSchemaPrivileges");
    expect(source).toContain("publicSchemaUsageAllowed");
    expect(source).toContain(
      'requiredSchemaPhase?: "CONTRACT" | "EXPAND" | "EXPAND_IDENTITY_LOCK"',
    );
    expect(source).toContain("schemaAclClosure.unexpected_count !== 0");
    expect(source).toContain("sequence_record.relkind = 'S'");
    expect(source).toContain("acl.grantee <> sequence_record.relowner");
    expect(source).toContain("sequenceOwnerTopology.unexpected_count !== 0");
    expect(source).toContain(
      "sequence_record.relowner <> migration_table.relowner",
    );
    expect(source).toContain("table_record.relkind in ('r', 'p', 'S')");
    expect(source).toContain("sequencePrivilegeRows.length !== 0");
    expect(provisionSource).toContain(
      "revoke create on schema public from public",
    );
    expect(provisionSource).toContain("grant usage on schema public to public");
    expect(provisionSource).toContain("$schema_acl_reset$");
    expect(provisionSource).toContain("$migration_owned_table_acl_reset$");
    expect(provisionSource).toContain("$tenant_owned_table_acl_reset$");
    expect(provisionSource).toContain("$sequence_acl_reset$");
    expect(accountSource).not.toMatch(/update\s+auth_sessions/iu);
    expect(accountSource).toContain("auth_revoke_user_sessions_v1");
  });

  it("checks canonical ownership before any migration or seed mutation", () => {
    const preflight = provisionSource.indexOf(
      "ownershipPreflight.unexpected_sequence_owners !== 0",
    );
    const migrationLoop = provisionSource.indexOf(
      "for (const [version, fileName] of migrations)",
    );
    const previewSeed = provisionSource.indexOf(
      "insert into companies (id, legal_name, status)",
    );
    expect(preflight).toBeGreaterThan(0);
    expect(preflight).toBeLessThan(migrationLoop);
    expect(preflight).toBeLessThan(previewSeed);
    expect(
      provisionSource.indexOf("updateLocalCiDefinerMembership(", preflight),
    ).toBeGreaterThan(preflight);
  });

  it("requires the API-only user-session revoke definer boundary", () => {
    expect(source).toContain("AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256");
    expect(source).toContain(
      "procedure_record.proname = 'auth_revoke_user_sessions_v1'",
    );
    expect(source).toContain("userSessionRevokeFunction.executable !==");
    expect(source).toContain("userSessionRevokeFunction.public_execute");
    expect(source).toContain('(options.capability === "API_RUNTIME")');
    expect(source).toContain(
      "userSessionRevokeFunction.non_owner_execute_count > 1",
    );
    expect(source).toMatch(
      /options\.capability === "API_RUNTIME" &&[\s\S]{0,120}userSessionRevokeFunction\.non_owner_execute_count !== 1/u,
    );
  });

  it("checks the connected runtime role's write privileges", () => {
    expect(source).toContain("aclexplode(coalesce(");
    expect(source).toContain("grantee_role.rolname = current_user");
    for (const requirement of [
      "auth_sessions:SELECT",
      "users:INSERT",
      "users:UPDATE",
      "auth_identities:INSERT",
      "audit_events:INSERT",
      "idempotency_records:DELETE",
      "outbox_jobs:UPDATE",
      "account_provisioning_attempts:UPDATE",
      "initial_password_change_attempts:UPDATE",
    ]) {
      expect(source).toContain(requirement);
    }
  });

  it("binds readiness to the exact runtime capability and all auth definer fingerprints", () => {
    expect(source).toContain("capabilityIdentity?.expected");
    expect(source).toContain("capabilityIdentity.unexpected");
    expect(source).toContain("AUTH_RESOLVE_PRINCIPAL_V2_PROSRC_SHA256");
    expect(source).toContain("AUTH_REVOKE_SESSION_V2_PROSRC_SHA256");
    expect(source).toContain("TENANT_AUTHORITY_PROSRC_SHA256");
    expect(source).toContain("runtime_is_schema_owner");
    expect(source).toContain("runtime_has_capability");
    expect(source).toContain("api_current_company_id");
    expect(source).toContain("reconciler_current_company_id");
    expect(source).toContain("sync_reconciliation_company_registry");
    expect(source).toContain("reconciliation_company_ids");
    expect(source).toContain("werehere_tenant_authority_definer");
    expect(source).toContain("unexpected_execute_count");
    expect(source).toContain("public_execute");
    expect(source).toContain("authFunction.public_execute");
    expect(source).toContain("authSupportFunction.public_execute");
    expect(source).toContain("0008_remove_legacy_company_id_fallback");
    expect(source).toContain("return normalized === expected");
    expect(source).toContain("function normalizePolicyDefinition");
    expect(source).toContain("return normalizePolicyDefinition(value);");
    expect(source).toContain("const sqlLiterals: string[] = []");
    expect(source).toContain("__SQL_LITERAL_");
    expect(source).toContain("runtime_has_capability('API_RUNTIME'::text)");
    expect(source).toContain("authSupportFunction.contract_safe");
    expect(source).toContain(
      "PREVENT_LOGIN_ID_REGISTRY_MUTATION_PROSRC_SHA256",
    );
    expect(source).toContain("loginRegistryTrigger.trigger_type !== 27");
    expect(source).toContain('trigger.enabled === "O"');
    expect(source).toContain("trigger_record.tgattr::smallint[]");
    expect(source).toContain(
      'protectedColumns: ["company_id", "scope", "branch_id"]',
    );
    expect(source).toContain(
      'protectedColumns: ["company_id", "branch_id", "room_type_id"]',
    );
    expect(source).toContain("policy_record.polroles = array[0::oid]");
    expect(source).toContain("policy.roles_public");
    expect(source).toContain(
      "array['ACTIVE'::text, 'INACTIVE'::text, 'DELETED'::text]",
    );
    expect(source).toContain("hotel_rooms_live_room_number_key");
    expect(source).toContain("hotel_rooms_deleted_immutable");
    expect(source).toContain("hotel_room_status_history_source_shape");
    expect(source).toContain("hotel_room_status_history_insert_guard");
    expect(source).toContain("REJECT_DELETED_HOTEL_ROOM_CHANGE_PROSRC_SHA256");
    expect(source).toContain(
      "ENFORCE_NEW_HOTEL_ROOM_HISTORY_INSERT_PROSRC_SHA256",
    );
    expect(source).toContain(
      "(previous_status = 'ACTIVE'::text) and (next_status = 'INACTIVE'::text)",
    );
    expect(source).toContain('"hotel_rooms:planned_resume_date:UPDATE"');
    expect(source).toContain(
      'labels.filter((label) => !label.startsWith("hotel_rooms:"))',
    );
    expect(source).toContain('candidate.startsWith("hotel_rooms:")');
    expect(source).toContain("!loginRegistryTrigger.function_acl_safe");
    expect(source).toContain("aclexplode(");
    expect(source).toContain("direct_column_mutation_acl_count");
    expect(source).toContain("protected_column.attacl");
    expect(source).toContain("pg_catalog.pg_attribute protected_column");
    expect(provisionSource).toContain("$migration_owned_column_acl_reset$");
    expect(provisionSource).toContain(
      "revoke all privileges (%I) on table %I.%I from %I cascade",
    );
    expect(source).not.toContain(
      "grantee_role.rolname <> 'werehere_preview_runtime'",
    );
    expect(source).toContain("membership.admin_option");
    expect(source).toContain("grantable_execute_count !== 0");
    expect(source).toContain("auth_identities_provider_provider_subject_key");
    expect(source).toContain("unique (provider, provider_subject)");
    expect(source).toContain("legacy_api_count");
    expect(source).toContain('schemaPhase === "EXPAND"');
    expect(source).toContain('schemaPhase === "CONTRACT"');
    expect(source).toContain("capabilityTopology.total_count === 3");
  });

  it("binds readiness and Preview grants to inspection evidence processing", () => {
    for (const contract of [
      "0032_hotel_inspection_evidence_processing",
      "hotel_file_scan_candidates_v1",
      "34315511feea89376fba3eafa1d4f802aa3464966a6082c354622156533f8529",
      "hotel_file_links_version_result_revision_key",
      "hotel_file_links_parent_guard",
      "hotel_file_links_terminal_insert_guard",
      "GUARD_HOTEL_FILE_LINK_PARENT_V1_PROSRC_SHA256",
      "GUARD_INSPECTION_TERMINAL_MUTATION_PROSRC_SHA256",
    ]) {
      expect(source).toContain(contract);
    }
    expect(provisionSource).toContain(
      "0032_hotel_inspection_evidence_processing.sql",
    );
    expect(provisionSource).toContain(
      "grant execute on function public.hotel_file_scan_candidates_v1(",
    );
    expect(foundationIntegrationSource).toContain(
      "HOTEL_INSPECTION_EVIDENCE_PROCESSING_OK",
    );
  });

  it("binds readiness and Preview grants to canonical file upload scope", () => {
    for (const contract of [
      "0033_hotel_file_upload_scope",
      "hotel_file_upload_scope_v1",
      "dce219c3bb0458e3ff1150cdee934ebbf2227de50f5930e7499e5a7e022015c0",
      "public.hotel_file_upload_scope_v1(uuid,uuid,text)",
    ]) {
      expect(source).toContain(contract);
    }
    expect(provisionSource).toContain("0033_hotel_file_upload_scope.sql");
    expect(provisionSource).toContain(
      "grant execute on function public.hotel_file_upload_scope_v1(",
    );
    expect(foundationIntegrationSource).toContain(
      "HOTEL_FILE_UPLOAD_SCOPE_OK",
    );
  });

  it("binds readiness and Preview grants to evidence submission v2", () => {
    for (const contract of [
      "0034_hotel_inspection_evidence_submission",
      "hotel_inspection_command_v2",
      "81c3bcfca74413771c3e3a36fb502c02267ef077b9a2d6297488c95c9889dba1",
      "public.hotel_inspection_command_v2(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
    ]) {
      expect(source).toContain(contract);
    }
    expect(provisionSource).toContain(
      "0034_hotel_inspection_evidence_submission.sql",
    );
    expect(provisionSource).toContain(
      "grant execute on function public.hotel_inspection_command_v2(",
    );
    expect(provisionSource).toContain(
      "revoke execute on function public.hotel_inspection_command_v1(",
    );
    expect(foundationIntegrationSource).toContain(
      "HOTEL_INSPECTION_EVIDENCE_SUBMISSION_OK",
    );
    expect(foundationIntegrationSource).toContain(
      "HOTEL_INSPECTION_EVIDENCE_CONCURRENCY_OK",
    );
  });

  it("keeps runtime readiness opaque while reporting a safe provisioning checkpoint", () => {
    expect(source).toContain(
      "onSchemaNotReady?: (checkpoint: string) => void;",
    );
    expect(source).toContain("const schemaNotReady = () => {");
    expect(source).toContain("options.onSchemaNotReady?.(");
    expect(source).toContain('return { status: "SCHEMA_NOT_READY" } as const;');
    expect(provisionSource).toContain(
      "READINESS_CHECKPOINT_${checkpoint}_API_RUNTIME",
    );
    expect(provisionSource).toContain(
      "READINESS_CHECKPOINT_${checkpoint}_RECONCILER",
    );
    expect(provisionSource).not.toContain("readinessStack");
  });

  it("binds readiness and Preview ACL closure to inspection review v1", () => {
    for (const contract of [
      "0035_hotel_inspection_review_and_file_view",
      "HOTEL_INSPECTION_INTERNAL_FUNCTION_CONTRACTS",
      "59ee6d0461c7ae7aa942c5f04aa4925df3f1b7d5b373377ebcd6e9570034784d",
      "d08ee2d3d4457bf44f74e09922df23218cb8deae8a8c542851bb84a8a7ad46e1",
      "8c8f0816f9666212a238d25c657e312eb59e5b7bf60d43ee7c77170bf5574bf9",
      "811dcd84a6b75c0bff5a3f3cf349745205e0ddd512cf3b950a7291401859393f",
      "5ece2f7716873e06c7cf239598b61e527683843f79003ebb9b868abb17c119fe",
      "hotel_file_access_rate_windows",
      "hotel_file_access_grants",
      "hotel_file_access_rate_windows_company_isolation",
      "hotel_file_access_grants_company_isolation",
    ]) {
      expect(source).toContain(contract);
    }
    for (const contract of [
      "0035_hotel_inspection_review_and_file_view.sql",
      "grant execute on function public.hotel_inspection_reviews_read_v1(",
      "grant execute on function public.hotel_inspection_transition_v1(",
      "grant execute on function public.hotel_file_view_command_v1(",
      "grant execute on function public.hotel_file_access_recover_expired_v1(",
      "'hotel_process_reviewer_is_eligible_v1'",
    ]) {
      expect(provisionSource).toContain(contract);
    }
    for (const contract of [
      "hotel_inspection_reviews_read_v1(uuid,uuid,uuid,jsonb,text)",
      "hotel_inspection_transition_v1(uuid,uuid,uuid,integer,jsonb,text,uuid,text,text,text,uuid,uuid)",
      "hotel_file_view_command_v1(uuid,uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid)",
      "HOTEL_INSPECTION_REVIEW_OK",
      "HOTEL_INSPECTION_REVIEW_IDEMPOTENCY_CONCURRENCY_OK",
      "HOTEL_INSPECTION_REVIEW_READINESS_DAMAGE_OK",
      "REVIEW_DAMAGE_POLICY_RESTORED",
      "REVIEW_DAMAGE_EXTRA_POLICY_RESTORED",
      "REVIEW_DAMAGE_ROLE_SCOPED_EXTRA_POLICY_RESTORED",
      "REVIEW_DAMAGE_CONSTRAINT_RESTORED",
      "PREVIEW_EXPAND_PREMATURE_REVIEW_POLICY_REJECTED",
    ]) {
      expect(
        `${foundationIntegrationSource}\n${previewProvisioningIntegrationSource}`,
      ).toContain(contract);
    }
  });
});
