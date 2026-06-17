import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedSessionToken = { value: "dev-placeholder-session_COMPANY_ADMIN" };

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
import WorkItemsPage from "./app/work-items/page";
import { workItemGuardrails, workItemHubHighlights } from "./app/work-items/work-items-config";

describe("Phase 37 internal operational storage boundaries", () => {
  beforeEach(() => {
    mockedSessionToken.value = "dev-placeholder-session_COMPANY_ADMIN";
  });

  it("keeps documents focused on lifecycle and internal storage boundaries instead of public sharing", () => {
    const html = renderToStaticMarkup(<DocumentsPage />);

    expect(html).toContain("Phase 41 내부 문서 협업 도입");
    expect(html).toContain("파일 lifecycle");
    expect(html).toContain("upload-init");
    expect(html).toContain("upload-complete");
    expect(html).toContain("download-init");
    expect(html).toContain("storageStatus(pending/ready/deleted)는 내부 저장 lifecycle 설명이며 public share 완료 뜻이 아닙니다.");
    expect(html).not.toContain("public URL 발급 완료");
  });

  it("keeps audit logs on masked preview and storageRef summary only", () => {
    const html = renderToStaticMarkup(<AuditLogsPage />);

    expect(html).toContain("storage preview 경계");
    expect(html).toContain("storageRef 는 fileId / spaceId / versionId / storageStatus 수준의 참조 요약입니다.");
    expect(html).toContain("감사 export/download/external sink 는 이번 단계 완료 기준이 아닙니다.");
    expect(html).toContain("raw storageKey / bucket / signed URL / public URL 전문은 감사 응답과 화면에 노출하지 않습니다.");
  });

  it("bridges management, payroll, and work-items with approval-gated read-model language", async () => {
    const managementHtml = renderToStaticMarkup(await ManagementPage());
    const payrollHtml = renderToStaticMarkup(<PayrollPage />);
    const workItemsHtml = renderToStaticMarkup(<WorkItemsPage />);

    expect(managementHtml).toContain("Phase 43 급여·세무·노무·법무 내부관리 허브");
    expect(managementHtml).toContain("`/uat` 에서 시나리오를 먼저 읽고");
    expect(managementHtml).toContain("역할별 시나리오 + 이슈 템플릿");
    expect(managementHtml).toContain("/payroll/me 에서 self-only 명세서 preview 와 정정 안내가 분리되어 보이는지 확인");
    expect(managementHtml).toContain("/work-items/tax → /work-items/labor → /work-items/legal 흐름이 허용 역할에서만 노출되는지 확인");
    expect(managementHtml).toContain("/documents 에서 upload-init / upload-complete / download-init / delete 경계와 storageStatus 설명 확인");
    expect(managementHtml).toContain("Phase 37 연결 체크");
  
    expect(payrollHtml).toContain("preview 금액, review step, approval gate 는 내부 운영 read model 이며 실지급/실신고 완료 뜻이 아닙니다.");

    expect(workItemsHtml).toContain("Phase 37 공통 업무 저장흐름 점검");
    expect(workItemsHtml).toContain("metadata preview / approval gate 언어");
    expect(workItemHubHighlights).toContain("민감 문서/첨부는 metadata preview 와 approval gate 언어로만 연결하고 raw 원문 저장 완료처럼 쓰지 않습니다.");
    expect(workItemGuardrails).toContain("payroll / documents / audit preview 와 연결되더라도 실원문 저장 확대, 외부 제출, production migration 은 계속 승인 게이트입니다.");
  });
});
