import { appRoutes } from "@gw/shared";

import { PlaceholderAction } from "../_components/placeholder-action";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

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
  "결재 양식 선택 (/api/approvals/forms)",
  "결재선 선택 (/api/approvals/lines)",
  "참조자/합의 후보 선택 (/api/approvals/references|agreements/candidates)",
  "제목/요약 placeholder 입력",
] as const;

const detailSections = [
  "문서 기본 정보: 제목, 문서번호, 상태, 기안자",
  "결재선 단계: 순서, 승인자, decisionStatus",
  "참조/합의 대상: referenceType, readAt placeholder",
  "승인/반려 버튼과 상태 안내 placeholder",
] as const;

const bridgeNotes = [
  "권한 부족: approval.document.approve 권한이 없으면 승인함 대신 내 문서함 중심으로 제한합니다.",
  "회사/문서 범위: 같은 회사 문서이면서 기안자/승인자/참조자에게만 상세를 허용합니다.",
  "정책 연결: 팀장 승인 권한과 운영 관리자 권한을 같은 것으로 보지 않고 /admin/users 설명과 분리합니다.",
  "placeholder 제한: 실제 발송/저장 없이 self-approval guardrail 과 audit candidate 만 먼저 확인합니다.",
] as const;

export default function ApprovalsPage() {
  return (
    <PageShell
      eyebrow="Phase 14 승인 흐름 연결"
      title="전자결재 1차 skeleton"
      description="대시보드의 승인 대기 요약과 같은 우선순위로 내 승인함, 팀 병목, 기안 작성 진입점을 작은 화면에서도 먼저 읽히게 정리한 placeholder 입니다."
      actions={
        <div className="action-row">
          <PlaceholderAction label="승인 placeholder" hint="실제 승인 처리는 self-approval guardrail 과 회사 범위 검증이 연결된 뒤에만 활성화됩니다." />
          <PlaceholderAction label="반려 placeholder" hint="반려 처리 역시 서버 검증과 감사 로그 연결 전까지는 실행되지 않습니다." tone="secondary" />
        </div>
      }
    >
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

      <SurfaceSection title="기안 작성 skeleton" description="제목·요약·결재선·참조자 조합을 먼저 고정합니다.">
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

      <SurfaceSection title="운영 경계 / 차단 이유" description="팀장, 일반 구성원, 운영 관리자가 같은 차단 이유를 같은 말로 읽도록 맞춥니다.">
        <ul className="summary-list">
          {bridgeNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="연결할 API" description="same-origin /api 계약을 모바일에서도 유지합니다.">
        <ul className="summary-list">
          <li><a href={appRoutes.approvals.forms}>{appRoutes.approvals.forms}</a> — 결재 양식 목록/생성 skeleton</li>
          <li><a href={appRoutes.approvals.lines}>{appRoutes.approvals.lines}</a> — 결재선 목록/생성 skeleton</li>
          <li><a href={appRoutes.approvals.documents}>{appRoutes.approvals.documents}</a> — 내 문서함/기안 skeleton</li>
          <li><a href={appRoutes.approvals.inbox}>{appRoutes.approvals.inbox}</a> — 승인함 skeleton</li>
          <li><a href={appRoutes.approvals.referenceCandidates}>{appRoutes.approvals.referenceCandidates}</a> — 참조 후보</li>
          <li><a href={appRoutes.approvals.agreementCandidates}>{appRoutes.approvals.agreementCandidates}</a> — 합의 후보</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
