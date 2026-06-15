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

describe("Phase 26 HR meeting work-item API permission boundaries", () => {
  it("returns only the work items each role is allowed to see", async () => {
    const expectations: Array<{ role: RoleCode; itemIds: string[] }> = [
      {
        role: "COMPANY_ADMIN",
        itemIds: [
          "work_item_hr_onboarding_packet",
          "work_item_hr_one_on_one_checkin",
          "work_item_hr_branch_training_followup",
          "work_item_tax_month_end_evidence",
          "work_item_tax_vat_package_preparation",
          "work_item_labor_overtime_review",
          "work_item_labor_leave_balance_adjustment",
          "work_item_legal_contract_review",
          "work_item_branch_daily_report",
        ],
      },
      {
        role: "HR_ADMIN",
        itemIds: [
          "work_item_hr_onboarding_packet",
          "work_item_hr_one_on_one_checkin",
          "work_item_hr_branch_training_followup",
          "work_item_hr_grievance_triage",
          "work_item_tax_month_end_evidence",
          "work_item_tax_vat_package_preparation",
          "work_item_labor_overtime_review",
          "work_item_labor_leave_balance_adjustment",
          "work_item_labor_grievance_intake",
          "work_item_labor_discipline_review",
        ],
      },
      {
        role: "MANAGER",
        itemIds: [
          "work_item_hr_branch_training_followup",
          "work_item_tax_month_end_evidence",
          "work_item_labor_overtime_review",
        ],
      },
      {
        role: "EMPLOYEE",
        itemIds: ["work_item_hr_one_on_one_checkin", "work_item_labor_leave_balance_adjustment"],
      },
      {
        role: "AUDITOR",
        itemIds: [
          "work_item_hr_onboarding_packet",
          "work_item_hr_one_on_one_checkin",
          "work_item_hr_branch_training_followup",
          "work_item_hr_grievance_triage",
          "work_item_tax_month_end_evidence",
          "work_item_tax_vat_package_preparation",
          "work_item_labor_overtime_review",
          "work_item_labor_leave_balance_adjustment",
          "work_item_labor_grievance_intake",
          "work_item_labor_discipline_review",
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

  it("exposes hr lifecycle/meeting metadata while keeping self, branch, and grievance boundaries separated", async () => {
    const employeeResponse = await requestAs("EMPLOYEE", appRoutes.workItems.detail("work_item_hr_one_on_one_checkin"));
    expect(employeeResponse.status).toBe(200);
    const employeePayload = workItemDetailResponseSchema.parse(await employeeResponse.json());
    expect(employeePayload.data.item.hrContext?.lifecycleStage).toBe("probation");
    expect(employeePayload.data.item.hrContext?.visibility.employeeSelf).toContain("본인 일정");
    expect(employeePayload.data.item.hrContext?.followUp.ownerRoleCodes).toEqual(["EMPLOYEE", "HR_ADMIN"]);
    expect(employeePayload.data.auditLogs).toEqual([]);

    const managerResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_hr_branch_training_followup"));
    expect(managerResponse.status).toBe(200);
    const managerPayload = workItemDetailResponseSchema.parse(await managerResponse.json());
    expect(managerPayload.data.item.hrContext?.lifecycleStage).toBe("capability_building");
    expect(managerPayload.data.item.hrContext?.visibility.branchManager).toContain("자기 지점");
    expect(managerPayload.data.item.hrContext?.confidentialityLevel).toBe("standard");

    const grievanceBlockedResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_hr_grievance_triage"));
    expect(grievanceBlockedResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await grievanceBlockedResponse.json()).error.code).toBe("FORBIDDEN");

    const companyAdminGrievanceResponse = await requestAs("COMPANY_ADMIN", appRoutes.workItems.detail("work_item_hr_grievance_triage"));
    expect(companyAdminGrievanceResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await companyAdminGrievanceResponse.json()).error.code).toBe("FORBIDDEN");

    const employeeGrievanceResponse = await requestAs("EMPLOYEE", appRoutes.workItems.detail("work_item_hr_grievance_triage"));
    expect(employeeGrievanceResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await employeeGrievanceResponse.json()).error.code).toBe("FORBIDDEN");

    const hrAdminGrievanceResponse = await requestAs("HR_ADMIN", appRoutes.workItems.detail("work_item_hr_grievance_triage"));
    expect(hrAdminGrievanceResponse.status).toBe(200);
    const hrAdminGrievancePayload = workItemDetailResponseSchema.parse(await hrAdminGrievanceResponse.json());
    expect(hrAdminGrievancePayload.data.item.hrContext?.confidentialityLevel).toBe("grievance_restricted");
    expect(hrAdminGrievancePayload.data.item.hrContext?.privateNoteExists).toBe(true);
  });

  it("exposes labor metadata while keeping self-scope, branch-visible, and restricted labor boundaries separated", async () => {
    const employeeResponse = await requestAs("EMPLOYEE", appRoutes.workItems.detail("work_item_labor_leave_balance_adjustment"));
    expect(employeeResponse.status).toBe(200);
    const employeePayload = workItemDetailResponseSchema.parse(await employeeResponse.json());
    expect(employeePayload.data.item.access.viewerScope).toBe("self");
    expect(employeePayload.data.item.laborContext?.intakeStatus).toBe("evidence_requested");
    expect(employeePayload.data.item.laborContext?.followUp.ownerScope).toBe("employee");
    expect(employeePayload.data.item.laborContext?.visibility.employeeSelf).toContain("자기 제출 요청");

    const managerSelfScopeResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_labor_leave_balance_adjustment"));
    expect(managerSelfScopeResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await managerSelfScopeResponse.json()).error.code).toBe("FORBIDDEN");

    const managerResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_labor_overtime_review"));
    expect(managerResponse.status).toBe(200);
    const managerPayload = workItemDetailResponseSchema.parse(await managerResponse.json());
    expect(managerPayload.data.item.laborContext?.intakeStatus).toBe("evidence_requested");
    expect(managerPayload.data.item.laborContext?.followUp.ownerScope).toBe("branch_manager");
    expect(managerPayload.data.item.laborContext?.confidentialityLevel).toBe("standard");

    const companyAdminRestrictedResponse = await requestAs("COMPANY_ADMIN", appRoutes.workItems.detail("work_item_labor_discipline_review"));
    expect(companyAdminRestrictedResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await companyAdminRestrictedResponse.json()).error.code).toBe("FORBIDDEN");

    const managerRestrictedResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_labor_grievance_intake"));
    expect(managerRestrictedResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await managerRestrictedResponse.json()).error.code).toBe("FORBIDDEN");

    const hrAdminRestrictedResponse = await requestAs("HR_ADMIN", appRoutes.workItems.detail("work_item_labor_discipline_review"));
    expect(hrAdminRestrictedResponse.status).toBe(200);
    const hrAdminRestrictedPayload = workItemDetailResponseSchema.parse(await hrAdminRestrictedResponse.json());
    expect(hrAdminRestrictedPayload.data.item.laborContext?.confidentialityLevel).toBe("disciplinary_restricted");
    expect(hrAdminRestrictedPayload.data.item.laborContext?.legalHoldRequired).toBe(true);
    expect(hrAdminRestrictedPayload.data.item.laborContext?.reviewActors.some((actor) => actor.scope === "auditor")).toBe(true);
  });

  it("exposes tax metadata while keeping branch submission scope and HQ package scope separated", async () => {
    const managerResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_tax_month_end_evidence"));
    expect(managerResponse.status).toBe(200);
    const managerPayload = workItemDetailResponseSchema.parse(await managerResponse.json());
    expect(managerPayload.data.item.access.viewerScope).toBe("branch");
    expect(managerPayload.data.item.taxContext?.filingStage).toBe("collecting");
    expect(managerPayload.data.item.taxContext?.branchRequests[0]?.missingEvidenceCount).toBe(2);
    expect(managerPayload.data.item.taxContext?.visibility.branchManager).toContain("자기 지점");
    expect(managerPayload.data.auditLogs).toEqual([]);

    const managerBlockedResponse = await requestAs("MANAGER", appRoutes.workItems.detail("work_item_tax_vat_package_preparation"));
    expect(managerBlockedResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await managerBlockedResponse.json()).error.code).toBe("FORBIDDEN");

    const hqResponse = await requestAs("HR_ADMIN", appRoutes.workItems.detail("work_item_tax_vat_package_preparation"));
    expect(hqResponse.status).toBe(200);
    const hqPayload = workItemDetailResponseSchema.parse(await hqResponse.json());
    expect(hqPayload.data.item.taxContext?.packagePreparation.status).toBe("ready_for_review");
    expect(hqPayload.data.item.taxContext?.visibility.headquartersTax).toContain("company scope");
    expect(hqPayload.data.auditLogs).toEqual([]);

    const auditorResponse = await requestAs("AUDITOR", appRoutes.workItems.detail("work_item_tax_vat_package_preparation"));
    expect(auditorResponse.status).toBe(200);
    const auditorPayload = workItemDetailResponseSchema.parse(await auditorResponse.json());
    expect(auditorPayload.data.auditLogs.map((item) => item.id)).toEqual(["wiaudit_tax_package_ready"]);
  });

  it("keeps sensitive work-item documents and attachments available only to explicitly allowed roles", async () => {
    const hrDocumentRoute = appRoutes.workItems.documents("work_item_hr_onboarding_packet");
    const hrAttachmentRoute = appRoutes.workItems.attachments("work_item_hr_onboarding_packet");
    const grievanceDocumentRoute = appRoutes.workItems.documents("work_item_hr_grievance_triage");
    const grievanceAttachmentRoute = appRoutes.workItems.attachments("work_item_hr_grievance_triage");

    const companyAdminDocuments = workItemDocumentsResponseSchema.parse(await (await requestAs("COMPANY_ADMIN", hrDocumentRoute)).json());
    expect(companyAdminDocuments.data.items.map((item) => item.id)).toEqual(["widoc_hr_onboarding_checklist"]);
    expect(companyAdminDocuments.data.items.every((item) => item.containsSensitiveData)).toBe(true);

    const hrAdminAttachments = workItemAttachmentsResponseSchema.parse(await (await requestAs("HR_ADMIN", hrAttachmentRoute)).json());
    expect(hrAdminAttachments.data.items.map((item) => item.id)).toEqual(["wiatt_hr_packet_zip"]);
    expect(hrAdminAttachments.data.items[0]?.sensitivityLabel).toBe("restricted");

    const hrAdminGrievanceDocuments = workItemDocumentsResponseSchema.parse(await (await requestAs("HR_ADMIN", grievanceDocumentRoute)).json());
    expect(hrAdminGrievanceDocuments.data.items.map((item) => item.id)).toEqual(["widoc_hr_grievance_triage_summary"]);
    expect(hrAdminGrievanceDocuments.data.items[0]?.containsSensitiveData).toBe(true);

    const hrAdminGrievanceAttachments = workItemAttachmentsResponseSchema.parse(await (await requestAs("HR_ADMIN", grievanceAttachmentRoute)).json());
    expect(hrAdminGrievanceAttachments.data.items.map((item) => item.id)).toEqual(["wiatt_hr_grievance_packet"]);
    expect(hrAdminGrievanceAttachments.data.items[0]?.sensitivityLabel).toBe("restricted");

    const grievanceCompanyAdminDocumentsResponse = await requestAs("COMPANY_ADMIN", grievanceDocumentRoute);
    expect(grievanceCompanyAdminDocumentsResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await grievanceCompanyAdminDocumentsResponse.json()).error.code).toBe("FORBIDDEN");

    const grievanceCompanyAdminAttachmentsResponse = await requestAs("COMPANY_ADMIN", grievanceAttachmentRoute);
    expect(grievanceCompanyAdminAttachmentsResponse.status).toBe(403);
    expect(errorResponseSchema.parse(await grievanceCompanyAdminAttachmentsResponse.json()).error.code).toBe("FORBIDDEN");

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
        deadlineIds: [
          "wideadline_hr_onboarding",
          "wideadline_hr_one_on_one_checkin",
          "wideadline_hr_branch_training",
          "wideadline_tax_month_end",
          "wideadline_tax_vat_package",
          "wideadline_branch_daily_close",
        ],
      },
      {
        role: "HR_ADMIN",
        deadlineIds: [
          "wideadline_hr_onboarding",
          "wideadline_hr_one_on_one_checkin",
          "wideadline_hr_branch_training",
          "wideadline_tax_month_end",
          "wideadline_tax_vat_package",
        ],
      },
      {
        role: "MANAGER",
        deadlineIds: ["wideadline_hr_branch_training", "wideadline_tax_month_end"],
      },
      {
        role: "EMPLOYEE",
        deadlineIds: ["wideadline_hr_one_on_one_checkin"],
      },
      {
        role: "AUDITOR",
        deadlineIds: [
          "wideadline_hr_onboarding",
          "wideadline_hr_one_on_one_checkin",
          "wideadline_hr_branch_training",
          "wideadline_tax_month_end",
          "wideadline_tax_vat_package",
          "wideadline_branch_daily_close",
        ],
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
