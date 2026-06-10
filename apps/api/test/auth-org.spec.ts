import { describe, expect, it } from "vitest";
import {
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
  authLoginResponseSchema,
  createInviteResponseSchema,
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
} from "@gw/shared";
import { app } from "../src/app";

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
  it("allows employee to check in and check out with placeholder attendance contract", async () => {
    const { cookie } = await loginAndGetCookie("EMPLOYEE");

    const checkInResponse = await app.request(appRoutes.attendance.checkIn, {
      method: "POST",
      headers: {
        cookie,
      },
    });

    expect(checkInResponse.status).toBe(201);
    const checkInPayload = attendanceActionResponseSchema.parse(await checkInResponse.json());
    expect(checkInPayload.data.record.status).toBe("checked_in");
    expect(checkInPayload.data.audit.action).toBe("attendance.check_in");

    const checkOutResponse = await app.request(appRoutes.attendance.checkOut, {
      method: "POST",
      headers: {
        cookie,
      },
    });

    expect(checkOutResponse.status).toBe(200);
    const checkOutPayload = attendanceActionResponseSchema.parse(await checkOutResponse.json());
    expect(checkOutPayload.data.record.status).toBe("checked_out");
    expect(checkOutPayload.data.record.checkOutAt).not.toBeNull();
    expect(checkOutPayload.data.audit.action).toBe("attendance.check_out");
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

    const approverInboxResponse = await app.request(appRoutes.approvals.inbox, {
      headers: {
        cookie: approver.cookie,
      },
    });
    expect(approverInboxResponse.status).toBe(200);
    const approverInboxPayload = approvalInboxResponseSchema.parse(await approverInboxResponse.json());
    expect(approverInboxPayload.data.items.map((item) => item.id)).toContain("approval_document_team_pending");

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
