import React from "react";
import { appRoutes } from "@gw/shared";

import { PlaceholderAction } from "../_components/placeholder-action";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { ApprovalsLiveSection } from "../_components/real-usage-panels";

const mailboxCards = [
  {
    title: "내 승인함",
    body: "모바일에서는 승인 대기 문서를 먼저 보고, 큰 승인/반려 CTA 와 경고 문구를 같은 화면에 둡니다.",
    status: "pending review",
  },
  {
    title: "내 기안함",
    body: "기안자 기준 상태 요약과 문서함 진입점을 별도 카드로 분리합니다.",
    status: "draft / pending_approval / approved / rejected",
  },
  {
    title: "참조/합의 문서함",
    body: "참조자/합의 후보가 후속 단계에서 확인할 문서함 분리 시작점입니다.",
    status: "reference / agreement",
  },
] as const;

const draftChecklist = [
  "1. 결재 양식 선택 (/api/approvals/forms)",
  "2. 결재선 선택 (/api/approvals/lines)",
  "3. 참조자/합의 후보 선택 (/api/approvals/references|agreements/candidates)",
  "4. 제목/요약 입력 후 기안 preview 생성",
] as const;

const approvalFlowSteps = [
  {
    title: "기안자 lane",
    body: "내 문서함에서 상태를 확인하고, 문서가 pending_approval 로 넘어가면 승인자 응답을 기다립니다.",
  },
  {
    title: "승인자 lane",
    body: "승인 권한자는 내 승인함에서 문서를 검토하고 approve / reject / 보완 요청 판단을 수행합니다.",
  },
  {
    title: "운영 경계",
    body: "양식/결재선 관리와 감사 추적은 일반 직원 문서 확인 흐름과 섞지 않고 별도 운영 권한으로 분리합니다.",
  },
] as const;

const detailSections = [
  "문서 기본 정보: 제목, 문서번호, 상태, 기안자",
  "결재선 단계: 순서, 승인자, decisionStatus",
  "참조/합의 대상: referenceType, readAt placeholder",
  "의견/댓글과 상태 이력을 같은 상세 route 에서 함께 확인",
  "승인/반려 버튼과 상태 안내 placeholder",
] as const;

const bridgeNotes = [
  "권한 부족: approval.document.approve 권한이 없으면 승인함 대신 내 문서함 중심으로 제한합니다.",
  "회사/문서 범위: 같은 회사 문서이면서 기안자/승인자/참조자에게만 상세를 허용합니다.",
  "정책 연결: 팀장 승인 권한과 운영 관리자 권한을 같은 것으로 보지 않고 /admin/users 설명과 분리합니다.",
  "replay 차단: 한 번 승인/반려된 문서는 같은 단계에서 다시 성공 처리하지 않습니다.",
  "placeholder 제한: 실제 발송/저장 없이 self-approval guardrail 과 audit candidate 만 먼저 확인합니다.",
] as const;

const collaborationRoutes = [
  "`/dashboard` 에서 승인 대기 먼저 확인",
  "필요 시 `/boards` 에서 공지/협업 글 맥락 확인",
  "첨부·참조 문서는 `/documents` 권한 경계 안에서만 열람",
  "양식/결재선 운영 정책은 `/admin/policies` 에서 별도 검토",
] as const;

const guardrailCards = [
  {
    tone: "accent" as const,
    title: "권한 부족",
    body: "approval.document.approve 권한이 없으면 승인함 접근 자체를 막고 내 문서 확인만 남깁니다.",
  },
  {
    tone: "warning" as const,
    title: "self-approval 금지",
    body: "자기 문서 자기승인은 근태/휴가와 같은 공통 guardrail 로 유지합니다.",
  },
  {
    tone: "default" as const,
    title: "회사 scope / unknown id 차단",
    body: "forged·unknown document id, 회사 scope 밖 문서, replay 시도는 상세/승인 성공처럼 처리하지 않습니다.",
  },
  {
    tone: "warning" as const,
    title: "placeholder 제한",
    body: "실서명, 외부 메일/메신저 알림, 법적 효력, 원문 장기보관은 별도 승인 게이트입니다.",
  },
] as const;

export default function ApprovalsPage() {
  return (
    <PageShell
      eyebrow="Phase 41 일상 협업 결재 도입"
      title="전자결재"
      titleHref="/approvals"
      description="기안자 lane, 승인자 lane, 운영 정책 lane 을 분리해 보여 주고, same-origin API 기준으로 기안·승인·반려 preview 와 self-approval/replay guardrail 을 직접 확인할 수 있게 정리했습니다."
      actions={
        <div className="action-row">
          <PlaceholderAction label="승인 placeholder" hint="실제 승인 처리는 self-approval guardrail 과 회사 범위 검증이 연결된 뒤에만 활성화됩니다." />
          <PlaceholderAction label="반려 placeholder" hint="반려 처리 역시 서버 검증과 감사 로그 연결 전까지는 실행되지 않습니다." tone="secondary" />
        </div>
      }
    >
      <SurfaceSection title="실사용 확인 패널" description="내 문서함·승인함을 실제 API에서 읽고, 기안/승인/반려 preview 를 바로 테스트합니다.">
        <ApprovalsLiveSection />
      </SurfaceSection>

      <SurfaceSection title="기안 → 승인/반려 → 보완 요청 흐름" description="전자결재의 happy path 를 기안자/승인자 책임 단위로 먼저 읽히게 정리합니다.">
        <div className="grid-auto">
          {approvalFlowSteps.map((step) => (
            <article key={step.title} className="route-card">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="모바일 우선 문서함" description="내 승인함 → 내 기안함 → 참조/합의 순서로 카드 우선순위를 재정렬했습니다.">
        <div className="grid-auto">
          {mailboxCards.map((card, index) => (
            <article key={card.title} className="route-card">
              <Pill tone={index === 0 ? "accent" : "default"}>{card.status}</Pill>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="기안 작성 stepper" description="양식·결재선·참조자 조합을 먼저 고정하고, 작성 흐름을 바로 따라갈 수 있게 만듭니다.">
        <ol className="number-list">
          {draftChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="문서 상세 / 승인 처리 placeholder" description="작은 화면에서도 핵심 상태와 CTA 를 먼저 보여 줍니다." muted>
        <ul className="summary-list">
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="muted-copy" style={{ marginTop: 16 }}>
          버튼을 크게 만드는 것만으로는 충분하지 않으며, 서버에서 company scope 와 self-approval guardrail 을 함께 확인합니다.
        </p>
      </SurfaceSection>

      <SurfaceSection title="차단 이유 4축" description="권한 부족, self-approval, 회사 scope/unknown id, placeholder 제한을 분리해 고정합니다.">
        <div className="grid-auto-compact">
          {guardrailCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone={card.tone}>{card.title}</Pill>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="운영 경계 / 차단 이유" description="팀장, 일반 구성원, 운영 관리자가 같은 차단 이유를 같은 말로 읽도록 맞춥니다.">
        <ul className="summary-list">
          {bridgeNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="협업 흐름 연결" description="전자결재는 `/dashboard` 에서 시작하는 협업 레인의 일부이며 운영 정책 화면과 책임을 섞지 않습니다.">
        <ul className="summary-list">
          {collaborationRoutes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="연결할 API" description="same-origin /api 계약을 모바일에서도 유지합니다.">
        <ul className="summary-list">
          <li><a href={appRoutes.approvals.forms}>{appRoutes.approvals.forms}</a> — 결재 양식 목록/생성 skeleton</li>
          <li><a href={appRoutes.approvals.lines}>{appRoutes.approvals.lines}</a> — 결재선 목록/생성 skeleton</li>
          <li><a href={appRoutes.approvals.documents}>{appRoutes.approvals.documents}</a> — 내 문서함/기안 skeleton</li>
          <li><a href={appRoutes.approvals.detail("approval_document_demo")}>{appRoutes.approvals.detail("approval_document_demo")}</a> — 문서 상세/승인선/이력</li>
          <li><a href={appRoutes.approvals.comments("approval_document_demo")}>{appRoutes.approvals.comments("approval_document_demo")}</a> — 의견/댓글 목록·작성</li>
          <li><a href={appRoutes.approvals.inbox}>{appRoutes.approvals.inbox}</a> — 승인함 skeleton</li>
          <li><a href={appRoutes.approvals.referenceCandidates}>{appRoutes.approvals.referenceCandidates}</a> — 참조 후보</li>
          <li><a href={appRoutes.approvals.agreementCandidates}>{appRoutes.approvals.agreementCandidates}</a> — 합의 후보</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
