import React from "react";
import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "./_components/page-shell";
import { installGuideSteps, mobilePrimaryNav, mobileReviewChecklist } from "./mobile-pwa-config";

const primaryFlows = [
  {
    badge: "일반 업무 흐름",
    title: "/ → /login → /dashboard → /attendance → /leave → /approvals → /boards·/documents → /me → /org·/employees",
    body: "일반 직원과 팀장은 오늘 할 일 확인 뒤 출퇴근, 휴가, 전자결재, 공지/문서, 내 정보, 조직/직원 조회 순서로 하루 흐름을 먼저 봅니다.",
  },
  {
    badge: "관리자 검토 흐름",
    title: "/dashboard 권한 기반 CTA → /admin → /admin/users · /admin/policies · /admin/audit-logs",
    body: "인사/운영 관리자와 감사 사용자는 같은 앱 안에서 별도 검토 흐름으로 들어가며, 일반 사용자 기본 화면에는 관리자 CTA 를 섞어 보이지 않습니다.",
  },
] as const;

const roleEntryCards = [
  {
    role: "일반 직원",
    firstRoute: "/dashboard",
    summary: "오늘 상태를 먼저 보고 출퇴근, 휴가, 전자결재로 이동합니다.",
    note: "관리자 기능은 기본 흐름에 노출하지 않습니다.",
  },
  {
    role: "팀장 / 결재자",
    firstRoute: "/dashboard",
    summary: "같은 대시보드에서 시작하되 승인 대기와 팀 병목 확인을 더 먼저 처리합니다.",
    note: "필요 시 /leave, /employees 에서 일정과 인원 상태를 확인합니다.",
  },
  {
    role: "인사 / 운영 관리자",
    firstRoute: "/admin",
    summary: "사용자, 정책, 감사 preview 를 검토하는 운영 흐름으로 분리합니다.",
    note: "일반 조회 화면과 운영 변경 검토 화면을 섞지 않습니다.",
  },
  {
    role: "감사 전용 사용자",
    firstRoute: "/admin/audit-logs",
    summary: "감사 로그 조회와 마스킹/회사 경계 확인에 집중합니다.",
    note: "전체 관리자 허브보다 조회 전용 경로가 먼저입니다.",
  },
] as const;

const secondaryLinks = [
  { href: "/boards", label: "게시판", summary: "공지/게시판 읽기 흐름은 /documents 와 함께 협업 묶음으로 이어서 확인합니다." },
  { href: "/employees", label: "직원", summary: "조직 확인 뒤 직원 상태와 소속을 읽는 마지막 조회 흐름으로 확인합니다." },
  { href: "/offline", label: "오프라인 안내", summary: "상태 변경이 실제 성공처럼 보이지 않도록 제약과 재시도 절차를 분리합니다." },
] as const;

export default function HomePage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 14 실사용 MVP 통합 1차"
      title="그룹웨어 실사용 MVP 시작점"
      description="홈, 로그인, 대시보드, 일반 업무 화면, 관리자 검토 화면을 한 흐름으로 눌러 보면서 직원의 하루 업무 순서를 그대로 따라갈 수 있게 정리한 dev-safe 시작 화면입니다."
      actions={
        <div className="action-row">
          <Link href="/login" className="touch-button">
            로그인 흐름 보기
          </Link>
          <Link href="/dashboard" className="touch-button--secondary">
            대시보드 보기
          </Link>
        </div>
      }
    >
      <section className="hero-card">
        <p className="brand-link__eyebrow">real-usable MVP pass 1</p>
        <h2 style={{ margin: "8px 0 12px" }}>한 번에 눌러 볼 수 있는 업무 흐름과 관리자 경계를 같이 보여 줍니다.</h2>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          이번 단계는 실제 저장이나 외부 연동을 여는 작업이 아니라, 사내 검토자가 제품의 핵심 흐름을 이해하고 역할별 진입 경계를 확인할 수 있게 묶는 단계입니다.
        </p>
        <div className="pill-row" style={{ marginTop: 16 }}>
          <Pill tone="accent">dev-safe skeleton</Pill>
          <Pill tone="accent">general flow + admin boundary</Pill>
          <Pill tone="warning">실제 저장/권한 변경 제외</Pill>
        </div>
      </section>

      <SurfaceSection title="이번 MVP에서 먼저 보는 2개 흐름" description="한 앱 안에서 일반 업무와 관리자 검토 흐름을 분리해 보여 줍니다.">
        <div className="grid-auto">
          {primaryFlows.map((flow) => (
            <article key={flow.title} className="route-card">
              <div className="pill-row">
                <Pill tone="accent">{flow.badge}</Pill>
              </div>
              <h3>{flow.title}</h3>
              <p>{flow.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="역할별 첫 진입점" description="직원, 팀장, 인사/운영, 감사 사용자가 어디부터 보는지 먼저 고정합니다.">
        <div className="mobile-summary-grid">
          {roleEntryCards.map((item) => (
            <article key={item.role} className="info-card">
              <Pill tone="accent">{item.role}</Pill>
              <h3>{item.firstRoute}</h3>
              <p>{item.summary}</p>
              <p className="card-note">{item.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="핵심 route 바로가기" description="이번 1차 smoke 의 중심이 되는 직원 하루 업무 route 를 같은 순서로 먼저 노출합니다.">
        <div className="grid-auto">
          {mobilePrimaryNav.map((item) => (
            <article key={item.href} className="route-card">
              <div className="pill-row">
                <Pill>{item.label}</Pill>
              </div>
              <h3>{item.href}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>바로 열기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="마무리 조회 / 예외 확인 경로" description="핵심 흐름 뒤에 보는 조직·직원 조회와 오프라인 예외 안내를 별도 섹션으로 분리합니다." muted>
        <div className="grid-auto-compact">
          {secondaryLinks.map((item) => (
            <article key={item.href} className="info-card">
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>{item.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="설치/preview 안내" description="실배포 전에도 유지할 수 있는 상대 경로 manifest 와 preview 안내를 함께 남깁니다.">
        <ol className="number-list">
          {installGuideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="검토 체크포인트" description="live preview 에서 눌러 볼 때 특히 확인할 항목입니다.">
        <ul className="bullet-list">
          <li>일반 사용자 기준 관리자 CTA 가 기본 흐름에 섞여 보이지 않는지 확인</li>
          <li>/attendance 의 정책 안내와 /admin/policies 의 설명 방향이 같은지 확인</li>
          <li>/employees 일반 조회와 /admin/users 운영 검토가 다른 역할로 읽히는지 확인</li>
          {mobileReviewChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}