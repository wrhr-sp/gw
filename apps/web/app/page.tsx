import React from "react";
import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "./_components/page-shell";
import { SessionSummaryPanel } from "./_components/real-usage-panels";
import { installGuideSteps, mobileBottomTabs, mobilePrimaryNav, mobileReviewChecklist } from "./mobile-pwa-config";

const primaryFlows = [
  {
    badge: "일반 업무 흐름",
    title: "/ → /login → /dashboard → /attendance → /leave → /approvals → /boards·/documents → /me → /org·/employees",
    body: "일반 직원과 팀장은 오늘 할 일 확인 뒤 출퇴근, 휴가, 전자결재, 공지/문서, 내 정보, 조직/직원 조회 순서로 하루 흐름을 먼저 봅니다.",
  },
  {
    badge: "관리자 검토 흐름",
    title:
      "/dashboard 관리자 CTA → 운영 관리자: /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health · 지점 관리자: /work-items/branch → /employees → /org → /management",
    body:
      "운영 관리자는 회사 전체 운영·정책·감사 preview 를 보는 company scope 레인으로, 지점 관리자는 자기 지점 업무·직원·조직 확인 뒤 /management 문맥만 참고하는 branch scope 레인으로 분리해 안내합니다.",
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
    summary: "같은 대시보드에서 시작하되 팀원 근태·휴가 맥락을 본 뒤 승인 대기와 팀 병목 확인을 처리합니다.",
    note: "필요 시 /attendance, /leave, /employees 에서 일정과 인원 상태를 확인합니다.",
  },
  {
    role: "인사 관리자",
    firstRoute: "/dashboard",
    summary: "로그인 직후 공통 홈에서 시작한 뒤 관리자 CTA 로 사용자/권한 관리 레인으로 이어집니다.",
    note: "HR_ADMIN 의 첫 관리자 레인은 /management 가 아니라 /admin/users 계열입니다.",
  },
  {
    role: "운영 관리자",
    firstRoute: "/dashboard",
    summary: "로그인 직후 공통 홈에서 시작한 뒤 company scope 운영 CTA 로 /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health 레인을 확인합니다.",
    note: "운영 관리자는 회사 공통 운영 권한을 검토하고, branch scope 업무 레인과 같은 권한처럼 설명하지 않습니다.",
  },
  {
    role: "지점 관리자",
    firstRoute: "/dashboard",
    summary: "공통 홈 뒤 `/work-items/branch → /employees → /org → /management` 순서의 branch scope 운영 레인으로 이어집니다.",
    note: "`/employees`, `/org` 는 읽기 확인용이고 `/management` 는 회사 공통 운영 authority 가 아니라 연결 문맥으로만 소개합니다.",
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
      eyebrow="Phase 43 일반 직원 홈과 내부관리 허브 분리"
      title="그룹웨어 실사용 MVP 시작점"
      description="홈, 로그인, 대시보드, 근태·휴가 기본 업무, 읽기 중심 인사 조회, 내부관리 허브를 한 흐름으로 눌러 보면서 회사 내부 도입 가능 범위를 실제 API 응답과 함께 확인할 수 있게 정리한 시작 화면입니다."
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
          이번 단계는 실제 저장이나 외부 연동을 여는 작업이 아니라, 사내 검토자가 제품의 핵심 흐름을 이해하고 역할별 진입 경계와 승인 게이트를 확인할 수 있게 묶는 단계입니다.
        </p>
        <div className="pill-row" style={{ marginTop: 16 }}>
          <Pill tone="accent">dev-safe skeleton</Pill>
          <Pill tone="accent">general flow + admin boundary</Pill>
          <Pill tone="warning">실제 저장/권한 변경 제외</Pill>
        </div>
      </section>

      <SurfaceSection title="현재 로그인 상태" description="이미 로그인했다면 이 화면에서 바로 세션과 권한을 다시 확인하고 다음 route 로 이동할 수 있습니다.">
        <SessionSummaryPanel />
      </SurfaceSection>

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

      <SurfaceSection title="모바일 하단 탭 5개" description="파일럿 모바일 기본 탐색은 `메뉴`, `홈`, `메신저`, `메일`, `알림` 5개로 고정하고, 실제 업무 기능은 `메뉴`에서 같은 정보구조로 다시 고릅니다.">
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