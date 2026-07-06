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
  { href: appRoutes.admin.users, label: "사원 계정 관리 API" },
  { href: appRoutes.admin.policies, label: "권한·운영 정책 API" },
  { href: appRoutes.admin.auditLogs, label: "감사로그 API" },
] as const;

const adminWorkButtons = [
  {
    href: "/admin/users",
    title: "사원 계정 관리",
    description: "신규입사, 재직 중 권한 변경, 잠금, 비활성화, 퇴사 처리까지 계정 생애주기를 관리합니다.",
    firstReviewPoint: "계정 상태, 직원 연결, 역할, 고위험 권한",
  },
  {
    href: "/admin/users#permission-matrix",
    title: "사용자별 권한 관리",
    description: "사용자 계정별 그룹웨어 기능 접근권한과 관리자 권한 범위를 한 곳에서 확인합니다.",
    firstReviewPoint: "기능별 보기·작성·수정·삭제·승인·관리 권한",
  },
  {
    href: "/admin/policies",
    title: "운영 정책 관리",
    description: "통합설정에 흩어져 있던 관리자 정책 설정을 관리자 페이지 업무로 분리합니다.",
    firstReviewPoint: "근태·휴가·문서·게시판 정책과 적용 전 승인 게이트",
  },
  {
    href: "/admin/audit-logs",
    title: "감사로그",
    description: "계정 생성, 상태 변경, 권한 변경, 관리자 조회 이력을 읽기 전용으로 추적합니다.",
    firstReviewPoint: "변경 전/후, 조작자, 대상, 사유, 회사 경계",
  },
] as const;

const adminScopeRules = [
  "관리자 페이지 사이드바에는 관리자 업무 기능만 노출합니다.",
  "기본업무, 부서업무포털, 지점관리포털의 일반 업무 버튼은 관리자 사이드바에 섞지 않습니다.",
  "통합설정의 개인 설정은 유지하고, 사용자/권한/운영 정책/감사 기능은 관리자 페이지로 분리합니다.",
  "저장 기능은 실제 API → DB → 재조회 → 감사로그 흐름이 준비된 경우에만 활성화합니다.",
] as const;

export function AdminPageContent({ visibleAdminHubCards }: { visibleAdminHubCards: readonly AdminHubCard[] }) {
  return (
    <PageShell
      backHref="/home"
      backLabel="대시보드로"
      eyebrow="관리자 전용"
      title="그룹웨어관리자"
      description="관리자 계정이 사원 계정, 기능별 세부권한, 운영 정책, 감사로그를 한 곳에서 확인하고 관리하는 관리자 전용 페이지입니다."
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
        title="관리자 업무 진입"
        description="사이드바와 허브에서 같은 관리자 업무 버튼을 사용합니다. 일반 직원용 업무 메뉴는 이 영역에 섞지 않습니다."
      >
        <div className="mobile-summary-grid">
          {adminWorkButtons.map((button) => (
            <article key={button.href} className="route-card">
              <Pill tone="accent">관리자 업무</Pill>
              <h3>{button.title}</h3>
              <p>{button.description}</p>
              <p className="card-note">먼저 볼 것: {button.firstReviewPoint}</p>
              <Link href={button.href}>진입하기 →</Link>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="구현 범위"
        description="이번 1차는 관리자 페이지 정보구조와 실제 계정 목록·권한 요약 확인 흐름을 먼저 고정합니다."
      >
        <ul className="summary-list">
          {[...adminHubPriorityChecks, ...adminUserHighlights].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="관리자 페이지 분리 원칙" description="통합설정과 관리자 페이지의 책임을 분리합니다." muted>
        <ul className="summary-list">
          {adminScopeRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="권한별 진입 경계" description="일반 사용자와 감사 전용 사용자는 관리자 변경 업무에 들어오지 못해야 합니다.">
        <div className="grid-auto-compact">
          {adminRoleEntryRules.map((rule) => (
            <article key={rule} className="info-card">
              <Pill tone="warning">접근 기준</Pill>
              <p>{rule}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="기존 관리자 화면 연결"
        description="이미 존재하는 관리자 route를 유지하면서 이름과 책임을 그룹웨어관리자 페이지 기준으로 정리합니다."
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

      <SurfaceSection title="저장 전 승인 게이트" description="운영 계정·권한 변경은 실데이터 영향이 있으므로 안전 기준을 유지합니다." muted>
        <ul className="bullet-list">
          {adminApprovalGateNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="함께 보는 API 시작점" description="화면은 same-origin 관리자 API와 같은 책임을 공유합니다.">
        <ul className="summary-list">
          {adminApiLinks.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="통합설정에서 관리자 페이지로 옮길 기능" description="개인 설정이 아닌 회사 운영·권한 설정은 관리자 페이지에서 다룹니다.">
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
