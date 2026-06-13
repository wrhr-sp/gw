import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { mobileBottomTabs, mobileMenuSections } from "../mobile-pwa-config";

export default function MenuPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="홈으로"
      eyebrow="Phase 24 파일럿 전체 메뉴"
      title="전체 메뉴 / 기능 선택 화면"
      description="모바일 하단 탭의 `메뉴` 버튼에서 여는 전체 기능 선택 화면입니다. 기본 업무, 조회, 협업 placeholder 를 같은 정보구조로 보여 주고 실제 외부 연동은 승인 게이트로 남깁니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">모바일 5탭 기준</Pill>
          <Pill>same IA as PC sidebar</Pill>
        </div>
      }
    >
      <SurfaceSection title="하단 탭 고정 항목" description="메뉴/홈/메신저/메일/알림 5개는 파일럿 기본 진입점으로만 고정합니다.">
        <div className="grid-auto-compact">
          {mobileBottomTabs.map((item) => (
            <article key={item.href} className="info-card">
              <Pill tone="accent">{item.shortLabel}</Pill>
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>{item.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      {mobileMenuSections.map((section) => (
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

      <SurfaceSection title="파일럿 운영 메모" description="이번 단계에서 과장하지 말아야 할 경계를 함께 적습니다." muted>
        <ul className="summary-list">
          <li>메신저, 메일, 알림은 실제 외부 서버/푸시 연동이 아니라 placeholder honesty 확인이 목적입니다.</li>
          <li>관리자 메뉴는 일반 사용자 전체 메뉴에 섞지 않고 권한/host 기준으로 분리합니다.</li>
          <li>PC 사이드바와 모바일 전체 메뉴는 같은 메뉴군을 가리키고, 탐색 껍데기만 다르게 유지합니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
