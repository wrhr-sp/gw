import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/client.ts", import.meta.url), "utf8");
const accountSource = readFileSync(new URL("../src/accounts.ts", import.meta.url), "utf8");

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

  it("rejects direct auth-session writes for both runtime capabilities", () => {
    expect(source).toMatch(/const FORBIDDEN_RUNTIME_PRIVILEGES = \[\s*"auth_sessions:INSERT",\s*"auth_sessions:UPDATE"/u);
    expect(source).toContain("FORBIDDEN_RUNTIME_PRIVILEGES.some");
    expect(accountSource).not.toMatch(/update\s+auth_sessions/iu);
    expect(accountSource).toContain("auth_revoke_user_sessions_v1");
  });

  it("requires the API-only user-session revoke definer boundary", () => {
    expect(source).toContain("AUTH_REVOKE_USER_SESSIONS_V1_PROSRC_SHA256");
    expect(source).toContain("procedure_record.proname = 'auth_revoke_user_sessions_v1'");
    expect(source).toContain("userSessionRevokeFunction.executable !== (options.capability === \"API_RUNTIME\")");
    expect(source).toContain("userSessionRevokeFunction.non_owner_execute_count > 1");
    expect(source).toContain("options.capability === \"API_RUNTIME\" && userSessionRevokeFunction.non_owner_execute_count !== 1");
  });

  it("checks the connected runtime role's write privileges", () => {
    expect(source).toContain("has_table_privilege(current_user");
    for (const requirement of [
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
});
