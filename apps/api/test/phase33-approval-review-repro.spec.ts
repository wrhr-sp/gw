import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appRoutes,
  approvalActionResponseSchema,
  approvalDocumentDetailResponseSchema,
  approvalInboxResponseSchema,
  errorResponseSchema,
} from "@gw/shared";

async function getFreshApp() {
  const mod = await import("../src/app");
  return mod.app;
}

async function loginAndGetCookie(
  app: Awaited<ReturnType<typeof getFreshApp>>,
  role: "STAFF" | "HR_ADMIN" | "MANAGER",
) {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });

  const cookie = response.headers.get("set-cookie");
  expect(cookie).toBeTruthy();
  return cookie as string;
}

describe("Phase 33 approval review authorization regression", () => {
  afterEach(() => {
    vi.doUnmock("../src/lib/postgres");
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks readable-only users and lets the pending approver finish a single-step document", async () => {
    const app = await getFreshApp();
    const [referenceCookie, agreementCookie, approverCookie] = await Promise.all([
      loginAndGetCookie(app, "STAFF"),
      loginAndGetCookie(app, "HR_ADMIN"),
      loginAndGetCookie(app, "MANAGER"),
    ]);

    const referenceApproveResponse = await app.request(appRoutes.approvals.approve("approval_document_demo"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: referenceCookie,
      },
      body: JSON.stringify({ reason: "reference should not approve" }),
    });
    expect(referenceApproveResponse.status).toBe(403);
    const referenceApprovePayload = errorResponseSchema.parse(await referenceApproveResponse.json());
    expect(referenceApprovePayload.error.details?.documentId).toBe("approval_document_demo");

    const agreementApproveResponse = await app.request(appRoutes.approvals.approve("approval_document_demo"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: agreementCookie,
      },
      body: JSON.stringify({ reason: "agreement should not approve" }),
    });
    expect(agreementApproveResponse.status).toBe(403);
    const agreementApprovePayload = errorResponseSchema.parse(await agreementApproveResponse.json());
    expect(agreementApprovePayload.error.details?.documentId).toBe("approval_document_demo");

    const firstApproveResponse = await app.request(appRoutes.approvals.approve("approval_document_demo"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: approverCookie,
      },
      body: JSON.stringify({ reason: "pending approver can approve" }),
    });
    expect(firstApproveResponse.status).toBe(503);
    const firstApprovePayload = errorResponseSchema.parse(await firstApproveResponse.json());
    expect(firstApprovePayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("only exposes the current pending approver in inbox and requires all steps before approval completion", async () => {
    const app = await getFreshApp();
    const [managerCookie, hrCookie] = await Promise.all([
      loginAndGetCookie(app, "MANAGER"),
      loginAndGetCookie(app, "HR_ADMIN"),
    ]);

    const hrInboxBeforeResponse = await app.request(appRoutes.approvals.inbox, {
      headers: { cookie: hrCookie },
    });
    expect(hrInboxBeforeResponse.status).toBe(200);
    const hrInboxBeforePayload = approvalInboxResponseSchema.parse(await hrInboxBeforeResponse.json());
    expect(hrInboxBeforePayload.data.items.some((item) => item.id === "approval_document_multistep")).toBe(false);

    const hrApproveBeforeResponse = await app.request(appRoutes.approvals.approve("approval_document_multistep"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: hrCookie,
      },
      body: JSON.stringify({ reason: "step2 must wait" }),
    });
    expect(hrApproveBeforeResponse.status).toBe(403);

    const managerInboxResponse = await app.request(appRoutes.approvals.inbox, {
      headers: { cookie: managerCookie },
    });
    expect(managerInboxResponse.status).toBe(200);
    const managerInboxPayload = approvalInboxResponseSchema.parse(await managerInboxResponse.json());
    expect(managerInboxPayload.data.items.some((item) => item.id === "approval_document_multistep")).toBe(true);

    const managerApproveResponse = await app.request(appRoutes.approvals.approve("approval_document_multistep"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: managerCookie,
      },
      body: JSON.stringify({ reason: "step1 approved" }),
    });
    expect(managerApproveResponse.status).toBe(503);
    const managerApprovePayload = errorResponseSchema.parse(await managerApproveResponse.json());
    expect(managerApprovePayload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  it("returns null without changing document status when the acting approver has no current pending step", async () => {
    const sqlMock = Object.assign(vi.fn(), {
      query: vi.fn().mockResolvedValueOnce([]),
    });

    vi.resetModules();
    vi.doMock("../src/lib/postgres", () => ({
      createOperationalSql: () => sqlMock,
    }));

    const { updateOperationalApprovalDocumentDecision } = await import("../src/lib/operational-workflows");

    const result = await updateOperationalApprovalDocumentDecision({} as never, {
      companyId: "company_demo",
      documentId: "approval_document_demo",
      approverEmployeeId: "employee_manager",
      decision: "approved",
      reason: "pending step missing",
      reviewedBy: "user_manager",
    });

    expect(result).toBeNull();
    expect(sqlMock).toHaveBeenCalledTimes(1);
    expect(sqlMock.query).not.toHaveBeenCalled();
  });
});
