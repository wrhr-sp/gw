import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/postgres", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/postgres")>("../src/lib/postgres");

  return {
    ...actual,
    createOperationalSql: () => {
      const sql = (() => {
        throw new Error('relation "notifications" does not exist');
      }) as any;
      sql.query = async () => {
        throw new Error('relation "audit_logs" does not exist');
      };
      return sql;
    },
  };
});

import { listOperationalNotifications } from "../src/lib/operational-notifications";
import { listOperationalAdminAuditLogs } from "../src/lib/operational-admin";

describe("phase34 degraded schema fallback", () => {
  it("notifications helper returns null when notifications table is missing", async () => {
    await expect(listOperationalNotifications({ DATABASE_URL: "postgres://example" }, "company_demo", "user_company_admin")).resolves.toBeNull();
  });

  it("audit helper returns null when audit_logs table is missing", async () => {
    await expect(listOperationalAdminAuditLogs({ DATABASE_URL: "postgres://example" }, "company_demo")).resolves.toBeNull();
  });
});
