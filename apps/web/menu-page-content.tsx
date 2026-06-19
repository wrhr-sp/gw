import React from "react";
import type { HomeShortcut, RoleCode } from "@gw/shared";

import { HomeShortcutsPanel } from "./app/_components/home-shortcuts-panel";
import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import { fieldUsabilityPrinciples, getVisibleMobileMenuSections, hasManagementMenuAccess, mobileBottomTabs, recoveryRouteCards } from "./app/mobile-pwa-config";

const menuStatusGuideCards = [
  {
    title: "loading",
    summary: "아직 내용을 불러오는 중인 상태입니다.",
    detail: "저장 성공이나 권한 차단으로 단정하지 말고 잠시 기다린 뒤 홈 또는 메뉴에서 다시 확인합니다.",
  },
  {
    title: "empty",
    summary: "정상적으로 비어 있을 수 있는 상태입니다.",
    detail: "현재 권한에서 추가로 볼 항목이 없을 수 있습니다.",
  },
  {
    title: "error",
    summary: "조회나 불러오기에 실패한 상태입니다.",
    detail: "복구 경로와 오프라인 안내를 먼저 확인한 뒤 다시 시도합니다.",
  },
  {
    title: "forbidden",
    summary: "로그인은 되었지만 현재 업무 권한 또는 접근 범위가 맞지 않는 상태입니다.",
    detail: "관리자 전용 메뉴를 대신 열지 않고 허용된 홈·메뉴 레인에서만 확인합니다.",
  },
  {
    title: "offline",
    summary: "네트워크가 불안정해 재시도가 필요한 상태입니다.",
    detail: "가능한 일과 막히는 일을 먼저 확인한 뒤 안정적인 네트워크에서 다시 시도합니다.",
  },
  {
    title: "내부 확인용 데이터",
    summary: "외부 연동 전 먼저 읽는 dev-safe 안내 상태입니다.",
    detail: "실제 저장 완료, 외부 발송 완료, 운영 반영 완료로 설명하지 않습니다.",
  },
] as const;

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
      eyebrow="전체 기능 탐색"
      title="전체 메뉴 / 기능 탐색 허브"
      description="`/dashboard` 는 오늘 할 일 시작 홈으로, `/menu` 는 전체 기능 탐색 허브로 분리하고, 두 화면은 같은 바로가기·권한 registry 와 같은 모바일/PC 정보구조를 공유하도록 정리했습니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">/dashboard = 오늘 할 일</Pill>
          <Pill>/menu = 전체 기능 탐색</Pill>
        </div>
      }
    >
      <SurfaceSection
        title="홈과 메뉴 역할 분리"
        description="두 화면은 같은 route·권한 기준을 공유하지만, 읽히는 책임은 다르게 유지합니다."
      >
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">오늘 업무 시작</Pill>
            <h3>/dashboard</h3>
            <p>근태 → 휴가 → 결재 → 게시판 → 문서 → 내 정보 순서로 오늘 먼저 눌러야 할 일을 정리하는 홈입니다.</p>
          </article>
          <article className="info-card">
            <Pill>전체 기능 탐색</Pill>
            <h3>/menu</h3>
            <p>홈에서 우선순위상 뒤로 밀린 기능군, 조회 메뉴, 협업 도구, 역할별 추가 진입점을 한 화면에서 다시 고르는 메뉴입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">같은 기준 공유</Pill>
            <h3>같은 바로가기·권한 registry</h3>
            <p>회사 공통 고정 / 권한 기반 사용자 전용 바로가기, 모바일 전체 메뉴, PC sidebar 는 서로 다른 사이트맵이 아니라 같은 정보구조를 다른 탐색 껍데기로 보여 줍니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="홈·메뉴 공통 바로가기"
        description="하단 탭의 홈(`/dashboard`)과 메뉴(`/menu`)에서 같은 홈 바로가기 API를 읽어 회사 공통 고정 + 권한 기반 사용자 전용 항목을 같은 기준으로 보여 줍니다."
      >
        <HomeShortcutsPanel
          homeShortcuts={homeShortcuts}
          homeShortcutNotices={homeShortcutNotices}
          homeShortcutLoadError={homeShortcutLoadError}
          emptyFixedMessage="로그인 뒤 홈 바로가기 API를 읽으면 회사 공통 고정 항목이 여기에 표시됩니다."
          emptyCustomMessage="관리자·감사·경영업무처럼 현재 세션 권한으로 추가된 사용자 전용 바로가기가 없으면 이 상태를 그대로 보여 줍니다."
        />
      </SurfaceSection>

      <SurfaceSection title="하단 탭 고정 항목" description="메뉴/홈/메신저/메일/알림 5개는 모바일에서 항상 같은 순서로 고정하고, 실제 업무 진입은 홈과 전체 메뉴에서 이어집니다.">
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

      <SurfaceSection title="모바일·PC 같은 정보구조 원칙" description="현장에서는 기기만 바뀌고 메뉴 뜻은 바뀌지 않도록 모바일 전체 메뉴와 PC sidebar 가 같은 route 체계를 가리키게 유지합니다.">
        <ul className="summary-list">
          {fieldUsabilityPrinciples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="모바일 상태 문장 가이드" description="한 손 사용 중에도 loading, empty, error, forbidden, offline, 내부 확인용 데이터 의미가 섞이지 않게 같은 문장을 유지합니다.">
        <div className="grid-auto-compact">
          {menuStatusGuideCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="모바일 추천 확인 순서" description="하단 탭과 전체 메뉴를 눌러 볼 때도 홈 → 복구 → 실제 업무 순서가 흔들리지 않게 고정합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <h3>일반 직원 · 팀장 확인 순서</h3>
            <p>같은 정보구조를 따라 홈 → 근태 → 휴가 → 결재 → 협업 → 내 정보 순서로 확인합니다.</p>
            <p className="card-note">/login → /dashboard → /attendance → /leave → /approvals → /boards → /documents → /me</p>
          </article>
          {hasManagementMenuAccess(roleCode) ? (
            <article className="info-card">
              <h3>관리자 계정·정책 확인 순서</h3>
              <p>모바일 메뉴에서도 일반 업무 뒤에만 경영업무 분리 메뉴를 확인하고, HR_ADMIN 은 첫 관리자 레인을 /admin/users 로 읽습니다.</p>
              <p className="card-note">/menu → /management → /admin/users → /admin/policies → /admin/audit-logs</p>
            </article>
          ) : null}
        </div>
      </SurfaceSection>

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
        title="메뉴 검토 포인트"
        description="실사용 기준으로 홈/메뉴 역할 분리와 권한별 노출 기준을 확인할 때 꼭 같이 보는 점검 항목입니다."
        muted
      >
        <ul className="summary-list">
          <li>모바일 홈(`/dashboard`)과 메뉴(`/menu`)가 같은 홈 바로가기 API를 읽고 같은 권한 기준을 사용한다.</li>
          <li>`/dashboard` 는 오늘 업무 시작 화면, `/menu` 는 전체 기능 탐색 화면으로 서로 다른 책임이 읽힌다.</li>
          <li>일반 사용자는 관리자/감사/경영업무 shortcut 을 받지 않고, 권한 있는 사용자만 개인 전용 바로가기로 본다.</li>
          <li>메신저/메일/알림은 현재 확인 가능한 범위를 안내하고, 실제 외부 연동은 승인 게이트로 남긴다.</li>
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
