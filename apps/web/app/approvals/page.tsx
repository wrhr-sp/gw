import Link from "next/link";
import { appRoutes } from "@gw/shared";

const mailboxCards = [
  {
    title: "내 기안함",
    body: "기안자 기준으로 내 문서 목록과 상태를 먼저 구분합니다. 실제 법적 효력이 있는 전자결재가 아니라 placeholder 상태입니다.",
    status: "draft / pending_approval / approved / rejected",
  },
  {
    title: "내 승인함",
    body: "승인 권한이 있는 사용자만 보는 승인 대기 문서함입니다. 자기 문서 자기 승인은 API guardrail 로 차단합니다.",
    status: "pending review",
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
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/dashboard">← 대시보드로</Link>
      <h1>전자결재 1차 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        이 화면은 법적 효력이 있는 전자결재 완성본이 아니라, Phase 4 승인 범위 안에서 문서함/기안/상세/승인함 구조를 먼저 고정하기 위한
        placeholder 입니다.
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {mailboxCards.map((card) => (
          <article key={card.title} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>{card.title}</h2>
            <p style={{ lineHeight: 1.7 }}>{card.body}</p>
            <p style={{ marginBottom: 0, color: "#4b5563" }}>상태 예시: {card.status}</p>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>기안 작성 skeleton</h2>
        <p style={{ lineHeight: 1.7 }}>
          실제 rich editor/첨부/PDF 변환 대신 제목·요약·결재선·참조자 조합을 먼저 고정합니다.
        </p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {draftChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>문서 상세 / 승인 처리 placeholder</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 16 }}>
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" disabled style={{ padding: "10px 16px", borderRadius: 999, border: "1px solid #d1d5db" }}>
            승인 placeholder
          </button>
          <button type="button" disabled style={{ padding: "10px 16px", borderRadius: 999, border: "1px solid #d1d5db" }}>
            반려 placeholder
          </button>
        </div>
        <p style={{ marginTop: 12, marginBottom: 0, color: "#6b7280" }}>
          버튼을 숨기는 것만으로는 충분하지 않으며, 서버에서 company scope 와 self-approval guardrail 을 함께 확인합니다.
        </p>
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>연결할 API</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li><a href={appRoutes.approvals.forms}>{appRoutes.approvals.forms}</a> — 결재 양식 목록/생성 skeleton</li>
          <li><a href={appRoutes.approvals.lines}>{appRoutes.approvals.lines}</a> — 결재선 목록/생성 skeleton</li>
          <li><a href={appRoutes.approvals.documents}>{appRoutes.approvals.documents}</a> — 내 문서함/기안 skeleton</li>
          <li><a href={appRoutes.approvals.inbox}>{appRoutes.approvals.inbox}</a> — 승인함 skeleton</li>
          <li><a href={appRoutes.approvals.referenceCandidates}>{appRoutes.approvals.referenceCandidates}</a> — 참조 후보</li>
          <li><a href={appRoutes.approvals.agreementCandidates}>{appRoutes.approvals.agreementCandidates}</a> — 합의 후보</li>
        </ul>
      </section>
    </main>
  );
}
