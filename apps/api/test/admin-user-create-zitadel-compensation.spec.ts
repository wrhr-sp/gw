import { afterEach, describe, expect, it, vi } from "vitest";

const createApprovedHumanUserMock = vi.fn(async () => ({
  userId: "zitadel_created_before_db_failure",
  registrationStatus: "APPROVED",
  userType: "INTERNAL_STAFF",
}));
const deactivateHumanUserMock = vi.fn(async () => ({
  userId: "zitadel_created_before_db_failure",
  registrationStatus: "SUSPENDED",
}));

vi.mock("../src/lib/zitadel-step-up-auth", () => ({
  createApprovedHumanUser: createApprovedHumanUserMock,
  deactivateHumanUser: deactivateHumanUserMock,
}));

vi.mock("../src/lib/postgres", () => {
  const sql = vi.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    if (text === "begin" || text === "rollback" || text === "commit") return [];
    if (text.includes("select id from users")) return [];
    if (text.includes("from branches")) return [{ id: "branch_main" }];
    if (text.includes("from departments")) return [{ id: "dept_hr" }];
    if (text.includes("from positions")) return [];
    if (text.includes("from roles")) return [{ id: "role_employee" }];
    if (text.includes("insert into users")) throw new Error("simulated users insert failure");
    return [];
  });

  return {
    createOperationalSql: () => sql,
    isOperationalSchemaDriftError: () => false,
  };
});

describe("admin user create ZITADEL compensation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deactivates the external user when groupware DB creation fails after external user creation", async () => {
    const { createOperationalAdminUser } = await import("../src/lib/operational-admin");
    const createRequest = {
      fullName: "보상처리 사용자",
      email: ["compensation", "example.test"].join("@"),
      initialPassword: "ChangeMe1234!",
      departmentName: "경영지원팀",
      branchName: "본사",
      positionName: "",
      accountType: "employee" as const,
      roleCode: "EMPLOYEE" as const,
      status: "invited" as const,
      reason: "사내임직원 생성 보상처리 테스트",
      mustChangePassword: true,
      mfaRequired: false,
    };

    await expect(createOperationalAdminUser(
      { DATABASE_URL: "postgresql://unit-test.invalid/db" },
      "company_demo",
      "user_company_admin",
      createRequest,
      () => [],
      [],
    )).rejects.toThrow("simulated users insert failure");

    expect(createApprovedHumanUserMock).toHaveBeenCalledTimes(1);
    expect(deactivateHumanUserMock).toHaveBeenCalledTimes(1);
    expect(deactivateHumanUserMock).toHaveBeenCalledWith(expect.any(Object), "zitadel_created_before_db_failure");
  });
});
