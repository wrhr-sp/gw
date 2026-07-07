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
