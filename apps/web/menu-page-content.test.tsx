import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HomeShortcut } from "@gw/shared";

import { MenuPageContent } from "./menu-page-content";

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
    id: "shortcut_approvals",
    code: "approvals",
    label: "결재",
    href: "/approvals",
    icon: "stamp",
    isFixed: true,
    sortOrder: 20,
    scope: "company",
  },
];

const privilegedShortcuts: HomeShortcut[] = [
  {
    id: "shortcut_admin_users",
    code: "admin_users",
    label: "관리자 사용자",
    href: "/admin/users",
    icon: "shield",
    isFixed: false,
    sortOrder: 110,
    scope: "user",
  },
  {
    id: "shortcut_management",
    code: "management",
    label: "경영업무",
    href: "/management",
    icon: "briefcase",
    isFixed: false,
    sortOrder: 120,
    scope: "user",
  },
];

describe("Phase 31 mobile home/menu entrypoints", () => {
  it("renders Phase 31 mobile home copy with shared fixed/user-scoped shortcut split", () => {
    const html = renderToStaticMarkup(
      <MenuPageContent
        roleCode="EMPLOYEE"
        homeShortcuts={companyShortcuts}
        homeShortcutNotices={[
          "운영 DB 기준 홈 바로가기를 조회했습니다.",
          "회사 공통 고정 항목과 권한 기반 사용자 전용 항목을 함께 정렬해 제공합니다.",
        ]}
      />,
    );

    expect(html).toContain("Phase 31 모바일 홈 실사용 UAT");
    expect(html).toContain("모바일 홈 / 전체 메뉴");
    expect(html).toContain("회사 공통 고정");
    expect(html).toContain("권한 기반 사용자 전용");
    expect(html).toContain("근태");
    expect(html).toContain("결재");
    expect(html).toContain("운영 DB 기준 홈 바로가기를 조회했습니다.");
    expect(html).toContain("메뉴/홈/메신저/메일/알림");
    expect(html).toContain("모바일·PC 같은 정보구조 원칙");
    expect(html).toContain("막힐 때 다시 가는 복구 경로");
    expect(html).toContain("현재 세션은 일반 업무 메뉴만 확인하고 경영업무 분리 메뉴는 보지 않습니다.");
    expect(html).not.toContain('href="/admin/users"');
  });

  it("shows privileged personal shortcuts and management lane only for privileged viewers", () => {
    const html = renderToStaticMarkup(
      <MenuPageContent
        roleCode="COMPANY_ADMIN"
        homeShortcuts={[...companyShortcuts, ...privilegedShortcuts]}
        homeShortcutNotices={["회사 공통 고정 항목과 권한 기반 사용자 전용 항목을 함께 정렬해 제공합니다."]}
      />,
    );

    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/management"');
    expect(html).toContain("경영업무");
    expect(html).toContain("막힐 때 다시 가는 복구 경로");
    expect(html).toContain("현재 세션은 경영업무 분리 메뉴를 함께 확인해야 합니다.");
  });
});
