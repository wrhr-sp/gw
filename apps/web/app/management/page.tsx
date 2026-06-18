import React from "react";
import { cookies } from "next/headers";
import { getViewerAccessForRoleCode, hasHomeShortcutRouteAccess } from "@gw/shared";

import { extractViewerRoleCodeFromSessionToken } from "../../admin-page-access";
import { ManagementCompliancePreviewSection } from "../_components/phase35-live-sections";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { Phase47RecommendedFlowSection, Phase47StatusGuideSection } from "../_components/phase47-usage-guide";
import { getVisibleDashboardManagementCards } from "../dashboard/dashboard-config";

const baseManagementCards = [
  {
    title: "인사관리 / 계정관리",
    href: "/admin/users",
    summary: "사용자 생성, 역할/업무권한 지정, 활성/비활성, 비밀번호 초기화 preview 를 dev-safe 로 검토합니다.",
    roleScope: "본사 관리자 / 인사관리자",
  },
  {
    title: "근태 / 휴가 관리자 업무",
    href: "/attendance",
    summary: "정정 필요 근태, 등록 방식 정책, 휴가 승인 대기를 홈과 분리해서 다시 확인합니다.",
    roleScope: "본사 관리자 / 팀장 / 지점 관리자",
  },
  {
    title: "지점 운영",
    href: "/work-items/branch",
    summary: "지점 일일 보고와 마감 placeholder 를 본사/지점 운영 언어로 확인합니다.",
    roleScope: "본사 운영 / 지점 관리자",
  },
  {
    title: "컴플라이언스 / 감사",
    href: "/admin/audit-logs",
    summary: "민감 업무 접근 흔적과 운영 변경 후보를 read-only 로 확인합니다.",
    roleScope: "본사 관리자 / 감사",
  },
] as const;

const managementGuardrails = [
  "일반 직원은 이 허브를 기본 홈에서 직접 보지 않고, 허용 역할만 별도 진입합니다.",
  "HR_ADMIN 시작점은 /management 가 아니라 /admin/users 이고, 이 허브는 운영 관리자/지점 관리자 중심 레인으로 유지합니다.",
  "`/admin/users`·`/admin/policies` preview 와 `/employees`·`/org` 읽기 확인을 같은 책임처럼 섞지 않습니다.",
  "감사 역할은 audit.read 기준으로 감사/추적 레인을 우선 확인하고, 모듈 카드는 역할별 허용 범위만 노출합니다.",
  "실메일/실메신저/SSO/OAuth/외부 기관 계정 연동은 계속 승인 게이트입니다.",
  "급여 지급, 실제 세무 신고, production DB 입력, migration, destructive 작업은 이번 범위가 아닙니다.",
] as const;

const onboardingBridgeSteps = [
  "1) /admin/users 에서 계정 생성·권한 diff preview 검토",
  "2) /employees, /org 에서 소속/부서/지점 read model 재확인",
  "3) 운영 담당자만 /management 로 넘어와 일반 홈과 분리된 운영 허브를 확인",
  "4) /admin/policies → /admin/audit-logs → /api/health 순서로 운영 기준선을 다시 확인",
  "5) /work-items/branch 에서 branch scope 운영 레인이 일반 조회와 섞이지 않는지 점검",
] as const;

const pilotLaneCards = [
  {
    title: "운영 관리자 레인",
    route: "/dashboard → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health",
    summary: "운영 허브, 계정·정책 preview, 감사 read-only, 최소 liveness 를 같은 UAT 순서로 기록합니다.",
  },
  {
    title: "지점관리자 레인",
    route: "/dashboard → /work-items/branch → /employees → /org → /management",
    summary: "branch scope 업무 확인 뒤 필요할 때만 읽기 조회와 운영 허브 문맥을 이어 보고 company scope 와 구분합니다.",
  },
] as const;

const recordingChecklist = [
  "happy path: 허용 역할에서 실제 route 순서가 자연스럽게 이어지는가",
  "forbidden: 허용되지 않은 역할이 `/management`, `/admin*`, 민감 work item 레인에 섞여 들어오지 않는가",
  "empty/error/loading: 빈 상태·실패·대기 상태가 저장 성공처럼 보이지 않는가",
  "mobile/PC: 같은 정보구조와 CTA 순서로 읽히는가",
] as const;

const rehearsalPackageHighlights = [
  "`/uat` 에서 역할별 시나리오, 이슈 기록 템플릿, 진행자 스크립트를 한 번에 확인합니다.",
  "blocker 와 approval-needed 를 같은 버그 목록으로 섞지 않습니다.",
  "final report 에는 live URL, `admin / 1234`, 역할별 route, 남은 승인 게이트를 분리해 남깁니다.",
] as const;

const storageBridgeChecks = [
  "/documents 에서 upload/download 준비와 storageStatus 경계를 먼저 확인",
  "/admin/audit-logs 에서 masked storage preview 와 company boundary 확인",
  "/payroll · /work-items/* 에서 민감 원문 대신 metadata/review/approval gate 언어 확인",
] as const;

export default async function ManagementPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gw_session")?.value ?? null;
  const roleCode = extractViewerRoleCodeFromSessionToken(sessionToken);
  const viewerAccess = roleCode ? getViewerAccessForRoleCode(roleCode) : null;
  const scopedManagementCards = viewerAccess ? getVisibleDashboardManagementCards(viewerAccess.roleCodes) : [];
  const visibleBaseManagementCards = viewerAccess
    ? baseManagementCards.filter((card) => hasHomeShortcutRouteAccess(card.href, viewerAccess))
    : [];
  const managementCards = [
    ...visibleBaseManagementCards.slice(0, 2),
    ...scopedManagementCards.map((card) => ({
      title: card.title,
      href: card.href,
      summary: card.body,
      roleScope: card.roleScope,
    })),
    ...visibleBaseManagementCards.slice(2),
  ];

  return (
    <PageShell
      backHref="/dashboard"
      backLabel="홈(대시보드)으로"
      eyebrow="Phase 56 경영업무 운영 허브 / 민감 레인 실사용화"
      title="경영업무"
      description="민감 운영 모듈을 일반 직원 홈과 분리하고, 급여·세무·노무·법무·감사 레인을 역할별 허용 범위에 맞춰 직접 눌러볼 수 있게 정리한 내부관리 허브입니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">sensitive access</Pill>
          <Pill>home separated</Pill>
        </div>
      }
    >
      <SurfaceSection title="경영업무에서 바로 여는 화면" description="이번 단계는 전체 완성보다, 민감한 업무와 branch scope 운영 레인을 홈과 분리하고 역할별 허용 카드만 보이게 맞추는 데 집중합니다.">
        <div className="grid-auto-compact">
          {managementCards.map((card) => (
            <article key={card.href} className="info-card">
              <Pill tone="warning">{card.roleScope}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="Phase 56 역할별 운영 레인" description="직원 홈과 운영 허브를 섞지 않도록, 이번 UAT 에서 실제로 기록할 route 순서를 역할별로 다시 잠급니다.">
        <div className="grid-auto-compact">
          {pilotLaneCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone="accent">{card.title}</Pill>
              <h3>{card.route}</h3>
              <p>{card.summary}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="계정관리 → 조직조회 → 경영업무 브리지"
        description="인사 온보딩 레인과 운영 레인을 같은 첫 화면처럼 섞지 않고, 어디서 넘어오는지만 명확히 적어 둡니다."
      >
        <ol className="number-list">
          {onboardingBridgeSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="추천 UAT 순서" description="admin / 1234 로그인 뒤 `/uat` 에서 시나리오를 먼저 읽고, 아래 route 순서로 일반 직원 레인과 내부관리 레인이 섞이지 않는지 확인합니다.">
        <ol className="number-list">
          <li>/dashboard 에서 홈과 관리자 CTA 가 분리되어 보이는지 확인</li>
          <li>/management 에서 내부관리 허브가 일반 홈과 분리되어 보이는지 확인</li>
          <li>/admin/users 에서 계정관리 preview 와 읽기 조회(`/employees`, `/org`)가 같은 책임처럼 보이지 않는지 확인</li>
          <li>/admin/policies 에서 current/candidate/capability/audit preview 형식 확인</li>
          <li>/admin/audit-logs 에서 컴플라이언스 / 감사 read-only 경계와 production 금지 문구 확인</li>
          <li>/api/health 에서 최소 liveness 기준만 기록</li>
          <li>/work-items/branch 에서 branch scope 업무 목록 → 상세 → 문서 → 마감 흐름과 company scope 경계 확인</li>
        </ol>
      </SurfaceSection>

      <SurfaceSection title="UAT 기록 체크포인트" description="tester 와 docs 가 같은 분류 언어를 이어받도록 운영 허브에서도 기록 질문을 고정합니다.">
        <ul className="summary-list">
          {recordingChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <Phase47RecommendedFlowSection
        title="운영 레인 고정 순서"
        description="일반 홈과 운영 허브를 섞지 않고, live 확인 때도 같은 점검 순서를 반복합니다."
        roleCode={roleCode}
      />

      <Phase47StatusGuideSection title="운영 상태 문장 가이드" description="민감 운영 레인에서도 loading, empty, error, forbidden, dev-safe 를 각각 다른 책임으로 읽고, mobile/PC 에서도 같은 정보구조로 보이게 고정합니다." />

      <SurfaceSection title="리허설 패키지 묶음" description="내부 도입 리허설 참가자와 진행자가 같은 언어를 보도록 `/uat` 를 함께 둡니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">/uat</Pill>
            <h3>역할별 시나리오 + 이슈 템플릿</h3>
            <p>직원/승인자/운영 관리자/지점 관리자/감사 담당자 레인별 행동 순서와 happy path, forbidden, empty, error, loading, mobile/PC 확인 포인트를 묶어 둡니다.</p>
            <a href="/uat">/uat</a>
          </article>
        </div>
        <ul className="summary-list">
          {rehearsalPackageHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="Phase 37 연결 체크" description="문서 저장흐름과 감사/민감업무 읽기 모델을 같은 기준으로 다시 확인합니다.">
        <ul className="summary-list">
          {storageBridgeChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="컴플라이언스 / 감사 preview" description="audit.read 가 있는 역할은 same-origin 감사 응답을, 없는 역할은 403 guard 문구를 같은 화면에서 확인합니다.">
        <ManagementCompliancePreviewSection />
      </SurfaceSection>

      <SurfaceSection title="분리 원칙" description="단순 메뉴 숨김이 아니라 route/API/문서 언어를 같이 맞춥니다." muted>
        <ul className="summary-list">
          {managementGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
