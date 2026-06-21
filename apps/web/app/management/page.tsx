import React from "react";
import { cookies } from "next/headers";
import { getViewerAccessForRoleCode, hasHomeShortcutRouteAccess } from "@gw/shared";

import { extractViewerRoleCodeFromSessionToken } from "../../admin-page-access";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { getVisibleDashboardManagementCards } from "../dashboard/dashboard-config";
import { phase59AdminGuideCards, phase59GuideDocumentLinks, phase59RoleLabels } from "../uat/phase59-uat-config";

const managementStatusGuideCards = [
  {
    title: "loading",
    summary: "아직 내용을 불러오는 중인 상태입니다.",
    detail: "저장 성공이나 권한 차단으로 단정하지 말고 잠시 기다린 뒤 다시 확인합니다.",
  },
  {
    title: "empty",
    summary: "정상적으로 비어 있을 수 있는 상태입니다.",
    detail: "현재 권한 범위에서 추가로 볼 항목이 없을 수 있습니다.",
  },
  {
    title: "error",
    summary: "조회나 불러오기에 실패한 상태입니다.",
    detail: "같은 작업을 반복 실행하지 말고 복구 경로와 권한 범위를 먼저 확인합니다.",
  },
  {
    title: "forbidden",
    summary: "로그인은 되었지만 현재 운영 권한 또는 접근 범위가 맞지 않는 상태입니다.",
    detail: "허용되지 않은 역할은 민감 운영 레인으로 들어오지 않고 허용된 홈·감사 레인으로 돌아갑니다.",
  },
  {
    title: "offline",
    summary: "네트워크가 불안정해 재시도가 필요한 상태입니다.",
    detail: "가능한 일과 막히는 일을 먼저 확인한 뒤 상태 변경 전 최신 연결 상태를 다시 확인합니다.",
  },
  {
    title: "참고용 요약 데이터",
    summary: "현재 화면에서 먼저 읽는 dev-safe 안내 상태입니다.",
    detail: "실제 저장 완료, 외부 연동 완료, 운영 반영 완료로 설명하지 않습니다.",
  },
] as const;

const baseManagementCards = [
  {
    title: "인사관리 / 계정관리",
    href: "/admin/users",
    summary: "사용자 생성, 역할/업무권한 지정, 활성/비활성, 비밀번호 초기화 안내를 참고용으로 검토합니다.",
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
    summary: "지점 일일 보고와 마감 현황을 본사/지점 운영 언어로 확인합니다.",
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
  "`/admin/users`·`/admin/policies` 안내 화면과 `/employees`·`/org` 읽기 확인을 같은 책임처럼 섞지 않습니다.",
  "감사 역할은 audit.read 기준으로 감사/추적 레인을 우선 확인하고, 모듈 카드는 역할별 허용 범위만 노출합니다.",
  "실메일/실메신저/SSO/OAuth/외부 기관 계정 연동은 계속 승인 게이트입니다.",
  "급여 지급, 실제 세무 신고, production DB 입력, migration, destructive 작업은 이번 범위가 아닙니다.",
] as const;

const onboardingBridgeSteps = [
  "1) /admin/users 에서 계정 생성·권한 diff 안내 검토",
  "2) /employees, /org 에서 소속/부서/지점 read model 재확인",
  "3) 운영 담당자만 /management 로 넘어와 일반 홈과 분리된 운영 허브를 확인",
  "4) /admin/policies → /admin/audit-logs → /api/health 순서로 운영 기준선을 다시 확인",
  "5) /work-items/branch 에서 branch scope 운영 레인이 일반 조회와 섞이지 않는지 점검",
] as const;

const pilotLaneCards = [
  {
    title: "HR 관리자 첫 검토 레인",
    route: "/dashboard → /admin/users → /employees → /org → /me",
    summary: "HR_ADMIN 은 공통 홈 뒤 계정관리부터 열고, 조직 read model 을 확인한 뒤 개인 확인으로 마무리합니다.",
    visibleTo: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    title: "운영 관리자 브리지 레인",
    route: "/dashboard → /admin/users → /employees → /org → /management",
    summary: "COMPANY_ADMIN 은 계정·조직 read model 을 먼저 확인한 뒤에만 운영 허브로 넘어갑니다.",
    visibleTo: ["COMPANY_ADMIN", "SUPER_ADMIN"],
  },
  {
    title: "운영 관리자 레인",
    route: "/dashboard → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health",
    summary: "운영 허브, 계정·정책 안내, 감사 read-only, 최소 liveness 를 같은 점검 순서로 기록합니다.",
    visibleTo: ["COMPANY_ADMIN", "SUPER_ADMIN"],
  },
  {
    title: "감사 시작 레인",
    route: "/admin/audit-logs → /documents → /me",
    summary: "AUDITOR 는 운영 저장 레인 대신 read-only 추적 레인부터 열고 필요한 문서·내 정보 확인으로 이어집니다.",
    visibleTo: ["AUDITOR", "COMPANY_ADMIN", "SUPER_ADMIN"],
  },
  {
    title: "지점관리자 레인",
    route: "/dashboard → /management → /payroll → /work-items/tax → /work-items/legal → /me",
    summary: "MANAGER 는 실제 허용된 운영 레인만 따라가고 `/admin*`, `/work-items/labor` 같은 company-only 레인은 forbidden 으로 기록합니다.",
    visibleTo: ["MANAGER"],
  },
] as const;

const recordingChecklist = [
  "happy path: 허용 역할에서 실제 route 순서가 자연스럽게 이어지는가",
  "forbidden: 허용되지 않은 역할이 `/management`, `/admin*`, 민감 work item 레인에 섞여 들어오지 않는가",
  "empty/error/loading: 빈 상태·실패·대기 상태가 저장 성공처럼 보이지 않는가",
  "mobile/PC: 같은 정보구조와 CTA 순서로 읽히는가",
] as const;

const storageBridgeChecks = [
  "/documents 에서 upload/download 준비와 storageStatus 경계를 먼저 확인",
  "/admin/audit-logs 에서 masked storage 안내와 company boundary 확인",
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
  const visibleAdminGuideCards =
    roleCode == null
      ? phase59AdminGuideCards
      : phase59AdminGuideCards.filter((card) => card.visibleTo.some((visibleRole) => visibleRole === roleCode));
  const visiblePilotLaneCards =
    roleCode == null ? pilotLaneCards : pilotLaneCards.filter((card) => card.visibleTo.some((visibleRole) => visibleRole === roleCode));
  const onboardingBridgeChecklist =
    roleCode === "MANAGER"
      ? [
          "1) /management 에서 일반 홈과 분리된 운영 허브인지 먼저 확인",
          "2) /payroll 에서 self/branch/company scope 문구가 섞이지 않는지 확인",
          "3) /work-items/tax 에서 지점 마감·세무 준비가 metadata 중심으로 설명되는지 확인",
          "4) /work-items/legal 에서 branch/company 경계와 read-only 안내를 확인",
          "5) company-only 관리자 레인(`/admin/users`, `/admin/policies`, `/work-items/labor`, `/admin/audit-logs`)은 forbidden 으로 기록",
        ]
      : roleCode === "HR_ADMIN"
        ? [
            "1) /admin/users 에서 계정 생성·권한 diff 안내 검토",
            "2) /employees, /org 에서 소속/부서/지점 read model 재확인",
            "3) 필요할 때만 /management 문맥을 참고하고 첫 관리자 레인은 계속 /admin/users 로 유지",
            "4) `/admin/audit-logs` 와 company-only 민감 운영 레인은 자동 허용처럼 기록하지 않음",
          ]
        : roleCode === "AUDITOR"
          ? [
              "1) /admin/audit-logs 에서 read-only 추적 레인부터 확인",
              "2) /documents 에서 관련 문서 연결만 읽고 운영 저장/변경 레인으로 넘어가지 않음",
              "3) /me 에서 세션·권한 문맥을 마지막에 정리",
            ]
          : onboardingBridgeSteps;
  const visibleStorageBridgeChecks =
    roleCode === "MANAGER"
      ? [
          "/documents 에서 upload/download 준비와 storageStatus 경계를 먼저 확인",
          "/payroll · /work-items/tax · /work-items/legal 에서 민감 원문 대신 metadata/review/approval gate 언어 확인",
          "company-only 관리자 레인(`/admin/users`, `/admin/policies`, `/work-items/labor`, `/admin/audit-logs`)은 직접 확인 흐름이 아니라 forbidden 기록 대상으로 남김",
        ]
      : roleCode === "AUDITOR"
        ? [
            "/admin/audit-logs 에서 masked storage 안내와 company boundary 확인",
            "/documents 에서 관련 문서 연결과 read-only 맥락 확인",
          ]
        : storageBridgeChecks;
  const visibleManagementGuardrails =
    roleCode === "MANAGER"
      ? [
          "일반 직원은 이 허브를 기본 홈에서 직접 보지 않고, 허용 역할만 별도 진입합니다.",
          "MANAGER 는 `/management`, `/payroll`, `/work-items/tax`, `/work-items/legal` 범위만 따라가고 company-only 관리자 레인은 forbidden 으로 기록합니다.",
          "급여 지급, 실제 세무 신고, production DB 입력, migration, destructive 작업은 이번 범위가 아닙니다.",
        ]
      : roleCode === "AUDITOR"
        ? [
            "AUDITOR 는 audit.read 기준의 read-only 추적 레인만 확인하고 운영 저장/변경 레인으로 넘어가지 않습니다.",
            "실메일/실메신저/SSO/OAuth/외부 기관 계정 연동은 계속 승인 게이트입니다.",
            "급여 지급, 실제 세무 신고, production DB 입력, migration, destructive 작업은 이번 범위가 아닙니다.",
          ]
        : managementGuardrails;
  const recommendedRouteChecklist =
    roleCode === "MANAGER"
      ? [
          "/dashboard 에서 홈과 관리자 CTA 가 분리되어 보이는지 확인",
          "/management 에서 관리자 업무 허브가 일반 홈과 분리되어 보이는지 확인",
          "/payroll 에서 self/branch/company scope 문구가 섞이지 않는지 확인",
          "/work-items/tax 에서 metadata 중심 안내와 approval gate 문구 확인",
          "/work-items/legal 에서 branch/company 경계와 read-only 안내 확인",
          "`/admin/users`, `/admin/policies`, `/work-items/labor`, `/admin/audit-logs` 가 MANAGER 에게 forbidden 으로 유지되는지 기록",
        ]
      : roleCode === "HR_ADMIN"
        ? [
            "/dashboard 에서 홈과 관리자 CTA 가 분리되어 보이는지 확인",
            "HR_ADMIN 은 /management 보다 /admin/users 를 첫 관리자 레인으로 읽는지 확인",
            "/admin/users 에서 계정관리 안내와 읽기 조회(`/employees`, `/org`)가 같은 책임처럼 보이지 않는지 확인",
            "/employees, /org 에서 read model 과 운영 변경 문구가 섞이지 않는지 확인",
            "허용되지 않은 `/admin/audit-logs`, `/management`, 민감 work item 레인이 자동 허용처럼 보이지 않는지 확인",
          ]
        : roleCode === "AUDITOR"
          ? [
              "/admin/audit-logs 에서 컴플라이언스 / 감사 read-only 경계 확인",
              "/documents, /me 로 이어지는 감사 후속 확인이 자연스러운지 기록",
              "`/management`, `/admin/users`, 민감 work item 저장 레인이 AUDITOR 에게 열리지 않는지 확인",
            ]
          : [
              "/dashboard 에서 홈과 관리자 CTA 가 분리되어 보이는지 확인",
              "/management 에서 관리자 업무 허브가 일반 홈과 분리되어 보이는지 확인",
              "HR_ADMIN 은 /management 보다 /admin/users 를 첫 관리자 레인으로 읽는지 확인",
              "/admin/users 에서 계정관리 안내와 읽기 조회(`/employees`, `/org`)가 같은 책임처럼 보이지 않는지 확인",
              "/admin/policies 에서 current/candidate/capability/audit 안내 형식 확인",
              "/admin/audit-logs 에서 컴플라이언스 / 감사 read-only 경계와 AUDITOR 시작 레인 문구 확인",
              "/api/health 에서 최소 liveness 기준만 기록",
              "/work-items/branch 에서 branch scope 업무 목록 → 상세 → 문서 → 마감 흐름과 company scope 경계 확인",
            ];
  const operationLaneSequenceCards =
    roleCode === "MANAGER"
      ? [
          {
            title: "팀장/지점 운영 확인 순서",
            summary: "실제로 허용된 운영 레인만 따라가고 company-only 관리자 레인은 forbidden 으로 남깁니다.",
            route: "/login → /dashboard → /management → /payroll → /work-items/tax → /work-items/legal → /me",
          },
        ]
      : roleCode === "HR_ADMIN"
        ? [
            {
              title: "HR 관리자 확인 순서",
              summary: "운영 허브보다 계정·조직 read model 을 먼저 확인하고 허용된 관리자 레인만 따라갑니다.",
              route: "/login → /dashboard → /admin/users → /employees → /org → /me",
            },
          ]
        : roleCode === "AUDITOR"
          ? [
              {
                title: "감사 담당자 확인 순서",
                summary: "조회 전용 추적 레인부터 시작하고 운영 저장·변경 레인으로 넘어가지 않습니다.",
                route: "/login → /admin/audit-logs → /documents → /me",
              },
            ]
          : [
              {
                title: "일반 직원 · 팀장 확인 순서",
                summary: "같은 정보구조를 따라 홈 → 근태 → 휴가 → 결재 → 협업 → 내 정보 순서로 확인합니다.",
                route: "/login → /dashboard → /attendance → /leave → /approvals → /boards → /documents → /me",
              },
              {
                title: "관리자 계정·정책 확인 순서",
                summary: "일반 홈과 운영 레인을 섞지 않고 운영 허브 확인 뒤 계정, 정책, 감사 레인을 같은 문장으로 이어 봅니다.",
                route: "/login → /dashboard → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health",
              },
              {
                title: "운영 관리자 확인 순서",
                summary: "일반 홈과 운영 허브를 섞지 않고 계정관리, 정책, 민감 내부관리 화면을 별도 허브에서 이어 봅니다.",
                route: "/login → /dashboard → /management → /admin/users → /admin/policies → /payroll → /work-items/tax → /work-items/labor → /work-items/legal → /admin/audit-logs → /api/health",
              },
            ];

  return (
    <PageShell
      backHref="/dashboard"
      backLabel="홈(대시보드)으로"
      eyebrow="지정 관리자 업무 허브"
      title="경영업무"
      titleHref="/management"
      description="민감 운영 모듈을 일반 직원 홈과 분리하고, 급여·세무·노무·법무·감사 레인을 역할별 허용 범위에 맞춰 직접 눌러볼 수 있게 정리한 관리자 업무 허브입니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">민감 정보 접근 주의</Pill>
          <Pill>일반 홈과 분리</Pill>
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

      <SurfaceSection title="역할별 운영 레인" description="직원 홈과 운영 허브를 섞지 않도록 실제로 확인할 route 순서를 역할별로 다시 잠급니다.">
        <div className="grid-auto-compact">
          {visiblePilotLaneCards.map((card) => (
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
          {onboardingBridgeChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="관리자 안내 흐름" description="현재 역할에서 다시 확인해야 하는 운영 안내 흐름과 참고 문서를 운영 허브 안에서도 바로 찾을 수 있게 묶어 둡니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="warning">/uat</Pill>
            <h3>통합 UAT 체크 화면</h3>
            <p>역할별 entry, 시나리오 A~F, 역할별 검증표, 승인 게이트를 한 화면에서 다시 확인합니다.</p>
            <a href="/uat">/uat</a>
          </article>
          {visibleAdminGuideCards.map((item) => (
            <article key={item.title} className="info-card">
              <Pill tone="accent">{item.visibleTo.map((role) => phase59RoleLabels[role]).join(" · ")}</Pill>
              <h3>{item.title}</h3>
              <p>{item.route}</p>
              <p className="card-note">{item.summary}</p>
            </article>
          ))}
          <article className="info-card">
            <Pill>참고 문서</Pill>
            <h3>경영업무 운영 가이드</h3>
            <p>{phase59GuideDocumentLinks[5]?.summary}</p>
            <p className="card-note">
              참고 문서: <a href={phase59GuideDocumentLinks[5]?.docHref}>{phase59GuideDocumentLinks[5]?.title}</a>
            </p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="추천 확인 순서" description="아래 route 순서로 일반 직원 레인과 관리자 레인이 섞이지 않는지 확인합니다.">
        <ol className="number-list">
          {recommendedRouteChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="기록 체크포인트" description="관리자와 검토 담당자가 같은 분류 언어를 이어받을 수 있도록 운영 허브에서도 기록 질문을 고정합니다.">
        <ul className="summary-list">
          {recordingChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="운영 레인 고정 순서" description="일반 홈과 운영 허브를 섞지 않고, 실접속 확인 때도 같은 점검 순서를 반복합니다.">
        <div className="grid-auto-compact">
          {operationLaneSequenceCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.route}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="운영 상태 문장 가이드" description="민감 운영 레인에서도 loading, empty, error, forbidden, 참고용 요약 데이터를 각각 다른 책임으로 읽고, mobile/PC 에서도 같은 정보구조로 보이게 고정합니다.">
        <div className="grid-auto-compact">
          {managementStatusGuideCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결 체크" description="문서 저장흐름과 감사/민감업무 읽기 모델을 같은 기준으로 다시 확인합니다.">
        <ul className="summary-list">
          {visibleStorageBridgeChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="컴플라이언스 / 감사 확인" description="audit.read 가 있는 역할은 same-origin 감사 응답을, 없는 역할은 403 guard 문구를 같은 화면에서 확인합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">컴플라이언스 / 감사 안내</Pill>
            <p className="card-note">same-origin API 응답을 불러오는 중인지, 읽기 전용 안내가 유지되는지 먼저 확인합니다.</p>
          </article>
          <article className="info-card">
            <Pill>audit.read guard</Pill>
            <p className="card-note">권한이 없는 역할은 403 guard 문구만 보고 저장/변경 화면으로 넘어가지 않습니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="분리 원칙" description="단순 메뉴 숨김이 아니라 route/API/문서 언어를 같이 맞춥니다." muted>
        <ul className="summary-list">
          {visibleManagementGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
