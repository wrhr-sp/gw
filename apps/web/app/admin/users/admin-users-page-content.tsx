import React from "react";
import type { AdminUsersListResponse } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";

type AdminUsersPreview = Pick<AdminUsersListResponse["data"], "items" | "linkedScreens" | "companySettingsModel" | "audit">;

type AdminUsersPageContentProps = {
  preview: AdminUsersPreview;
  actionMessage?: string | null;
  loadError?: string | null;
  actionType?: string | null;
  focusMessage?: string | null;
};

const capabilityExamples = [
  "board.manage / document.space.manage 는 협업 운영 범위에서만 허용합니다.",
  "attendance.manage / leave.approve 는 근태·휴가 관리자 업무와 같이 검토합니다.",
  "audit.read 는 감사 또는 지정 관리자만 열고 일반 직원 홈에는 노출하지 않습니다.",
] as const;

const happyPathCards = [
  { href: "/boards", title: "게시판", description: "작성/상세/댓글 happy path 를 직접 눌러봅니다." },
  { href: "/documents", title: "문서", description: "목록/상세/첨부 metadata 와 권한 차단을 확인합니다." },
  { href: "/attendance", title: "근태", description: "출근/퇴근 또는 정정 요청 안내를 확인합니다." },
  { href: "/leave", title: "휴가", description: "신청 → 승인/반려 → 상태 확인 흐름을 봅니다." },
  { href: "/approvals", title: "전자결재", description: "기안 → 승인/반려/보완 → 결재함 상태를 확인합니다." },
] as const;

const actionJourneyMap = {
  create: [
    "1) 사용자 생성 preview 결과 확인",
    "2) /employees, /org 에서 조직·부서·지점 read model 연결 확인",
    "3) /boards, /documents, /attendance 중 하나를 눌러 일반 업무 첫 진입 확인",
  ],
  role: [
    "1) 역할/업무권한 diff 확인",
    "2) /dashboard 공통 landing 뒤 HR은 /admin/users, 운영은 /management, 감사는 /admin/audit-logs 로 이어지는지 재확인",
    "3) 고위험 권한은 감사 후보 문구와 함께 검토",
  ],
  status: [
    "1) 활성/비활성 상태 변경 diff 확인",
    "2) 비활성 사용자의 차단 안내와 업무 중단 범위 확인",
    "3) 로그아웃 → 재로그인 → landing 재확인 순서로 차단 범위를 점검",
  ],
  password: [
    "1) 비밀번호 reset preview 결과 확인",
    "2) 실제 임시 비밀번호 값이 URL/배너에 남지 않았는지 확인",
    "3) 로그아웃/재로그인 시나리오만 점검하고 production 정책은 열지 않음",
  ],
} as const;

const onboardingRehearsalSteps = [
  "1) /login → /dashboard 로 로그인/기본 홈 확인",
  "2) /admin/users 에서 사용자 생성 preview 와 역할/권한 diff 검토",
  "3) /employees 에서 읽기 중심 직원 조회, /org 에서 부서·역할·지점 구조 확인",
  "4) 운영 담당자는 /management → /work-items/branch 로 branch scope 운영 레인 확인",
  "5) 감사 사용자는 /admin/audit-logs 에서 read-only 추적 레인만 재확인",
  "6) 상태 변경/비밀번호 초기화 preview 뒤 로그아웃 → 재로그인 → landing 재확인",
] as const;

const roleLaneCards = [
  {
    role: "EMPLOYEE",
    firstRoute: "/dashboard",
    summary: "일반 직원은 홈에서 근태·휴가·결재·게시판·문서 흐름을 먼저 확인합니다.",
    blocked: "/admin/users · /management · /admin/audit-logs 기본 진입 차단",
  },
  {
    role: "HR_ADMIN",
    firstRoute: "/dashboard",
    summary: "계정 생성/권한 지정/상태 변경/비밀번호 초기화 preview 는 공통 홈 뒤 인사 운영 레인으로 이어서 확인합니다.",
    blocked: "첫 관리자 레인은 /management 가 아니라 /admin/users 로 고정",
  },
  {
    role: "MANAGER",
    firstRoute: "/dashboard",
    summary: "지점 관리자는 공통 홈 뒤 /work-items/branch → /employees → /org → /management 순서의 branch scope 운영 레인만 확인합니다.",
    blocked: "/employees · /org 는 read-only 확인용이며 /admin/users · /admin/policies preview 는 기본 진입 차단",
  },
  {
    role: "COMPANY_ADMIN",
    firstRoute: "/dashboard",
    summary: "운영 관리자는 공통 홈 뒤 /management → /admin/users → /admin/policies → /admin/audit-logs company scope 운영 레인을 검토합니다.",
    blocked: "공통 landing 다음 레인은 /management 이고 branch scope 읽기 화면(/employees, /org)을 관리자 저장 화면처럼 쓰지 않음",
  },
  {
    role: "AUDITOR",
    firstRoute: "/admin/audit-logs",
    summary: "감사는 read-only 추적 레인만 먼저 열고 운영 변경 레인과 섞지 않습니다.",
    blocked: "운영 변경 저장 레인 기본 진입 차단",
  },
] as const;

const shortcutSourceRules = [
  {
    title: "회사 공통 고정 바로가기 source",
    body: "`/api/home/shortcuts` 의 `scope=company` + `isFixed=true` 항목을 홈(`/dashboard`)·메뉴(`/menu`)와 같은 뜻으로 읽습니다.",
    note: "근태·휴가·결재처럼 모두가 같은 순서로 찾는 기본 업무만 여기 남깁니다.",
  },
  {
    title: "권한 기반 사용자 전용 바로가기 source",
    body: "같은 API의 `scope=user` 항목을 현재 세션 권한으로만 추가하고, 일반 직원에게는 privileged shortcut 을 숨깁니다.",
    note: "관리자 사용자·감사 로그·경영업무처럼 민감한 진입점은 홈 공통 영역과 섞지 않습니다.",
  },
  {
    title: "role / permission 카탈로그 source",
    body: "`/api/roles`, `/api/permissions`, `/api/admin/users` 를 같이 보며 role diff, 고위험 권한 후보, 노출/차단 기준을 운영 검토용으로 읽습니다.",
    note: "`/employees` 는 일반 조회이고, 실제 권한 저장은 이번 단계 범위가 아닙니다.",
  },
] as const;

export function AdminUsersPageContent({
  preview,
  actionMessage,
  loadError,
  actionType,
  focusMessage,
}: AdminUsersPageContentProps) {
  const activeJourney = actionJourneyMap[actionType as keyof typeof actionJourneyMap] ?? null;

  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="Phase 55 관리자 계정·권한·조직 실사용화"
      title="계정관리 / 사용자·권한"
      description="사용자 생성, 역할/업무권한 지정, 활성/비활성, 비밀번호 초기화·변경을 dev-safe preview 로 눌러보고, 실제 저장은 열지 않는 계정관리 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">dev-safe account flow</Pill>
          <Pill tone="warning">no production writes</Pill>
        </div>
      }
    >
      {actionMessage ? (
        <section className="status-banner" role="status">
          <strong>최근 dev-safe 실행 결과</strong>
          <span>{actionMessage}</span>
        </section>
      ) : null}

      {focusMessage || activeJourney ? (
        <SurfaceSection title="방금 실행한 preview 다음 확인" description="계정관리 preview 를 누른 뒤 어디를 바로 확인할지 actionType 기준으로 고정합니다.">
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
        title="Phase 55 관리자 온보딩·운영 순서"
        description="이번 단계에서는 계정 preview, 조직 읽기, 운영 레인, 감사 레인을 live URL 기준 한 절차로 묶어 같은 언어로 확인합니다."
      >
        <ol className="number-list">
          {onboardingRehearsalSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection
        title="역할별 시작 레인과 차단 기준"
        description="직원·인사·운영·감사 사용자가 같은 화면을 첫 진입점으로 쓰지 않도록 route 기준을 고정합니다."
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
          <strong>계정관리 미리보기를 불러오지 못했습니다</strong>
          <span>{loadError}</span>
        </section>
      ) : null}

      <SurfaceSection title="운영자 설정 read model" description="`/dashboard`·`/menu` shortcut, role/permission source, 회사 설정 모델, dev-safe 경계를 같은 언어로 묶어 설명합니다.">
        <article className="info-card">
          <Pill tone="accent">{preview.companySettingsModel.companyName}</Pill>
          <h3>정책 시작점</h3>
          <p>{preview.companySettingsModel.policyStartPoint}</p>
          <p className="card-note">audit candidate: {preview.audit.action}</p>
        </article>
        <div className="grid-auto-compact" style={{ marginTop: 16 }}>
          {shortcutSourceRules.map((item) => (
            <article key={item.title} className="info-card">
              <Pill>source</Pill>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <p className="card-note">{item.note}</p>
            </article>
          ))}
        </div>
        <div className="grid-auto-compact" style={{ marginTop: 16 }}>
          {preview.companySettingsModel.policyAxes.map((axis) => (
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
          <Pill tone="accent">{preview.companySettingsModel.companyName}</Pill>
          <h3>정책 시작점</h3>
          <p>{preview.companySettingsModel.policyStartPoint}</p>
          <p className="card-note">audit candidate: {preview.audit.action}</p>
        </article>
        <div className="grid-auto-compact" style={{ marginTop: 16 }}>
          {preview.companySettingsModel.groups.map((group) => (
            <article key={group.id} className="info-card">
              <Pill>{group.owner}</Pill>
              <h3>{group.title}</h3>
              <p>{group.summary}</p>
              <p className="card-note">연결 화면: {group.linkedRoutes.join(" · ")}</p>
            </article>
          ))}
        </div>
        <div className="grid-auto-compact" style={{ marginTop: 16 }}>
          {preview.companySettingsModel.policyAxes.map((axis) => (
            <article key={axis.id} className="info-card">
              <Pill tone="accent">정책 축</Pill>
              <h3>{axis.title}</h3>
              <p>{axis.summary}</p>
              <p className="card-note">우선순위: {axis.priority}</p>
            </article>
          ))}
        </div>
        <ul className="summary-list" style={{ marginTop: 16 }}>
          {preview.companySettingsModel.employeeVisibilityRules.map((rule) => (
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
            <p>실제 저장 없이 role diff, status preview, high-risk permission 후보, shortcut 노출 기준을 검토합니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="현재 검토 중인 사용자" description="실제 API 응답 기반으로 역할·상태·고위험 권한 preview 를 함께 보여 줍니다.">
        {preview.items.length > 0 ? (
          <div className="grid-auto-compact">
            {preview.items.map((item) => (
              <article key={item.userId} className="info-card">
                <Pill tone={item.highRiskPermissions.length > 0 ? "warning" : "accent"}>{item.roleCodes.join(", ")}</Pill>
                <h3>{item.fullName}</h3>
                <p>{item.email} · {item.departmentName}</p>
                <p className="meta-copy">역할 후보: {item.roleChangePreview.nextRoleCodes.join(", ") || "유지"}</p>
                <p className="card-note">
                  상태 변경 diff: {item.employmentStatus} → {item.statusChangePreview.nextStatus} · 감사 후보: {item.highRiskPermissions.length > 0 ? item.highRiskPermissions.join(", ") : "없음"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <article className="info-card">
            <h3>empty 상태</h3>
            <p>이번 회사 scope 에 아직 계정관리 대상 사용자가 없으면 여기서 empty 를 그대로 보여 줍니다.</p>
          </article>
        )}
      </SurfaceSection>

      <SurfaceSection title="사용자 생성 dev-safe 흐름" description="실제 저장 없이 어떤 정보를 받아 어떤 계정이 생길지 preview 메시지로만 확인합니다.">
        <p className="meta-copy">실저장 없음 · 실제 초대/계정 생성/외부 발송 없이 preview 문구만 남깁니다.</p>
        <form className="form-placeholder" method="post" action="/admin/users/dev-safe-action">
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
          <button type="submit" className="touch-button">생성 preview 보기</button>
        </form>
      </SurfaceSection>

      <SurfaceSection title="역할 / 업무권한 지정" description="역할과 capability 를 한 번에 바꿨을 때 어떤 경로가 열리는지 preview 로만 확인합니다.">
        <p className="meta-copy">실저장 없음 · 역할 후보, capability diff, 열리는 route 범위만 검토합니다.</p>
        <form className="form-placeholder" method="post" action="/admin/users/dev-safe-action">
          <input type="hidden" name="actionType" value="role" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">대상 사용자</span>
              <input className="field" name="targetUser" defaultValue={preview.items[0]?.fullName ?? "관리자 테스트"} />
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
          <button type="submit" className="touch-button">권한 diff preview 보기</button>
        </form>
        <ul className="summary-list">
          {capabilityExamples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="활성 / 비활성 전환" description="비활성화나 휴직 전환도 실제 저장 대신 영향 범위만 먼저 안내합니다.">
        <p className="meta-copy">실저장 없음 · 상태 변경 diff 와 영향 범위만 먼저 보여 줍니다.</p>
        <form className="form-placeholder" method="post" action="/admin/users/dev-safe-action">
          <input type="hidden" name="actionType" value="status" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">대상 사용자</span>
              <input className="field" name="targetUser" defaultValue={preview.items[0]?.fullName ?? "관리자 테스트"} />
            </label>
            <label>
              <span className="meta-copy">다음 상태</span>
              <input className="field" name="nextStatus" defaultValue="offboarded" />
            </label>
            <label>
              <span className="meta-copy">사유</span>
              <input className="field" name="reason" defaultValue="UAT 상태 변경 preview" />
            </label>
          </div>
          <button type="submit" className="touch-button">상태 변경 preview 보기</button>
        </form>
      </SurfaceSection>

      <SurfaceSection title="비밀번호 초기화 / 변경" description="production 비밀번호 정책은 열지 않고, dev/test/UAT 범위에서 초기화/변경 시 어떤 안내가 나가는지만 preview 합니다.">
        <p className="meta-copy">실저장 없음 · 임시 비밀번호 안내와 감사 후보 메시지만 preview 합니다.</p>
        <form className="form-placeholder" method="post" action="/admin/users/dev-safe-action">
          <input type="hidden" name="actionType" value="password" />
          <div className="field-grid">
            <label>
              <span className="meta-copy">대상 사용자</span>
              <input className="field" name="targetUser" defaultValue={preview.items[0]?.fullName ?? "관리자 테스트"} />
            </label>
            <label>
              <span className="meta-copy">새 임시 비밀번호</span>
              <input className="field" name="nextPassword" defaultValue="1234" />
            </label>
            <label>
              <span className="meta-copy">메모</span>
              <input className="field" name="reason" defaultValue="dev-safe UAT reset only" />
            </label>
          </div>
          <button type="submit" className="touch-button">비밀번호 preview 보기</button>
        </form>
      </SurfaceSection>

      <SurfaceSection title="계정관리 뒤 바로 눌러볼 주요 업무" description="새 계정/권한 preview 뒤 최소 happy path 를 직접 눌러볼 수 있게 연결합니다.">
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

      <SurfaceSection title="forbidden / empty / error / dev-safe 경계" description="좋아 보이는 상태만 숨기지 않고 같이 남깁니다." muted>
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="warning">forbidden</Pill>
            <p>일반 직원이나 비허용 역할은 /admin/users, /management, /admin/audit-logs 에서 차단됩니다.</p>
          </article>
          <article className="info-card">
            <Pill>empty</Pill>
            <p>현재 회사 scope 에 계정이 없거나 검토 큐가 비어 있으면 empty 를 정상 상태로 그대로 보여 줍니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">error</Pill>
            <p>API preview 나 dev-safe action 처리에 실패하면 성공처럼 넘기지 않고 경고 배너로 남깁니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="accent">dev-safe</Pill>
            <p>실제 메일 발송, 외부 IdP, production password policy, 대량 import 는 이번 단계에 포함하지 않습니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결 화면 / 근거" description="현재 API 응답이 어떤 화면과 이어지는지 같이 적어 둡니다.">
        <div className="grid-auto-compact">
          {preview.linkedScreens.map((item) => (
            <article key={`${item.source}-${item.title}`} className="info-card">
              <Pill>{item.category}</Pill>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <p className="card-note">source: {item.source}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
