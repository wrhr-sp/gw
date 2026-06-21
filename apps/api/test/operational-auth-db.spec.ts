import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  adminAuditLogListResponseSchema,
  adminUsersListResponseSchema,
  appRoutes,
  authLoginResponseSchema,
  boardCommentCreateResponseSchema,
  boardPostCreateResponseSchema,
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
  readReceiptCreateResponseSchema,
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

    if (!sql) {
      throw new Error("DATABASE_URL_PREVIEW is required");
    }
    await sql`
      insert into notifications (id, company_id, user_id, title, body, notification_type, read_at, created_at)
      values (
        'notification_admin_seed_1',
        'company_demo',
        'user_company_admin',
        '운영 DB 알림 seed',
        '운영 DB smoke 확인용 읽지 않은 알림입니다.',
        'system',
        null,
        now()
      )
      on conflict (id) do update
      set read_at = null,
          title = excluded.title,
          body = excluded.body,
          notification_type = excluded.notification_type,
          created_at = excluded.created_at
    `;

    const notificationsResponse = await app.request(appRoutes.notifications, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(notificationsResponse.status).toBe(200);
    const notificationsPayload = listNotificationsResponseSchema.parse(await notificationsResponse.json());
    expect(notificationsPayload.data.unreadCount).toBeGreaterThanOrEqual(1);
    expect(notificationsPayload.data.items.some((item) => item.id === "notification_admin_seed_1")).toBe(true);

    const auditLogsResponse = await app.request(appRoutes.admin.auditLogs, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(auditLogsResponse.status).toBe(200);
    const auditLogsPayload = adminAuditLogListResponseSchema.parse(await auditLogsResponse.json());
    expect(auditLogsPayload.data.items.some((item) => item.id === "audit_initial_seed_admin")).toBe(true);
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

  runWhenDbConfigured("maps board collaboration audit resource types back to board_policy in admin audit logs", async () => {
    if (!sql) {
      throw new Error("DATABASE_URL_PREVIEW is required");
    }

    const adminCookie = await login();
    const auditBoardSlug = `audit-mapping-${Date.now()}`;
    const auditBoardId = `board_company_demo_${auditBoardSlug}`;

    await sql`
      delete from read_receipts
      where company_id = 'company_demo'
        and target_id in (select id from posts where board_id in (select id from boards where code like 'audit-mapping-%'))
    `;
    await sql`
      delete from comments
      where company_id = 'company_demo'
        and post_id in (select id from posts where board_id in (select id from boards where code like 'audit-mapping-%'))
    `;
    await sql`
      delete from posts
      where company_id = 'company_demo'
        and board_id in (select id from boards where code like 'audit-mapping-%')
    `;
    await sql`
      delete from audit_logs
      where company_id = 'company_demo'
        and (
          resource_id = ${auditBoardId}
          or resource_id in (select id from boards where code like 'audit-mapping-%')
        )
    `;
    await sql`delete from boards where id = ${auditBoardId}`;

    try {
      const createBoardResponse = await app.request(
        appRoutes.boards.boards,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: adminCookie,
          },
          body: JSON.stringify({
            boardType: "general",
            name: "운영 DB audit 매핑 게시판",
            slug: auditBoardSlug,
            visibility: "company",
            isNoticeOnly: false,
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createBoardResponse.status).toBe(201);
      const createBoardPayload = boardResponseSchema.parse(await createBoardResponse.json());

      const createPostResponse = await app.request(
        appRoutes.boards.posts(createBoardPayload.data.board.id),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: adminCookie,
          },
          body: JSON.stringify({
            title: `운영 DB audit 매핑 점검 ${Date.now()}`,
            bodyPreview: "게시글 감사 로그 targetType 확인",
            isNotice: false,
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createPostResponse.status).toBe(201);
      const createPostPayload = boardPostCreateResponseSchema.parse(await createPostResponse.json());

      const createCommentResponse = await app.request(
        appRoutes.boards.comments(createPostPayload.data.post.id),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: adminCookie,
          },
          body: JSON.stringify({
            body: "댓글 감사 로그 targetType 확인",
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createCommentResponse.status).toBe(201);
      const createCommentPayload = boardCommentCreateResponseSchema.parse(await createCommentResponse.json());

      const createReceiptResponse = await app.request(
        appRoutes.readReceipts,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: adminCookie,
          },
          body: JSON.stringify({
            targetType: "post",
            targetId: createPostPayload.data.post.id,
          }),
        },
        { DATABASE_URL: databaseUrl },
      );
      expect(createReceiptResponse.status).toBe(201);
      readReceiptCreateResponseSchema.parse(await createReceiptResponse.json());

      const auditLogsResponse = await app.request(
        appRoutes.admin.auditLogs,
        { headers: { cookie: adminCookie } },
        { DATABASE_URL: databaseUrl },
      );
      expect(auditLogsResponse.status).toBe(200);
      const auditLogsPayload = adminAuditLogListResponseSchema.parse(await auditLogsResponse.json());

      expect(
        auditLogsPayload.data.items.find(
          (item) => item.action === "board.post.create" && item.targetId === createPostPayload.data.post.id,
        )?.targetType,
      ).toBe("board_policy");
      expect(
        auditLogsPayload.data.items.find(
          (item) => item.action === "board.comment.create" && item.targetId === createCommentPayload.data.comment.id,
        )?.targetType,
      ).toBe("board_policy");
      expect(
        auditLogsPayload.data.items.find(
          (item) => item.action === "read_receipt.create" && item.targetId === createPostPayload.data.post.id,
        )?.targetType,
      ).toBe("board_policy");
    } finally {
      await sql`
        delete from read_receipts
        where company_id = 'company_demo'
          and target_id in (select id from posts where board_id = ${auditBoardId})
      `;
      await sql`
        delete from comments
        where company_id = 'company_demo'
          and post_id in (select id from posts where board_id = ${auditBoardId})
      `;
      await sql`delete from posts where board_id = ${auditBoardId}`;
      await sql`delete from audit_logs where company_id = 'company_demo' and resource_id = ${auditBoardId}`;
      await sql`delete from boards where id = ${auditBoardId}`;
    }
  });
});
