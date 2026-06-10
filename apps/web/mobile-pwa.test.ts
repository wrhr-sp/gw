import { describe, expect, it } from "vitest";
import {
  installGuideSteps,
  mobilePrimaryNav,
  offlineGuidance,
  pwaManifest,
  touchTargetStyle,
} from "./app/mobile-pwa-config";

describe("Phase 6 mobile/PWA skeleton config", () => {
  it("keeps manifest routes relative and provides placeholder icons", () => {
    expect(pwaManifest.start_url).toBe("/");
    expect(pwaManifest.scope).toBe("/");
    expect(pwaManifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(pwaManifest.icons.every((icon) => icon.src.startsWith("/icons/"))).toBe(true);
  });

  it("exposes mobile-first navigation for the approved Phase 6 routes", () => {
    expect(mobilePrimaryNav.map((item) => item.href)).toEqual([
      "/dashboard",
      "/attendance",
      "/leave",
      "/approvals",
      "/boards",
      "/documents",
    ]);
  });

  it("defines honest offline guidance without pretending state-changing actions succeed", () => {
    expect(offlineGuidance.availableNow).toContain("읽기 중심 placeholder 탐색");
    expect(offlineGuidance.blockedNow).toContain("출퇴근 등록/정정 요청");
    expect(offlineGuidance.retrySteps).toEqual(["네트워크 연결 확인", "잠시 후 다시 시도", "필요 시 데스크톱 또는 안정적인 네트워크에서 재시도"]);
  });

  it("uses touch-friendly minimum action sizing and install guidance", () => {
    expect(touchTargetStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(touchTargetStyle.paddingInline).toBeGreaterThanOrEqual(16);
    expect(installGuideSteps).toContain("설치 후에도 same-origin /api 경로 정책은 그대로 유지됩니다.");
  });
});
