import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSmokeUrl = new URL("./run-worker-auth-smoke.sh", import.meta.url);
const source = readFileSync(workerSmokeUrl, "utf8");

describe("Worker runtime smoke database contract", () => {
  it("grants the CONTRACT hotel relationship column privileges", () => {
    expect(source).toContain(
      "GRANT UPDATE (version) ON hotel_profiles TO $RUNTIME_ROLE;",
    );
    expect(source).toContain(
      "end_date, terminated_at, termination_reason, terminated_by, version, updated_at",
    );
    expect(source).toContain(
      ") ON hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments",
    );
  });

  it("grants only the API runtime access to the owner-session revoke boundary", () => {
    expect(source).toContain(
      "public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)\nTO $RUNTIME_ROLE;",
    );
    expect(source).not.toContain(
      "public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)\nTO $RECONCILER_ROLE;",
    );
  });

  it("checks effective room ACLs in PostgreSQL before starting the Worker", () => {
    expect(source).toContain("has_table_privilege(");
    expect(source).toContain("has_column_privilege(");
    expect(source).toContain("has_schema_privilege(");
    expect(source).toContain("FROM pg_auth_members membership");
    expect(source).toContain(
      "role.rolsuper OR role.rolinherit OR role.rolbypassrls",
    );
    expect(source).toContain("WORKER_ROOM_RUNTIME_ACL_MISMATCH");
    expect(source).toContain("WORKER_ROOM_RUNTIME_ACL_OK");
    expect(source.indexOf("WORKER_ROOM_RUNTIME_ACL_OK")).toBeLessThan(
      source.indexOf('RUNTIME_DATABASE_URL="$(python'),
    );
  });
});
