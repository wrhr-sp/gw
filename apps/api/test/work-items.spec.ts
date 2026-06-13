import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  workItemAttachmentsResponseSchema,
  workItemDeadlinesResponseSchema,
  workItemDetailResponseSchema,
  workItemDocumentsResponseSchema,
  workItemListResponseSchema,
  type RoleCode,
} from "@gw/shared";
import { app } from "../src/app";

async function loginAndGetCookie(role: RoleCode) {
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

  return cookie;
}

async function requestAs(role: RoleCode, route: string) {
  const cookie = await loginAndGetCookie(role);
  return app.request(route, {
    headers: {
      cookie,
    },
  });
}

describe("Phase 25 work-item API permission boundaries", () => {
  it("returns only the work items each role is allowed to see", async () => {
    const expectations: Array<{ role: RoleCode; itemIds: string[] }> = [
      {
        role: "COMPANY_ADMIN",
        itemIds: [
          "work_item_hr_onboarding_packet",
          "work_item_tax_month_end_evidence",
          "work_item_labor_attendance_followup",
          "work_item_legal_contract_review",
          "work_item_branch_daily_report",
        ],
      },
      {
        role: "HR_ADMIN",
        itemIds: [
          "work_item_hr_onboarding_packet",
          "work_item_tax_month_end_evidence",
          "work_item_labor_attendance_followup",
        ],
      },
      {
        role: "MANAGER",
        itemIds: ["work_item_tax_month_end_evidence", "work_item_labor_attendance_followup"],
      },
      {
        role: "EMPLOYEE",
        itemIds: [],
      },
      {
        role: "AUDITOR",
        itemIds: [
          "work_item_hr_onboarding_packet",
          "work_item_tax_month_end_evidence",
          "work_item_labor_attendance_followup",
          "work_item_legal_contract_review",
          "work_item_branch_daily_report",
        ],
      },
    ];

    for (const { role, itemIds } of expectations) {
      const response = await requestAs(role, appRoutes.workItems.list);
      expect(response.status, `${role} should list allowed work items`).toBe(200);

      const payload = workItemListResponseSchema.parse(await response.json());
      expect(payload.data.items.map((item) => item.id)).toEqual(itemIds);
    }
  });

  it("keeps sensitive work-item documents and attachments available only to explicitly allowed roles", async () => {
    const hrDocumentRoute = appRoutes.workItems.documents("work_item_hr_onboarding_packet");
    const hrAttachmentRoute = appRoutes.workItems.attachments("work_item_hr_onboarding_packet");

    const companyAdminDocuments = workItemDocumentsResponseSchema.parse(await (await requestAs("COMPANY_ADMIN", hrDocumentRoute)).json());
    expect(companyAdminDocuments.data.items.map((item) => item.id)).toEqual(["widoc_hr_onboarding_checklist"]);
    expect(companyAdminDocuments.data.items.every((item) => item.containsSensitiveData)).toBe(true);

    const hrAdminAttachments = workItemAttachmentsResponseSchema.parse(await (await requestAs("HR_ADMIN", hrAttachmentRoute)).json());
    expect(hrAdminAttachments.data.items.map((item) => item.id)).toEqual(["wiatt_hr_packet_zip"]);
    expect(hrAdminAttachments.data.items[0]?.sensitivityLabel).toBe("restricted");

    const managerDocumentsResponse = await requestAs("MANAGER", hrDocumentRoute);
    expect(managerDocumentsResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await managerDocumentsResponse.json()).error.code).toBe("FORBIDDEN");

    const employeeAttachmentsResponse = await requestAs("EMPLOYEE", hrAttachmentRoute);
    expect(employeeAttachmentsResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await employeeAttachmentsResponse.json()).error.code).toBe("FORBIDDEN");
  });

  it("omits audit logs when the viewer lacks work_item.audit.read even if the item itself is visible", async () => {
    const hrAdminResponse = await requestAs("HR_ADMIN", appRoutes.workItems.detail("work_item_tax_month_end_evidence"));
    expect(hrAdminResponse.status).toBe(200);
    const hrAdminPayload = workItemDetailResponseSchema.parse(await hrAdminResponse.json());
    expect(hrAdminPayload.data.item.id).toBe("work_item_tax_month_end_evidence");
    expect(hrAdminPayload.data.auditLogs).toEqual([]);

    const auditorResponse = await requestAs("AUDITOR", appRoutes.workItems.detail("work_item_tax_month_end_evidence"));
    expect(auditorResponse.status).toBe(200);
    const auditorPayload = workItemDetailResponseSchema.parse(await auditorResponse.json());
    expect(auditorPayload.data.auditLogs.map((item) => item.id)).toEqual(["wiaudit_tax_deadline_sync"]);
  });

  it("returns 403 when a role requests a work item outside its visibility boundary", async () => {
    const response = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_legal_contract_review"));
    expect(response.status).toBe(403);

    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("FORBIDDEN");
    expect(payload.error.details?.workItemId).toBe("work_item_legal_contract_review");
  });

  it("returns only deadlines for work items visible to the current viewer", async () => {
    const expectations: Array<{ role: RoleCode; deadlineIds: string[] }> = [
      {
        role: "COMPANY_ADMIN",
        deadlineIds: ["wideadline_hr_onboarding", "wideadline_tax_month_end", "wideadline_branch_daily_close"],
      },
      {
        role: "HR_ADMIN",
        deadlineIds: ["wideadline_hr_onboarding", "wideadline_tax_month_end"],
      },
      {
        role: "MANAGER",
        deadlineIds: ["wideadline_tax_month_end"],
      },
      {
        role: "EMPLOYEE",
        deadlineIds: [],
      },
      {
        role: "AUDITOR",
        deadlineIds: ["wideadline_hr_onboarding", "wideadline_tax_month_end", "wideadline_branch_daily_close"],
      },
    ];

    for (const { role, deadlineIds } of expectations) {
      const response = await requestAs(role, appRoutes.workItems.deadlines);
      expect(response.status, `${role} should list only visible deadlines`).toBe(200);

      const payload = workItemDeadlinesResponseSchema.parse(await response.json());
      expect(payload.data.items.map((item) => item.id)).toEqual(deadlineIds);
    }
  });
});
