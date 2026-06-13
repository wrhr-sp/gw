import React from "react";
import Link from "next/link";

import { Phase16PilotPanel } from "./app/_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import {
  dashboardActionCards,
  dashboardApiLinks,
  dashboardOperationsCards,
  dashboardReadingCards,
  dashboardRoleJourneyCards,
  dashboardStatusCards,
  dashboardTopBadges,
  dashboardWaitingCards,
  dashboardWorkItemCards,
  type DashboardAdminShortcut,
} from "./app/dashboard/dashboard-config";

export function DashboardPageContent({ adminShortcut }: { adminShortcut: DashboardAdminShortcut | null }) {
  return (
    <PageShell
      backHref="/"
      backLabel="홈으로"
      eyebrow="Phase 23 관리자 운영 콘솔 실사용 1차"
      title="대시보드 시작 화면 skeleton"
      description="오늘 할 일, 휴가/승인 대기, 공지·문서 진입, 내 정보와 일반 조회, 관리자 운영 검토 레인을 한 화면에서 먼저 읽히게 다시 묶은 dev-safe placeholder 입니다."
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
        description="가장 먼저 눌러야 할 상단 액션 6가지를 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 고정하고, 실제 상태 변경은 각 화면에서만 이어집니다."
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

      <SurfaceSection
        title="관리자 운영 검토 레인"
        description="운영자는 일반 직원 흐름과 섞지 않고 `/dashboard` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 순서로 검토합니다."
      >
        <ul className="summary-list">
          <li>`/dashboard` 에서 권한 기반 운영 CTA 또는 감사 CTA 확인</li>
          <li>`/admin` 에서 오늘 검토할 사용자/정책/감사 체크포인트 정리</li>
          <li>`/admin/users` 에서 직원 조회가 아니라 권한·상태 변경 후보를 검토</li>
          <li>`/admin/policies` 에서 근태·휴가·결재·게시판·문서 정책 candidate 비교</li>
          <li>`/admin/audit-logs` 에서 masked/company boundary 기준으로 read-only 감사 추적</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="오늘 상태와 마무리 조회" description="근태·휴가 상태와 내 정보·조직 읽기 흐름을 함께 보여 주고 운영 변경은 분리합니다.">
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

      <SurfaceSection
        title="공통 업무 엔진 진입"
        description="HR·세무·노무·법무·지점 업무를 개별 앱처럼 흩뿌리지 않고 공통 work item, 문서, 마감, 권한 설명 구조로 먼저 묶습니다."
      >
        <div className="grid-auto-compact">
          {dashboardWorkItemCards.map((card) => (
            <article key={card.href} className="info-card">
              <Pill tone="accent">{card.roleScope}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <Phase16PilotPanel
        description="대시보드는 핵심 업무 route, 협업 route, 내 정보 확인, 관리자 route 를 한 화면에서 묶어 사내 검토용 초안의 시작점으로 사용합니다."
        confirmItems={[
          "일반 직원은 /attendance, /leave, /approvals, /boards, /documents, /me 로 자연스럽게 이동한다.",
          "팀장/승인자는 같은 허브에서 시작하되 approvals 우선순위를 더 먼저 확인한다.",
          "운영 관리자와 감사 사용자는 일반 조회와 /admin 계열 preview 가 분리돼 보인다.",
        ]}
        blockedItems={[
          "실제 production KPI, 외부 알림 발송, 개인정보 원문 노출은 이번 단계에서 열지 않는다.",
          "게시판/문서 진입점은 읽기 중심 placeholder 이며 운영 저장 완료 화면처럼 보이지 않게 유지한다.",
        ]}
        nextRoutes={[
          { href: "/attendance", label: "/attendance", description: "오늘 근태 상태와 정정 필요 여부 확인" },
          { href: "/leave", label: "/leave", description: "잔여와 신청/승인 대기 흐름 확인" },
          { href: "/approvals", label: "/approvals", description: "승인 대기와 팀 병목 후보 확인" },
          { href: "/boards", label: "/boards", description: "공지/게시판 가드레일 확인" },
          { href: "/documents", label: "/documents", description: "문서 공간/첨부 metadata 경계 확인" },
          { href: "/me", label: "/me", description: "세션, 역할, 보안 안내 뒤 조직 조회로 이어지는지 확인" },
        ]}
        approvalGates={[
          "production data 반영",
          "secret 입력/교체",
          "DNS/custom domain",
          "유료 리소스 생성·증액",
          "외부 연동",
        ]}
        evidenceNote="live fetch 가 막히면 pnpm check, pnpm --filter @gw/web build:cf, local preview/deployment metadata 를 대체 근거로 남깁니다."
      />

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