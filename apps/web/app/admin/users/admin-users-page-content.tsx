import React from "react";
import type { AdminUsersListResponse } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { adminOfflineGuidance, adminRecoveryRouteCards } from "../../mobile-pwa-config";

type AdminUsersPreview = Pick<AdminUsersListResponse["data"], "items" | "linkedScreens" | "companySettingsModel" | "audit">;

type AdminUsersPageContentProps = {
  adminUsers: AdminUsersPreview;
  actionMessage?: string | null;
  loadError?: string | null;
  loadErrorKind?: "error" | "offline" | null;
  actionType?: string | null;
  focusMessage?: string | null;
};

const capabilityExamples = [
  "board.manage / document.space.manage 는 협업 운영 범위에서만 허용합니다.",
  "attendance.manage / leave.approve 는 근태·휴가 관리자 업무와 같이 검토합니다.",
  "audit.read 는 감사 또는 지정 관리자만 열고 일반 직원 홈에는 노출하지 않습니다.",
] as const;

const happyPathCards = [
  { href: "/boards", title: "게시판", description: "작성/상세/댓글 정상 흐름을 직접 눌러봅니다." },
  { href: "/documents", title: "문서", description: "목록/상세/첨부 메타데이터와 권한 차단을 확인합니다." },
  { href: "/attendance", title: "근태", description: "출근/퇴근 또는 정정 요청 안내를 확인합니다." },
  { href: "/leave", title: "휴가", description: "신청 → 승인/반려 → 상태 확인 흐름을 봅니다." },
  { href: "/approvals", title: "전자결재", description: "기안 → 승인/반려/보완 → 결재함 상태를 확인합니다." },
] as const;

const actionJourneyMap = {
  create: [
    "1) 사용자 생성 검증 결과 확인",
    "2) /employees, /org 에서 조직·부서·지점 조회 모델 연결 확인",
    "3) /boards, /documents, /attendance 중 하나를 눌러 일반 업무 첫 진입 확인",
  ],
  role: [
    "1) 역할/업무권한 변경점 확인",
    "2) /home 공통 랜딩 뒤 HR은 /admin/users, 운영은 /management, 감사는 /admin/audit-logs 로 이어지는지 재확인",
    "3) 고위험 권한은 감사 후보 문구와 함께 검토",
  ],
  status: [
    "1) 활성/비활성 상태 변경점 확인",
    "2) 비활성 사용자의 차단 안내와 업무 중단 범위 확인",
    "3) 로그아웃 → 재로그인 → 랜딩 재확인 순서로 차단 범위를 점검",
  ],
  password: [
    "1) 비밀번호 초기화 검증 결과 확인",
    "2) 실제 임시 비밀번호 값이 URL/배너에 남지 않았는지 확인",
    "3) 로그아웃/재로그인 시나리오만 점검하고 운영 정책은 열지 않음",
  ],
} as const;

const onboardingRehearsalSteps = [
  "1) /login → /home 로 로그인/기본 홈 확인",
  "2) /admin/users 에서 사용자 생성 검증과 역할/권한 변경점 검토",
  "3) /employees 에서 읽기 중심 직원 조회, /org 에서 부서·역할·지점 구조 확인",
  "4) 운영 담당자는 /management → /work-items/branch 로 branch 범위 운영 레인 확인",
  "5) 감사 사용자는 /admin/audit-logs 에서 읽기 전용 추적 레인만 재확인",
  "6) 상태 변경/비밀번호 초기화 검증 후 로그아웃 → 재로그인 → 랜딩 재확인",
] as const;

const roleLaneCards = [
  {
    role: "EMPLOYEE",
    firstRoute: "/home",
    summary: "일반 직원은 홈에서 근태·휴가·결재·게시판·문서 흐름을 먼저 확인합니다.",
    blocked: "/admin/users · /management · /admin/audit-logs 기본 진입 차단",
  },
  {
    role: "HR_ADMIN",
    firstRoute: "/home",
    summary: "계정 생성/권한 지정/상태 변경/비밀번호 초기화 검증은 공통 홈 뒤 인사 운영 레인으로 이어서 확인합니다.",
    blocked: "첫 관리자 레인은 /management 가 아니라 /admin/users 로 고정",
  },
  {
    role: "MANAGER",
    firstRoute: "/home",
    summary: "지점 관리자는 공통 홈 뒤 /work-items/branch → /employees → /org → /management 순서의 branch 범위 운영 레인만 확인합니다.",
    blocked: "/employees · /org 는 읽기 전용 확인용이며 /admin/users · /admin/policies 검증은 기본 진입 차단",
  },
  {
    role: "COMPANY_ADMIN",
    firstRoute: "/home",
    summary: "운영 관리자는 공통 홈 뒤 /management → /admin/users → /admin/policies → /admin/audit-logs 회사 범위 운영 레인을 검토합니다.",
    blocked: "공통 랜딩 다음 레인은 /management 이고 branch 범위 읽기 화면(/employees, /org)을 관리자 저장 화면처럼 쓰지 않음",
  },
  {
    role: "AUDITOR",
    firstRoute: "/admin/audit-logs",
    summary: "감사는 읽기 전용 추적 레인만 먼저 열고 운영 변경 레인과 섞지 않습니다.",
    blocked: "운영 변경 저장 레인 기본 진입 차단",
  },
] as const;

const 바로가기SourceRules = [
  {
    title: "회사 공통 고정 바로가기 출처",
    body: "`/api/home/shortcuts` 의 회사 공통 고정 항목을 홈(`/home`)·메뉴(`/menu`)와 같은 뜻으로 읽습니다.",
    note: "근태·휴가·결재처럼 모두가 같은 순서로 찾는 기본 업무만 여기 남깁니다.",
  },
  {
    title: "권한 기반 사용자 전용 바로가기 출처",
    body: "같은 API의 사용자 전용 항목을 현재 세션 권한으로만 추가하고, 일반 직원에게는 권한 필요 바로가기를 숨깁니다.",
    note: "관리자 사용자·감사 로그·경영업무처럼 민감한 진입점은 홈 공통 영역과 섞지 않습니다.",
  },
  {
    title: "역할 / 권한 카탈로그 출처",
    body: "`/api/roles`, `/api/permissions`, `/api/admin/users` 를 같이 보며 역할 변경점, 고위험 권한 후보, 노출/차단 기준을 운영 검토용으로 읽습니다.",
    note: "`/employees` 는 일반 조회이고, 실제 권한 저장은 이번 단계 범위가 아닙니다.",
  },
] as const;

const statusBoundaryCards = [
  {
    title: "loading",
    tone: "accent" as const,
    summary: "아직 계정관리 데이터를 불러오는 중인 상태입니다.",
    detail: "저장 성공이나 권한 차단으로 단정하지 말고 잠시 기다린 뒤 /admin/users 또는 허용된 홈 레인에서 다시 확인합니다.",
  },
  {
    title: "empty",
    tone: "default" as const,
    summary: "현재 회사 범위에 계정이나 검토 큐가 없는 정상 빈 상태일 수 있습니다.",
    detail: "실패나 권한 차단으로 섞지 않고, 지금 추가로 검토할 계정이 없는 상태로 기록합니다.",
  },
  {
    title: "error",
    tone: "warning" as const,
    summary: "조회나 내부 검증 처리에 실패한 상태입니다.",
    detail: "같은 작업을 성공처럼 넘기지 말고 경고 배너, 재조회, 복구 경로를 먼저 확인합니다.",
  },
  {
    title: "offline",
    tone: "warning" as const,
    summary: "네트워크가 불안정하거나 연결이 끊겨 검증을 다시 시도해야 하는 상태입니다.",
    detail: "가능한 읽기 업무와 막히는 저장/실행 업무를 먼저 구분한 뒤 안정적인 네트워크에서 다시 확인합니다.",
  },
  {
    title: "forbidden",
    tone: "warning" as const,
    summary: "로그인은 되었지만 현재 인사 운영 권한 또는 접근 범위가 맞지 않는 상태입니다.",
    detail: "일반 직원이나 비허용 역할은 /admin/users 를 우회하지 않고 허용된 홈·감사 레인으로 돌아갑니다.",
  },
  {
    title: "내부 검증",
    tone: "accent" as const,
    summary: "현재 화면은 실제 저장 대신 검증과 내부 확인용 데이터만 보여 주는 상태입니다.",
    detail: "실제 메일 발송, 외부 IdP, 운영 비밀번호 정책, 대량 import 는 계속 승인 게이트로 남깁니다.",
  },
] as const;

export function AdminUsersPageContent({
  adminUsers,
  actionMessage,
  loadError,
  loadErrorKind,
  actionType,
  focusMessage,
}: AdminUsersPageContentProps) {
  const effectiveAdminUsers = adminUsers;
  const activeJourney = actionType && actionType in actionJourneyMap ? actionJourneyMap[actionType as keyof typeof actionJourneyMap] : null;
  const loadErrorTitle =
    loadErrorKind === "offline"
      ? "offline 상태: 네트워크가 불안정해 계정관리 미리보기를 다시 불러와야 합니다"
      : "error 상태: 계정관리 미리보기를 불러오지 못했습니다";

  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="Phase 55 관리자 계정·권한·조직 실사용화"
      title="계정관리 / 사용자·권한"
      description="사용자 생성, 역할/업무권한 지정, 활성/비활성, 비밀번호 초기화·변경을 내부 검증으로 눌러보고, 실제 저장은 열지 않는 계정관리 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">내부 계정 흐름</Pill>
          <Pill tone="warning">운영 데이터 변경 없음</Pill>
        </div>
      }
    >
      {actionMessage ? (
        <section className="status-banner" role="status">
          <strong>최근 내부 검증 실행 결과</strong>
          <span>{actionMessage}</span>
        </section>
      ) : null}

      {focusMessage || activeJourney ? (
        <SurfaceSection title="방금 실행한 검증 다음 확인" description="계정관리 검증을 누른 뒤 어디를 바로 확인할지 actionType 기준으로 고정합니다.">
          {focusMessage ? <p className="meta-copy">{focusMessage}</p> : null}
          {activeJourney ? (
            <ol className="number-list">
              {activeJourney.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : null}
        </SurfaceSection>
      ) : null}

      <SurfaceSection
        title="forbidden / empty / error / offline / loading / 내부 검증 경계"
        description="계정관리 화면에서는 좋아 보이는 상태만 남기지 않고, 각 상태를 서로 다른 의미로 고정합니다."
      >
        <div className="grid-auto-compact">
          {statusBoundaryCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone={card.tone}>{card.title}</Pill>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="Phase 55 관리자 온보딩·운영 순서"
        description="이번 단계에서는 계정 검증, 조직 읽기, 운영 레인, 감사 레인을 live URL 기준 한 절차로 묶어 같은 언어로 확인합니다."
      >
        <ol className="number-list">
          {onboardingRehearsalSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection
        title="역할별 시작 레인과 차단 기준"
        description="직원·인사·운영·감사 사용자가 같은 화면을 첫 진입점으로 쓰지 않도록 경로 기준을 고정합니다."
      >
        <div className="grid-auto-compact">
          {roleLaneCards.map((card) => (
            <article key={card.role} className="info-card">
              <Pill tone="accent">{card.role}</Pill>
              <h3>{card.firstRoute}</h3>
              <p>{card.summary}</p>
              <p className="card-note">차단/분리 기준: {card.blocked}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      {loadError ? (
        <section className="status-banner status-banner--warning" role="alert">
          <strong>{loadErrorTitle}</strong>
          <span>{loadError}</span>
          {loadErrorKind === "offline" ? (
            <>
              <span>{adminOfflineGuidance.bannerBody}</span>
              <ul className="summary-list">
                {adminOfflineGuidance.retrySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="card-note">복구 경로: {adminRecoveryRouteCards.map((경로) => 경로.href).join(" · ")}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <SurfaceSection title="운영자 설정 조회 모델" description="`/home`·`/menu` 바로가기, role/permission 출처, 회사 설정 모델, 내부 검증 경계를 같은 언어로 묶어 설명합니다.">
        <article className="info-card">
          <Pill tone="accent">{effectiveAdminUsers.companySettingsModel.companyName}</Pill>
          <h3>정책 시작점</h3>
          <p>{effectiveAdminUsers.companySettingsModel.policyStartPoint}</p>
          <p className="card-note">감사 후보: {effectiveAdminUsers.audit.action}</p>
        </article>
        <div className="grid-auto-compact stack-top-md">
          {바로가기SourceRules.map((item) => (
            <article key={item.title} className="info-card">
              <Pill>출처</Pill>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <p className="card-note">{item.note}</p>
            </article>
          ))}
        </div>
        <div className="grid-auto-compact stack-top-md">
          {effectiveAdminUsers.companySettingsModel.policyAxes.map((axis) => (
            <article key={axis.id} className="info-card">
              <Pill tone="accent">정책 축</Pill>
              <h3>{axis.title}</h3>
              <p>{axis.summary}</p>
              <p className="card-note">우선순위: {axis.priority}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="회사 설정 모델과 운영 연결"
        description="`/employees` 일반 조회와 `/admin/users` 운영 검토를 다시 섞지 않도록 회사 설정 모델의 연결 화면을 먼저 확인합니다."
      >
        <article className="info-card">
          <Pill tone="accent">{effectiveAdminUsers.companySettingsModel.companyName}</Pill>
          <h3>정책 시작점</h3>
          <p>{effectiveAdminUsers.companySettingsModel.policyStartPoint}</p>
          <p className="card-note">감사 후보: {effectiveAdminUsers.audit.action}</p>
        </article>
        <div className="grid-auto-compact stack-top-md">
          {effectiveAdminUsers.companySettingsModel.groups.map((group) => (
            <article key={group.id} className="info-card">
              <Pill>{group.owner}</Pill>
              <h3>{group.title}</h3>
              <p>{group.summary}</p>
              <p className="card-note">연결 화면: {group.linkedRoutes.join(" · ")}</p>
            </article>
          ))}
        </div>
        <div className="grid-auto-compact stack-top-md">
          {effectiveAdminUsers.companySettingsModel.policyAxes.map((axis) => (
            <article key={axis.id} className="info-card">
              <Pill tone="accent">정책 축</Pill>
              <h3>{axis.title}</h3>
              <p>{axis.summary}</p>
              <p className="card-note">우선순위: {axis.priority}</p>
            </article>
          ))}
        </div>
        <ul className="summary-list stack-top-md">
          {effectiveAdminUsers.companySettingsModel.employeeVisibilityRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="일반 조회와 운영 검토 책임 분리"
        description="직원 조회는 일반 읽기 흐름으로 남기고, 계정관리에서는 권한·상태·감사 후보만 검토합니다."
        muted
      >
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill>일반 조회</Pill>
            <h3>/employees · /org</h3>
            <p>직원 검색, 조직 읽기, 일반 현황 확인을 위한 조회 흐름입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">운영 검토</Pill>
            <h3>/admin/users</h3>
            <p>실제 저장 없이 역할 변경점, 상태 변경 검증, 고위험 권한 후보, 바로가기 노출 기준을 검토합니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="현재 검토 중인 사용자" description="실제 API 응답 기반으로 역할·상태·고위험 권한 검증을 함께 보여 줍니다.">
        {effectiveAdminUsers.items.length > 0 ? (
          <div className="grid-auto-compact">
            {effectiveAdminUsers.items.map((item) => (
              <article key={item.userId} className="info-card">
                <Pill tone={item.highRiskPermissions.length > 0 ? "warning" : "accent"}>{item.roleCodes.join(", ")}</Pill>
                <h3>{item.fullName}</h3>
                <p>{item.email} · {item.departmentName}</p>
                <p className="meta-copy">역할 후보: {item.roleChangePreview.nextRoleCodes.join(", ") || "유지"}</p>
                <p className="card-note">
                  상태 변경점: {item.employmentStatus} → {item.statusChangePreview.nextStatus} · 감사 후보: {item.highRiskPermissions.length > 0 ? item.highRiskPermissions.join(", ") : "없음"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <article className="info-card">
            <h3>empty 상태</h3>
            <p>이번 회사 범위 에 아직 계정관리 대상 사용자가 없으면 실패나 권한 차단으로 바꾸지 않고 empty 를 그대로 보여 줍니다.</p>
          </article>
        )}
      </SurfaceSection>

      <SurfaceSection title="사용자 생성 내부 검증 흐름" description="실제 저장 없이 어떤 정보를 받아 어떤 계정이 생길지 검증 메시지로 확인합니다.">
        <p className="meta-copy">실제 초대 메일 발송 없이 계정 생성 전 검증 상태만 남깁니다.</p>
        <form className="form-field-stack" method="post" action="/admin/users/verification-action">
          <input type="hidden" name="actionType" value="create" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">이름</span>
              <input className="field" name="fullName" defaultValue="UAT 신규 사용자" />
            </label>
            <label>
              <span className="meta-copy">이메일</span>
              <input className="field" name="email" defaultValue="uat.user@example.com" />
            </label>
            <label>
              <span className="meta-copy">부서</span>
              <input className="field" name="departmentName" defaultValue="운영팀" />
            </label>
            <label>
              <span className="meta-copy">초기 역할</span>
              <input className="field" name="roleCode" defaultValue="EMPLOYEE" />
            </label>
          </div>
          <button type="submit" className="touch-button">생성 검증 보기</button>
        </form>
      </SurfaceSection>

      <SurfaceSection title="역할 / 업무권한 지정" description="역할과 capability 를 한 번에 바꿨을 때 어떤 경로가 열리는지 검증으로만 확인합니다.">
        <p className="meta-copy">역할 후보, 권한 차이, 열리는 경로 범위를 검토합니다.</p>
        <form className="form-field-stack" method="post" action="/admin/users/verification-action">
          <input type="hidden" name="actionType" value="role" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">대상 사용자</span>
              <input className="field" name="targetUser" defaultValue={effectiveAdminUsers.items[0]?.fullName ?? "관리자 테스트"} />
            </label>
            <label>
              <span className="meta-copy">다음 역할</span>
              <input className="field" name="nextRoleCodes" defaultValue="HR_ADMIN, AUDITOR" />
            </label>
            <label>
              <span className="meta-copy">업무권한</span>
              <input className="field" name="capabilities" defaultValue="attendance.manage, leave.approve" />
            </label>
          </div>
          <button type="submit" className="touch-button">권한 변경점 검증 보기</button>
        </form>
        <ul className="summary-list">
          {capabilityExamples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="활성 / 비활성 전환" description="비활성화나 휴직 전환도 실제 저장 대신 영향 범위만 먼저 안내합니다.">
        <p className="meta-copy">상태 변경 차이와 영향 범위를 먼저 보여 줍니다.</p>
        <form className="form-field-stack" method="post" action="/admin/users/verification-action">
          <input type="hidden" name="actionType" value="status" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">대상 사용자</span>
              <input className="field" name="targetUser" defaultValue={effectiveAdminUsers.items[0]?.fullName ?? "관리자 테스트"} />
            </label>
            <label>
              <span className="meta-copy">다음 상태</span>
              <input className="field" name="nextStatus" defaultValue="offboarded" />
            </label>
            <label>
              <span className="meta-copy">사유</span>
              <input className="field" name="reason" defaultValue="UAT 상태 변경 검증" />
            </label>
          </div>
          <button type="submit" className="touch-button">상태 변경 검증 보기</button>
        </form>
      </SurfaceSection>

      <SurfaceSection title="비밀번호 초기화 / 변경" description="운영 비밀번호 정책은 열지 않고, UAT 범위에서 초기화/변경 시 어떤 안내가 나가는지만 검증합니다.">
        <p className="meta-copy">임시 비밀번호 안내와 감사 후보 메시지를 검증합니다.</p>
        <form className="form-field-stack" method="post" action="/admin/users/verification-action">
          <input type="hidden" name="actionType" value="password" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">대상 사용자</span>
              <input className="field" name="targetUser" defaultValue={effectiveAdminUsers.items[0]?.fullName ?? "관리자 테스트"} />
            </label>
            <label>
              <span className="meta-copy">새 임시 비밀번호</span>
              <input className="field" name="nextPassword" defaultValue="1234" />
            </label>
            <label>
              <span className="meta-copy">메모</span>
              <input className="field" name="reason" defaultValue="내부 검증 UAT 초기화 검증" />
            </label>
          </div>
          <button type="submit" className="touch-button">비밀번호 검증 보기</button>
        </form>
      </SurfaceSection>

      <SurfaceSection title="계정관리 뒤 바로 눌러볼 주요 업무" description="새 계정/권한 검증 뒤 최소 정상 흐름을 직접 눌러볼 수 있게 연결합니다.">
        <div className="grid-auto-compact">
          {happyPathCards.map((card) => (
            <article key={card.href} className="route-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="권한 차단과 승인 게이트 메모" description="실사용 검토 때 자주 헷갈리는 경계를 다시 한 번 짧게 남깁니다." muted>
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="warning">forbidden</Pill>
            <p>일반 직원이나 비허용 역할은 /admin/users 를 우회하지 않고 허용된 홈·감사 레인으로 돌아갑니다.</p>
          </article>
          <article className="info-card">
            <Pill>empty</Pill>
            <p>현재 회사 범위에 계정이 없거나 검토 큐가 비어 있으면 empty 를 정상 빈 상태로 그대로 보여 줍니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">error</Pill>
            <p>API 검증이나 내부 검증 action 처리에 실패하면 성공처럼 넘기지 않고 경고 배너와 재확인 순서를 남깁니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="accent">내부 검증</Pill>
            <p>실제 메일 발송, 외부 IdP, 운영 비밀번호 정책, 대량 import 는 계속 승인 게이트로 남깁니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결 화면 / 근거" description="현재 API 응답이 어떤 화면과 이어지는지 같이 적어 둡니다.">
        <div className="grid-auto-compact">
          {effectiveAdminUsers.linkedScreens.map((item) => (
            <article key={`${item.source}-${item.title}`} className="info-card">
              <Pill>{item.category}</Pill>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <p className="card-note">출처: {item.source}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}

