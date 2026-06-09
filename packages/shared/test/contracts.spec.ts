import { describe, expect, it } from "vitest";
import {
  appRoutes,
  authLoginRequestSchema,
  authLoginResponseSchema,
  createInviteRequestSchema,
  errorResponseSchema,
  listCompaniesResponseSchema,
  listPermissionsResponseSchema,
  sessionUserSchema,
} from "../src/contracts";

describe("shared contracts", () => {
  it("defines Phase 2 auth/org route metadata", () => {
    expect(appRoutes.health).toBe("/api/health");
    expect(appRoutes.auth.login).toBe("/api/auth/login");
    expect(appRoutes.auth.logout).toBe("/api/auth/logout");
    expect(appRoutes.me).toBe("/api/me");
    expect(appRoutes.org.companies).toBe("/api/companies");
    expect(appRoutes.org.employees).toBe("/api/employees");
    expect(appRoutes.org.departments).toBe("/api/departments");
    expect(appRoutes.org.roles).toBe("/api/roles");
    expect(appRoutes.org.permissions).toBe("/api/permissions");
    expect(appRoutes.admin.invites).toBe("/api/admin/invites");
  });

  it("parses login/session and org list payloads", () => {
    const request = authLoginRequestSchema.parse({
      email: "admin@example.com",
      password: "placeholder-password",
    });

    expect(request.email).toBe("admin@example.com");

    const sessionUser = sessionUserSchema.parse({
      id: "user_admin",
      companyId: "company_demo",
      employeeId: "employee_admin",
      email: "admin@example.com",
      fullName: "관리자 테스트",
      roleCodes: ["COMPANY_ADMIN", "AUDITOR"],
      permissions: ["company.read", "employee.read", "invite.manage"],
    });

    expect(
      authLoginResponseSchema.parse({
        ok: true,
        data: {
          session: {
            id: "session_demo",
            status: "authenticated",
            expiresAt: "2099-01-01T00:00:00.000Z",
            placeholder: true,
          },
          user: sessionUser,
          nextStep: "Connect real auth provider after approval.",
        },
        error: null,
      }).data.user.roleCodes,
    ).toContain("COMPANY_ADMIN");

    expect(
      listCompaniesResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "company_demo",
              code: "demo",
              name: "데모 주식회사",
              status: "active",
            },
          ],
        },
        error: null,
      }).data.items,
    ).toHaveLength(1);

    expect(
      listPermissionsResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              code: "invite.manage",
              description: "관리자 초대와 권한 부여를 관리한다.",
            },
          ],
        },
        error: null,
      }).data.items[0].code,
    ).toBe("invite.manage");
  });

  it("parses invite requests and common auth errors", () => {
    expect(
      createInviteRequestSchema.parse({
        companyId: "company_demo",
        email: "new.user@example.com",
        roleCode: "MANAGER",
        departmentId: "department_ops",
      }).roleCode,
    ).toBe("MANAGER");

    expect(
      errorResponseSchema.parse({
        ok: false,
        data: null,
        error: {
          code: "AUTH_REQUIRED",
          message: "로그인이 필요합니다.",
          details: {
            route: "/api/me",
          },
        },
      }).error.code,
    ).toBe("AUTH_REQUIRED");
  });
});
