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
    expect(firstApproveResponse.status).toBe(200);
    const firstApprovePayload = approvalActionResponseSchema.parse(await firstApproveResponse.json());
    expect(firstApprovePayload.data.document.status).toBe("approved");

    const detailResponse = await app.request(appRoutes.approvals.detail("approval_document_demo"), {
      headers: {
        cookie: approverCookie,
      },
    });
    expect(detailResponse.status).toBe(200);
    const detailPayload = approvalDocumentDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.document.status).toBe("approved");
    expect(detailPayload.data.steps).toHaveLength(1);
    expect(detailPayload.data.steps[0]?.decisionStatus).toBe("approved");
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
    expect(managerApproveResponse.status).toBe(200);
    const managerApprovePayload = approvalActionResponseSchema.parse(await managerApproveResponse.json());
    expect(managerApprovePayload.data.document.status).toBe("pending_approval");

    const detailAfterStep1Response = await app.request(appRoutes.approvals.detail("approval_document_multistep"), {
      headers: { cookie: managerCookie },
    });
    expect(detailAfterStep1Response.status).toBe(200);
    const detailAfterStep1Payload = approvalDocumentDetailResponseSchema.parse(await detailAfterStep1Response.json());
    expect(detailAfterStep1Payload.data.document.status).toBe("pending_approval");
    expect(detailAfterStep1Payload.data.steps.map((step) => step.decisionStatus)).toEqual(["approved", "pending"]);

    const hrInboxAfterResponse = await app.request(appRoutes.approvals.inbox, {
      headers: { cookie: hrCookie },
    });
    expect(hrInboxAfterResponse.status).toBe(200);
    const hrInboxAfterPayload = approvalInboxResponseSchema.parse(await hrInboxAfterResponse.json());
    expect(hrInboxAfterPayload.data.items.some((item) => item.id === "approval_document_multistep")).toBe(true);

    const hrApproveAfterResponse = await app.request(appRoutes.approvals.approve("approval_document_multistep"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: hrCookie,
      },
      body: JSON.stringify({ reason: "final step approved" }),
    });
    expect(hrApproveAfterResponse.status).toBe(200);
    const hrApproveAfterPayload = approvalActionResponseSchema.parse(await hrApproveAfterResponse.json());
    expect(hrApproveAfterPayload.data.document.status).toBe("approved");

    const detailAfterFinalResponse = await app.request(appRoutes.approvals.detail("approval_document_multistep"), {
      headers: { cookie: hrCookie },
    });
    expect(detailAfterFinalResponse.status).toBe(200);
    const detailAfterFinalPayload = approvalDocumentDetailResponseSchema.parse(await detailAfterFinalResponse.json());
    expect(detailAfterFinalPayload.data.document.status).toBe("approved");
    expect(detailAfterFinalPayload.data.steps.map((step) => step.decisionStatus)).toEqual(["approved", "approved"]);
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
    expect(sqlMock.query).toHaveBeenCalledTimes(1);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
