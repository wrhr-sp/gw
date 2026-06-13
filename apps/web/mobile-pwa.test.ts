import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { metadata as adminRouteMetadata } from "./app/admin/layout";
import {
  adminOfflineGuidance,
  adminManifestHref,
  adminPwaManifest,
  adminPrimaryNav,
  generalManifestHref,
  generalPwaManifest,
  getAppShellConfigForHost,
  getManifestHrefForHost,
  getOfflineGuidanceForHost,
  getPwaManifestForHost,
  installGuideSteps,
  mobilePrimaryNav,
  offlineGuidance,
  touchTargetStyle,
} from "./app/mobile-pwa-config";

const publicManifest = JSON.parse(readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf-8")) as typeof generalPwaManifest;

describe("Phase 6 mobile/PWA skeleton config", () => {
  it("keeps the general-user manifest relative and provides placeholder icons", () => {
    expect(generalPwaManifest.id).toBe("/");
    expect(generalPwaManifest.start_url).toBe("/");
    expect(generalPwaManifest.scope).toBe("/");
    expect(generalPwaManifest.display_override).toEqual(["standalone", "minimal-ui", "browser"]);
    expect(generalPwaManifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(["/dashboard", "/attendance", "/approvals"]);
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
    expect(adminManifest.display_override).toEqual(["standalone", "minimal-ui", "browser"]);
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

  it("exposes mobile-first navigation for the approved Phase 14 MVP routes", () => {
    expect(mobilePrimaryNav.map((item) => item.href)).toEqual([
      "/dashboard",
      "/attendance",
      "/leave",
      "/approvals",
      "/documents",
      "/me",
      "/org",
    ]);
  });

  it("switches the app shell to admin-focused navigation on admin hosts", () => {
    expect(adminPrimaryNav.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/policies",
      "/admin/audit-logs",
    ]);

    expect(getAppShellConfigForHost("admin.localhost:3000")).toMatchObject({
      appName: "GW Admin",
      homeHref: "/admin",
      navItems: adminPrimaryNav,
    });
    expect(getAppShellConfigForHost("localhost:3000")).toMatchObject({
      appName: "그룹웨어 Web/PWA",
      homeHref: "/",
      navItems: mobilePrimaryNav,
    });
  });

  it("defines honest offline guidance without pretending state-changing actions succeed", () => {
    expect(offlineGuidance.availableNow).toContain("읽기 중심 placeholder 탐색");
    expect(offlineGuidance.blockedNow).toContain("출퇴근 등록/정정 요청");
    expect(offlineGuidance.retrySteps).toEqual(["네트워크 연결 확인", "잠시 후 다시 시도", "필요 시 데스크톱 또는 안정적인 네트워크에서 재시도"]);

    expect(adminOfflineGuidance.blockedNow).toContain("사용자 초대, 권한 변경, 비활성화 같은 상태 변경 저장");
    expect(adminOfflineGuidance.blockedNow).toContain("정책 candidate 저장/적용 및 운영 규칙 배포");
    expect(getOfflineGuidanceForHost("gw-admin.preview-account.workers.dev")).toBe(adminOfflineGuidance);
  });

  it("uses touch-friendly minimum action sizing and install guidance", () => {
    expect(touchTargetStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(touchTargetStyle.paddingInline).toBeGreaterThanOrEqual(16);
    expect(installGuideSteps).toContain("설치 후에도 same-origin /api 경로 정책은 그대로 유지됩니다.");
    expect(getAppShellConfigForHost("gw-admin.preview-account.workers.dev")).toMatchObject({
      homeHref: "/admin",
      offlineGuidance: adminOfflineGuidance,
    });
    expect(getAppShellConfigForHost("gw-admin.preview-account.workers.dev").installGuideSteps[0]).toContain("/admin/users");
    expect(getAppShellConfigForHost("gw-admin.preview-account.workers.dev").installGuideSteps[2]).toContain("placeholder");
  });
});
