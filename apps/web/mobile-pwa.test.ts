import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { metadata as adminRouteMetadata } from "./app/admin/layout";
import {
  adminOfflineGuidance,
  adminManifestHref,
  adminMenuSections,
  adminPwaManifest,
  adminPrimaryNav,
  adminRecoveryRouteCards,
  fieldUsabilityPrinciples,
  generalManifestHref,
  generalPwaManifest,
  getAppShellConfigForHost,
  getManifestHrefForHost,
  getOfflineGuidanceForHost,
  getPwaManifestForHost,
  getRecoveryRouteCardsForHost,
  installGuideSteps,
  mobileBottomTabs,
  mobileMenuSections,
  mobilePrimaryNav,
  offlineGuidance,
  offlineTaskGuides,
  recoveryRouteCards,
  touchTargetStyle,
} from "./app/mobile-pwa-config";

const publicManifest = JSON.parse(readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf-8")) as typeof generalPwaManifest;

describe("mobile/PWA config", () => {
  it("keeps the general-user manifest relative and provides local icons", () => {
    expect(generalPwaManifest.id).toBe("/login");
    expect(generalPwaManifest.start_url).toBe("/home");
    expect(generalPwaManifest.scope).toBe("/");
    expect(generalPwaManifest.display).toBe("browser");
    expect(generalPwaManifest.display_override).toEqual(["browser"]);
    expect(generalPwaManifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(["/home", "/attendance", "/approvals"]);
    expect(generalPwaManifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(generalPwaManifest.icons.every((icon) => icon.src.startsWith("/icons/"))).toBe(true);
  });

  it("keeps the real /manifest.webmanifest implementation aligned with the shared general-user manifest identity", () => {
    expect(publicManifest).toMatchObject(generalPwaManifest);
    expect(publicManifest.icons).toEqual(generalPwaManifest.icons);
    expect(generalManifestHref).toBe("/manifest.webmanifest");
  });

  it("returns a separate admin manifest identity for admin hosts", () => {
    const adminManifest = getPwaManifestForHost("gw-admin.preview-account.workers.dev");

    expect(adminManifest.name).toBe("GW Admin");
    expect(adminManifest.short_name).toBe("GW Admin");
    expect(adminManifest.id).toBe("/admin");
    expect(adminManifest.start_url).toBe("/admin");
    expect(adminManifest.scope).toBe("/admin");
    expect(adminManifest.display).toBe("browser");
    expect(adminManifest.display_override).toEqual(["browser"]);
    expect(adminManifest.shortcuts.map((shortcut) => shortcut.url)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/policies",
      "/admin/audit-logs",
    ]);
    expect(adminManifest.icons.every((icon) => icon.src.startsWith("/icons/admin-"))).toBe(true);
    expect(adminManifestHref).toBe("/admin/manifest.webmanifest");
    expect(getManifestHrefForHost("gw-admin.preview-account.workers.dev")).toBe(adminManifestHref);
    expect(getManifestHrefForHost("gw-web.preview-account.workers.dev")).toBe(generalManifestHref);
    expect(adminRouteMetadata.manifest).toBe(adminManifestHref);
    expect(adminRouteMetadata.applicationName).toBe(adminPwaManifest.short_name);
  });

  it("exposes mobile-first navigation for the approved pilot routes", () => {
    expect(mobilePrimaryNav.map((item) => item.href)).toEqual([
      "/home",
      "/attendance",
      "/leave",
      "/approvals",
      "/boards",
      "/documents",
      "/sales",
      "/me",
      "/org",
      "/employees",
      "/payroll/me",
    ]);

    expect(mobileBottomTabs.map((item) => item.href)).toEqual([
      "/menu",
      "/home",
      "/messenger",
      "/mail",
    ]);
    expect(mobileBottomTabs[0]?.summary).toContain("전체 기능 탐색");

    expect(mobileMenuSections.map((section) => section.title)).toEqual([
      "협업/소통",
      "일정/개인 업무",
      "영업",
      "근무/인사",
      "결재/문서",
      "급여/비용",
      "운영/기타",
    ]);
    expect(mobilePrimaryNav[0]).toMatchObject({ href: "/home", label: "홈", shortLabel: "홈" });
    expect(mobilePrimaryNav[5]).toMatchObject({ href: "/documents", label: "전사 문서함", shortLabel: "전사문서" });
    expect(mobilePrimaryNav[6]).toMatchObject({ href: "/sales", label: "영업관리", shortLabel: "영업" });
    expect(mobilePrimaryNav[9]).toMatchObject({ href: "/employees", label: "조직도", shortLabel: "조직도" });
    expect(mobileMenuSections.flatMap((section) => section.items.map((item) => item.href))).toEqual([
      "/mail",
      "/messenger",
      "/boards",
      "/org",
      "/employees",
      "#anonymous-board",
      "#calendar",
      "#reservation",
      "#reports",
      "#todo-plus",
      "/sales",
      "/attendance",
      "/leave",
      "/work-items/hr",
      "#employee-training",
      "#employment-contract",
      "/approvals",
      "/documents",
      "#library",
      "#drive",
      "/payroll/me",
      "#expense",
      "/vehicle-operation",
    ]);
    expect(mobileMenuSections.flatMap((section) => section.items).filter((item) => item.disabled).map((item) => item.label)).toEqual([
      "익명게시판",
      "캘린더",
      "예약",
      "보고",
      "ToDO+",
      "직장인교육",
      "고용전자계약",
      "자료실",
      "드라이브",
      "경비",
    ]);
  });

  it("switches the app shell to admin-focused navigation on admin hosts", () => {
    expect(adminPrimaryNav.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/policies",
      "/admin/audit-logs",
    ]);
    expect(adminMenuSections.map((section) => section.title)).toEqual(["관리자 운영"]);

    expect(getAppShellConfigForHost("admin.localhost:3000")).toMatchObject({
      appName: "GW Admin",
      homeHref: "/admin",
      navItems: adminPrimaryNav,
      bottomTabs: adminPrimaryNav,
      menuSections: adminMenuSections,
    });
    expect(getAppShellConfigForHost("localhost:3000")).toMatchObject({
      appName: "We'reHere",
      appEyebrow: "기본업무",
      homeHref: "/home",
      navItems: mobilePrimaryNav,
      bottomTabs: mobileBottomTabs,
      menuSections: mobileMenuSections,
    });

    const employeeShell = getAppShellConfigForHost("localhost:3000", "EMPLOYEE");
    expect(employeeShell.menuSections.map((section) => section.title)).toContain("경영업무");
    expect(employeeShell.menuSections.flatMap((section) => section.items).find((item) => item.href === "/management")).toMatchObject({
      permissionDenied: true,
      badge: "권한필요",
    });
  });

  it("defines honest offline guidance without pretending state-changing actions succeed", () => {
    expect(offlineGuidance.availableNow).toContain("읽기 중심 안내 탐색");
    expect(offlineGuidance.blockedNow).toContain("출퇴근 등록/정정 요청");
    expect(offlineGuidance.retrySteps).toEqual(["네트워크 연결 확인", "잠시 후 다시 시도", "필요 시 데스크톱 또는 안정적인 네트워크에서 재시도"]);
    expect(fieldUsabilityPrinciples).toContain("알림은 상단바 알림 버튼 전용이며, 기능페이지나 사이드바 메뉴로 노출하지 않습니다.");
    expect(recoveryRouteCards.map((item) => item.href)).toEqual(["/home", "/menu", "/offline"]);
    expect(getRecoveryRouteCardsForHost("gw-web.preview-account.workers.dev")).toBe(recoveryRouteCards);
    expect(offlineTaskGuides.find((item) => item.href === "/attendance")?.blocked).toContain("오프라인 성공처럼 처리하지 않습니다");
    expect(offlineTaskGuides.find((item) => item.href === "/admin")?.adminOnly).toBe(true);

    expect(adminOfflineGuidance.blockedNow).toContain("사용자 초대, 권한 변경, 비활성화 같은 상태 변경 저장");
    expect(adminOfflineGuidance.blockedNow).toContain("정책 candidate 저장/적용 및 운영 규칙 배포");
    expect(getOfflineGuidanceForHost("gw-admin.preview-account.workers.dev")).toBe(adminOfflineGuidance);
    expect(adminRecoveryRouteCards.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/policies",
      "/admin/audit-logs",
      "/offline",
    ]);
    expect(getRecoveryRouteCardsForHost("gw-admin.preview-account.workers.dev")).toBe(adminRecoveryRouteCards);
  });

  it("uses touch-friendly minimum action sizing and install guidance", () => {
    expect(touchTargetStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(touchTargetStyle.paddingInline).toBeGreaterThanOrEqual(16);
    expect(installGuideSteps).toContain("설치 후에도 same-origin /api 경로 정책은 그대로 유지됩니다.");
    expect(getAppShellConfigForHost("gw-admin.preview-account.workers.dev")).toMatchObject({
      homeHref: "/admin",
      offlineGuidance: adminOfflineGuidance,
      showMobileMenuShortcut: false,
    });
    expect(getAppShellConfigForHost("gw-web.preview-account.workers.dev")).toMatchObject({
      homeHref: "/home",
      showMobileMenuShortcut: true,
    });
    expect(getAppShellConfigForHost("gw-admin.preview-account.workers.dev").installGuideSteps[0]).toContain("/admin/users");
    expect(getAppShellConfigForHost("gw-admin.preview-account.workers.dev").installGuideSteps[2]).toContain("기본 자산");
  });
});
