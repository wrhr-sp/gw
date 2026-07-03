import React from "react";
import { cookies } from "next/headers";
import { getViewerAccessForRoleCode, hasHomeShortcutRouteAccess } from "@gw/shared";

import { extractViewerRoleCodeFromSessionToken } from "../../admin-page-access";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { getVisibleDashboardManagementCards } from "../dashboard/dashboard-config";
import { ManagementLiveSection } from "./management-live-section";

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
    summary: "현재 화면에서 먼저 읽는 검증 안내 상태입니다.",
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
    route: "/home → /admin/users → /employees → /org → /management",
    summary: "HR_ADMIN 은 공통 홈 뒤 계정관리부터 열고, 조직 read model 을 확인한 뒤 필요할 때만 운영 허브로 넘어갑니다.",
  },
  {
    title: "운영 관리자 레인",
    route: "/home → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health",
    summary: "운영 허브, 계정·정책 안내, 감사 read-only, 최소 liveness 를 같은 점검 순서로 기록합니다.",
  },
  {
    title: "감사 시작 레인",
    route: "/admin/audit-logs → /documents → /me",
    summary: "AUDITOR 는 운영 저장 레인 대신 read-only 추적 레인부터 열고 필요한 문서·내 정보 확인으로 이어집니다.",
  },
  {
    title: "지점관리자 레인",
    route: "/home → /work-items/branch → /employees → /org → /management",
    summary: "branch scope 업무 확인 뒤 필요할 때만 읽기 조회와 운영 허브 문맥을 이어 보고 company scope 와 구분합니다.",
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

  return (
    <PageShell
      backHref="/home"
      backLabel="홈(대시보드)으로"
      eyebrow="지정 관리자 업무 허브"
      title="경영업무"
      description="민감 운영 모듈을 일반 직원 홈과 분리하고, 급여·세무·노무·법무·감사 레인을 역할별 허용 범위에 맞춰 직접 눌러볼 수 있게 정리한 관리자 업무 허브입니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">민감 정보 접근 주의</Pill>
          <Pill>일반 홈과 분리</Pill>
        </div>
      }
    >
      <SurfaceSection title="실제 운영 기준선" description="현재 세션, 역할, 서비스 상태를 same-origin API 로 먼저 확인합니다.">
        <ManagementLiveSection />
      </SurfaceSection>

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

      <SurfaceSection title="추천 확인 순서" description="아래 route 순서로 일반 직원 레인과 관리자 레인이 섞이지 않는지 확인합니다.">
        <ol className="number-list">
          <li>/home 에서 홈과 관리자 CTA 가 분리되어 보이는지 확인</li>
          <li>/management 에서 관리자 업무 허브가 일반 홈과 분리되어 보이는지 확인</li>
          <li>HR_ADMIN 은 /management 보다 /admin/users 를 첫 관리자 레인으로 읽는지 확인</li>
          <li>/admin/users 에서 계정관리 안내와 읽기 조회(`/employees`, `/org`)가 같은 책임처럼 보이지 않는지 확인</li>
          <li>/admin/policies 에서 current/candidate/capability/audit 안내 형식 확인</li>
          <li>/admin/audit-logs 에서 컴플라이언스 / 감사 read-only 경계와 AUDITOR 시작 레인 문구 확인</li>
          <li>/api/health 에서 최소 liveness 기준만 기록</li>
          <li>/work-items/branch 에서 branch scope 업무 목록 → 상세 → 문서 → 마감 흐름과 company scope 경계 확인</li>
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
          <article className="info-card">
            <h3>일반 직원 · 팀장 확인 순서</h3>
            <p>같은 정보구조를 따라 홈 → 근태 → 휴가 → 결재 → 협업 → 내 정보 순서로 확인합니다.</p>
            <p className="card-note">/login → /home → /attendance → /leave → /approvals → /boards → /documents → /me</p>
          </article>
          <article className="info-card">
            <h3>관리자 계정·정책 확인 순서</h3>
            <p>일반 홈과 운영 레인을 섞지 않고 운영 허브 확인 뒤 계정, 정책, 감사 레인을 같은 문장으로 이어 봅니다.</p>
            <p className="card-note">/login → /home → /management → /admin/users → /admin/policies → /admin/audit-logs → /api/health</p>
          </article>
          <article className="info-card">
            <h3>운영 관리자 확인 순서</h3>
            <p>일반 홈과 운영 허브를 섞지 않고 계정관리, 정책, 민감 내부관리 화면을 별도 허브에서 이어 봅니다.</p>
            <p className="card-note">/login → /home → /management → /admin/users → /admin/policies → /payroll → /work-items/tax → /work-items/labor → /work-items/legal → /admin/audit-logs → /api/health</p>
          </article>
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
          {storageBridgeChecks.map((item) => (
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
          {managementGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
