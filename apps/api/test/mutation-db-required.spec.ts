import { describe, expect, it } from "vitest";

import { appRoutes } from "@gw/shared";
import { app } from "../src/app";

async function loginAndGetCookie(role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });

  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("missing cookie");
  return cookie;
}

const allowedNonSuccessCodes = new Set(["DB_NOT_CONFIGURED", "EXTERNAL_AUTH_NOT_CONFIGURED", "VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND", "NOT_IMPLEMENTED", "USER_NOT_FOUND"]);

async function expectNoFakeSuccess(response: Response) {
  const payload = (await response.json()) as {
    ok: boolean;
    data: unknown;
    error?: { code?: string };
  };

  expect(response.status).not.toBe(200);
  expect(response.status).not.toBe(201);
  expect(payload).toMatchObject({
    ok: false,
    data: null,
  });
  expect(allowedNonSuccessCodes.has(payload.error?.code ?? "")).toBe(true);
  expect(JSON.stringify(payload)).not.toMatch(/placeholder|mock|memory|in-memory|dummy|fake/i);
}

describe("mutation APIs require real persistence", () => {
  it.each([
    ["attendance check-in", appRoutes.attendance.checkIn, { method: "pc", note: "출근" }],
    ["attendance check-out", appRoutes.attendance.checkOut, { note: "퇴근" }],
    ["attendance correction", appRoutes.attendance.corrections, { recordId: "attendance_record_1", reason: "정정 요청" }],
    ["leave request", appRoutes.leave.requests, { leaveTypeId: "annual", startDate: "2026-07-01", endDate: "2026-07-01", reason: "휴가" }],
    ["approval document", appRoutes.approvals.documents, { formId: "approval_form_vacation", title: "결재", body: "본문" }],
    ["board post", appRoutes.boards.posts("board_general"), { title: "게시글", bodyPreview: "본문", isNotice: false }],
    ["mail send", appRoutes.mail.send, { toUserIds: ["user_employee"], subject: "메일", body: "본문" }],
    ["auth registration request", appRoutes.auth.registrationRequests, { companyId: "company_demo", loginName: "new.user", email: "new.user@example.com", displayName: "신규 사용자", initialPassword: "ChangeMe1234!", userType: "INTERNAL_STAFF" }],
    ["admin user create", appRoutes.admin.userCreate, { fullName: "신규 사용자", email: "new.user@example.com", initialPassword: "ChangeMe1234!", departmentName: "경영지원팀", branchName: "본사", accountType: "employee", roleCode: "EMPLOYEE", status: "invited", reason: "신규 입사" }],
  ])("does not return fake success for %s when DB is not configured", async (_label, route, body) => {
    const cookie = await loginAndGetCookie();
    const response = await app.request(route, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });

    await expectNoFakeSuccess(response);
  });

  it.each([
    ["leave approve", appRoutes.leave.approve("leave_request_missing")],
    ["leave reject", appRoutes.leave.reject("leave_request_missing")],
    ["approval approve", appRoutes.approvals.approve("approval_document_missing")],
    ["approval reject", appRoutes.approvals.reject("approval_document_missing")],
    ["mail mark read", appRoutes.mail.markRead("mail_message_missing")],
    ["admin registration approve", appRoutes.admin.registrationRequestApprove("zitadel_reg_missing")],
  ])("does not return fake success for %s when DB is not configured", async (_label, route) => {
    const cookie = await loginAndGetCookie();
    const response = await app.request(route, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ reason: "검토" }),
    });

    await expectNoFakeSuccess(response);
  });

  it("does not return fake success for admin registration request list when DB is not configured", async () => {
    const cookie = await loginAndGetCookie();
    const response = await app.request(appRoutes.admin.registrationRequests, {
      method: "GET",
      headers: { cookie },
    });

    await expectNoFakeSuccess(response);
  });
});
