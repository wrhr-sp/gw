import { describe, expect, it } from "vitest";
import {
  adminAuditLogListResponseSchema,
  adminPoliciesListResponseSchema,
  adminPolicyUpdateResponseSchema,
  adminUsersListResponseSchema,
  appRoutes,
  approvalActionResponseSchema,
  approvalCandidateListResponseSchema,
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
  leaveActionResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateResponseSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  meResponseSchema,
  noticeListResponseSchema,
  readReceiptCreateResponseSchema,
  type AttendanceRegistrationMethod,
  type AttendanceRegistrationPolicy,
} from "@gw/shared";
import { app, isAttendanceRegistrationMethodAllowed } from "../src/app";

async function loginAndGetCookie(role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "placeholder-password",
    }),
  });

  const cookie = response.headers.get("set-cookie");

  if (!cookie) {
    throw new Error("expected login response to include set-cookie header");
  }

  return { response, cookie };
}

function assertListPayload(route: string, payload: unknown) {
  switch (route) {
    case appRoutes.org.employees:
      return listEmployeesResponseSchema.parse(payload);
    case appRoutes.org.departments:
      return listDepartmentsResponseSchema.parse(payload);
    case appRoutes.org.roles:
      return listRolesResponseSchema.parse(payload);
    case appRoutes.org.permissions:
      return listPermissionsResponseSchema.parse(payload);
    default:
      throw new Error(`unexpected route: ${route}`);
  }
}

describe("Phase 2 auth/org skeleton", () => {
  it("logs in with placeholder auth and returns shared contract", async () => {
    const { response } = await loginAndGetCookie();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");

    const payload = authLoginResponseSchema.parse(await response.json());

    expect(payload.data.session.placeholder).toBe(true);
    expect(payload.data.user.roleCodes).toContain("COMPANY_ADMIN");
  });

  it("rejects me when no auth cookie is present", async () => {
    const response = await app.request(appRoutes.me);
    expect(response.status).toBe(401);

    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("AUTH_REQUIRED");
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

    expect(permissionsResponse.status).toBe(200);
    const permissionsPayload = listPermissionsResponseSchema.parse(await permissionsResponse.json());
    expect(permissionsPayload.data.items.some((item) => item.code === "invite.manage")).toBe(true);
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

  it("creates placeholder invite skeleton for admins", async () => {
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

    expect(response.status).toBe(201);
    const payload = createInviteResponseSchema.parse(await response.json());
    expect(payload.data.status).toBe("pending_delivery");
    expect(payload.data.audit.action).toBe("admin.invite.create");
  });

  it("returns employee directory summaries, filters, and admin-boundary notices", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const response = await app.request(`${appRoutes.org.employees}?departmentId=department_ops&employmentStatus=active&roleCode=MANAGER`, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    const payload = listEmployeesResponseSchema.parse(await response.json());
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]?.id).toBe("employee_manager");
    expect(payload.data.summaries[0]?.departmentName).toBe("운영팀");
    expect(payload.data.summaries[0]?.roleSummary).toContain("MANAGER");
    expect(payload.data.filters.departmentId).toBe("department_ops");
    expect(payload.data.filters.employmentStatus).toBe("active");
    expect(payload.data.filters.roleCode).toBe("MANAGER");
    expect(payload.data.filterOptions.departments.some((item) => item.name === "운영팀")).toBe(true);
    expect(payload.data.notices.some((item) => item.includes("/admin/users"))).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("invite.manage");
  });

  it("keeps admin-only roles out of the general employee directory for non-admin viewers", async () => {
    const { cookie } = await loginAndGetCookie("MANAGER");

    const response = await app.request(`${appRoutes.org.employees}?roleCode=COMPANY_ADMIN`, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    const payload = listEmployeesResponseSchema.parse(await response.json());
    expect(payload.data.items.some((item) => item.id === "employee_admin")).toBe(false);
    expect(payload.data.summaries.some((item) => item.roleSummary.includes("COMPANY_ADMIN"))).toBe(false);
    expect(payload.data.summaries.some((item) => item.roleSummary.includes("HR_ADMIN"))).toBe(false);
    expect(payload.data.filterOptions.roleCodes).toEqual(["MANAGER", "EMPLOYEE"]);
    expect(payload.data.filters.roleCode).toBeUndefined();
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

  it("lists admin users only for admin roles with permission catalog access", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const response = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    const payload = adminUsersListResponseSchema.parse(await response.json());
    expect(payload.data.items.some((item) => item.roleCodes.includes("COMPANY_ADMIN"))).toBe(true);
    expect(payload.data.items[0]?.highRiskPermissions.length).toBeGreaterThan(0);
    expect(payload.data.items[0]?.roleChangePreview.auditCandidate).toBe(true);
    expect(payload.data.linkedScreens.some((item) => item.source === "/dashboard")).toBe(true);
    expect(payload.data.audit.action).toBe("admin.user.list.viewed");
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

    expect(readResponse.status).toBe(200);
    const readPayload = adminAuditLogListResponseSchema.parse(await readResponse.json());
    expect(readPayload.data.items.length).toBeGreaterThan(0);
    expect(readPayload.data.filterOptions.categories).toContain("policy");
    expect(readPayload.data.detailPreview.reasonRequired).toBe(true);
    expect(readPayload.data.items[0]?.metadata.maskedFields.length).toBeGreaterThan(0);
    expect(readPayload.data.operationalTrail.blockedReasons.some((item) => item.category === "placeholder")).toBe(true);
    expect(JSON.stringify(readPayload)).not.toContain("storageKey");
    expect(JSON.stringify(readPayload)).not.toContain("bucket");

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

  it("filters admin audit logs by createdFrom and createdTo query params", async () => {
    const { cookie } = await loginAndGetCookie("AUDITOR");

    const createdFromResponse = await app.request(
      `${appRoutes.admin.auditLogs}?createdFrom=2026-06-10T09:00:00.000Z`,
      {
        headers: {
          cookie,
        },
      },
    );

    expect(createdFromResponse.status).toBe(200);
    const createdFromPayload = adminAuditLogListResponseSchema.parse(await createdFromResponse.json());
    expect(createdFromPayload.data.items).toHaveLength(2);

    const createdToResponse = await app.request(
      `${appRoutes.admin.auditLogs}?createdTo=2026-06-10T08:59:59.999Z`,
      {
        headers: {
          cookie,
        },
      },
    );

    expect(createdToResponse.status).toBe(200);
    const createdToPayload = adminAuditLogListResponseSchema.parse(await createdToResponse.json());
    expect(createdToPayload.data.items).toHaveLength(0);

    const boundedResponse = await app.request(
      `${appRoutes.admin.auditLogs}?category=policy&createdFrom=2026-06-10T09:00:00.000Z&createdTo=2026-06-10T09:00:00.000Z`,
      {
        headers: {
          cookie,
        },
      },
    );

    expect(boundedResponse.status).toBe(200);
    const boundedPayload = adminAuditLogListResponseSchema.parse(await boundedResponse.json());
    expect(boundedPayload.data.items).toHaveLength(1);
    expect(boundedPayload.data.items[0]?.id).toBe("audit_admin_policy_document_1");
    expect(boundedPayload.data.filters.createdFrom).toBe("2026-06-10T09:00:00.000Z");
    expect(boundedPayload.data.filters.createdTo).toBe("2026-06-10T09:00:00.000Z");
  });

  it.each([
    ["employees list", appRoutes.org.employees, "employee.read", "MANAGER"],
    ["departments list", appRoutes.org.departments, "department.read", "MANAGER"],
    ["roles list", appRoutes.org.roles, "role.read", "MANAGER"],
    ["permissions list", appRoutes.org.permissions, "permission.read", "HR_ADMIN"],
  ])("allows authorized roles to read %s", async (_label, route, _requiredPermission, role) => {
    const { cookie } = await loginAndGetCookie(role);

    const response = await app.request(route, {
      headers: {
        cookie,
      },
    });

    expect(response.status).toBe(200);
    assertListPayload(route, await response.json());
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

    expect(payload.data.bridgeSummary.currentState).toContain("1차 bridge");
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

    expect(employeeAllowed.status).toBe(201);
    const employeeAllowedPayload = attendanceActionResponseSchema.parse(await employeeAllowed.json());
    expect(employeeAllowedPayload.data.record.status).toBe("checked_in");

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

    expect(managerAllowed.status).toBe(200);
    const managerAllowedPayload = attendanceActionResponseSchema.parse(await managerAllowed.json());
    expect(managerAllowedPayload.data.record.status).toBe("checked_out");
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

    expect(correctionResponse.status).toBe(201);
    const correctionPayload = attendanceCorrectionResponseSchema.parse(await correctionResponse.json());
    expect(correctionPayload.data.request.status).toBe("requested");
    expect(correctionPayload.data.audit.action).toBe("attendance.correction.request");
  });

  it("returns leave types, balances, and requests for request-capable roles", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const [typesResponse, balancesResponse, requestsResponse] = await Promise.all([
      app.request(appRoutes.leave.types, { headers: { cookie } }),
      app.request(appRoutes.leave.balances, { headers: { cookie } }),
      app.request(appRoutes.leave.requests, { headers: { cookie } }),
    ]);

    expect(typesResponse.status).toBe(200);
    expect(balancesResponse.status).toBe(200);
    expect(requestsResponse.status).toBe(200);

    const typesPayload = leaveTypeListResponseSchema.parse(await typesResponse.json());
    const balancesPayload = leaveBalanceListResponseSchema.parse(await balancesResponse.json());
    const requestsPayload = leaveRequestListResponseSchema.parse(await requestsResponse.json());

    expect(typesPayload.data.items.some((item) => item.code === "annual")).toBe(true);
    expect(balancesPayload.data.items[0]?.remainingDays).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(requestsPayload.data.items)).toBe(true);
    expect(requestsPayload.data.items).toHaveLength(1);
    expect(requestsPayload.data.items[0]?.id).toBe("leave_request_demo");
    expect(typesPayload.data.policyContext.blockedReasons.some((item) => item.category === "policy")).toBe(true);
    expect(balancesPayload.data.policyContext.currentState).toContain("휴가 정책");
    expect(requestsPayload.data.policyContext.sourceLabel).toContain("/leave");
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

    expect(createResponse.status).toBe(201);
    const createPayload = leaveRequestCreateResponseSchema.parse(await createResponse.json());
    expect(createPayload.data.request.approvalStatus).toBe("pending");
    expect(createPayload.data.policyContext.placeholderNote).toContain("실제 급여 반영");
    expect(createPayload.data.audit.action).toBe("leave.request.create");

    const approveResponse = await app.request(appRoutes.leave.approve(createPayload.data.request.id), {
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

  it("allows approvers to approve and reject subordinate placeholder leave requests", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const requestsResponse = await app.request(appRoutes.leave.requests, {
      headers: {
        cookie,
      },
    });

    expect(requestsResponse.status).toBe(200);
    const requestsPayload = leaveRequestListResponseSchema.parse(await requestsResponse.json());
    expect(requestsPayload.data.items.map((item) => item.id)).toEqual([
      "leave_request_demo",
      "leave_request_team_pending",
    ]);

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

    expect(approveResponse.status).toBe(200);
    const approvePayload = leaveActionResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.data.request.approvalStatus).toBe("approved");
    expect(approvePayload.data.audit.action).toBe("leave.request.approve");
    expect(approvePayload.data.request.requestedBy).toBe("user_employee");
    expect(approvePayload.data.request.reviewedBy).toBe("user_hr_admin");

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

    expect(rejectResponse.status).toBe(200);
    const rejectPayload = leaveActionResponseSchema.parse(await rejectResponse.json());
    expect(rejectPayload.data.request.approvalStatus).toBe("rejected");
    expect(rejectPayload.data.audit.action).toBe("leave.request.reject");
    expect(rejectPayload.data.request.requestedBy).toBe("user_employee");
    expect(rejectPayload.data.request.reviewedBy).toBe("user_hr_admin");
  });
});

describe("Phase 4 approvals skeleton", () => {
  it("lists approval forms and lines for document writers", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const [formsResponse, linesResponse] = await Promise.all([
      app.request(appRoutes.approvals.forms, { headers: { cookie } }),
      app.request(appRoutes.approvals.lines, { headers: { cookie } }),
    ]);

    expect(formsResponse.status).toBe(200);
    expect(linesResponse.status).toBe(200);

    const formsPayload = approvalFormListResponseSchema.parse(await formsResponse.json());
    const linesPayload = approvalLineListResponseSchema.parse(await linesResponse.json());

    expect(formsPayload.data.items[0]?.companyId).toBe("company_demo");
    expect(linesPayload.data.items[0]?.steps[0]?.approverEmployeeId).toBe("employee_manager");
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

    expect(createResponse.status).toBe(201);
    const createPayload = approvalDocumentCreateResponseSchema.parse(await createResponse.json());
    expect(createPayload.data.document.status).toBe("pending_approval");
    expect(createPayload.data.operationalContext.currentState).toContain("전자결재");
    expect(createPayload.data.audit.action).toBe("approval.document.create");

    const detailResponse = await app.request(appRoutes.approvals.detail(createPayload.data.document.id), {
      headers: {
        cookie,
      },
    });

    expect(detailResponse.status).toBe(200);
    const detailPayload = approvalDocumentDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.document.id).toBe(createPayload.data.document.id);
    expect(detailPayload.data.references.map((item) => item.referenceType)).toContain("reference");
    expect(detailPayload.data.operationalContext.blockedReasons.some((item) => item.category === "company_scope")).toBe(true);
  });

  it("separates my drafts and approval inbox scopes", async () => {
    const employee = await loginAndGetCookie("EMPLOYEE");
    const approver = await loginAndGetCookie("HR_ADMIN");

    const employeeDocumentsResponse = await app.request(appRoutes.approvals.documents, {
      headers: {
        cookie: employee.cookie,
      },
    });
    expect(employeeDocumentsResponse.status).toBe(200);
    const employeeDocumentsPayload = approvalDocumentListResponseSchema.parse(await employeeDocumentsResponse.json());
    expect(employeeDocumentsPayload.data.items.map((item) => item.id)).toContain("approval_document_demo");
    expect(employeeDocumentsPayload.data.items.map((item) => item.id)).not.toContain("approval_document_team_pending");
    expect(employeeDocumentsPayload.data.operationalContext.sourceLabel).toContain("/approvals");

    const approverInboxResponse = await app.request(appRoutes.approvals.inbox, {
      headers: {
        cookie: approver.cookie,
      },
    });
    expect(approverInboxResponse.status).toBe(200);
    const approverInboxPayload = approvalInboxResponseSchema.parse(await approverInboxResponse.json());
    expect(approverInboxPayload.data.items.map((item) => item.id)).toContain("approval_document_team_pending");
    expect(approverInboxPayload.data.operationalContext.blockedReasons.some((item) => item.category === "permission")).toBe(true);

    const employeeInboxResponse = await app.request(appRoutes.approvals.inbox, {
      headers: {
        cookie: employee.cookie,
      },
    });
    expect(employeeInboxResponse.status).toBe(403);
    const employeeInboxPayload = errorResponseSchema.parse(await employeeInboxResponse.json());
    expect(employeeInboxPayload.error.details?.requiredPermission).toBe("approval.document.approve");
  });

  it("lists reference and agreement candidates inside the same company", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const [referenceResponse, agreementResponse] = await Promise.all([
      app.request(appRoutes.approvals.referenceCandidates, { headers: { cookie } }),
      app.request(appRoutes.approvals.agreementCandidates, { headers: { cookie } }),
    ]);

    expect(referenceResponse.status).toBe(200);
    expect(agreementResponse.status).toBe(200);

    const referencePayload = approvalCandidateListResponseSchema.parse(await referenceResponse.json());
    const agreementPayload = approvalCandidateListResponseSchema.parse(await agreementResponse.json());

    expect(referencePayload.data.items.every((item) => item.companyId === "company_demo")).toBe(true);
    expect(referencePayload.data.items.every((item) => item.type === "reference")).toBe(true);
    expect(agreementPayload.data.items.every((item) => item.type === "agreement")).toBe(true);
  });

  it("blocks self-approval and allows approvers to approve or reject reviewable documents", async () => {
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

    expect(approveResponse.status).toBe(200);
    const approvePayload = approvalActionResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.data.document.status).toBe("approved");
    expect(approvePayload.data.operationalContext.placeholderNote).toContain("실제 저장/발송 없이");
    expect(approvePayload.data.audit.action).toBe("approval.document.approve");

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

    expect(rejectResponse.status).toBe(200);
    const rejectPayload = approvalActionResponseSchema.parse(await rejectResponse.json());
    expect(rejectPayload.data.document.status).toBe("rejected");
    expect(rejectPayload.data.audit.action).toBe("approval.document.reject");
  });

  it("forbids unknown approval document ids", async () => {
    const { cookie } = await loginAndGetCookie("HR_ADMIN");

    const detailResponse = await app.request(appRoutes.approvals.detail("foreign_approval_document"), {
      headers: {
        cookie,
      },
    });
    expect(detailResponse.status).toBe(403);
    const detailPayload = errorResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.error.details?.documentId).toBe("foreign_approval_document");

    const approveResponse = await app.request(appRoutes.approvals.approve("foreign_approval_document"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        reason: "존재하지 않는 문서",
      }),
    });
    expect(approveResponse.status).toBe(403);
    const approvePayload = errorResponseSchema.parse(await approveResponse.json());
    expect(approvePayload.error.details?.documentId).toBe("foreign_approval_document");
  });
});

describe("Phase 5 boards/documents skeleton", () => {
  it("lists notices and boards and lets employees create posts, comments, and read receipts in accessible boards", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const noticesResponse = await app.request(appRoutes.boards.notices, {
      headers: { cookie },
    });
    expect(noticesResponse.status).toBe(200);
    const noticesPayload = noticeListResponseSchema.parse(await noticesResponse.json());
    expect(noticesPayload.data.items.every((item) => item.boardType === "notice")).toBe(true);

    const boardsResponse = await app.request(appRoutes.boards.boards, {
      headers: { cookie },
    });
    expect(boardsResponse.status).toBe(200);
    const boardsPayload = boardsListResponseSchema.parse(await boardsResponse.json());
    expect(boardsPayload.data.items.map((item) => item.id)).toContain("board_general");

    const postsResponse = await app.request(appRoutes.boards.posts("board_general"), {
      headers: { cookie },
    });
    expect(postsResponse.status).toBe(200);
    const postsPayload = boardPostListResponseSchema.parse(await postsResponse.json());
    expect(postsPayload.data.board.id).toBe("board_general");

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
    expect(createPostResponse.status).toBe(201);
    const createPostPayload = boardPostCreateResponseSchema.parse(await createPostResponse.json());
    expect(createPostPayload.data.post.boardId).toBe("board_general");
    expect(createPostPayload.data.audit.action).toBe("board.post.create");

    const detailResponse = await app.request(appRoutes.boards.postDetail(createPostPayload.data.post.id), {
      headers: { cookie },
    });
    expect(detailResponse.status).toBe(200);
    const detailPayload = boardPostDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.post.id).toBe(createPostPayload.data.post.id);

    const createCommentResponse = await app.request(appRoutes.boards.comments(createPostPayload.data.post.id), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        body: "오늘은 비빔밥이요.",
      }),
    });
    expect(createCommentResponse.status).toBe(201);
    const createCommentPayload = boardCommentCreateResponseSchema.parse(await createCommentResponse.json());
    expect(createCommentPayload.data.comment.postId).toBe(createPostPayload.data.post.id);

    const commentsResponse = await app.request(appRoutes.boards.comments(createPostPayload.data.post.id), {
      headers: { cookie },
    });
    expect(commentsResponse.status).toBe(200);
    const commentsPayload = boardCommentListResponseSchema.parse(await commentsResponse.json());
    expect(commentsPayload.data.items.map((item) => item.id)).toContain(createCommentPayload.data.comment.id);

    const receiptResponse = await app.request(appRoutes.readReceipts, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        targetType: "post",
        targetId: createPostPayload.data.post.id,
      }),
    });
    expect(receiptResponse.status).toBe(201);
    const receiptPayload = readReceiptCreateResponseSchema.parse(await receiptResponse.json());
    expect(receiptPayload.data.receipt.targetId).toBe(createPostPayload.data.post.id);
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

  it("blocks employees from writing posts into notice-only boards", async () => {
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

    expect(response.status).toBe(403);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.boardId).toBe("board_notice");
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

  it("lets admins manage boards and document metadata without exposing storage keys", async () => {
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
    expect(createBoardResponse.status).toBe(201);
    const createBoardPayload = boardResponseSchema.parse(await createBoardResponse.json());
    expect(createBoardPayload.data.board.slug).toBe("ops-updates");

    const createSpaceResponse = await app.request(appRoutes.documents.spaces, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "운영 문서함",
        slug: "ops-docs",
        visibility: "company",
        isPublicWithinCompany: true,
      }),
    });
    expect(createSpaceResponse.status).toBe(201);
    const createSpacePayload = documentSpaceResponseSchema.parse(await createSpaceResponse.json());
    expect(createSpacePayload.data.space.slug).toBe("ops-docs");

    const filesResponse = await app.request(appRoutes.documents.files, {
      headers: { cookie },
    });
    expect(filesResponse.status).toBe(200);
    const filesPayload = documentFileListResponseSchema.parse(await filesResponse.json());
    expect(filesPayload.data.items.length).toBeGreaterThan(0);

    const metadataResponse = await app.request(appRoutes.documents.fileMetadata, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        spaceId: createSpacePayload.data.space.id,
        fileName: "board-outline.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 64000,
        versionLabel: "draft-1",
        isPublicWithinCompany: false,
      }),
    });
    expect(metadataResponse.status).toBe(201);
    const metadataPayload = documentFileMetadataCreateResponseSchema.parse(await metadataResponse.json());
    expect(metadataPayload.data.file.spaceId).toBe(createSpacePayload.data.space.id);
    expect(Object.prototype.hasOwnProperty.call(metadataPayload.data.file, "storageKey")).toBe(false);
  });

  it("creates upload/download/delete placeholder actions without exposing raw storage internals", async () => {
    const { cookie } = await loginAndGetCookie("COMPANY_ADMIN");

    const uploadInitResponse = await app.request(appRoutes.documents.uploadInit, {
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
    });
    expect(uploadInitResponse.status).toBe(201);
    const uploadInitPayload = documentFileUploadInitResponseSchema.parse(await uploadInitResponse.json());
    expect(uploadInitPayload.data.file.spaceId).toBe("document_space_public");
    expect(uploadInitPayload.data.file.storageStatus).toBe("pending");
    expect(uploadInitPayload.data.file.versionId).toMatch(/^document_version_/);
    expect(uploadInitPayload.data.action.kind).toMatch(/upload/);
    expect(uploadInitPayload.data.action.objectKeyPreview).toContain("companies/company_demo/spaces/document_space_public/files/");
    expect(uploadInitPayload.data.action.objectKeyPreview).not.toContain("phase8-plan v1.pdf");
    expect(uploadInitPayload.data.action.objectKeyPreview).not.toContain(" ");
    expect(Object.prototype.hasOwnProperty.call(uploadInitPayload.data.action, "storageKey")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(uploadInitPayload.data.action, "bucketName")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(uploadInitPayload.data.action, "publicUrl")).toBe(false);

    const uploadCompleteResponse = await app.request(
      appRoutes.documents.uploadComplete(uploadInitPayload.data.file.id),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          uploadToken: uploadInitPayload.data.action.uploadToken,
          checksumSha256: "a".repeat(64),
        }),
      },
    );
    expect(uploadCompleteResponse.status).toBe(200);
    const uploadCompletePayload = documentFileUploadCompleteResponseSchema.parse(await uploadCompleteResponse.json());
    expect(uploadCompletePayload.data.file.storageStatus).toBe("ready");
    expect(uploadCompletePayload.data.file.checksumSha256).toBe("a".repeat(64));

    const downloadInitResponse = await app.request(
      appRoutes.documents.downloadInit(uploadInitPayload.data.file.id),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
      },
    );
    expect(downloadInitResponse.status).toBe(200);
    const downloadInitPayload = documentFileDownloadInitResponseSchema.parse(await downloadInitResponse.json());
    expect(downloadInitPayload.data.file.id).toBe(uploadInitPayload.data.file.id);
    expect(downloadInitPayload.data.action.kind).toMatch(/download/);
    expect(downloadInitPayload.data.action.downloadToken).toBeTruthy();

    const deleteResponse = await app.request(appRoutes.documents.deleteFile(uploadInitPayload.data.file.id), {
      method: "DELETE",
      headers: { cookie },
    });
    expect(deleteResponse.status).toBe(200);
    const deletePayload = documentFileDeleteResponseSchema.parse(await deleteResponse.json());
    expect(deletePayload.data.file.status).toBe("archived");
    expect(deletePayload.data.file.storageStatus).toBe("deleted");
  });

  it("uses the request FILES_BUCKET binding to switch document actions to the r2 placeholder provider", async () => {
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
      {
        FILES_BUCKET: {
          head: async () => null,
          get: async () => null,
          put: async () => null,
          delete: async () => undefined,
        },
      },
    );

    expect(uploadInitResponse.status).toBe(201);
    const uploadInitPayload = documentFileUploadInitResponseSchema.parse(await uploadInitResponse.json());
    expect(uploadInitPayload.data.file.storageProvider).toBe("r2");
    expect(uploadInitPayload.data.action.provider).toBe("r2");
    expect(uploadInitPayload.data.action.kind).toBe("r2-upload-placeholder");
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
});
