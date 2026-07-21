import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration6 = readFileSync(new URL("../migrations/0006_account_administration.sql", import.meta.url), "utf8");
const migration7 = readFileSync(new URL("../migrations/0007_api_tenant_authority_expand.sql", import.meta.url), "utf8");

describe("DB-1A durable account migration contracts", () => {
  it("models durable dispatch states, terminal slot release, and post-expiry terminal evidence", () => {
    for (const state of [
      "RESERVED_NOT_DISPATCHED", "DISPATCHED", "PROVIDER_CONFIRMED", "COMPLETED",
      "RECOVERY_REQUIRED", "COMPENSATION_REQUIRED", "COMPENSATED", "OPERATOR_REQUIRED", "DEAD_LETTER",
    ]) expect(migration6).toContain(`'${state}'`);
    for (const state of [
      "RESERVED_NOT_DISPATCHED", "DISPATCHED", "PROVIDER_UPDATED",
      "RECOVERY_REQUIRED", "OPERATOR_REQUIRED", "COMPLETED",
    ]) expect(migration6).toContain(`'${state}'`);
    expect(migration6).toMatch(/account_provisioning_attempts_active_user_unique_idx[\s\S]+where status in \('RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_CONFIRMED', 'RECOVERY_REQUIRED', 'COMPENSATION_REQUIRED'\)/i);
    expect(migration6).toMatch(/initial_password_change_attempts_active_user_unique_idx[\s\S]+where status in \('RESERVED_NOT_DISPATCHED', 'DISPATCHED', 'PROVIDER_UPDATED', 'RECOVERY_REQUIRED'\)/i);
    for (const column of ["dispatched_at", "provider_confirmed_at", "recovery_required_at", "operator_required_at", "operator_reason", "failure_code"]) {
      expect(migration6).toContain(column);
    }
    expect(migration6).not.toMatch(/delete\s+from\s+(account_provisioning_attempts|initial_password_change_attempts)/i);
  });

  it("binds password attempts to the exact tenant session principal", () => {
    expect(migration6).toMatch(/alter table auth_sessions[\s\S]+unique \(company_id, id, user_id\)/i);
    expect(migration6).toMatch(/foreign key \(company_id, session_id, user_id\) references auth_sessions\(company_id, id, user_id\)/i);
  });

  it("validates account payload identity/action fields and recursively rejects plaintext password keys", () => {
    for (const key of ["userId", "providerSubject", "action"]) {
      expect(migration6).toMatch(new RegExp(`jsonb_typeof\\([^;]+->\\s*'${key}'\\)\\s*=\\s*'string'`, "i"));
    }
    expect(migration6).toContain("jsonb_reject_plaintext_password_keys");
    for (const key of ["initialpassword", "password", "plainpassword", "newpassword"]) expect(migration6).toContain(`'${key}'`);
  });
});

describe("DB-1A auth v2 and tenant authority contracts", () => {
  it("adds v2 auth functions without replacing or dropping v1", () => {
    for (const fn of ["auth_create_session", "auth_resolve_principal", "auth_revoke_session"]) {
      expect(migration7).toMatch(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${fn}_v2\\b`, "i"));
      expect(migration7).not.toMatch(new RegExp(`(?:create\\s+(?:or\\s+replace\\s+)?|drop\\s+)function\\s+(?:public\\.)?${fn}\\s*\\(`, "i"));
    }
    expect(migration7).toMatch(/set search_path = pg_catalog/g);
    expect(migration7).not.toMatch(/set search_path = pg_catalog,\s*public/i);
    expect(migration7).toContain("app_user.status in ('ACTIVE', 'PENDING_SETUP')");
    expect(migration7).toContain("must_change_password");
    expect(migration7).toMatch(/'PRINCIPAL_INACTIVE'[\s\S]+null::boolean/i);
  });

  it("provides an API-tenant-bound definer for user-wide session revocation", () => {
    expect(migration7).toMatch(/create function public\.auth_revoke_user_sessions_v1\(\s*p_company_id uuid,\s*p_user_id uuid,\s*p_reason text/iu);
    expect(migration7).toMatch(/auth_revoke_user_sessions_v1[\s\S]+security definer[\s\S]+set search_path = pg_catalog/iu);
    expect(migration7).toContain("p_company_id is distinct from public.api_current_company_id()");
    expect(migration7).toContain("p_reason not in ('ACCOUNT_DEACTIVATED', 'INITIAL_PASSWORD_CHANGED')");
    expect(migration7).toMatch(/alter function public\.auth_revoke_user_sessions_v1\(uuid, uuid, text\)\s+owner to werehere_auth_session_definer/iu);
    expect(migration7).toMatch(/revoke all on function public\.auth_revoke_user_sessions_v1\(uuid, uuid, text\) from public/iu);
  });

  it("uses isolated hardened owners, public qualification, and no residual membership", () => {
    expect(migration7).toContain("werehere_auth_session_definer");
    expect(migration7).toContain("werehere_tenant_authority_definer");
    expect(migration7).toMatch(/create role werehere_tenant_authority_definer\s+nologin noinherit nosuperuser/i);
    expect(migration7).toMatch(/revoke werehere_auth_session_definer from %I granted by %I/i);
    expect(migration7).toMatch(/revoke werehere_tenant_authority_definer from %I granted by %I/i);
    expect(migration7).toMatch(/from public\.runtime_database_capabilities/i);
    expect(migration7).toMatch(/from public\.auth_sessions/i);
    expect(migration7).toMatch(/from public\.reconciliation_company_registry/i);
    expect(migration7).toMatch(/role_name = session_user/i);
    expect(migration7).toMatch(/revoke all on function public\.runtime_has_capability\(text\) from public/i);
  });

  it("expands named policies with capability CASE branches and legacy fallback without drop-all", () => {
    expect(migration7).not.toContain("FROM pg_policies");
    expect(migration7).not.toMatch(/drop policy %I/i);
    expect(migration7).toContain("when public.runtime_has_capability(''API_RUNTIME'')");
    expect(migration7).toContain("when public.runtime_has_capability(''RECONCILER'')");
    expect(migration7).toContain("not public.runtime_has_capability(''API_RUNTIME'')");
    expect(migration7).toContain("not public.runtime_has_capability(''RECONCILER'')");
    expect(migration7).toContain("nullif(pg_catalog.current_setting(''app.company_id'', true), '''')::uuid");
    expect(migration7).toContain("alter table public.%I enable row level security");
    expect(migration7).toContain("alter table public.%I force row level security");
  });

  it("records only the exact renamed schema markers", () => {
    expect(migration6).toContain("values ('0006_account_administration')");
    expect(migration7).toContain("values ('0007_api_tenant_authority_expand')");
    expect(migration6).not.toContain("0005_account_administration");
    expect(migration7).not.toContain("0006_api_tenant_authority");
  });
});
