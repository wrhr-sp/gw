import { describe, expect, it, vi } from "vitest";
import { appRoutes, errorResponseSchema } from "@gw/shared";

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
  it("returns DB_NOT_CONFIGURED for degraded notifications instead of placeholder fallback", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.notifications, {
      headers: { cookie },
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("returns DB_NOT_CONFIGURED for degraded audit logs instead of placeholder fallback", async () => {
    const { cookie } = await loginAndGetCookie("AUDITOR");

    const response = await app.request(appRoutes.admin.auditLogs, {
      headers: { cookie },
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });
});
