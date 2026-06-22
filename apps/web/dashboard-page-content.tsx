import React from "react";
import Link from "next/link";
import type { HomeShortcut } from "@gw/shared";

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

const dashboardStatusGuideCards = [
  {
    title: "loading",
    summary: "아직 내용을 불러오는 중인 상태입니다.",
    detail: "저장 성공이나 권한 차단으로 단정하지 말고 잠시 기다린 뒤 홈 또는 메뉴에서 다시 확인합니다.",
  },
  {
    title: "empty",
    summary: "정상적으로 비어 있을 수 있는 상태입니다.",
    detail: "오늘 처리할 항목이 없거나 현재 권한 범위에 해당 데이터가 없는 상태일 수 있습니다.",
  },
  {
    title: "error",
    summary: "조회나 불러오기에 실패한 상태입니다.",
    detail: "같은 화면에서 반복 저장을 시도하지 말고 메뉴나 오프라인 안내로 이동해 복구 경로를 다시 확인합니다.",
  },
  {
    title: "forbidden",
    summary: "로그인은 되었지만 현재 업무 권한 또는 접근 범위가 맞지 않는 상태입니다.",
    detail: "숨겨진 운영 메뉴를 대신 열지 않고 허용된 홈·메뉴 레인으로 돌아가거나 지정 담당자 레인에서만 확인합니다.",
  },
  {
    title: "offline",
    summary: "네트워크가 불안정해 재시도가 필요한 상태입니다.",
    detail: "가능한 일과 막히는 일을 먼저 확인한 뒤 안정적인 네트워크에서 다시 시도합니다.",
  },
  {
    title: "참고용 요약 데이터",
    summary: "현재 화면에서 먼저 읽는 dev-safe 안내 상태입니다.",
    detail: "현재 화면 정보는 실제 저장 완료, 외부 발송 완료, 운영 반영 완료로 설명하지 않습니다.",
  },
] as const;

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
  const canViewManagementEntry = managementCards.length > 0;

  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      eyebrow="오늘 할 일 시작 홈"
      title="홈"
      description="`/home`을 오늘 할 일 시작 홈으로 고정하고, 근태·휴가·결재 같은 기본 업무를 먼저 읽은 뒤 공지·문서·내 정보·조회 흐름으로 이어지게 정리한 홈 화면입니다."
      actions={
        <div className="pill-row">
          {dashboardTopBadges.map((badge) => (
            <Pill key={badge} tone={badge === "read-only summary" ? "accent" : "default"}>
              {badge}
            </Pill>
          ))}
        </div>
      }
    >
      <SurfaceSection title="현재 세션 / 홈-경영업무 분리" description="로그인 뒤 홈은 /home 로 고정하고, 직원 기본 업무와 민감 운영 업무를 다른 레인으로 분리해 확인합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">현재 세션</Pill>
            <h3>{viewerRoleCode ?? "로그인 전"}</h3>
            <p>로그인 성공 시 topbar 로그아웃과 함께 gw_session 세션을 유지하고, 홈은 /home 에서 계속 확인합니다.</p>
          </article>
          <article className="info-card">
            <Pill>일반 홈</Pill>
            <h3>/home</h3>
            <p>근태, 휴가, 전자결재, 게시판, 문서, 내 정보 같은 일반 직원 기본 업무 시작점입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">경영업무 허브</Pill>
            <h3>/management</h3>
            <p>급여, 세무, 노무, 법무, 감사 같은 내부관리 모듈은 홈과 분리된 별도 허브에서만 검토합니다.</p>
            {canViewManagementEntry ? <Link href="/management">/management</Link> : <p className="card-note">권한 있는 사용자에게만 경영업무 허브 진입 링크를 노출합니다.</p>}
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="홈 역할 안내"
        description="`/home` 를 오늘 업무 시작 홈으로, `/menu` 를 전체 기능 탐색 메뉴로 분리하고 운영 관리자 화면과 섞이지 않게 안내합니다."
      >
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">추천 순서</Pill>
            <h3>/home → /attendance → /leave → /approvals → /boards → /documents → /me</h3>
            <p>오늘 할 일부터 협업, 마무리 확인까지 실제 파일럿 기록 순서로 다시 읽습니다.</p>
          </article>
          <article className="info-card">
            <Pill>분리 원칙</Pill>
            <h3>/home 는 홈, /menu 는 탐색, 운영 허브는 별도 레인</h3>
            <p>/management, /admin/users, /admin/policies 는 직원 기본 홈의 다음 단계가 아니라 권한 있는 운영 사용자 레인이며, `/menu` 도 전체 탐색 화면으로만 읽혀야 합니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">확인 포인트</Pill>
            <h3>happy · forbidden · empty · error · loading · mobile/PC</h3>
            <p>각 화면에서 같은 분류 언어를 유지해 사용자와 운영 담당자가 loading, empty, error, forbidden, offline, dev-safe 를 같은 뜻으로 읽게 맞춥니다.</p>
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
        description="`/home` 와 `/menu` 가 같이 쓰는 회사 공통 고정 바로가기와 권한 기반 사용자 전용 바로가기를 실제 API 기준으로 나눠 보여 줍니다."
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

      <SurfaceSection title="상태 안내 기준선" description="loading, empty, error, forbidden, offline, 참고용 요약 데이터를 서로 다른 의미로 읽도록 홈 기준 문장을 고정합니다.">
        <div className="grid-auto-compact">
          {dashboardStatusGuideCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="추천 확인 순서" description="실사용 화면에서 직접 눌러 볼 때도 홈·복구·운영 레인을 같은 순서로 따라가게 고정합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <h3>일반 직원 · 팀장 확인 순서</h3>
            <p>같은 정보구조를 따라 홈 → 근태 → 휴가 → 결재 → 협업 → 내 정보 순서로 확인합니다.</p>
            <p className="card-note">/login → /home → /attendance → /leave → /approvals → /boards → /documents → /me</p>
          </article>
          {viewerRoleCode && canViewManagementEntry ? (
            <article className="info-card">
              <h3>관리자 계정·정책 확인 순서</h3>
              <p>일반 홈과 운영 허브를 섞지 않고 계정관리, 정책, 감사, 내부관리 화면을 별도 레인으로 이어 봅니다.</p>
              <p className="card-note">/login → /home → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health</p>
            </article>
          ) : null}
          {viewerRoleCode === "AUDITOR" ? (
            <article className="info-card">
              <h3>감사 확인 순서</h3>
              <p>운영 전체 허브 대신 조회 전용 감사 경로부터 확인합니다.</p>
              <p className="card-note">/login → /admin/audit-logs → /documents → /me</p>
            </article>
          ) : null}
        </div>
      </SurfaceSection>

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

      <SurfaceSection
        title="관리자 운영 검토 레인"
        description="운영자는 일반 직원 흐름과 섞지 않고 `/management` → `/admin/users` → `/admin/policies` → `/admin/audit-logs` → `/api/health` 순서로 운영 기준선을 먼저 검토합니다."
      >
        <ul className="summary-list">
          <li>`/home` 에서 일반 직원 홈과 운영 레인이 분리되어 보이는지 확인</li>
          <li>`/management` 에서 운영 허브가 일반 홈의 연장이 아니라는 안내 확인</li>
          <li>`/admin/users` 에서 계정 생성·권한 diff·비밀번호 초기화가 참고용 안내로 읽히는지 확인</li>
          <li>`/admin/policies` 에서 current/candidate/capability/audit 안내 형식이 실제 저장 완료처럼 보이지 않는지 확인</li>
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

      <SurfaceSection title="홈 점검 메모" description="핵심 업무 route, 협업 route, 내 정보 확인, 관리자 route 를 한 화면에서 묶어 점검 기준을 맞춥니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">이번 화면에서 확인할 것</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              <li>일반 직원은 /attendance, /leave, /approvals, /boards, /documents, /me 로 자연스럽게 이동한다.</li>
              <li>팀장/승인자는 같은 허브에서 시작하되 approvals 우선순위를 더 먼저 확인한다.</li>
              <li>운영 관리자와 감사 사용자는 일반 조회와 /admin 계열 관리자 화면이 분리돼 보인다.</li>
            </ul>
          </article>
          <article className="info-card">
            <Pill tone="warning">아직 안 여는 것</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              <li>실제 production KPI, 외부 알림 발송, 개인정보 원문 노출은 이번 단계에서 열지 않는다.</li>
              <li>게시판/문서 진입점은 읽기 중심 안내이며 운영 저장 완료 화면처럼 보이지 않게 유지한다.</li>
            </ul>
          </article>
          <article className="info-card">
            <Pill>별도 승인 필요</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              <li>production data 반영</li>
              <li>secret 입력/교체</li>
              <li>DNS/custom domain</li>
              <li>유료 리소스 생성·증액</li>
              <li>외부 연동</li>
            </ul>
          </article>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="meta-copy">접속 경로에서 이어서 눌러 볼 route</p>
          <ul className="summary-list">
            <li><a href="/attendance">/attendance</a> — 오늘 근태 상태와 정정 필요 여부 확인</li>
            <li><a href="/leave">/leave</a> — 잔여와 신청/승인 대기 흐름 확인</li>
            <li><a href="/approvals">/approvals</a> — 승인 대기와 팀 병목 후보 확인</li>
            <li><a href="/boards">/boards</a> — 공지/게시판 가드레일 확인</li>
            <li><a href="/documents">/documents</a> — 문서 공간/첨부 metadata 경계 확인</li>
            <li><a href="/me">/me</a> — 세션, 역할, 보안 안내 뒤 조직 조회로 이어지는지 확인</li>
          </ul>
        </div>
        <p className="card-note" style={{ marginTop: 16 }}>화면 안내와 실제 동작이 다를 때는 해당 업무 화면의 권한, 저장, 연결 상태를 다시 확인합니다.</p>
      </SurfaceSection>

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
            <Pill tone="warning">관리자 전용</Pill>
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

      <SurfaceSection title="이용 안내 / 별도 승인 범위" description="운영처럼 보이더라도 아직 바로 실행하지 않는 범위를 미리 안내하는 고정 문구입니다.">
        <ul className="bullet-list">
          <li>참고용 요약이며 실제 저장·발송·외부 연동은 각 업무 화면과 권한 범위에서 다시 확인해야 합니다.</li>
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
