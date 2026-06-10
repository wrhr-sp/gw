import { appRoutes } from "@gw/shared";

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

export default function ApprovalsPage() {
  return (
    <PageShell
      eyebrow="모바일 전자결재 skeleton"
      title="전자결재 1차 skeleton"
      description="모바일에서 내 승인함을 먼저 열고, 기안 작성과 상세 상태를 작은 화면에서도 우선순위가 드러나게 정리한 placeholder 입니다."
      actions={
        <div className="action-row">
          <span className="touch-button" aria-disabled="true">
            승인 placeholder
          </span>
          <span className="touch-button--secondary" aria-disabled="true">
            반려 placeholder
          </span>
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
