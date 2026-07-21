import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/client.ts", import.meta.url), "utf8");

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
