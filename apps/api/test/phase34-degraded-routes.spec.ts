import { describe, expect, it, vi } from "vitest";
import { adminAuditLogListResponseSchema, appRoutes, listNotificationsResponseSchema } from "@gw/shared";

vi.mock("../src/lib/postgres", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/postgres")>("../src/lib/postgres");

  const makeQueryError = (name: string) => Object.assign(new Error(`relation "${name}" does not exist`), { code: "42P01" });
  const getText = (strings: TemplateStringsArray | string) => (Array.isArray(strings) ? strings.join(" ") : strings);

  return {
    ...actual,
    createOperationalSql: () => {
      const sql = ((strings: TemplateStringsArray, ..._values: unknown[]) => {
        const text = getText(strings);
        if (text.includes("from notifications")) {
          throw makeQueryError("notifications");
        }
        if (text.includes("from audit_logs")) {
          throw makeQueryError("audit_logs");
        }
        return [];
      }) as any;
      sql.query = async (text: string) => {
        if (text.includes("from notifications")) {
          throw makeQueryError("notifications");
        }
        if (text.includes("from audit_logs")) {
          throw makeQueryError("audit_logs");
        }
        return [];
      };
      return sql;
    },
  };
});

import { app } from "../src/app";

async function loginAndGetCookie(role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      loginId: "admin",
      password: "1234",
    }),
  });

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("expected login response to include set-cookie header");
  }

  return { cookie };
}

describe("phase34 degraded DB route fallback", () => {
  it("falls back to placeholder notifications instead of returning 500", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.notifications, {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    const payload = listNotificationsResponseSchema.parse(await response.json());
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.items.every((item) => item.userId === "user_company_admin")).toBe(true);
  });

  it("falls back to placeholder audit logs instead of returning 500", async () => {
    const { cookie } = await loginAndGetCookie("AUDITOR");

    const response = await app.request(appRoutes.admin.auditLogs, {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    const payload = adminAuditLogListResponseSchema.parse(await response.json());
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.items.every((item) => item.companyId === "company_demo")).toBe(true);
  });
});
