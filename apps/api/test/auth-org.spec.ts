import { describe, expect, it } from "vitest";
import {
  adminPoliciesListResponseSchema,
  adminPolicyUpdateResponseSchema,
  appRoutes,
  approvalActionResponseSchema,
  approvalCandidateListResponseSchema,
  approvalCommentCreateResponseSchema,
  approvalCommentListResponseSchema,
  approvalDocumentCreateResponseSchema,
  approvalDocumentDetailResponseSchema,
  approvalDocumentListResponseSchema,
  approvalFormListResponseSchema,
  approvalInboxResponseSchema,
  approvalLineListResponseSchema,
  attendanceActionResponseSchema,
  attendanceCorrectionResponseSchema,
  attendanceListRecordsResponseSchema,
  attendancePolicyLevelSchema,
  authLoginResponseSchema,
  boardCommentCreateResponseSchema,
  boardCommentListResponseSchema,
  boardPostCreateResponseSchema,
  boardPostDetailResponseSchema,
  boardPostListResponseSchema,
  boardResponseSchema,
  boardsListResponseSchema,
  createInviteResponseSchema,
  demoAttendancePolicySubjects,
  documentFileListResponseSchema,
  documentFileMetadataCreateResponseSchema,
  documentFileUploadCompleteResponseSchema,
  documentFileUploadInitResponseSchema,
  documentFileDownloadInitResponseSchema,
  documentFileDeleteResponseSchema,
  documentSpaceListResponseSchema,
  documentSpaceResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  leaveActionResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateResponseSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  meResponseSchema,
  noticeListResponseSchema,
  readReceiptCreateResponseSchema,
  type AttendanceRegistrationMethod,
  type AttendanceRegistrationPolicy,
} from "@gw/shared";
import { app, isAttendanceRegistrationMethodAllowed } from "../src/app";

const r2TestBinding = {
  FILES_BUCKET: {
    head: async () => null,
    get: async () => null,
    put: async () => null,
    delete: async () => undefined,
  },
};

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
      rememberSession: false,
    }),
  });

  const cookie = response.headers.get("set-cookie");

  if (!cookie) {
    throw new Error("expected login response to include set-cookie header");
  }

  return { response, cookie };
}

describe("Phase 2 auth/org skeleton", () => {
  it("logs in with placeholder auth and returns shared contract", async () => {
    const { response } = await loginAndGetCookie();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("Max-Age=");

    const payload = authLoginResponseSchema.parse(await response.json());

    expect(payload.data.session.placeholder).toBe(true);
    expect(payload.data.user.roleCodes).toContain("COMPANY_ADMIN");
  });

  it("switches session persistence based on the rememberSession choice", async () => {
    const rememberedResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        loginId: "admin",
        password: "1234",
        rememberSession: true,
      }),
    });

    expect(rememberedResponse.status).toBe(200);
    expect(rememberedResponse.headers.get("set-cookie")).toContain("Max-Age=2592000");

    const sessionOnlyResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        loginId: "admin",
        password: "1234",
        rememberSession: false,
      }),
    });

    expect(sessionOnlyResponse.status).toBe(200);
    expect(sessionOnlyResponse.headers.get("set-cookie")).not.toContain("Max-Age=");
  });

  it("rejects invalid dev-safe login credentials", async () => {
    const response = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        loginId: "admin",
        password: "wrong-password",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("rejects me when no auth cookie is present", async () => {
    const response = await app.request(appRoutes.me);
    expect(response.status).toBe(401);

    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("AUTH_REQUIRED");
  });

  it("returns the minimal health contract for ops baseline checks", async () => {
    const response = await app.request(appRoutes.health);
    expect(response.status).toBe(200);

    const payload = healthResponseSchema.parse(await response.json());
    expect(payload.data.service).toBe("gw-api");
    expect(payload.data.status).toBe("ok");
    expect(payload.data.version).toBeTruthy();
  });

  it("returns session user and permissions with placeholder auth cookie", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const meResponse = await app.request(appRoutes.me, {
      headers: {
        cookie,
      },
    });

    expect(meResponse.status).toBe(200);

    const mePayload = meResponseSchema.parse(await meResponse.json());
    expect(mePayload.data.user.roleCodes).toContain("HR_ADMIN");
    expect(mePayload.data.user.permissions).toContain("employee.read");

    const permissionsResponse = await app.request(appRoutes.org.permissions, {
      headers: {
        cookie,
      },
    });

    expect(permissionsResponse.status).toBe(503);
    const permissionsPayload = errorResponseSchema.parse(await permissionsResponse.json());
    expect(permissionsPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL for home shortcuts and still returns company settings payloads", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const shortcutsResponse = await app.request(appRoutes.home.shortcuts, {
      headers: {
        cookie,
      },
    });
    expect(shortcutsResponse.status).toBe(503);
    const shortcutsPayload = errorResponseSchema.parse(await shortcutsResponse.json());
    expect(shortcutsPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const companiesResponse = await app.request(appRoutes.org.companies, {
      headers: {
        cookie,
      },
    });
    expect(companiesResponse.status).toBe(503);
    const companiesPayload = errorResponseSchema.parse(await companiesResponse.json());
    expect(companiesPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL for branch summaries and notification inbox payloads", async () => {
    const { cookie: adminCookie } = await loginAndGetCookie("COMPANY_ADMIN");
    const adminBranchesResponse = await app.request(appRoutes.org.branches, {
      headers: {
        cookie: adminCookie,
      },
    });
    expect(adminBranchesResponse.status).toBe(503);
    const adminBranchesPayload = errorResponseSchema.parse(await adminBranchesResponse.json());
    expect(adminBranchesPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: managerCookie } = await loginAndGetCookie("MANAGER");
    const managerBranchesResponse = await app.request(appRoutes.org.branches, {
      headers: {
        cookie: managerCookie,
      },
    });
    expect(managerBranchesResponse.status).toBe(503);
    const managerBranchesPayload = errorResponseSchema.parse(await managerBranchesResponse.json());
    expect(managerBranchesPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const notificationsResponse = await app.request(appRoutes.notifications, {
      headers: {
        cookie: adminCookie,
      },
    });
    expect(notificationsResponse.status).toBe(503);
    const notificationsPayload = errorResponseSchema.parse(await notificationsResponse.json());
    expect(notificationsPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL instead of fallback home shortcuts for non-privileged viewers", async () => {
    const { cookie: employeeCookie } = await loginAndGetCookie("EMPLOYEE");
    const employeeResponse = await app.request(appRoutes.home.shortcuts, {
      headers: {
        cookie: employeeCookie,
      },
    });
    expect(employeeResponse.status).toBe(503);
    const employeePayload = errorResponseSchema.parse(await employeeResponse.json());
    expect(employeePayload.error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: managerCookie } = await loginAndGetCookie("MANAGER");
    const managerResponse = await app.request(appRoutes.home.shortcuts, {
      headers: {
        cookie: managerCookie,
      },
    });
    expect(managerResponse.status).toBe(503);
    const managerPayload = errorResponseSchema.parse(await managerResponse.json());
    expect(managerPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("blocks invite creation when current role lacks admin permission", async () => {
    const { cookie } = await loginAndGetCookie("MANAGER");

    const response = await app.request(appRoutes.admin.invites, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        email: "new.user@example.com",
        roleCode: "EMPLOYEE",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("requires PostgreSQL for admin invite creation", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.invites, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        email: "new.user@example.com",
        roleCode: "MANAGER",
        departmentId: "department_ops",
      }),
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL for employee directory summaries, filters, and admin-boundary notices", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const response = await app.request(`${appRoutes.org.employees}?departmentId=department_ops&employmentStatus=active&roleCode=MANAGER`, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL before filtering admin-only roles out of the general employee directory", async () => {
    const { cookie } = await loginAndGetCookie("MANAGER");

    const response = await app.request(`${appRoutes.org.employees}?roleCode=COMPANY_ADMIN`, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("returns validation errors instead of 500 for invalid employee directory filters", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const invalidStatusResponse = await app.request(`${appRoutes.org.employees}?employmentStatus=inactive`, {
      headers: {
        cookie,
      },
    });
    expect(invalidStatusResponse.status).toBe(400);
    const invalidStatusPayload = errorResponseSchema.parse(await invalidStatusResponse.json());
    expect(invalidStatusPayload.error.code).toBe("VALIDATION_ERROR");
    expect(invalidStatusPayload.error.details?.field).toBe("employmentStatus");

    const invalidRoleResponse = await app.request(`${appRoutes.org.employees}?roleCode=NOT_A_ROLE`, {
      headers: {
        cookie,
      },
    });
    expect(invalidRoleResponse.status).toBe(400);
    const invalidRolePayload = errorResponseSchema.parse(await invalidRoleResponse.json());
    expect(invalidRolePayload.error.code).toBe("VALIDATION_ERROR");
    expect(invalidRolePayload.error.details?.field).toBe("roleCode");
  });

  it("requires PostgreSQL for admin users list even for admin roles with permission catalog access", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const response = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("blocks admin users list for non-admin roles even if they can read employees", async () => {
    const { cookie } = await loginAndGetCookie("MANAGER");

    const response = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("returns masked document policy update candidates without raw storage details", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.policyDocuments, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        visibility: "company",
        maxFileSizeBytes: 10485760,
        allowedFileExtensions: ["pdf", "docx"],
        retentionDays: 365,
        reason: "보안 정책 점검",
      }),
    });

    expect(response.status).toBe(200);
    const payload = adminPolicyUpdateResponseSchema.parse(await response.json());
    expect(payload.data.audit.action).toBe("admin.policy.document.updated");
    expect(payload.data.policy.reasonRequired).toBe(true);
    expect(payload.data.policy.diffPreview.after).toContain("visibility=company");
    expect(payload.data.maskedFields).toContain("storageKey");
    expect(JSON.stringify(payload)).not.toContain("companies/company_demo/");
    expect(JSON.stringify(payload)).not.toContain("signedUrl");
  });

  it("returns board policy candidate summary with review requirement", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.policyBoards, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        visibility: "company",
        allowAnonymousComments: false,
        requireReadReceipt: true,
        retentionDays: 90,
        reason: "공지 운영 정책 점검",
      }),
    });

    expect(response.status).toBe(200);
    const payload = adminPolicyUpdateResponseSchema.parse(await response.json());
    expect(payload.data.audit.action).toBe("admin.policy.board.updated");
    expect(payload.data.policy.capability).toBe("board.manage");
    expect(payload.data.requiresReview).toBe(true);
  });

  it("rejects attendance registration policy payload on board policy endpoint", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.policyBoards, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_demo",
        visibility: "company",
        allowAnonymousComments: false,
        requireReadReceipt: true,
        retentionDays: 90,
        reason: "게시판 정책 경계 검증",
        attendanceRegistrationPolicy: {
          allowedAttendanceRegistrationMethods: ["mobile"],
          candidateAllowedAttendanceRegistrationMethods: ["mobile", "tag"],
          tagDeviceStatus: "skeleton_only",
        },
      }),
    });

    expect(response.status).toBe(400);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks cross-company document policy candidates", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.policyDocuments, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        companyId: "company_other",
        visibility: "company",
        maxFileSizeBytes: 10485760,
        allowedFileExtensions: ["pdf"],
        retentionDays: 365,
        reason: "범위 확인",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("allows audit-capable roles to read masked admin audit logs and blocks missing permission", async () => {
    const { cookie: auditorCookie } = await loginAndGetCookie("AUDITOR");
    const readResponse = await app.request(appRoutes.admin.auditLogs, {
      headers: {
        cookie: auditorCookie,
      },
    });

    expect(readResponse.status).toBe(503);
    const readPayload = errorResponseSchema.parse(await readResponse.json());
    expect(readPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: hrCookie } = await loginAndGetCookie("HR_ADMIN");
    const blockedResponse = await app.request(appRoutes.admin.auditLogs, {
      headers: {
        cookie: hrCookie,
      },
    });

    expect(blockedResponse.status).toBe(403);
    const blockedPayload = errorResponseSchema.parse(await blockedResponse.json());
    expect(blockedPayload.error.code).toBe("FORBIDDEN");
    expect(blockedPayload.error.details?.requiredPermission).toBe("audit.read");
  });

  it("requires PostgreSQL before filtering admin audit logs by createdFrom and createdTo query params", async () => {
    const { cookie } = await loginAndGetCookie("AUDITOR");

    const createdFromResponse = await app.request(
      `${appRoutes.admin.auditLogs}?createdFrom=2026-06-10T09:00:00.000Z`,
      {
        headers: {
          cookie,
        },
      },
    );

    expect(createdFromResponse.status).toBe(503);
    const createdFromPayload = errorResponseSchema.parse(await createdFromResponse.json());
    expect(createdFromPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL for common work item list/detail/document/deadline reads", async () => {
    const { cookie: hrCookie } = await loginAndGetCookie("HR_ADMIN");

    const listResponse = await app.request(appRoutes.workItems.list, {
      headers: { cookie: hrCookie },
    });
    expect(listResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await listResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const filteredResponse = await app.request(`${appRoutes.workItems.list}?module=hr`, {
      headers: { cookie: hrCookie },
    });
    expect(filteredResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await filteredResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: managerCookie } = await loginAndGetCookie("MANAGER");
    const detailResponse = await app.request(appRoutes.workItems.detail("work_item_tax_month_end_evidence"), {
      headers: { cookie: managerCookie },
    });
    expect(detailResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await detailResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const documentResponse = await app.request(appRoutes.workItems.documents("work_item_legal_contract_renewal"), {
      headers: { cookie: managerCookie },
    });
    expect(documentResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await documentResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const deadlinesResponse = await app.request(appRoutes.workItems.deadlines, {
      headers: { cookie: managerCookie },
    });
    expect(deadlinesResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await deadlinesResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
  });

  it.each([
    ["employees list", appRoutes.org.employees, "employee.read", "MANAGER"],
    ["departments list", appRoutes.org.departments, "department.read", "MANAGER"],
    ["roles list", appRoutes.org.roles, "role.read", "MANAGER"],
    ["permissions list", appRoutes.org.permissions, "permission.read", "HR_ADMIN"],
  ])("requires PostgreSQL for authorized roles to read %s", async (_label, route, _requiredPermission, role) => {
    const { cookie } = await loginAndGetCookie(role);

    const response = await app.request(route, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it.each([
    ["employees list", appRoutes.org.employees, "employee.read"],
    ["departments list", appRoutes.org.departments, "department.read"],
    ["roles list", appRoutes.org.roles, "role.read"],
    ["permissions list", appRoutes.org.permissions, "permission.read"],
  ])("forbids EMPLOYEE from reading %s", async (_label, route, requiredPermission) => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(route, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(403);

    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.requiredPermission).toBe(requiredPermission);
  });
});

describe("Phase 3 attendance/leave skeleton", () => {
  it("returns attendance policy scope metadata and preview on the admin policies endpoint", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.admin.policies, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    const payload = adminPoliciesListResponseSchema.parse(await response.json());
    const attendancePolicy = payload.data.items.find((item) => item.category === "attendance");
    const companyPolicy = payload.data.items.find((item) => item.category === "company");
    const leavePolicy = payload.data.items.find((item) => item.category === "leave");

    expect(payload.data.bridgeSummary.currentState).toContain("1차 bridge");
    expect(payload.data.companySettingsModel.groups).toHaveLength(4);
    expect(companyPolicy?.capability).toBe("company.read");
    expect(leavePolicy?.leavePolicySummary?.allowedLeaveTypeCodes).toEqual(["annual", "half_day_am", "sick"]);
    expect(attendancePolicy?.attendancePolicyPreview?.priorityOrder).toEqual(attendancePolicyLevelSchema.options);
    expect(attendancePolicy?.attendancePolicyPreview?.scopeSummaries.find((item) => item.policyTargetId === "department_ops")?.appliedEmployeeCount).toBe(2);
    expect(attendancePolicy?.attendancePolicyPreview?.sampleEmployees.find((item) => item.employeeId === demoAttendancePolicySubjects.employee.employeeId)?.effectiveAttendanceRegistrationMethods).toEqual(["tag"]);
    expect(attendancePolicy?.attendancePolicyPreview?.duplicateWarnings).toContain("동일 target 활성 정책 중복: 근무지/지점 · 원격 실험실");
  });

  it("applies effective policy by employee scope before validating attendance methods", async () => {
    const employeeSession = await loginAndGetCookie("EMPLOYEE");
    const managerSession = await loginAndGetCookie("MANAGER");

    const employeeForbidden = await app.request(appRoutes.attendance.checkIn, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: employeeSession.cookie,
      },
      body: JSON.stringify({
        attendanceRegistrationMethod: "mobile",
      }),
    });

    expect(employeeForbidden.status).toBe(403);
    const employeeForbiddenPayload = errorResponseSchema.parse(await employeeForbidden.json());
    const effectivePolicySource = employeeForbiddenPayload.error.details?.effectivePolicySource as
      | { policyLevel?: string }
      | undefined;
    expect(employeeForbiddenPayload.error.details?.allowedAttendanceRegistrationMethods).toEqual(["tag"]);
    expect(effectivePolicySource?.policyLevel).toBe("job_type");

    const employeeAllowed = await app.request(appRoutes.attendance.checkIn, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: employeeSession.cookie,
      },
      body: JSON.stringify({
        attendanceRegistrationMethod: "tag",
      }),
    });

    expect(employeeAllowed.status).toBe(503);
    const employeeAllowedPayload = errorResponseSchema.parse(await employeeAllowed.json());
    expect(employeeAllowedPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const managerAllowed = await app.request(appRoutes.attendance.checkOut, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: managerSession.cookie,
      },
      body: JSON.stringify({
        attendanceRegistrationMethod: "pc",
      }),
    });

    expect(managerAllowed.status).toBe(503);
    const managerAllowedPayload = errorResponseSchema.parse(await managerAllowed.json());
    expect(managerAllowedPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("covers mobile-only, pc-only, tag-only, mobile+pc, and all-allowed policy combinations", async () => {
    const cases: Array<{
      name: string;
      policy: AttendanceRegistrationPolicy;
      allowed: AttendanceRegistrationMethod[];
      blocked: AttendanceRegistrationMethod[];
    }> = [
      {
        name: "mobile only",
        policy: {
          allowedAttendanceRegistrationMethods: ["mobile"],
          candidateAllowedAttendanceRegistrationMethods: ["mobile"],
          tagDeviceStatus: "skeleton_only",
        },
        allowed: ["mobile"],
        blocked: ["pc", "tag"],
      },
      {
        name: "pc only",
        policy: {
          allowedAttendanceRegistrationMethods: ["pc"],
          candidateAllowedAttendanceRegistrationMethods: ["pc"],
          tagDeviceStatus: "skeleton_only",
        },
        allowed: ["pc"],
        blocked: ["mobile", "tag"],
      },
      {
        name: "tag only",
        policy: {
          allowedAttendanceRegistrationMethods: ["tag"],
          candidateAllowedAttendanceRegistrationMethods: ["tag"],
          tagDeviceStatus: "skeleton_only",
        },
        allowed: ["tag"],
        blocked: ["mobile", "pc"],
      },
      {
        name: "mobile + pc",
        policy: {
          allowedAttendanceRegistrationMethods: ["mobile", "pc"],
          candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc"],
          tagDeviceStatus: "skeleton_only",
        },
        allowed: ["mobile", "pc"],
        blocked: ["tag"],
      },
      {
        name: "all allowed",
        policy: {
          allowedAttendanceRegistrationMethods: ["mobile", "pc", "tag"],
          candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc", "tag"],
          tagDeviceStatus: "skeleton_only",
        },
        allowed: ["mobile", "pc", "tag"],
        blocked: [],
      },
    ];

    for (const testCase of cases) {
      for (const method of testCase.allowed) {
        expect(isAttendanceRegistrationMethodAllowed(testCase.policy, method), `${testCase.name} allows ${method}`).toBe(true);
      }
      for (const method of testCase.blocked) {
        expect(isAttendanceRegistrationMethodAllowed(testCase.policy, method), `${testCase.name} blocks ${method}`).toBe(false);
      }
    }
  });

  it("returns 403 for disallowed attendance registration methods and 400 for invalid enum values", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const forbiddenResponse = await app.request(appRoutes.attendance.checkIn, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        attendanceRegistrationMethod: "mobile",
      }),
    });

    expect(forbiddenResponse.status).toBe(403);
    const forbiddenPayload = errorResponseSchema.parse(await forbiddenResponse.json());
    expect(forbiddenPayload.error.code).toBe("FORBIDDEN");
    expect(forbiddenPayload.error.details?.allowedAttendanceRegistrationMethods).toEqual(["tag"]);

    const invalidResponse = await app.request(appRoutes.attendance.checkOut, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        attendanceRegistrationMethod: "rfid",
      }),
    });

    expect(invalidResponse.status).toBe(400);
    const invalidPayload = errorResponseSchema.parse(await invalidResponse.json());
    expect(invalidPayload.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists employee attendance records and accepts correction requests", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const recordsResponse = await app.request(`${appRoutes.attendance.records}?workDateFrom=2026-06-01&workDateTo=2026-06-30`, {
      headers: {
        cookie,
      },
    });

    expect(recordsResponse.status).toBe(200);
    const recordsPayload = attendanceListRecordsResponseSchema.parse(await recordsResponse.json());
    expect(recordsPayload.data.items.length).toBeGreaterThan(0);
    expect(recordsPayload.data.filters.workDateFrom).toBe("2026-06-01");
    expect(recordsPayload.data.policyContext.currentState).toContain("현재 적용 정책");

    const correctionResponse = await app.request(appRoutes.attendance.corrections, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        attendanceRecordId: recordsPayload.data.items[0]?.id ?? "attendance_record_today",
        reason: "퇴근 시간이 누락되었습니다.",
        requestedCheckOutAt: "2026-06-10T18:10:00.000Z",
        note: "QR 체크아웃 누락",
      }),
    });

    expect(correctionResponse.status).toBe(503);
    const correctionPayload = errorResponseSchema.parse(await correctionResponse.json());
    expect(correctionPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires the operational DB for leave types, balances, and requests", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const [typesResponse, balancesResponse, requestsResponse] = await Promise.all([
      app.request(appRoutes.leave.types, { headers: { cookie } }),
      app.request(appRoutes.leave.balances, { headers: { cookie } }),
      app.request(appRoutes.leave.requests, { headers: { cookie } }),
    ]);

    expect(typesResponse.status).toBe(503);
    expect(balancesResponse.status).toBe(503);
    expect(requestsResponse.status).toBe(503);

    expect(errorResponseSchema.parse(await typesResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    expect(errorResponseSchema.parse(await balancesResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    expect(errorResponseSchema.parse(await requestsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("creates placeholder leave requests and blocks approval for non-approvers", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const createResponse = await app.request(appRoutes.leave.requests, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        leaveTypeId: "leave_type_annual",
        startDate: "2026-06-20",
        endDate: "2026-06-20",
        unit: "day",
        days: 1,
        reason: "가족 행사",
      }),
    });

    expect(createResponse.status).toBe(503);
    const createPayload = errorResponseSchema.parse(await createResponse.json());
    expect(createPayload.error.code).toBe("DB_NOT_CONFIGURED");

    const approveResponse = await app.request(appRoutes.leave.approve("leave_request_demo"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "셀프 승인 불가",
      }),
    });

    expect(approveResponse.status).toBe(403);
    const approvePayload = errorResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.error.details?.requiredPermission).toBe("leave.approve");
  });

  it("forbids attendance managers from querying unknown employee ids", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const response = await app.request(`${appRoutes.attendance.records}?employeeId=employee_other_company`, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.employeeId).toBe("employee_other_company");
  });

  it("blocks leave approval for unknown placeholder request ids", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const response = await app.request(appRoutes.leave.approve("foreign_request_id"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "test approval",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.requestId).toBe("foreign_request_id");
  });

  it.each(["HR_ADMIN", "MANAGER"])("blocks %s self-approval on owned placeholder leave requests", async (role) => {
    const { cookie } = await loginAndGetCookie(role);

    const response = await app.request(appRoutes.leave.approve("leave_request_demo"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "self approval should be blocked",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.requestId).toBe("leave_request_demo");
  });

  it("requires operational DB rows before approvers can review subordinate leave requests", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const requestsResponse = await app.request(appRoutes.leave.requests, {
      headers: {
        cookie,
      },
    });

    expect(requestsResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await requestsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const approveResponse = await app.request(appRoutes.leave.approve("leave_request_team_pending"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "인수인계 계획 확인 완료",
      }),
    });

    expect(approveResponse.status).toBe(403);
    const approvePayload = errorResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.error.code).toBe("FORBIDDEN");

    const rejectResponse = await app.request(appRoutes.leave.reject("leave_request_team_pending"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "대체 근무자 확인 전 재조정 필요",
      }),
    });

    expect(rejectResponse.status).toBe(403);
    const rejectPayload = errorResponseSchema.parse(await rejectResponse.json());
    expect(rejectPayload.error.code).toBe("FORBIDDEN");
  });
});

describe("Phase 4 approvals skeleton", () => {
  it("requires the operational DB for approval forms and lines", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const [formsResponse, linesResponse] = await Promise.all([
      app.request(appRoutes.approvals.forms, { headers: { cookie } }),
      app.request(appRoutes.approvals.lines, { headers: { cookie } }),
    ]);

    expect(formsResponse.status).toBe(503);
    expect(linesResponse.status).toBe(503);

    expect(errorResponseSchema.parse(await formsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    expect(errorResponseSchema.parse(await linesResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("blocks non-managers from creating approval forms and lines", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const formResponse = await app.request(appRoutes.approvals.forms, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "지출 결의서",
        category: "expense",
        fieldSummary: "금액/사유 입력 placeholder",
      }),
    });

    expect(formResponse.status).toBe(403);
    const formPayload = errorResponseSchema.parse(await formResponse.json());
    expect(formPayload.error.details?.requiredPermission).toBe("approval.form.manage");

    const lineResponse = await app.request(appRoutes.approvals.lines, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "기본 결재선",
        description: "팀장 승인 1단계 placeholder",
        steps: [
          {
            stepOrder: 1,
            approverEmployeeId: "employee_manager",
            stepType: "approve",
          },
        ],
      }),
    });

    expect(lineResponse.status).toBe(403);
    const linePayload = errorResponseSchema.parse(await lineResponse.json());
    expect(linePayload.error.details?.requiredPermission).toBe("approval.line.manage");
  });

  it("creates approval documents and returns scoped detail for participants", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const createResponse = await app.request(appRoutes.approvals.documents, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        formId: "approval_form_leave",
        title: "6월 연차 신청",
        summary: "6월 20일 연차 사용 placeholder",
        lineId: "approval_line_team_manager",
        referenceEmployeeIds: ["employee_staff"],
        agreementEmployeeIds: ["employee_admin"],
      }),
    });

    expect(createResponse.status).toBe(503);
    const createPayload = errorResponseSchema.parse(await createResponse.json());
    expect(createPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires the operational DB for approval comments", async () => {
    const drafter = await loginAndGetCookie("EMPLOYEE");
    const approver = await loginAndGetCookie("MANAGER");

    const commentsResponse = await app.request(appRoutes.approvals.comments("approval_document_demo"), {
      headers: {
        cookie: drafter.cookie,
      },
    });
    expect(commentsResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await commentsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const createCommentResponse = await app.request(appRoutes.approvals.comments("approval_document_demo"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: approver.cookie,
      },
      body: JSON.stringify({
        body: "참조 확인 후 의견 남깁니다.",
      }),
    });
    expect(createCommentResponse.status).toBe(503);
    const createCommentPayload = errorResponseSchema.parse(await createCommentResponse.json());
    expect(createCommentPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires the operational DB for approval document and inbox lists", async () => {
    const employee = await loginAndGetCookie("EMPLOYEE");
    const approver = await loginAndGetCookie("HR_ADMIN");

    const employeeDocumentsResponse = await app.request(appRoutes.approvals.documents, {
      headers: {
        cookie: employee.cookie,
      },
    });
    expect(employeeDocumentsResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await employeeDocumentsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const approverInboxResponse = await app.request(appRoutes.approvals.inbox, {
      headers: {
        cookie: approver.cookie,
      },
    });
    expect(approverInboxResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await approverInboxResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const employeeInboxResponse = await app.request(appRoutes.approvals.inbox, {
      headers: {
        cookie: employee.cookie,
      },
    });
    expect(employeeInboxResponse.status).toBe(403);
    const employeeInboxPayload = errorResponseSchema.parse(await employeeInboxResponse.json());
    expect(employeeInboxPayload.error.details?.requiredPermission).toBe("approval.document.approve");
  });

  it("requires the operational DB for reference and agreement candidates", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const [referenceResponse, agreementResponse] = await Promise.all([
      app.request(appRoutes.approvals.referenceCandidates, { headers: { cookie } }),
      app.request(appRoutes.approvals.agreementCandidates, { headers: { cookie } }),
    ]);

    expect(referenceResponse.status).toBe(503);
    expect(agreementResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await referenceResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    expect(errorResponseSchema.parse(await agreementResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("blocks self-approval, allows the current approver review once, and forbids replay on the same document", async () => {
    const approver = await loginAndGetCookie("HR_ADMIN");
    const selfApprover = await loginAndGetCookie("MANAGER");

    const selfApproveResponse = await app.request(appRoutes.approvals.approve("approval_document_manager_self"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: selfApprover.cookie,
      },
      body: JSON.stringify({
        reason: "셀프 승인 차단 검증",
      }),
    });

    expect(selfApproveResponse.status).toBe(403);
    const selfApprovePayload = errorResponseSchema.parse(await selfApproveResponse.json());
    expect(selfApprovePayload.error.details?.documentId).toBe("approval_document_manager_self");

    const approveResponse = await app.request(appRoutes.approvals.approve("approval_document_team_pending"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: approver.cookie,
      },
      body: JSON.stringify({
        reason: "예산 범위와 대체 장비 확인 완료",
      }),
    });

    expect(approveResponse.status).toBe(403);
    const approvePayload = errorResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.error.code).toBe("FORBIDDEN");

    const rejectResponse = await app.request(appRoutes.approvals.reject("approval_document_team_pending"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: approver.cookie,
      },
      body: JSON.stringify({
        reason: "증빙 보강 후 재기안 필요",
      }),
    });

    expect(rejectResponse.status).toBe(403);
    const rejectPayload = errorResponseSchema.parse(await rejectResponse.json());
    expect(rejectPayload.error.code).toBe("FORBIDDEN");
  });

  it("requires the operational DB before approval document detail lookup", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const detailResponse = await app.request(appRoutes.approvals.detail("foreign_approval_document"), {
      headers: {
        cookie,
      },
    });
    expect(detailResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await detailResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const approveResponse = await app.request(appRoutes.approvals.approve("foreign_approval_document"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "권한 없는 문서 승인 차단",
      }),
    });
    expect(approveResponse.status).toBe(403);
    const approvePayload = errorResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.error.details?.documentId).toBe("foreign_approval_document");
  });
});

describe("Phase 5 boards/documents skeleton", () => {
  it("requires the operational DB for notices, boards, and board posts", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const noticesResponse = await app.request(appRoutes.boards.notices, {
      headers: { cookie },
    });
    expect(noticesResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await noticesResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const boardsResponse = await app.request(appRoutes.boards.boards, {
      headers: { cookie },
    });
    expect(boardsResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await boardsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const postsResponse = await app.request(appRoutes.boards.posts("board_general"), {
      headers: { cookie },
    });
    expect(postsResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await postsResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const createPostResponse = await app.request(appRoutes.boards.posts("board_general"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "점심 메뉴 추천",
        bodyPreview: "오늘 뭐 드실래요?",
        isNotice: false,
      }),
    });
    expect(createPostResponse.status).toBe(503);
    const createPostPayload = (await createPostResponse.json()) as { error: { code: string } };
    expect(createPostPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("blocks board and document-space management for employees and forbids private document space access", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const createBoardResponse = await app.request(appRoutes.boards.boards, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        boardType: "general",
        name: "자유 게시판",
        slug: "general-2",
        visibility: "company",
        isNoticeOnly: false,
      }),
    });
    expect(createBoardResponse.status).toBe(403);
    const createBoardPayload = errorResponseSchema.parse(await createBoardResponse.json());
    expect(createBoardPayload.error.details?.requiredPermission).toBe("board.manage");

    const createSpaceResponse = await app.request(appRoutes.documents.spaces, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "인사 전용 문서함",
        slug: "hr-private",
        visibility: "private",
        isPublicWithinCompany: false,
      }),
    });
    expect(createSpaceResponse.status).toBe(403);
    const createSpacePayload = errorResponseSchema.parse(await createSpaceResponse.json());
    expect(createSpacePayload.error.details?.requiredPermission).toBe("document.space.manage");

    const listSpacesResponse = await app.request(appRoutes.documents.spaces, {
      headers: { cookie },
    });
    expect(listSpacesResponse.status).toBe(200);
    const listSpacesPayload = documentSpaceListResponseSchema.parse(await listSpacesResponse.json());
    expect(listSpacesPayload.data.items.map((item) => item.id)).toContain("document_space_public");
    expect(listSpacesPayload.data.items.map((item) => item.id)).not.toContain("document_space_hr_private");

    const privateFilesResponse = await app.request(`${appRoutes.documents.files}?spaceId=document_space_hr_private`, {
      headers: { cookie },
    });
    expect(privateFilesResponse.status).toBe(403);
    const privateFilesPayload = errorResponseSchema.parse(await privateFilesResponse.json());
    expect(privateFilesPayload.error.details?.spaceId).toBe("document_space_hr_private");
  });

  it("requires the operational DB before checking notice-only board post writes", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(appRoutes.boards.posts("board_notice"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "공지에 일반 글 작성 시도",
        bodyPreview: "notice-only board should reject employee-authored posts",
        isNotice: false,
      }),
    });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("forbids forged board_post detail lookups even when the board prefix is accessible", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(appRoutes.boards.postDetail("board_post_board_general_forged"), {
      headers: { cookie },
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.postId).toBe("board_post_board_general_forged");
  });

  it("forbids read receipts for forged board_post ids even when the board prefix is accessible", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(appRoutes.readReceipts, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        targetType: "post",
        targetId: "board_post_board_general_forged",
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.targetId).toBe("board_post_board_general_forged");
  });

  it("keeps employees from creating metadata in inaccessible private document spaces", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(appRoutes.documents.fileMetadata, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        spaceId: "document_space_hr_private",
        fileName: "restricted.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 64000,
        versionLabel: "draft-1",
        isPublicWithinCompany: false,
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("forbids metadata creation when document space does not exist", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const response = await app.request(appRoutes.documents.fileMetadata, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        spaceId: "document_space_missing",
        fileName: "restricted.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 64000,
        versionLabel: "draft-1",
        isPublicWithinCompany: false,
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.spaceId).toBe("document_space_missing");
  });

  it.each([
    ["post", "post_missing"],
    ["document_file", "document_file_hr_private"],
  ] as const)("forbids read receipts for inaccessible %s targets", async (targetType, targetId) => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const response = await app.request(appRoutes.readReceipts, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        targetType,
        targetId,
      }),
    });

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.targetId).toBe(targetId);
  });

  it("requires PostgreSQL for admin board and document metadata mutations", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const createBoardResponse = await app.request(appRoutes.boards.boards, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        boardType: "general",
        name: "운영 공지 게시판",
        slug: "ops-updates",
        visibility: "company",
        isNoticeOnly: false,
      }),
    });
    expect(createBoardResponse.status).toBe(503);
    const createBoardPayload = (await createBoardResponse.json()) as { error: { code: string } };
    expect(createBoardPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL for document upload/download/delete mutation records", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const uploadInitResponse = await app.request(
      appRoutes.documents.uploadInit,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          spaceId: "document_space_public",
          fileName: "phase8-plan v1.pdf",
          contentType: "application/pdf",
          fileSize: 1024,
          versionLabel: "draft-1",
          isPublicWithinCompany: false,
        }),
      },
      r2TestBinding,
    );
    expect(uploadInitResponse.status).toBe(503);
    const uploadInitPayload = (await uploadInitResponse.json()) as { error: { code: string } };
    expect(uploadInitPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL before returning r2 document action metadata", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const uploadInitResponse = await app.request(
      appRoutes.documents.uploadInit,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          spaceId: "document_space_public",
          fileName: "phase8-r2.pdf",
          contentType: "application/pdf",
          fileSize: 2048,
          versionLabel: "draft-r2",
          isPublicWithinCompany: false,
        }),
      },
      r2TestBinding,
    );

    expect(uploadInitResponse.status).toBe(503);
    const uploadInitPayload = (await uploadInitResponse.json()) as { error: { code: string } };
    expect(uploadInitPayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("rejects upload-init requests for disallowed mime types and oversized files", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const invalidMimeResponse = await app.request(appRoutes.documents.uploadInit, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        spaceId: "document_space_public",
        fileName: "dangerous.exe",
        contentType: "application/x-msdownload",
        fileSize: 1024,
        versionLabel: "draft-1",
        isPublicWithinCompany: false,
      }),
    });
    expect(invalidMimeResponse.status).toBe(400);
    const invalidMimePayload = errorResponseSchema.parse(await invalidMimeResponse.json());
    expect(invalidMimePayload.error.code).toBe("VALIDATION_ERROR");
    expect(invalidMimePayload.error.details?.contentType).toBe("application/x-msdownload");

    const oversizedResponse = await app.request(appRoutes.documents.uploadInit, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        spaceId: "document_space_public",
        fileName: "too-large.pdf",
        contentType: "application/pdf",
        fileSize: 26 * 1024 * 1024,
        versionLabel: "draft-1",
        isPublicWithinCompany: false,
      }),
    });
    expect(oversizedResponse.status).toBe(400);
    const oversizedPayload = errorResponseSchema.parse(await oversizedResponse.json());
    expect(oversizedPayload.error.code).toBe("VALIDATION_ERROR");
    expect(oversizedPayload.error.details?.maxFileSizeBytes).toBe(25 * 1024 * 1024);
  });

  it("requires PostgreSQL for payroll overview and role-split visibility data", async () => {
    const { cookie: adminCookie } = await loginAndGetCookie("COMPANY_ADMIN");
    const adminResponse = await app.request(appRoutes.payroll.overview, { headers: { cookie: adminCookie } });
    expect(adminResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await adminResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: managerCookie } = await loginAndGetCookie("MANAGER");
    const managerResponse = await app.request(appRoutes.payroll.overview, { headers: { cookie: managerCookie } });
    expect(managerResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await managerResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: employeeCookie } = await loginAndGetCookie("EMPLOYEE");
    const employeeResponse = await app.request(appRoutes.payroll.overview, { headers: { cookie: employeeCookie } });
    expect(employeeResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await employeeResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("requires PostgreSQL for payroll period detail and self payslip data", async () => {
    const { cookie: adminCookie } = await loginAndGetCookie("COMPANY_ADMIN");
    const detailResponse = await app.request(appRoutes.payroll.periodDetail("payroll_period_2026_05"), {
      headers: { cookie: adminCookie },
    });
    expect(detailResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await detailResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");

    const { cookie: employeeCookie } = await loginAndGetCookie("EMPLOYEE");
    const payslipResponse = await app.request(appRoutes.payroll.myPayslip, { headers: { cookie: employeeCookie } });
    expect(payslipResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await payslipResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("blocks payroll payslip access for roles without self payslip permission", async () => {
    const { cookie } = await loginAndGetCookie("MANAGER");
    const response = await app.request(appRoutes.payroll.myPayslip, { headers: { cookie } });
    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
  });
});
