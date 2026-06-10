import Link from "next/link";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { mobilePrimaryNav, mobileQuickActions } from "../mobile-pwa-config";

const sessionCards = [
  { title: "오늘 세션 상태", body: "placeholder HttpOnly Cookie 세션 상태와 현재 사용자 계약을 먼저 보여 줍니다.", note: "/api/me" },
  { title: "현재 회사 범위", body: "company_id 기준 멀티테넌시 경계를 모바일에서도 흐리지 않도록 요약합니다.", note: "/api/companies" },
  { title: "권한/가드레일", body: "roleCodes / permissions 와 self-approval guardrail 연결 지점을 분명히 남깁니다.", note: "/api/roles" },
] as const;

const todayShortcuts = [
  { href: "/attendance", title: "출퇴근 먼저", body: "출근/퇴근 CTA, 마지막 기록, 정정 요청 진입점" },
  { href: "/leave", title: "휴가 확인", body: "잔여/신청/승인 대기 우선 노출" },
  { href: "/approvals", title: "승인함 확인", body: "대기 문서와 큰 승인/반려 CTA" },
] as const;

export default function DashboardPage() {
  return (
    <PageShell
      backHref="/"
      backLabel="홈으로"
      eyebrow="모바일 핵심 진입점"
      title="대시보드 / 내 정보 skeleton"
      description="실제 완료 화면이 아니라, 모바일에서 자주 쓰는 업무 카드와 세션 요약을 먼저 보여 주는 placeholder 입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">small-screen priority</Pill>
          <Pill>placeholder only</Pill>
        </div>
      }
    >
      <SurfaceSection title="오늘 바로 보는 요약" description="가로 스크롤 없이 오늘 상태와 핵심 진입점을 먼저 확인합니다.">
        <div className="grid-auto">
          {sessionCards.map((card) => (
            <article key={card.title} className="stat-card">
              <Pill>{card.note}</Pill>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="모바일 quick action" description="Phase 6 1차에서 먼저 노출할 업무를 카드형으로 재배치했습니다.">
        <div className="mobile-summary-grid">
          {todayShortcuts.map((card) => (
            <article key={card.href} className="route-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <a href={card.href}>바로가기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="주요 route 맵" description="현재 route 구조를 바꾸지 않고도 모바일 우선 탐색을 유지합니다." muted>
        <div className="grid-auto-compact">
          {mobilePrimaryNav.map((item) => (
            <article key={item.href} className="info-card">
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>{item.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결할 API" description="same-origin /api 계약은 그대로 유지합니다.">
        <ul className="summary-list">
          <li><a href={appRoutes.me}>{appRoutes.me}</a> — 현재 사용자와 세션 상태</li>
          <li><a href={appRoutes.org.companies}>{appRoutes.org.companies}</a> — 회사 기본 조회</li>
          <li><a href={appRoutes.org.roles}>{appRoutes.org.roles}</a> — 역할/권한 요약</li>
          <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a> — 근태 목록 contract</li>
          <li><a href={appRoutes.leave.requests}>{appRoutes.leave.requests}</a> — 휴가 신청/대기 목록 contract</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="홈에 남긴 모바일 원칙" description="홈과 대시보드가 서로 다른 기준을 갖지 않도록 핵심 메시지를 재사용합니다.">
        <div className="grid-auto-compact">
          {mobileQuickActions.map((item) => (
            <article key={item.href} className="info-card">
              <Pill tone="accent">{item.badge}</Pill>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
