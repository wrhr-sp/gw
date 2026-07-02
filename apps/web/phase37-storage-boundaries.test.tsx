import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedSessionToken = { value: "dev-session_COMPANY_ADMIN" };

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get(name: string) {
      return name === "gw_session" ? { value: mockedSessionToken.value } : undefined;
    },
  })),
}));

import AuditLogsPage from "./app/admin/audit-logs/page";
import DocumentsPage from "./app/documents/page";
import ManagementPage from "./app/management/page";
import PayrollPage from "./app/payroll/page";
import { workItemGuardrails, workItemHubHighlights } from "./app/work-items/work-items-config";

describe("Phase 37 internal operational storage boundaries", () => {
  beforeEach(() => {
    mockedSessionToken.value = "dev-session_COMPANY_ADMIN";
  });

  it("keeps documents focused on internal document storage instead of public sharing", () => {
    const html = renderToStaticMarkup(<DocumentsPage />);

    expect(html).toContain("문서함 목록");
    expect(html).toContain("파일 올리기");
    expect(html).toContain("문서 상세");
    expect(html).toContain("공유 상태");
    expect(html).toContain("인사·근태 문서함");
    expect(html).toContain("document.read 권한과 문서 공간 접근 범위를 함께 확인합니다.");
    expect(html).toContain("문서 열기");
    expect(html).toContain("권한 요청");
    expect(html).not.toContain("public URL 발급 완료");
    expect(html).not.toContain("Phase");
  });

  it("keeps audit logs on masked review and storageRef summary only", () => {
    const html = renderToStaticMarkup(<AuditLogsPage />);

    expect(html).toContain("storage review 경계");
    expect(html).toContain("storageRef 는 fileId / spaceId / versionId / storageStatus 수준의 참조 요약입니다.");
    expect(html).toContain("감사 export/download/external sink 는 이번 단계 완료 기준이 아닙니다.");
    expect(html).toContain("raw storageKey / bucket / signed URL / public URL 전문은 감사 응답과 화면에 노출하지 않습니다.");
  });

  it("bridges management, payroll, and work-items with approval-gated read-model language", async () => {
    const managementHtml = renderToStaticMarkup(await ManagementPage());
    const payrollHtml = renderToStaticMarkup(<PayrollPage />);
    expect(managementHtml).toContain("지정 관리자 업무 허브");
    expect(managementHtml).not.toContain("아래 route 순서로 일반 직원 레인과 관리자 레인이 섞이지 않는지 확인합니다.");
    expect(managementHtml).toContain("/admin/users 에서 계정관리 안내와 읽기 조회(`/employees`, `/org`)가 같은 책임처럼 보이지 않는지 확인");
    expect(managementHtml).toContain("/admin/policies 에서 current/candidate/capability/audit 안내 형식 확인");
    expect(managementHtml).toContain("/api/health 에서 최소 liveness 기준만 기록");
    expect(managementHtml).toContain("/work-items/branch 에서 branch scope 업무 목록 → 상세 → 문서 → 마감 흐름과 company scope 경계 확인");
    expect(managementHtml).toContain("연결 체크");
    expect(managementHtml).toContain("dev-safe 안내 상태");
    expect(managementHtml).not.toMatch(/Phase |Skeleton|UAT|placeholder|skeleton/);
  
    expect(payrollHtml).toContain("feature-workspace");
    expect(payrollHtml).toContain("급여 현황");
    expect(payrollHtml).toContain("급여 프로필");
    expect(payrollHtml).toContain("마감/검토");

    expect(workItemHubHighlights).toContain("민감 문서/첨부는 metadata 확인용 와 승인 기준 언어로만 연결하고 원문 저장 완료처럼 쓰지 않습니다.");
    expect(workItemGuardrails).toContain("급여 / 문서 / 감사 확인용 와 연결되더라도 실원문 저장 확대, 외부 제출, 운영 전환 은 계속 승인 게이트입니다.");
  });
});
