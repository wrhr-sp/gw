import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  appRoutes,
  payrollOverviewResponseSchema,
  payrollPeriodDetailResponseSchema,
  workItemDetailResponseSchema,
} from "@gw/shared";

vi.mock("../src/lib/postgres", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/postgres")>("../src/lib/postgres");

  const sql = (() => []) as unknown as { query: (text: string, values?: unknown[]) => Promise<unknown[]> };
  sql.query = async (text: string, values?: unknown[]) => {
    if (text.includes("from payroll_profiles")) {
      return [
        {
          id: "payroll_profile_db_employee",
          company_id: "company_demo",
          employee_id: "employee_employee",
          employee_name: "DB 급여 구성원",
          branch_id: "branch_hotel_seoul",
          branch_label: "서울 호텔",
          pay_type: "monthly",
          base_pay: 3200000,
          hourly_rate: null,
          daily_rate: null,
          annual_salary: null,
          inclusive_allowance: 150000,
          standard_work_hours: 209,
          pay_day: 25,
          effective_from: "2026-06-01",
          effective_to: null,
          scope_note: "운영 DB 기준 급여 프로필",
        },
      ];
    }

    if (text.includes("from payroll_periods")) {
      return [
        {
          id: "payroll_period_2026_07",
          company_id: "company_demo",
          title: "2026년 7월 급여 preview",
          branch_scope_label: "서울 호텔 포함",
          starts_on: "2026-07-01",
          ends_on: "2026-07-31",
          pay_date: "2026-08-05",
          status: "collecting",
          source_summary: "운영 DB metadata",
          locked_fields_note: "실지급 전 metadata only",
        },
      ];
    }

    if (text.includes("from payroll_drafts")) {
      return [
        {
          id: "payroll_draft_2026_07_employee",
          company_id: "company_demo",
          period_id: "payroll_period_2026_07",
          profile_id: "payroll_profile_db_employee",
          employee_id: "employee_employee",
          employee_name: "DB 급여 구성원",
          branch_label: "서울 호텔",
          pay_type: "monthly",
          status: "collecting",
          gross_pay: 3500000,
          estimated_deductions: 420000,
          net_pay_preview: 3080000,
          review_note: "운영 DB 초안",
          approval_gate: "본사 급여 검토 필요",
        },
      ];
    }

    if (text.includes("from payroll_input_snapshots")) {
      return [
        {
          id: "payroll_input_2026_07_employee",
          period_id: "payroll_period_2026_07",
          employee_id: "employee_employee",
          attendance_hours: 209,
          overtime_hours: 12,
          night_hours: 4,
          holiday_hours: 0,
          paid_leave_days: 1,
          unpaid_leave_days: 0,
          absence_days: 0,
          lateness_count: 0,
          early_leave_count: 1,
          source_note: "운영 DB 근태 snapshot",
        },
      ];
    }

    if (text.includes("from payroll_line_items")) {
      return [
        {
          id: "payroll_line_2026_07_base",
          code: "base_pay",
          label: "기본급",
          classification: "earning",
          source: "manual",
          quantity: 1,
          unit_amount: 3200000,
          premium_rate: null,
          amount: 3200000,
          note: "운영 DB line item",
        },
      ];
    }

    if (text.includes("from payroll_review_steps")) {
      return [
        {
          id: "payroll_review_2026_07_hq",
          period_id: "payroll_period_2026_07",
          scope: "headquarters_payroll",
          status: "reviewing",
          note: "운영 DB 검토 단계",
        },
      ];
    }

    if (text.includes("from work_items")) {
      return [
        {
          id: "work_item_tax_db_deadline",
          company_id: "company_demo",
          branch_id: "branch_hotel_seoul",
          branch_label: "서울 호텔",
          module: "tax",
          category: "세무 증빙",
          title: "DB 세무 증빙 제출",
          description_preview: "운영 DB 에 저장된 세무 metadata",
          status: "in_progress",
          priority: "high",
          assignee_json: { userId: "employee_manager", roleCode: "MANAGER", label: "지점 관리자" },
          requester_user_id: "user_company_admin",
          due_at: "2026-07-20T09:00:00.000Z",
          review_required: true,
          contains_sensitive_data: true,
          access_json: {
            companyId: "company_demo",
            branchId: "branch_hotel_seoul",
            branchLabel: "서울 호텔",
            viewerScope: "company",
            allowedRoleCodes: ["COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"],
            capabilities: ["work_item.read", "work_item.review", "work_item.deadline.read", "work_item.audit.read"],
            branchAccessNote: "지점 제출 metadata only",
            roleAccessNote: "본사/지점 검토 허용",
          },
          hr_context_json: null,
          labor_context_json: null,
          tax_context_json: {
            taxType: "withholding",
            filingStage: "collecting",
            evidenceStatus: "partial",
            deadlineKind: "monthly",
            reportingPeriodLabel: "2026년 7월",
            externalFilingStatus: "approval_required",
            sensitiveRecordStatus: "metadata_only",
            branchRequests: [
              {
                branchId: "branch_hotel_seoul",
                branchLabel: "서울 호텔",
                submissionStatus: "partial",
                requestedAt: "2026-07-10T09:00:00.000Z",
                submittedAt: null,
                dueAt: "2026-07-20T09:00:00.000Z",
                missingEvidenceCount: 2,
                note: "매출 집계표 필요",
              },
            ],
            evidenceSummary: [
              {
                type: "payroll_tax_basis",
                summary: "원천세 기초자료 metadata",
                status: "partial",
                branchLabel: "서울 호텔",
                containsSensitiveData: true,
              },
            ],
            reviewActors: [
              {
                scope: "tax_hq",
                roleCode: "COMPANY_ADMIN",
                responsibility: "collection_review",
                status: "reviewing",
              },
            ],
            packagePreparation: {
              status: "collecting",
              plannedContents: ["원천세 집계표"],
              summary: "제출 패키지 준비중",
              deliveryGate: "외부 전송 전 전문가 확인",
            },
            visibility: {
              headquartersTax: "본사 세무 담당",
              branchManager: "지점 제출 현황만 확인",
              auditor: "감사 조회 허용",
              generalEmployee: "일반 직원 비노출",
              restrictedNote: "실원문 업로드 금지",
            },
            auditHints: ["제출 전 검토 필요"],
          },
          legal_context_json: null,
          tags_json: ["db", "phase35"],
          audit_summary: "운영 DB 기반 감사 추적",
          created_at: "2026-07-10T09:00:00.000Z",
          updated_at: "2026-07-12T10:00:00.000Z",
          closed_at: null,
        },
      ];
    }

    if (text.includes("from work_item_audit_logs")) {
      return [
        {
          id: "work_item_tax_db_audit_1",
          work_item_id: "work_item_tax_db_deadline",
          action: "tax.branch_request.logged",
          actor_role_code: "COMPANY_ADMIN",
          summary: "DB 세무 증빙 요청 등록",
          happened_at: "2026-07-12T10:00:00.000Z",
        },
      ];
    }

    if (text.includes("from work_item_documents")) {
      return [];
    }
    if (text.includes("from work_item_attachments")) {
      return [];
    }
    if (text.includes("from work_item_reviews")) {
      return [];
    }
    if (text.includes("from work_item_deadlines")) {
      return [];
    }

    return [];
  };

  return {
    ...actual,
    createOperationalSql: () => sql,
  };
});

async function getFreshApp() {
  vi.resetModules();
  const mod = await import("../src/app");
  return mod.app;
}

afterEach(() => {
  vi.resetModules();
});

afterAll(() => {
  vi.doUnmock("../src/lib/postgres");
  vi.resetModules();
});

async function loginAndGetCookie(app: Awaited<ReturnType<typeof getFreshApp>>, role = "COMPANY_ADMIN") {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      loginId: "admin",
      password: "1234",
    }),
  });

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("expected login response to include set-cookie header");
  }

  return cookie;
}

describe("phase35 operational management PostgreSQL integration", () => {
  it("merges PostgreSQL-backed payroll metadata into overview/detail responses", async () => {
    const app = await getFreshApp();
    const cookie = await loginAndGetCookie(app, "COMPANY_ADMIN");

    const overviewResponse = await app.request(appRoutes.payroll.overview, { headers: { cookie } }, { DATABASE_URL: "postgres://example" });
    expect(overviewResponse.status).toBe(200);
    const overviewPayload = payrollOverviewResponseSchema.parse(await overviewResponse.json());
    expect(overviewPayload.data.profiles.some((item) => item.id === "payroll_profile_db_employee")).toBe(true);
    expect(overviewPayload.data.periods.some((item) => item.id === "payroll_period_2026_07")).toBe(true);
    expect(overviewPayload.data.collectionSteps.some((item) => item.id === "payroll_review_2026_07_hq")).toBe(true);

    const detailResponse = await app.request(appRoutes.payroll.periodDetail("payroll_period_2026_07"), { headers: { cookie } }, { DATABASE_URL: "postgres://example" });
    expect(detailResponse.status).toBe(200);
    const detailPayload = payrollPeriodDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.draft.id).toBe("payroll_draft_2026_07_employee");
    expect(detailPayload.data.inputSnapshot.id).toBe("payroll_input_2026_07_employee");
    expect(detailPayload.data.lineItems.some((item) => item.id === "payroll_line_2026_07_base")).toBe(true);
  });

  it("serves PostgreSQL-backed work-item metadata and audit logs", async () => {
    const app = await getFreshApp();
    const cookie = await loginAndGetCookie(app, "COMPANY_ADMIN");

    const detailResponse = await app.request(appRoutes.workItems.detail("work_item_tax_db_deadline"), { headers: { cookie } }, { DATABASE_URL: "postgres://example" });
    expect(detailResponse.status).toBe(200);
    const detailPayload = workItemDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.item.title).toBe("DB 세무 증빙 제출");
    expect(detailPayload.data.item.tags).toEqual(expect.arrayContaining(["db", "phase35"]));
    expect(detailPayload.data.auditLogs.some((item) => item.id === "work_item_tax_db_audit_1")).toBe(true);
  });
});
