import { afterEach, describe, expect, it, vi } from "vitest";

describe("operational org helpers", () => {
  afterEach(() => {
    vi.doUnmock("../src/lib/postgres");
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("filters preview DB role permissions down to shared contract permission codes", async () => {
    const sqlMock = vi.fn().mockResolvedValueOnce([
      {
        code: "HR_ADMIN",
        name: "인사 관리자",
        role_scope: "company",
        permission_codes: ["employee.read", "leave.manage", "approval.document.read"],
      },
    ]);

    vi.resetModules();
    vi.doMock("../src/lib/postgres", () => ({
      createOperationalSql: () => sqlMock,
    }));

    const { listOperationalRoles } = await import("../src/lib/operational-org");

    const roles = await listOperationalRoles({} as never, "company_demo", () => ["employee.read"]);

    expect(roles).toEqual([
      {
        code: "HR_ADMIN",
        name: "인사 관리자",
        scope: "company",
        permissions: ["employee.read", "approval.document.read"],
      },
    ]);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to role permission defaults when preview DB only returns legacy permission codes", async () => {
    const sqlMock = vi.fn().mockResolvedValueOnce([
      {
        code: "MANAGER",
        name: "매니저",
        role_scope: "company",
        permission_codes: ["leave.manage"],
      },
    ]);

    vi.resetModules();
    vi.doMock("../src/lib/postgres", () => ({
      createOperationalSql: () => sqlMock,
    }));

    const { listOperationalRoles } = await import("../src/lib/operational-org");

    const roles = await listOperationalRoles({} as never, "company_demo", () => ["role.read", "approval.document.approve"]);

    expect(roles).toEqual([
      {
        code: "MANAGER",
        name: "매니저",
        scope: "company",
        permissions: ["role.read", "approval.document.approve"],
      },
    ]);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});
