import React from "react";
import type { AdminUsersListResponse } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";

type AdminUsersPreview = Pick<AdminUsersListResponse["data"], "items" | "linkedScreens">;

type AdminUsersPageContentProps = {
  preview: AdminUsersPreview;
  actionMessage?: string | null;
  loadError?: string | null;
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

export function AdminUsersPageContent({ preview, actionMessage, loadError }: AdminUsersPageContentProps) {
  return (
    <PageShell
      backHref="/management"
      backLabel="경영업무로"
      eyebrow="Phase 31 계정관리 / dev-safe UAT"
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

      {loadError ? (
        <section className="status-banner status-banner--warning" role="alert">
          <strong>계정관리 미리보기를 불러오지 못했습니다</strong>
          <span>{loadError}</span>
        </section>
      ) : null}

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
