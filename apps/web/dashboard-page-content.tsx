import React from "react";
import Link from "next/link";
import type { HomeShortcut, RoleCode } from "@gw/shared";

import { Phase16PilotPanel } from "./app/_components/phase-16-pilot";
import { Phase47RecommendedFlowSection, Phase47StatusGuideSection } from "./app/_components/phase47-usage-guide";
import { HomeShortcutsPanel } from "./app/_components/home-shortcuts-panel";
import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import { fieldUsabilityPrinciples, recoveryRouteCards } from "./app/mobile-pwa-config";
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
  type DashboardManagementCard,
} from "./app/dashboard/dashboard-config";

export function DashboardPageContent({
  adminShortcut,
  managementCards,
  viewerRoleCode,
  homeShortcuts = [],
  homeShortcutNotices = [],
  homeShortcutLoadError = null,
}: {
  adminShortcut: DashboardAdminShortcut | null;
  managementCards: readonly DashboardManagementCard[];
  viewerRoleCode: string | null;
  homeShortcuts?: readonly HomeShortcut[];
  homeShortcutNotices?: readonly string[];
  homeShortcutLoadError?: string | null;
}) {
  const canViewUatRehearsalPackage = viewerRoleCode
    ? new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "AUDITOR"]).has(viewerRoleCode as RoleCode)
    : false;

  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      eyebrow="Phase 57 홈·메뉴 IA 실사용 UAT"
      title="홈 / 대시보드"
      description="`/dashboard` 를 오늘 할 일 시작 홈으로 고정하고, 근태·휴가·결재 같은 기본 업무를 먼저 읽은 뒤 공지·문서·내 정보·조회 흐름으로 이어지게 정리한 홈 화면입니다."
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
      <SurfaceSection title="현재 세션 / 홈-경영업무 분리" description="로그인 뒤 홈은 /dashboard 로 고정하고, 직원 기본 업무와 민감 운영 업무를 다른 레인으로 분리해 확인합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">현재 세션</Pill>
            <h3>{viewerRoleCode ?? "로그인 전"}</h3>
            <p>로그인 성공 시 topbar 로그아웃과 함께 gw_session 세션을 유지하고, 홈은 /dashboard 에서 계속 확인합니다.</p>
          </article>
          <article className="info-card">
            <Pill>일반 홈</Pill>
            <h3>/dashboard</h3>
            <p>근태, 휴가, 전자결재, 게시판, 문서, 내 정보 같은 일반 직원 기본 업무 시작점입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">경영업무 허브</Pill>
            <h3>/management</h3>
            <p>급여, 세무, 노무, 법무, 감사 같은 내부관리 모듈은 홈과 분리된 별도 허브에서만 검토합니다.</p>
            <a href="/management">/management</a>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="Phase 57 홈 역할 고정"
        description="이번 파일럿/UAT에서는 `/dashboard` 를 오늘 업무 시작 홈으로, `/menu` 를 전체 기능 탐색 메뉴로 분리하고 운영 관리자 화면과 섞이지 않게 안내합니다."
      >
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">추천 순서</Pill>
            <h3>/dashboard → /attendance → /leave → /approvals → /boards → /documents → /me</h3>
            <p>오늘 할 일부터 협업, 마무리 확인까지 실제 파일럿 기록 순서로 다시 읽습니다.</p>
          </article>
          <article className="info-card">
            <Pill>분리 원칙</Pill>
            <h3>/dashboard 는 홈, /menu 는 탐색, 운영 허브는 별도 레인</h3>
            <p>/management, /admin/users, /admin/policies 는 직원 기본 홈의 다음 단계가 아니라 권한 있는 운영 사용자 레인이며, `/menu` 도 전체 탐색 화면으로만 읽혀야 합니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">UAT 기록 포인트</Pill>
            <h3>happy · forbidden · empty · error · loading · mobile/PC</h3>
            <p>각 화면에서 같은 분류 언어를 반복해 tester 와 docs 가 바로 이어받을 수 있게 고정합니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="오늘 할 일"
        description="직원 기본 업무 기준 상단 액션을 `/attendance` → `/leave` → `/approvals` → `/boards` → `/documents` → `/me` 순서로 고정하고, 조직/직원 조회는 마지막 읽기 보조 레인으로 이어집니다. 실제 상태 변경은 각 화면에서만 이어집니다."
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

      <SurfaceSection
        title="홈 바로가기"
        description="`/dashboard` 와 `/menu` 가 같이 쓰는 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기를 실제 API 기준으로 나눠 보여 줍니다."
      >
        <HomeShortcutsPanel
          homeShortcuts={homeShortcuts}
          homeShortcutNotices={homeShortcutNotices}
          homeShortcutLoadError={homeShortcutLoadError}
        />
      </SurfaceSection>

      <SurfaceSection title="현장 업무 사용성 원칙" description="홈, 메뉴, 알림, 오프라인, 운영 레인이 서로 다른 제품처럼 읽히지 않도록 같은 기준을 고정합니다.">
        <ul className="summary-list">
          {fieldUsabilityPrinciples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <Phase47StatusGuideSection />

      <Phase47RecommendedFlowSection roleCode={viewerRoleCode as RoleCode | null} />

      <SurfaceSection title="승인/대기 요약" description="근태·휴가 예외와 승인 병목 후보를 먼저 읽고 attendance/leave/approvals 상세 화면으로 이동합니다.">
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

      <SurfaceSection title="역할별 첫 이동" description="직원, 팀장, 인사/운영, 감사 사용자가 어느 레인으로 먼저 이어지는지 같은 화면에서 설명합니다.">
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

      {canViewUatRehearsalPackage ? (
        <SurfaceSection
          title="내부 도입 리허설 패키지"
          description="역할별 시나리오, 이슈 기록 템플릿, 진행자 스크립트, approval gate 를 `/uat` 한 화면에서 다시 확인합니다."
        >
          <div className="grid-auto-compact">
            <article className="info-card">
              <Pill tone="accent">권한 있는 진행자용 시작점</Pill>
              <h3>/uat</h3>
              <p>경영업무 담당자, 운영자, 감사 담당자가 live URL, 테스트 계정, 추천 route 를 한 번에 확인하는 내부 진행용 패키지입니다.</p>
              <a href="/uat">/uat</a>
            </article>
            <article className="info-card">
              <Pill tone="warning">이슈 분류</Pill>
              <h3>blocker · major · minor · copy-doc · approval-needed</h3>
              <p>권한 누출과 scope 누출은 blocker 로, 실데이터/외부 연동/production 변경은 approval-needed 로 따로 기록합니다.</p>
            </article>
            <article className="info-card">
              <Pill>final report</Pill>
              <h3>live URL + 역할별 시나리오 + 승인 게이트</h3>
              <p>최종 보고에는 live URL, 확인 route, 역할별 시나리오, 남은 승인 게이트를 분리해 남깁니다.</p>
            </article>
          </div>
        </SurfaceSection>
      ) : null}

      <SurfaceSection
        title="관리자 운영 검토 레인"
        description="운영자는 일반 직원 흐름과 섞지 않고 `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health` 순서로 운영 기준선을 먼저 검토합니다."
      >
        <ul className="summary-list">
          <li>`/dashboard` 에서 일반 직원 홈과 운영 레인이 분리되어 보이는지 확인</li>
          <li>`/management` 에서 운영 허브가 일반 홈의 연장이 아니라는 안내 확인</li>
          <li>`/admin/users` 에서 계정 생성·권한 diff·비밀번호 초기화가 dev-safe preview 로 읽히는지 확인</li>
          <li>`/admin/policies` 에서 current/candidate/capability/audit preview 형식이 실제 저장 완료처럼 보이지 않는지 확인</li>
          <li>`/admin/audit-logs` 에서 masked/company boundary 기준으로 read-only 감사 추적 확인</li>
          <li>`/api/health` 를 full monitoring 이 아닌 최소 liveness 기준으로 기록</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="오늘 상태와 마무리 조회" description="근태·휴가 상태와 내 정보·조직·직원 읽기 흐름을 함께 보여 주고 운영 변경은 분리합니다.">
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
        description="HR·세무·노무·지점 업무를 개별 앱처럼 흩뿌리지 않고 공통 work item, 문서, 마감, 권한 설명 구조로 먼저 묶습니다."
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

      {managementCards.length > 0 ? (
        <SurfaceSection
          title="경영업무 분리 진입"
          description="급여·세무·노무·법무·감사 내부관리 모듈은 일반 직원용 메뉴/허브와 섞지 않고 지정 관리자·담당자만 별도 영역에서 확인합니다."
        >
          <div className="grid-auto-compact">
            {managementCards.map((card) => (
              <article key={card.href} className="info-card">
                <Pill tone="warning">{card.roleScope}</Pill>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <a href={card.href}>{card.href}</a>
              </article>
            ))}
          </div>
        </SurfaceSection>
      ) : null}

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

      <SurfaceSection title="운영 요약" description="직원 기본 업무 뒤에 보는 읽기 중심 조직/직원 진입점과 관리자 운영 경계를 분리한 상태로 안내합니다." muted>
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

      <SurfaceSection title="dev-safe / 승인 게이트" description="운영처럼 보이더라도 아직 열지 않은 범위를 숨기지 않기 위한 고정 문구입니다.">
        <ul className="bullet-list">
          <li>dev-safe 요약이며 실제 저장·발송·외부 연동은 이번 단계에서 실행하지 않습니다.</li>
          <li>실제 개인정보 원문, production KPI, 외부 알림, 권한 저장은 이번 단계 범위에서 제외합니다.</li>
          <li>모바일/PWA 좁은 화면에서도 카드 제목, 한 줄 상태, CTA 순서가 먼저 읽히도록 유지합니다.</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="막힐 때 다시 가는 현장 복구 경로" description="홈에서 끝내지 못한 상황을 메뉴·알림·오프라인과 연결해 다시 풀 수 있게 둡니다.">
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
