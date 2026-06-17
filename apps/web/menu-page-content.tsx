import React from "react";
import type { HomeShortcut, RoleCode } from "@gw/shared";

import { HomeShortcutsPanel } from "./app/_components/home-shortcuts-panel";
import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import { Phase47RecommendedFlowSection, Phase47StatusGuideSection } from "./app/_components/phase47-usage-guide";
import { fieldUsabilityPrinciples, getVisibleMobileMenuSections, hasManagementMenuAccess, mobileBottomTabs, recoveryRouteCards } from "./app/mobile-pwa-config";

export function MenuPageContent({
  roleCode,
  homeShortcuts = [],
  homeShortcutNotices = [],
  homeShortcutLoadError = null,
}: {
  roleCode: RoleCode | null;
  homeShortcuts?: readonly HomeShortcut[];
  homeShortcutNotices?: readonly string[];
  homeShortcutLoadError?: string | null;
}) {
  const visibleMenuSections = getVisibleMobileMenuSections(roleCode);

  return (
    <PageShell
      backHref="/dashboard"
      backLabel="홈으로"
      eyebrow="Phase 31 모바일 홈 실사용 UAT"
      title="모바일 홈 / 전체 메뉴"
      description="모바일에서도 홈과 메뉴가 같은 기준으로 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기를 보여 주고, 하단 탭과 전체 메뉴는 같은 정보구조를 가리키도록 정리했습니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">홈=대시보드</Pill>
          <Pill>PC/모바일 공통 shortcut 기준</Pill>
        </div>
      }
    >
      <SurfaceSection
        title="모바일 홈 바로가기"
        description="하단 탭의 홈(`/dashboard`)과 메뉴(`/menu`)에서 같은 홈 바로가기 API를 읽어 회사 공통 고정 + 권한 기반 사용자 전용 항목을 함께 보여 줍니다."
      >
        <HomeShortcutsPanel
          homeShortcuts={homeShortcuts}
          homeShortcutNotices={homeShortcutNotices}
          homeShortcutLoadError={homeShortcutLoadError}
          emptyFixedMessage="로그인 뒤 홈 바로가기 API를 읽으면 회사 공통 고정 항목이 여기에 표시됩니다."
          emptyCustomMessage="관리자·감사·경영업무처럼 현재 세션 권한으로 추가된 사용자 전용 바로가기가 없으면 이 상태를 그대로 보여 줍니다."
        />
      </SurfaceSection>

      <SurfaceSection title="하단 탭 고정 항목" description="메뉴/홈/메신저/메일/알림 5개는 모바일에서 항상 같은 순서로 고정하고, 실제 업무 진입은 홈/메뉴 shortcut 과 전체 메뉴에서 이어집니다.">
        <div className="grid-auto-compact">
          {mobileBottomTabs.map((item) => (
            <article key={item.href} className="info-card">
              <Pill tone={item.href === "/dashboard" ? "accent" : "default"}>{item.shortLabel}</Pill>
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>{item.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="모바일·PC 같은 정보구조 원칙" description="현장에서는 기기만 바뀌고 메뉴 뜻은 바뀌지 않도록 같은 route 체계를 유지합니다.">
        <ul className="summary-list">
          {fieldUsabilityPrinciples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <Phase47StatusGuideSection title="모바일 상태 문장 가이드" description="한 손 사용 중에도 loading, empty, error, forbidden, offline, dev-safe 의미가 섞이지 않게 같은 문장을 유지합니다." />

      <Phase47RecommendedFlowSection
        title="모바일 추천 확인 순서"
        description="하단 탭과 전체 메뉴를 눌러 볼 때도 홈 → 복구 → 실제 업무 순서가 흔들리지 않게 고정합니다."
        roleCode={roleCode}
      />

      {visibleMenuSections.map((section) => (
        <SurfaceSection key={section.title} title={section.title} description={section.description}>
          <div className="grid-auto-compact">
            {section.items.map((item) => (
              <article key={item.href} className="route-card">
                <h3>{item.label}</h3>
                <p>{item.summary}</p>
                <a href={item.href}>{item.href}</a>
              </article>
            ))}
          </div>
        </SurfaceSection>
      ))}

      <SurfaceSection
        title="Phase 31 모바일 검토 포인트"
        description="실사용 UAT에서 홈/메뉴 acceptance 를 확인할 때 꼭 같이 보는 기준입니다."
        muted
      >
        <ul className="summary-list">
          <li>모바일 홈(`/dashboard`)과 메뉴(`/menu`)가 같은 홈 바로가기 API를 읽고 같은 권한 기준을 사용한다.</li>
          <li>일반 사용자는 관리자/감사/경영업무 shortcut 을 받지 않고, 권한 있는 사용자만 개인 전용 바로가기로 본다.</li>
          <li>메신저/메일/알림은 placeholder honesty 를 유지하고, 실제 외부 연동은 승인 게이트로 남긴다.</li>
          <li>{hasManagementMenuAccess(roleCode) ? "현재 세션은 경영업무 분리 메뉴를 함께 확인해야 합니다." : "현재 세션은 일반 업무 메뉴만 확인하고 경영업무 분리 메뉴는 보지 않습니다."}</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="막힐 때 다시 가는 복구 경로" description="알림/오프라인/홈을 서로 다른 화면이 아니라 같은 현장 업무 복구 세트로 읽습니다.">
        <div className="grid-auto-compact">
          {recoveryRouteCards.map((item) => (
            <article key={item.href} className="route-card">
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>{item.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
