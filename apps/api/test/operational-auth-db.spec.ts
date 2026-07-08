import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  adminAuditLogListResponseSchema,
  adminUserMutationResponseSchema,
  adminUsersListResponseSchema,
  appRoutes,
  authLoginResponseSchema,
  boardResponseSchema,
  documentSpaceResponseSchema,
  listBranchesResponseSchema,
  listCompaniesResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listHomeShortcutsResponseSchema,
  listNotificationsResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;
const sql = databaseUrl
  ? neon(databaseUrl, {
      fullResults: false,
    })
  : null;

async function login(loginId = "admin") {
  const loginResponse = await app.request(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId, password: "1234", rememberSession: true }),
    },
    { DATABASE_URL: databaseUrl },
  );

  const cookie = loginResponse.headers.get("set-cookie");
  expect(cookie).toContain("gw_session=");
  return cookie ?? "";
}

async function cleanupCrossCompanySlugRows(boardSlug: string, spaceSlug: string) {
  if (!sql) {
    return;
  }

  await sql`delete from document_spaces where company_id in ('company_demo', 'company_other') and code = ${spaceSlug}`;
  await sql`delete from boards where company_id in ('company_demo', 'company_other') and code = ${boardSlug}`;
  await sql`
    delete from companies
    where id = 'company_other'
      and not exists (select 1 from boards where company_id = 'company_other')
      and not exists (select 1 from document_spaces where company_id = 'company_other')
  `;
}

describe("operational DB-backed auth", () => {
  runWhenDbConfigured("logs in against the preview PostgreSQL seed when DATABASE_URL is configured", async () => {
    const response = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: "admin", password: "1234", rememberSession: true }),
      },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("gw_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");

    const payload = authLoginResponseSchema.parse(await response.json());
    expect(payload.data.user.id).toBe("user_company_admin");
    expect(payload.data.user.roleCodes).toContain("COMPANY_ADMIN");
    expect(payload.data.nextStep).toContain("운영 DB 인증");
  });

  runWhenDbConfigured("lists admin users from the preview PostgreSQL seed", async () => {
    const cookie = await login();

    const response = await app.request(
      "/api/admin/users",
      {
        headers: { cookie },
      },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(200);
    const payload = adminUsersListResponseSchema.parse(await response.json());
    expect(payload.data.items.length).toBeGreaterThanOrEqual(4);
    expect(payload.data.items.some((item) => item.userId === "user_company_admin" && item.roleCodes.includes("COMPANY_ADMIN"))).toBe(true);
    expect(payload.data.items.some((item) => item.userId === "user_hr_admin" && item.roleCodes.includes("HR_ADMIN"))).toBe(true);
  });

  runWhenDbConfigured("fails safely without creating an employee when ZITADEL create settings are missing", async () => {
    const cookie = await login();
    const unique = `smoke-${Date.now()}`;
    const email = `${unique}@example.invalid`;

    const response = await app.request(
      appRoutes.admin.userCreate,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "생성검증 사용자",
          email,
          initialPassword: "ChangeMe1234!",
          departmentName: "경영지원팀",
          branchName: "본사",
          positionName: "",
          accountType: "employee",
          roleCode: "EMPLOYEE",
          status: "invited",
          reason: "사내임직원 계정 생성 안전 실패 테스트",
          mustChangePassword: true,
          mfaRequired: false,
        }),
      },
      { DATABASE_URL: databaseUrl },
    );

    expect(response.status).toBe(503);
    const payload = await response.json() as { ok: boolean; data: unknown; error?: { code?: string } };
    expect(payload.ok).toBe(false);
    expect(payload.data).toBeNull();
    expect(payload.error?.code).toBe("EXTERNAL_AUTH_NOT_CONFIGURED");

    const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(rereadResponse.status).toBe(200);
    const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
    expect(rereadPayload.data.items.some((item) => item.email === email)).toBe(false);
  });

  runWhenDbConfigured("updates and re-reads an employee basic profile through admin users API", async () => {
    const cookie = await login();
    const targetUserId = "user_hr_admin";

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    if (!beforeUser) return;

    const nextName = beforeUser.fullName.endsWith(" 수정검증") ? beforeUser.fullName.replace(/ 수정검증$/, "") : `${beforeUser.fullName} 수정검증`;
    const nextStatus = beforeUser.employmentStatus === "active" ? "on_leave" : "active";

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userProfile(targetUserId),
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            fullName: nextName,
            email: beforeUser.email,
            employmentStatus: nextStatus,
            reason: "사원 기본정보 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.user.fullName).toBe(nextName);
      expect(updatePayload.data.user.employmentStatus).toBe(nextStatus);

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      expect(rereadPayload.data.items.find((item) => item.userId === targetUserId)?.fullName).toBe(nextName);
    } finally {
      await app.request(
        appRoutes.admin.userProfile(targetUserId),
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            fullName: beforeUser.fullName,
            email: beforeUser.email,
            employmentStatus: beforeUser.employmentStatus,
            reason: "사원 기본정보 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("updates and re-reads an employee organization profile through admin users API", async () => {
    const cookie = await login();
    const targetUserId = "user_hr_admin";

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    expect(beforeUser?.hireDate).toBeTruthy();
    if (!beforeUser?.hireDate) return;

    const nextEmployeeNumber = beforeUser.employeeNumber.endsWith("-SMOKE")
      ? beforeUser.employeeNumber.replace(/-SMOKE$/, "")
      : `${beforeUser.employeeNumber}-SMOKE`;
    const nextHireDate = beforeUser.hireDate === "2026-01-01" ? "2026-01-02" : "2026-01-01";

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userOrganization(targetUserId),
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            departmentName: beforeUser.departmentName,
            branchName: beforeUser.branchName,
            positionName: beforeUser.positionName ?? "",
            employeeNumber: nextEmployeeNumber,
            hireDate: nextHireDate,
            reason: "사원 조직정보 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.audit.action).toBe("admin.user.organization.update");
      expect(updatePayload.data.user.employeeNumber).toBe(nextEmployeeNumber);
      expect(updatePayload.data.user.hireDate).toBe(nextHireDate);

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      const rereadUser = rereadPayload.data.items.find((item) => item.userId === targetUserId);
      expect(rereadUser?.employeeNumber).toBe(nextEmployeeNumber);
      expect(rereadUser?.hireDate).toBe(nextHireDate);
    } finally {
      await app.request(
        appRoutes.admin.userOrganization(targetUserId),
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            departmentName: beforeUser.departmentName,
            branchName: beforeUser.branchName,
            positionName: beforeUser.positionName ?? "",
            employeeNumber: beforeUser.employeeNumber,
            hireDate: beforeUser.hireDate,
            reason: "사원 조직정보 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("updates and re-reads an employee account status through admin users API", async () => {
    const cookie = await login();
    const targetUserId = "user_hr_admin";

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    if (!beforeUser) return;

    const nextMustChangePassword = !beforeUser.mustChangePassword;

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userStatus(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            status: beforeUser.accountStatus,
            mustChangePassword: nextMustChangePassword,
            reason: "사원 계정상태 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.audit.action).toBe("admin.user.status.update");
      expect(updatePayload.data.user.accountStatus).toBe(beforeUser.accountStatus);
      expect(updatePayload.data.user.mustChangePassword).toBe(nextMustChangePassword);

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      const rereadUser = rereadPayload.data.items.find((item) => item.userId === targetUserId);
      expect(rereadUser?.accountStatus).toBe(beforeUser.accountStatus);
      expect(rereadUser?.mustChangePassword).toBe(nextMustChangePassword);
    } finally {
      await app.request(
        appRoutes.admin.userStatus(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            status: beforeUser.accountStatus,
            mustChangePassword: beforeUser.mustChangePassword,
            reason: "사원 계정상태 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("updates and re-reads an employee account lifecycle status through admin users API", async () => {
    const cookie = await login();
    const targetUserId = "user_employee";

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    if (!beforeUser) return;

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userStatus(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            status: "locked",
            mustChangePassword: beforeUser.mustChangePassword,
            reason: "사내임직원 계정 잠금 상태 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.audit.action).toBe("admin.user.status.update");
      expect(updatePayload.data.user.accountStatus).toBe("locked");

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      expect(rereadPayload.data.items.find((item) => item.userId === targetUserId)?.accountStatus).toBe("locked");
    } finally {
      await app.request(
        appRoutes.admin.userStatus(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            status: beforeUser.accountStatus,
            mustChangePassword: beforeUser.mustChangePassword,
            reason: "사내임직원 계정 잠금 상태 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("offboards an employee by revoking active roles, sessions, and audit logging the status change", async () => {
    if (!sql) return;
    const cookie = await login();
    const targetUserId = "user_employee";
    const sessionId = `test_offboard_session_${Date.now()}`;
    const sessionTokenHash = `${sessionId}_hash`;

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    if (!beforeUser) return;

    const beforeEmployeeRows = await sql`
      select employment_status, leave_date
      from employees
      where company_id = 'company_demo'
        and user_id = ${targetUserId}
        and deleted_at is null
      limit 1
    `;
    const beforeEmployee = beforeEmployeeRows[0] as { employment_status: string; leave_date: Date | string | null } | undefined;
    expect(beforeEmployee).toBeDefined();
    if (!beforeEmployee) return;

    await sql`
      insert into auth_sessions (id, company_id, user_id, session_token_hash, status, expires_at, created_at, updated_at)
      values (${sessionId}, 'company_demo', ${targetUserId}, ${sessionTokenHash}, 'active', now() + interval '1 hour', now(), now())
    `;

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userStatus(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            status: "offboarded",
            mustChangePassword: true,
            reason: "사내임직원 퇴사 권한 회수 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.audit.action).toBe("admin.user.status.update");
      expect(updatePayload.data.user.accountStatus).toBe("offboarded");
      expect(updatePayload.data.user.employmentStatus).toBe("offboarded");
      expect(updatePayload.data.user.roleCodes).toEqual([]);
      expect(updatePayload.data.user.permissions).toEqual([]);
      expect(updatePayload.data.user.activeSessionCount).toBe(0);

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      const rereadUser = rereadPayload.data.items.find((item) => item.userId === targetUserId);
      expect(rereadUser?.accountStatus).toBe("offboarded");
      expect(rereadUser?.employmentStatus).toBe("offboarded");
      expect(rereadUser?.roleCodes).toEqual([]);
      expect(rereadUser?.permissions).toEqual([]);
      expect(rereadUser?.activeSessionCount).toBe(0);

      const sessionRows = await sql`
        select status, revoked_at
        from auth_sessions
        where id = ${sessionId}
      `;
      expect((sessionRows[0] as { status: string; revoked_at: Date | string | null } | undefined)?.status).toBe("revoked");
      expect((sessionRows[0] as { status: string; revoked_at: Date | string | null } | undefined)?.revoked_at).toBeTruthy();

      const activeRoleRows = await sql`
        select count(*)::integer as count
        from user_roles
        where company_id = 'company_demo'
          and user_id = ${targetUserId}
          and status = 'active'
          and deleted_at is null
      `;
      expect(Number((activeRoleRows[0] as { count: number | string } | undefined)?.count ?? 0)).toBe(0);

      const auditRows = await sql`
        select action, before_json, after_json, metadata_json
        from audit_logs
        where company_id = 'company_demo'
          and resource_id = ${targetUserId}
          and action = 'admin.user.status.update'
        order by created_at desc
        limit 1
      `;
      const audit = auditRows[0] as
        | { action: string; before_json: { status?: string }; after_json: { status?: string }; metadata_json: { reason?: string } }
        | undefined;
      expect(audit?.action).toBe("admin.user.status.update");
      expect(audit?.before_json.status).toBe(beforeUser.accountStatus);
      expect(audit?.after_json.status).toBe("offboarded");
      expect(audit?.metadata_json.reason).toBe("사내임직원 퇴사 권한 회수 저장 테스트");
    } finally {
      await sql`delete from auth_sessions where id = ${sessionId}`;
      await sql`
        update employees
        set employment_status = ${beforeEmployee.employment_status},
            leave_date = ${beforeEmployee.leave_date},
            updated_at = now()
        where company_id = 'company_demo'
          and user_id = ${targetUserId}
          and deleted_at is null
      `;
      await app.request(
        appRoutes.admin.userStatus(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            status: beforeUser.accountStatus,
            mustChangePassword: beforeUser.mustChangePassword,
            reason: "사내임직원 퇴사 권한 회수 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      await app.request(
        appRoutes.admin.userRoles(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            roleCodes: beforeUser.roleCodes,
            reason: "사내임직원 퇴사 권한 회수 역할 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("updates and re-reads employee security settings through admin users API", async () => {
    const cookie = await login();
    const targetUserId = "user_employee";

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    if (!beforeUser) return;

    const nextTwoFactorRequired = !beforeUser.twoFactorRequired;
    const nextMustChangePassword = !beforeUser.mustChangePassword;

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userSecurity(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            twoFactorRequired: nextTwoFactorRequired,
            mustChangePassword: nextMustChangePassword,
            resetFailedLoginCount: true,
            revokeActiveSessions: true,
            reason: "사내임직원 보안 설정 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.audit.action).toBe("admin.user.security.update");
      expect(updatePayload.data.user.twoFactorRequired).toBe(nextTwoFactorRequired);
      expect(updatePayload.data.user.mustChangePassword).toBe(nextMustChangePassword);
      expect(updatePayload.data.user.failedLoginCount).toBe(0);

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      const rereadUser = rereadPayload.data.items.find((item) => item.userId === targetUserId);
      expect(rereadUser?.twoFactorRequired).toBe(nextTwoFactorRequired);
      expect(rereadUser?.mustChangePassword).toBe(nextMustChangePassword);
      expect(rereadUser?.failedLoginCount).toBe(0);
    } finally {
      await app.request(
        appRoutes.admin.userSecurity(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            twoFactorRequired: beforeUser.twoFactorRequired,
            mustChangePassword: beforeUser.mustChangePassword,
            resetFailedLoginCount: false,
            revokeActiveSessions: false,
            reason: "사내임직원 보안 설정 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("updates and re-reads employee roles through admin users API", async () => {
    const cookie = await login();
    const targetUserId = "user_hr_admin";

    const beforeResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(beforeResponse.status).toBe(200);
    const beforePayload = adminUsersListResponseSchema.parse(await beforeResponse.json());
    const beforeUser = beforePayload.data.items.find((item) => item.userId === targetUserId);
    expect(beforeUser).toBeDefined();
    if (!beforeUser) return;

    const roleToToggle = beforeUser.roleCodes.includes("AUDITOR") ? "EMPLOYEE" : "AUDITOR";
    const nextRoleCodes = Array.from(new Set([...beforeUser.roleCodes, roleToToggle]));

    try {
      const updateResponse = await app.request(
        appRoutes.admin.userRoles(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            roleCodes: nextRoleCodes,
            reason: "사원 역할 권한 저장 테스트",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(updateResponse.status).toBe(200);
      const updatePayload = adminUserMutationResponseSchema.parse(await updateResponse.json());
      expect(updatePayload.data.persistence).toBe("operational-db");
      expect(updatePayload.data.audit.action).toBe("admin.user.roles.update");
      expect(updatePayload.data.user.roleCodes).toEqual(expect.arrayContaining(nextRoleCodes));
      expect(updatePayload.data.user.permissions.length).toBeGreaterThan(0);

      const rereadResponse = await app.request(appRoutes.admin.users, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
      expect(rereadResponse.status).toBe(200);
      const rereadPayload = adminUsersListResponseSchema.parse(await rereadResponse.json());
      const rereadUser = rereadPayload.data.items.find((item) => item.userId === targetUserId);
      expect(rereadUser?.roleCodes).toEqual(expect.arrayContaining(nextRoleCodes));
    } finally {
      await app.request(
        appRoutes.admin.userRoles(targetUserId),
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({
            roleCodes: beforeUser.roleCodes,
            reason: "사원 역할 권한 저장 테스트 원복",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
    }
  });

  runWhenDbConfigured("lists org employees, departments, roles, permissions, companies, and home shortcuts from the preview PostgreSQL seed", async () => {
    const cookie = await login();

    const employeesResponse = await app.request("/api/employees", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(employeesResponse.status).toBe(200);
    const employeesPayload = listEmployeesResponseSchema.parse(await employeesResponse.json());
    expect(employeesPayload.data.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["employee_admin", "employee_staff", "employee_manager", "employee_employee"]),
    );
    expect(employeesPayload.data.notices.join(" ")).toContain("운영 DB 기준");

    const departmentsResponse = await app.request("/api/departments", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(departmentsResponse.status).toBe(200);
    const departmentsPayload = listDepartmentsResponseSchema.parse(await departmentsResponse.json());
    expect(departmentsPayload.data.items.map((item) => item.code)).toEqual(expect.arrayContaining(["EXEC", "HR", "OPS"]));

    const rolesResponse = await app.request("/api/roles", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(rolesResponse.status).toBe(200);
    const rolesPayload = listRolesResponseSchema.parse(await rolesResponse.json());
    expect(rolesPayload.data.items.map((item) => item.code)).toEqual(expect.arrayContaining(["COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"]));
    expect(rolesPayload.data.items.find((item) => item.code === "COMPANY_ADMIN")?.permissions).toEqual(
      expect.arrayContaining(["company.read", "permission.read", "invite.manage", "audit.read"]),
    );

    const permissionsResponse = await app.request("/api/permissions", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(permissionsResponse.status).toBe(200);
    const permissionsPayload = listPermissionsResponseSchema.parse(await permissionsResponse.json());
    expect(permissionsPayload.data.items.map((item) => item.code)).toEqual(expect.arrayContaining(["company.read", "invite.manage", "audit.read"]));

    const companiesResponse = await app.request("/api/companies", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(companiesResponse.status).toBe(200);
    const companiesPayload = listCompaniesResponseSchema.parse(await companiesResponse.json());
    expect(companiesPayload.data.items[0]?.name).toBe("데모 주식회사");
    expect(companiesPayload.data.items[0]?.settingsModel.policyStartPoint).toContain("본사 운영센터");

    const branchesResponse = await app.request(appRoutes.org.branches, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(branchesResponse.status).toBe(200);
    const branchesPayload = listBranchesResponseSchema.parse(await branchesResponse.json());
    expect(branchesPayload.data.scope).toBe("hq_admin");
    expect(branchesPayload.data.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["branch_hq", "branch_hotel_seoul"]),
    );

    const notificationsResponse = await app.request(appRoutes.notifications, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(notificationsResponse.status).toBe(200);
    const notificationsPayload = listNotificationsResponseSchema.parse(await notificationsResponse.json());
    expect(notificationsPayload.data.unreadCount).toBeGreaterThanOrEqual(1);
    expect(notificationsPayload.data.items.some((item) => item.id === "notification_admin_operational_ready")).toBe(true);

    const auditLogsResponse = await app.request(appRoutes.admin.auditLogs, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(auditLogsResponse.status).toBe(200);
    const auditLogsPayload = adminAuditLogListResponseSchema.parse(await auditLogsResponse.json());
    expect(auditLogsPayload.data.items.some((item) => item.id === "audit_initial_seed_admin" || item.id === "audit_initial_record_admin")).toBe(true);
    expect(auditLogsPayload.data.filterOptions.actorUserIds).toEqual(expect.arrayContaining(["user_company_admin"]));

    const shortcutsResponse = await app.request("/api/home/shortcuts", { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(shortcutsResponse.status).toBe(200);
    const shortcutsPayload = listHomeShortcutsResponseSchema.parse(await shortcutsResponse.json());
    expect(shortcutsPayload.data.items.map((item) => item.code)).toEqual(
      expect.arrayContaining(["attendance", "leave", "approvals", "boards", "documents", "me", "admin_users", "audit_logs"]),
    );
  });

  runWhenDbConfigured("keeps cross-company same-slug boards and document spaces isolated during API upserts", async () => {
    if (!sql) {
      throw new Error("DATABASE_URL_PREVIEW is required");
    }

    const boardSlug = "ops-updates";
    const spaceSlug = "ops-docs";
    const now = new Date().toISOString();

    await cleanupCrossCompanySlugRows(boardSlug, spaceSlug);

    try {
      await sql`
        insert into companies (id, name, status, created_at, updated_at)
        values ('company_other', '다른 회사', 'active', ${now}::timestamptz, ${now}::timestamptz)
        on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = excluded.updated_at
      `;
      await sql`
        insert into boards (id, company_id, code, name, board_type, visibility, status, created_at, updated_at)
        values (
          'board_company_other_ops-updates',
          'company_other',
          ${boardSlug},
          '다른 회사 운영 공지 게시판',
          'general',
          'company',
          'active',
          ${now}::timestamptz,
          ${now}::timestamptz
        )
      `;
      await sql`
        insert into document_spaces (id, company_id, code, name, visibility, status, created_at, updated_at)
        values (
          'document_space_company_other_ops-docs',
          'company_other',
          ${spaceSlug},
          '다른 회사 운영 문서함',
          'company',
          'active',
          ${now}::timestamptz,
          ${now}::timestamptz
        )
      `;

      const cookie = await login();

      const createBoardResponse = await app.request(
        appRoutes.boards.boards,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie,
          },
          body: JSON.stringify({
            boardType: 'general',
            name: '운영 공지 게시판',
            slug: boardSlug,
            visibility: 'company',
            isNoticeOnly: false,
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createBoardResponse.status).toBe(201);
      const createBoardPayload = boardResponseSchema.parse(await createBoardResponse.json());
      expect(createBoardPayload.data.board.id).toBe('board_company_demo_ops-updates');
      expect(createBoardPayload.data.board.companyId).toBe('company_demo');

      const createSpaceResponse = await app.request(
        appRoutes.documents.spaces,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie,
          },
          body: JSON.stringify({
            name: '운영 문서함',
            slug: spaceSlug,
            visibility: 'company',
            isPublicWithinCompany: true,
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createSpaceResponse.status).toBe(201);
      const createSpacePayload = documentSpaceResponseSchema.parse(await createSpaceResponse.json());
      expect(createSpacePayload.data.space.id).toBe('document_space_company_demo_ops-docs');
      expect(createSpacePayload.data.space.companyId).toBe('company_demo');

      const boardRows = await sql`
        select id, company_id, code, name
        from boards
        where company_id in ('company_demo', 'company_other')
          and code = ${boardSlug}
        order by company_id
      `;
      expect(boardRows).toHaveLength(2);
      expect(boardRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'board_company_demo_ops-updates',
            company_id: 'company_demo',
            code: boardSlug,
            name: '운영 공지 게시판',
          }),
          expect.objectContaining({
            id: 'board_company_other_ops-updates',
            company_id: 'company_other',
            code: boardSlug,
            name: '다른 회사 운영 공지 게시판',
          }),
        ]),
      );

      const spaceRows = await sql`
        select id, company_id, code, name
        from document_spaces
        where company_id in ('company_demo', 'company_other')
          and code = ${spaceSlug}
        order by company_id
      `;
      expect(spaceRows).toHaveLength(2);
      expect(spaceRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'document_space_company_demo_ops-docs',
            company_id: 'company_demo',
            code: spaceSlug,
            name: '운영 문서함',
          }),
          expect.objectContaining({
            id: 'document_space_company_other_ops-docs',
            company_id: 'company_other',
            code: spaceSlug,
            name: '다른 회사 운영 문서함',
          }),
        ]),
      );
    } finally {
      await cleanupCrossCompanySlugRows(boardSlug, spaceSlug);
    }
  });
});
