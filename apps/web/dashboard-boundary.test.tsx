import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HomeShortcut } from "@gw/shared";

import { getDashboardAdminShortcut, getVisibleDashboardManagementCards } from "./app/dashboard/dashboard-config";
import { DashboardPageContent } from "./dashboard-page-content";

const companyShortcuts: HomeShortcut[] = [
  {
    id: "shortcut_attendance",
    code: "attendance",
    label: "근태",
    href: "/attendance",
    icon: "clock",
    isFixed: true,
    sortOrder: 10,
    scope: "company",
  },
  {
    id: "shortcut_leave",
    code: "leave",
    label: "휴가",
    href: "/leave",
    icon: "calendar",
    isFixed: true,
    sortOrder: 20,
    scope: "company",
  },
];

const userShortcuts: HomeShortcut[] = [
  {
    id: "shortcut_admin_user_admin",
    code: "admin_users",
    label: "관리자 사용자",
    href: "/admin/users",
    icon: "shield",
    isFixed: false,
    sortOrder: 110,
    scope: "user",
  },
];

describe("Phase 57 dashboard home boundary", () => {
  it("keeps dashboard focused on today-first work, role journeys, read-only lookup, and admin boundaries", () => {
    const html = renderToStaticMarkup(<DashboardPageContent adminShortcut={null} managementCards={[]} viewerRoleCode={null} />);

    expect(html).toContain("Phase 57 홈·메뉴 IA 실사용 UAT");
    expect(html).toContain("오늘 할 일");
    expect(html).toContain("홈 바로가기");
    expect(html).toContain("회사 공통 고정");
    expect(html).toContain("권한 기반 사용자 전용");
    expect(html).toContain("현장 업무 사용성 원칙");
    expect(html).toContain("상태 안내 기준선");
    expect(html).toContain("Phase 47 추천 확인 순서");
    expect(html).toContain("Phase 57 홈 역할 고정");
    expect(html).toContain("/dashboard 는 홈, /menu 는 탐색, 운영 허브는 별도 레인");
    expect(html).toContain('href="/menu"');
    expect(html).toContain("/dashboard → /attendance → /leave → /approvals → /boards → /documents → /me");
    expect(html).toContain("일반 직원 · 팀장 확인 순서");
    expect(html).not.toContain("관리자 계정·정책 확인 순서");
    expect(html).not.toContain("감사 확인 순서");
    expect(html).toContain("loading");
    expect(html).toContain("forbidden");
    expect(html).toContain("dev-safe / preview");
    expect(html).toContain("오늘 출퇴근 먼저 처리");
    expect(html).toContain("휴가 잔여와 신청 확인");
    expect(html).toContain("승인 대기 보기");
    expect(html).toContain("공지/게시판 확인");
    expect(html).toContain("문서 공간 확인");
    expect(html).toContain("내 정보 마무리 확인");
    expect(html).toContain("승인/대기 요약");
    expect(html).toContain("역할별 첫 이동");
    expect(html).toContain("인사 관리자");
    expect(html).toContain("운영 관리자");
    expect(html).toContain("지점 관리자");
    expect(html).toContain("/admin/users");
    expect(html).toContain("/management");
    expect(html).toContain("관리자 운영 검토 레인");
    expect(html).toContain("오늘 상태와 마무리 조회");
    expect(html).toContain("공지/문서 진입점");
    expect(html).toContain("운영 요약");
    expect(html.indexOf("오늘 할 일")).toBeLessThan(html.indexOf("홈 바로가기"));
    expect(html.indexOf("홈 바로가기")).toBeLessThan(html.indexOf("상태 안내 기준선"));
    expect(html.indexOf("상태 안내 기준선")).toBeLessThan(html.indexOf("Phase 47 추천 확인 순서"));
    expect(html.indexOf("Phase 47 추천 확인 순서")).toBeLessThan(html.indexOf("승인/대기 요약"));
    expect(html.indexOf("승인/대기 요약")).toBeLessThan(html.indexOf("역할별 첫 이동"));
    expect(html).toContain("/management");
    expect(html).toContain("/admin/users");
    expect(html).toContain("/admin/policies");
    expect(html).toContain("/admin/audit-logs");
    expect(html).toContain("/api/health");
    expect(html).toContain("/me");
    expect(html).toContain("/org");
    expect(html).toContain("막힐 때 다시 가는 현장 복구 경로");
    expect(html).toContain("dev-safe 요약이며 실제 저장·발송·외부 연동은 이번 단계에서 실행하지 않습니다.");
    expect(html).not.toContain("경영업무 분리 진입");
    expect(html.indexOf("오늘 출퇴근 먼저 처리")).toBeLessThan(html.indexOf("휴가 잔여와 신청 확인"));
    expect(html.indexOf("휴가 잔여와 신청 확인")).toBeLessThan(html.indexOf("승인 대기 보기"));
    expect(html.indexOf("승인 대기 보기")).toBeLessThan(html.indexOf("공지/게시판 확인"));
    expect(html.indexOf("공지/게시판 확인")).toBeLessThan(html.indexOf("문서 공간 확인"));
    expect(html.indexOf("문서 공간 확인")).toBeLessThan(html.indexOf("내 정보 마무리 확인"));
  });

  it("does not expose admin or management entry CTA in the default general-user dashboard view", () => {
    const html = renderToStaticMarkup(<DashboardPageContent adminShortcut={null} managementCards={[]} viewerRoleCode={null} />);

    expect(html).toContain("권한 있는 사용자에게만 관리자 진입 CTA를 노출합니다.");
    expect(html).toContain("현재 세션 / 홈-경영업무 분리");
    expect(html).toContain("← 전체 메뉴로");
    expect(html).not.toContain("관리자 허브 바로가기");
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="/work-items/legal"');
    expect(html).not.toContain("내부 도입 리허설 패키지");
    expect(html).not.toContain('href="/uat"');
    expect(html).not.toContain("admin / 1234");
    expect(html).not.toContain('href="/admin/users"');
    expect(html).not.toContain('href="/admin/policies"');
    expect(html).not.toContain('href="/admin/audit-logs"');
  });

  it("only returns an admin shortcut for admin-capable roles and a separate audit shortcut for auditors", () => {
    expect(getDashboardAdminShortcut(["EMPLOYEE"])).toBeNull();
    expect(getDashboardAdminShortcut(["MANAGER"])).toBeNull();

    expect(getDashboardAdminShortcut(["COMPANY_ADMIN"], ["audit.read"])).toEqual({
      href: "/admin",
      title: "관리자 허브 바로가기",
      body: "권한 있는 운영 사용자만 정책/권한/감사 preview를 이어서 확인합니다.",
    });

    expect(getDashboardAdminShortcut(["HR_ADMIN"])).toEqual({
      href: "/admin",
      title: "관리자 허브 바로가기",
      body: "권한 있는 운영 사용자만 정책/권한/감사 preview를 이어서 확인합니다.",
    });

    expect(getDashboardAdminShortcut(["AUDITOR"], ["audit.read"])).toEqual({
      href: "/admin/audit-logs",
      title: "감사 로그 바로가기",
      body: "감사 권한 사용자는 조회 가능한 감사 로그 preview 로 바로 이동합니다.",
    });
  });

  it("only returns management cards for designated management roles", () => {
    expect(getVisibleDashboardManagementCards(["EMPLOYEE"])).toEqual([]);
    expect(getVisibleDashboardManagementCards(["HR_ADMIN"])).toEqual([]);
    expect(getVisibleDashboardManagementCards(["MANAGER"]).map((card) => card.href)).toEqual([
      "/management",
      "/payroll",
      "/work-items/tax",
      "/work-items/legal",
    ]);
    expect(getVisibleDashboardManagementCards(["COMPANY_ADMIN"]).map((card) => card.href)).toEqual([
      "/management",
      "/payroll",
      "/work-items/tax",
      "/work-items/labor",
      "/work-items/legal",
    ]);
    expect(getVisibleDashboardManagementCards(["AUDITOR"])).toEqual([]);
  });

  it("renders only the audit flow for auditors without exposing admin policy routes", () => {
    const html = renderToStaticMarkup(
      <DashboardPageContent adminShortcut={getDashboardAdminShortcut(["AUDITOR"], ["audit.read"])} managementCards={[]} viewerRoleCode="AUDITOR" />,
    );

    expect(html).toContain("감사 확인 순서");
    expect(html).toContain('href="/admin/audit-logs"');
    expect(html).not.toContain("관리자 계정·정책 확인 순서");
    expect(html).not.toContain('href="/admin/users"');
    expect(html).not.toContain('href="/admin/policies"');
  });

  it("renders the actual admin CTA, shortcut split, and management lane when a privileged viewer is supplied", () => {
    const html = renderToStaticMarkup(
      <DashboardPageContent
        adminShortcut={getDashboardAdminShortcut(["COMPANY_ADMIN"], ["audit.read"])}
        managementCards={getVisibleDashboardManagementCards(["COMPANY_ADMIN"])}
        viewerRoleCode="COMPANY_ADMIN"
        homeShortcuts={[...companyShortcuts, ...userShortcuts]}
        homeShortcutNotices={[
          "운영 DB 기준 홈 바로가기를 조회했습니다.",
          "회사 공통 고정 항목과 권한 기반 사용자 전용 항목을 함께 정렬해 제공합니다.",
        ]}
      />,
    );

    expect(html).toContain("관리자 허브 바로가기");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("경영업무 분리 진입");
    expect(html).toContain('href="/management"');
    expect(html).toContain('href="/payroll"');
    expect(html).toContain('href="/work-items/tax"');
    expect(html).toContain('href="/work-items/labor"');
    expect(html).toContain('href="/work-items/legal"');
    expect(html).toContain("내부 도입 리허설 패키지");
    expect(html).toContain('href="/uat"');
    expect(html).toContain("관리자 계정·정책 확인 순서");
    expect(html).toContain('href="/admin/users"');
    expect(html).toContain("/admin/policies");
    expect(html).toContain("/api/health");
    expect(html).not.toContain("감사 확인 순서");
    expect(html).not.toContain('href="/admin/audit-logs"');
    expect(html).toContain("근태");
    expect(html).toContain("관리자 사용자");
    expect(html).toContain("운영 DB 기준 홈 바로가기를 조회했습니다.");
  });
});
