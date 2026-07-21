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

describe("account administration readiness contract", () => {
  it.each([
    "users_login_name_unique_idx",
    "users_email_unique_idx",
    "hotel_staff_assignments_active_primary_user_unique_idx",
    "hotel_staff_assignments_active_lookup_idx",
    "initial_password_change_attempts_active_user_unique_idx",
    "account_provider_outbox_ready_idx",
  ])("requires critical index %s", (name) => {
    expect(source).toContain(`name: "${name}"`);
  });

  it("rejects privileged runtime roles that bypass tenant RLS", () => {
    expect(source).toContain("rolsuper");
    expect(source).toContain("rolbypassrls");
    expect(source).toContain("table_owner");
    expect(source).toContain("current_user");
  });

  it("uses complete runtime privilege allowlists and rejects public or grantable ACLs", () => {
    expect(source).toContain("EXPECTED_API_RUNTIME_TABLE_PRIVILEGES");
    expect(source).toContain("EXPECTED_RECONCILER_TABLE_PRIVILEGES");
    expect(source).not.toContain('"auth_sessions:INSERT"');
    expect(source).not.toContain('"auth_sessions:UPDATE"');
    expect(source).toContain(
      "actualRuntimePrivileges.size !== expectedRuntimePrivileges.length",
    );
    expect(source).toContain("row.grantable || row.public_grant");
    expect(source).toContain("acl.is_grantable");
    expect(accountSource).not.toMatch(/update\s+auth_sessions/iu);
    expect(accountSource).toContain("auth_revoke_user_sessions_v1");
  });

  it("requires the API-only user-session revoke definer boundary", () => {
    expect(source).toContain("AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256");
    expect(source).toContain(
      "procedure_record.proname = 'auth_revoke_user_sessions_v1'",
    );
    expect(source).toContain("userSessionRevokeFunction.executable !==");
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
    expect(source).toContain("werehere_tenant_authority_definer");
    expect(source).toContain("unexpected_execute_count");
    expect(source).toContain("public_execute");
    expect(source).toContain("0008_remove_legacy_company_id_fallback");
    expect(source).toContain('!normalized.includes("app.company_id")');
    expect(source).not.toContain(
      "grantee_role.rolname <> 'werehere_preview_runtime'",
    );
    expect(source).toContain("membership.admin_option");
    expect(source).toContain("grantable_execute_count !== 0");
    expect(source).toContain("auth_identities_provider_provider_subject_key");
    expect(source).toContain("unique (provider, provider_subject)");
  });
});
