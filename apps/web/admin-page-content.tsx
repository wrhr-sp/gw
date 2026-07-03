import React from "react";
import Link from "next/link";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import {
  adminApprovalGateNotes,
  adminHubBadges,
  adminHubPriorityChecks,
  adminPolicySections,
  adminRoleEntryRules,
  adminUserHighlights,
  type AdminHubCard,
} from "./admin-config";

const adminApiLinks = [
  { href: appRoutes.admin.users, label: "사용자 / 권한 API" },
  { href: appRoutes.admin.policies, label: "운영 정책 API" },
  { href: appRoutes.admin.auditLogs, label: "감사 로그 API" },
  { href: appRoutes.admin.invites, label: "초대 preview API" },
] as const;

export function AdminPageContent({ visibleAdminHubCards }: { visibleAdminHubCards: readonly AdminHubCard[] }) {
  return (
    <PageShell
      backHref="/home"
      backLabel="대시보드로"
      eyebrow="Phase 23 관리자 운영 콘솔 실사용 1차"
      title="관리자 허브"
      description="권한 있는 운영자가 어디서 들어와 무엇을 먼저 검토해야 하는지 고정한 operations-first 콘솔입니다. 실제 저장 대신 검토 순서, 감사 preview, 승인 게이트를 먼저 보여 줍니다."
      actions={
        <div className="pill-row">
          {adminHubBadges.map((badge) => (
            <Pill key={badge} tone={badge === "approval-gated" ? "warning" : "accent"}>
              {badge}
            </Pill>
          ))}
        </div>
      }
    >
      <SurfaceSection
        title="운영 검토 순서"
        description="이번 단계의 기준 순서는 `/home` → `/admin` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` 입니다."
      >
        <ul className="summary-list">
          <li>대시보드에서 권한 기반 운영 CTA 또는 감사 CTA 를 확인합니다.</li>
          <li>관리자 허브에서 오늘 검토할 사용자·정책·감사 포인트를 먼저 읽습니다.</li>
          <li>`/employees`, `/boards`, `/documents` 는 일반 조회/협업 화면으로 남기고 저장 전 운영 검토는 `/admin/*` 에서 분리합니다.</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="오늘 먼저 볼 운영 체크포인트"
        description="관리자 허브에 들어오면 저장 버튼보다 먼저 검토할 운영 포인트를 위에서부터 읽습니다."
      >
        <ul className="summary-list">
          {[...adminHubPriorityChecks, ...adminUserHighlights].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="권한별 진입 경계"
        description="UI 노출 조건과 route/API guard 는 같은 의미를 공유하되 서로 다른 책임으로 유지합니다."
      >
        <div className="grid-auto-compact">
          {adminRoleEntryRules.map((rule) => (
            <article key={rule} className="info-card">
              <Pill tone="warning">entry rule</Pill>
              <p>{rule}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="운영 콘솔 묶음"
        description="사용자, 정책, 감사 로그를 각각 다른 책임으로 분리하고 각 화면의 첫 검토 포인트를 함께 보여 줍니다."
      >
        <div className="mobile-summary-grid">
          {visibleAdminHubCards.map((card) => (
            <article key={card.href} className="route-card">
              <Pill>{card.primaryAudience}</Pill>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <p className="card-note">먼저 볼 것: {card.firstReviewPoint}</p>
              <p className="card-note">가드레일: {card.guardrail}</p>
              <Link href={card.href}>화면 보기 →</Link>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="저장 전 승인 게이트"
        description="이번 단계는 실제 저장이 아니라 승인 전 검토 흐름을 고정하는 단계입니다."
        muted
      >
        <ul className="bullet-list">
          {adminApprovalGateNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="함께 보는 API 시작점"
        description="큰 새 백엔드를 만들기보다 기존 admin read-only candidate API 를 화면과 같은 순서로 연결합니다."
      >
        <ul className="summary-list">
          {adminApiLinks.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="정책 카드 공통 형식"
        description="하위 정책 화면은 모두 current/candidate/capability/audit preview 형식을 공유합니다."
      >
        <div className="grid-auto-compact">
          {adminPolicySections.map((section) => (
            <article key={section.title} className="info-card">
              <h3>{section.title}</h3>
              <p>{section.currentState}</p>
              <p className="card-note">필요 capability: {section.capability}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
