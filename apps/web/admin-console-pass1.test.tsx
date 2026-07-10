import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { errorResponseSchema, appRoutes } from "@gw/shared";

import { AdminPageContent } from "./admin-page-content";
import { getAdminPageCardsForRole } from "./admin-page-access";
import { app } from "../api/src/app";
import { adminMenuSections, adminPrimaryNav } from "./app/mobile-pwa-config";
import AdminPoliciesPage from "./app/admin/policies/page";
import AdminAuditLogsPage from "./app/admin/audit-logs/page";
import AttendancePage from "./app/attendance/page";
import ManagementSupportHrPage from "./app/management-support/hr/page";

describe("Phase 55 admin account/rbac live usage", () => {
  it("keeps the admin sidebar scoped to administrator work only", () => {
    expect(adminMenuSections).toHaveLength(1);
    expect(adminMenuSections[0]?.title).toBe("관리자 업무");
    expect(adminPrimaryNav.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/policies",
      "/admin/audit-logs",
    ]);
    expect(adminPrimaryNav.map((item) => item.label)).toEqual([
      "그룹웨어관리",
      "운영 정책",
      "감사로그",
    ]);
    expect(adminPrimaryNav.some((item) => item.href === "/mail" || item.href === "/messenger" || item.href === "/work-items/branch")).toBe(false);
  });

  it("turns the admin hub into an operations-first console", () => {
    const html = renderToStaticMarkup(
      <AdminPageContent visibleAdminHubCards={getAdminPageCardsForRole("COMPANY_ADMIN")} />,
    );

    expect(html).toContain("그룹웨어관리자");
    expect(html).toContain("관리자 기능");
    expect(html).not.toContain("사원정보관리");
    expect(html).not.toContain("권한 관리");
    expect(html).toContain("운영 정책");
    expect(html).toContain("감사로그");
    expect(html).not.toContain("관리자 업무 진입");
    expect(html).not.toContain("구현 범위");
    expect(html).not.toContain("관리자 페이지 분리 원칙");
  });

  it("shows only the routes each admin viewer is allowed to open from the hub cards", () => {
    expect(getAdminPageCardsForRole("HR_ADMIN").map((card) => card.href)).toEqual(["/admin/organization-info", "/admin/policies"]);
    expect(getAdminPageCardsForRole("AUDITOR").map((card) => card.href)).toEqual(["/admin/audit-logs"]);
    expect(getAdminPageCardsForRole("COMPANY_ADMIN").map((card) => card.href)).toEqual([
      "/admin/organization-info",
      "/admin/policies",
      "/admin/audit-logs",
    ]);
  });

  it("places employee information management inside management support HR as a list-first surface", async () => {
    const supportHtml = renderToStaticMarkup(await ManagementSupportHrPage());
    const clientSource = await import("node:fs/promises").then((fs) =>
      fs.readFile("app/management-support/_components/management-support-hr-client.tsx", "utf8"),
    );

    expect(supportHtml).toContain("인사관리");
    expect(supportHtml).toContain("사원정보관리");
    expect(supportHtml).toContain("사원 목록");
    expect(supportHtml).toContain("+ 사원 생성");
    expect(supportHtml).not.toContain(">등록<");
    expect(supportHtml).toContain("삭제");
    expect(supportHtml).toContain("부서");
    expect(supportHtml).toContain("지점");
    expect(supportHtml).toContain("재직상태");
    expect(supportHtml).toContain("계정상태");
    expect(supportHtml).toContain("역할");
    expect(supportHtml).toContain("최근 로그인");
    expect(supportHtml).not.toContain("사내임직원 로그인 ID 또는 이메일");
    expect(supportHtml).not.toContain("사원 등록 / 계정 생성");
    expect(supportHtml).not.toContain("조직정보 저장");
    expect(supportHtml).not.toContain("계정상태 저장");
    expect(supportHtml).not.toContain("역할/권한 저장");
    expect(supportHtml).not.toContain("보안 설정 저장");
    expect(clientSource).toContain("<ConfirmDialog");
    expect(clientSource).toContain("사원 생성을 닫을까요?");
    expect(clientSource).toContain("employee-create-form");
    expect(clientSource).toContain("employee-detail-panel employee-detail-panel--create");
    expect(supportHtml).not.toContain("감사로그/변경이력은 관리자페이지 감사로그에서 확인합니다.");
    expect(supportHtml).not.toContain("감사로그 / 변경이력");
    expect(supportHtml).not.toContain("운영 DB 조회 결과에서 사원을 선택하면 실제 API 값 또는 연결 필요 상태를 표시합니다.");
    expect(supportHtml).not.toContain("선택 사원 조회 후 표시");
    expect(supportHtml).not.toContain("미구성 대기");
  });

  it("keeps policy review cards in a consistent current-candidate-capability format", () => {
    const html = renderToStaticMarkup(<AdminPoliciesPage />);

    expect(html).toContain("협업 화면과 운영 정책 화면의 경계");
    expect(html).toContain("/boards · /documents");
    expect(html).toContain("정책 카드 공통 형식");
    expect(html).toContain('id="policy-documents"');
    expect(html).toContain("현재 운영 기준");
    expect(html).toContain("candidate 변경안");
    expect(html).toContain("필요 capability");
    expect(html).toContain("감사 review");
    expect(html).toContain("문서 / 첨부 정책");
    expect(html).toContain("근태 / 출퇴근 등록 방식 정책");
    expect(html).toContain("현재 허용 방식");
    expect(html).toContain("candidate 허용 방식");
    expect(html).toContain("태그 단말 연동 승인 대기");
    expect(html).toContain("우선순위: 회사 기본 &lt; 근무지/지점 &lt; 부서/팀 &lt; 직무/역할");
    expect(html).toContain("예상 적용 인원 2명");
    expect(html).toContain("대상 직원 적용 현황");
    expect(html).toContain("동일 target 활성 정책 중복: 근무지/지점 · 원격 실험실");
  });

  it("shows employee attendance actions without exposing disallowed old mobile/PC labels", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("오늘 근태");
    expect(html).not.toContain("허용 방식");
    expect(html).not.toContain("태그 · PC");
    expect(html).toContain("퇴근 등록");
    expect(html).not.toContain("모바일 출근 등록");
    expect(html).not.toContain("PC 출근 등록");
    expect(html).not.toContain("Phase");
  });

  it("keeps audit logs focused on filters, timeline, detail context, and masking boundaries", () => {
    const html = renderToStaticMarkup(<AdminAuditLogsPage />);

    expect(html).toContain("Phase 56 감사 read-only / audit.read 경계 확인");
    expect(html).toContain("감사 전용 진입 의미");
    expect(html).toContain("역할별 route/API guard 요약");
    expect(html).toContain("AUDITOR");
    expect(html).toContain("/admin/audit-logs: 허용");
    expect(html).toContain("/management-support/hr: 차단");
    expect(html).toContain("조회 필터");
    expect(html).toContain("최근 이벤트 타임라인");
    expect(html).toContain("상세 패널");
    expect(html).toContain("운영 최소 기준선");
    expect(html).toContain("RUNBOOK.md 와 DEPLOYMENT.md");
    expect(html).toContain("비노출/회사 경계");
    expect(html).toContain("raw storageKey / bucket / signed URL / public URL 전문은 감사 응답과 화면에 노출하지 않습니다.");
    expect(html).toContain("storageRef 는 fileId / spaceId / versionId / storageStatus 수준의 참조 요약입니다.");
  });
});
