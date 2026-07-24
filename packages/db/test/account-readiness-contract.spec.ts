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
    expect(source).toContain("HOTEL_RELATIONSHIP_REQUIRED_COLUMNS");
    expect(provisionSource).toContain(
      '"0016_hotel_relationship_management.sql"',
    );
    expect(provisionSource).toContain(
      '"0017_hotel_relationship_integrity_hardening.sql"',
    );
    expect(provisionSource).not.toContain(
      '"0015_neon_definer_contract_hardening",\n    "0016_hotel_relationship_management",',
    );
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
      "assignment_type = 'primary'::text",
      "reserved_not_dispatched",
      "provider_updated",
      "account_provider_deactivate",
      "payload -> 'userid'::text",
      "payload -> 'providersubject'::text",
      "payload ->> 'action'::text) = 'compensate'::text",
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

  it("uses complete table privilege allowlists and rejects public, stale named-role, or grantable ACLs", () => {
    expect(source).toContain("EXPECTED_API_RUNTIME_TABLE_PRIVILEGES");
    expect(source).toContain("EXPECTED_RECONCILER_TABLE_PRIVILEGES");
    const apiRuntimeAllowlist = source.slice(
      source.indexOf("const EXPECTED_API_RUNTIME_TABLE_PRIVILEGES"),
      source.indexOf("const EXPECTED_RECONCILER_TABLE_PRIVILEGES"),
    );
    expect(apiRuntimeAllowlist).not.toContain('"auth_sessions:INSERT"');
    expect(apiRuntimeAllowlist).not.toContain('"auth_sessions:UPDATE"');
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
    expect(expandColumnAllowlist).not.toContain("terminated_at:UPDATE");
    expect(source).toContain("const columnPhaseDefinitions = [");
    expect(source).toContain('phase: "EXPAND_IDENTITY_LOCK" as const');
    expect(source).toContain("const observedSchemaAclPhase");
    expect(source).toContain("const observedColumnAclPhase");
    expect(source).toContain("const approvedAclTuple");
    expect(source).toContain(
      'observedSchemaAclPhase === "CONTRACT" &&\n          observedColumnAclPhase === "CONTRACT"',
    );
    expect(source).not.toContain("options.requiredSchemaPhase !== schemaPhase");
    expect(expandColumnAllowlist).not.toContain(
      "hotel_profiles:version:UPDATE",
    );
    expect(source).toContain("expectedColumnPrivilegeCandidates.filter");
    expect(source).toContain("matchingColumnAclPhases.length === 1");
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
      "contractCompatibleAclPhase\n        ? `grant update (version) on hotel_profiles to ${apiRuntimeTableGrantees};",
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
    expect(source).toContain("const sqlLiterals: string[] = []");
    expect(source).toContain("__SQL_LITERAL_");
    expect(source).toContain("runtime_has_capability('API_RUNTIME'::text)");
    expect(source).toContain("authSupportFunction.contract_safe");
    expect(source).toContain(
      "PREVENT_LOGIN_ID_REGISTRY_MUTATION_PROSRC_SHA256",
    );
    expect(source).toContain("loginRegistryTrigger.trigger_type !== 27");
    expect(source).toContain('trigger.enabled === "O"');
    expect(source).toContain("!loginRegistryTrigger.function_acl_safe");
    expect(source).toContain("aclexplode(");
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
});
