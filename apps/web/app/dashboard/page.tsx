import React from "react";
import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import {
  dashboardActionCards,
  dashboardApiLinks,
  dashboardOperationsCards,
  dashboardReadingCards,
  dashboardRoleJourneyCards,
  dashboardStatusCards,
  dashboardTopBadges,
  dashboardWaitingCards,
  getDashboardAdminShortcut,
} from "./dashboard-config";

const previewRoleCodes = ["EMPLOYEE"] as const;

export default function DashboardPage() {
  const adminShortcut = getDashboardAdminShortcut([...previewRoleCodes]);

  return (
    <PageShell
      backHref="/"
      backLabel="홈으로"
      eyebrow="Phase 14 실사용 MVP 통합 1차"
      title="대시보드 시작 화면 skeleton"
      description="오늘 할 일, 승인 대기, 일반 조회, 관리자 경계를 한 화면에서 먼저 읽히게 다시 묶은 dev-safe placeholder 입니다."
      actions={
        <div className="pill-row">
          {dashboardTopBadges.map((badge) => (
            <Pill key={badge} tone={badge === "dev-safe summary" ? "accent" : "default"}>
              {badge}
            </Pill>
          ))}
        </div>
      }
    >
      <SurfaceSection
        title="오늘 할 일"
        description="가장 먼저 눌러야 할 업무 3가지를 상단에 고정하고, 실제 상태 변경은 각 화면에서만 이어집니다."
      >
        <div className="mobile-summary-grid">
          {dashboardActionCards.map((card) => (
            <article key={card.href} className="route-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <p className="card-note">{card.detail}</p>
              <a href={card.href}>바로가기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="승인/대기 요약" description="병목 후보와 다시 확인할 건을 먼저 읽고 approvals/attendance 상세 화면으로 이동합니다.">
        <div className="grid-auto-compact">
          {dashboardWaitingCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone="accent">대기 요약</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="역할별 첫 이동" description="직원, 팀장, 인사/운영, 감사 사용자가 어디로 먼저 이어지는지 같은 화면에서 설명합니다.">
        <div className="grid-auto-compact">
          {dashboardRoleJourneyCards.map((card) => (
            <article key={card.role} className="info-card">
              <Pill tone="accent">{card.role}</Pill>
              <h3>{card.firstRoute}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="오늘 상태와 일반 조회" description="근태 상태와 조직/직원 읽기 흐름을 함께 보여 주고 운영 변경은 분리합니다.">
        <div className="grid-auto-compact">
          {dashboardStatusCards.map((card) => (
            <article key={card.title} className="stat-card">
              <Pill>{card.href}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="공지/문서 진입점" description="긴 본문 대신 읽기 중심 진입점만 짧게 보여 주고 상세 확인은 각 모듈에서 이어집니다.">
        <div className="grid-auto-compact">
          {dashboardReadingCards.map((card) => (
            <article key={card.href} className="route-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="운영 요약" description="일반 조회 흐름과 관리자 운영 경계를 분리한 상태로 조직/직원 진입점과 권한 기반 admin CTA 규칙만 안내합니다." muted>
        <div className="grid-auto-compact">
          {dashboardOperationsCards.map((card) => (
            <article key={card.href} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
          <article className="info-card">
            <Pill tone="warning">admin boundary</Pill>
            <h3>관리자 진입 경계</h3>
            <p>권한 있는 사용자에게만 관리자 진입 CTA를 노출합니다.</p>
            <p className="card-note">일반 사용자 기본 화면에서는 관리자 전용 링크를 숨기고, /admin route/API guard 를 그대로 유지합니다.</p>
            {adminShortcut ? <Link href={adminShortcut.href}>{adminShortcut.title}</Link> : null}
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결할 읽기 API" description="새 운영 백엔드를 크게 만들기보다 기존 read-only route 를 카드 요약용으로 먼저 재사용합니다.">
        <ul className="summary-list">
          {dashboardApiLinks.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a> — {item.description}
            </li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="placeholder 안내" description="운영처럼 보이되 운영 완료를 속이지 않기 위한 고정 문구입니다.">
        <ul className="bullet-list">
          <li>placeholder/dev-safe 요약이며 실제 저장이나 발송을 실행하지 않습니다.</li>
          <li>실제 개인정보 원문, production KPI, 외부 알림, 권한 저장은 이번 단계 범위에서 제외합니다.</li>
          <li>모바일/PWA 좁은 화면에서도 카드 제목, 한 줄 상태, CTA 순서가 먼저 읽히도록 유지합니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
