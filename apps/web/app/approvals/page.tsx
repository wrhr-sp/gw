"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  approvalDocumentCreateResponseSchema,
  approvalDocumentListResponseSchema,
  approvalFormListResponseSchema,
  approvalInboxResponseSchema,
  approvalLineListResponseSchema,
  errorResponseSchema,
  type ApprovalDocument,
  type ApprovalDocumentCreateRequest,
  type ApprovalForm,
  type ApprovalLine,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type MutationState = "idle" | "submitting" | "success" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type ApprovalData = {
  forms: ApprovalForm[];
  lines: ApprovalLine[];
  documents: ApprovalDocument[];
  inbox: ApprovalDocument[];
};

const documentStatusLabels: Record<ApprovalDocument["status"], string> = {
  draft: "임시저장",
  pending_approval: "승인 대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data.error.message;
  }
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parse(await response.json());
}

async function fetchApprovalData(): Promise<ApprovalData> {
  const [forms, lines, documents, inbox] = await Promise.all([
    fetchJson(appRoutes.approvals.forms, (payload) => {
      const parsed = approvalFormListResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("전자결재 양식 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(appRoutes.approvals.lines, (payload) => {
      const parsed = approvalLineListResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("전자결재 결재선 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(appRoutes.approvals.documents, (payload) => {
      const parsed = approvalDocumentListResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("전자결재 문서 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(appRoutes.approvals.inbox, (payload) => {
      const parsed = approvalInboxResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("내 결재함 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }).catch(() => [] as ApprovalDocument[]),
  ]);

  return { forms, lines, documents, inbox };
}

async function createApprovalDocument(request: ApprovalDocumentCreateRequest) {
  const response = await fetch(appRoutes.approvals.documents, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const parsed = approvalDocumentCreateResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("전자결재 기안 응답 형식이 계약과 맞지 않습니다.");
  }
  return parsed.data.data.document;
}

function ApprovalDocumentRow({ document }: { document: ApprovalDocument }) {
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{document.title}</strong>
        <span>{`${document.documentNumber} · ${document.summary}`}</span>
        <p>{document.submittedAt ? `상신 ${document.submittedAt.slice(0, 10)}` : "작성 중"}</p>
        <div className="feature-workspace__row-actions" aria-label={`${document.id} 전자결재 문서 처리`}>
          <a className="feature-workspace__row-action feature-workspace__row-action--secondary" href={appRoutes.approvals.detail(document.id)}>
            상세 보기
          </a>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">
            의견 남기기
          </button>
        </div>
      </div>
      <em>{documentStatusLabels[document.status]}</em>
    </article>
  );
}

export default function ApprovalsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [forms, setForms] = useState<ApprovalForm[]>([]);
  const [lines, setLines] = useState<ApprovalLine[]>([]);
  const [documents, setDocuments] = useState<ApprovalDocument[]>([]);
  const [inbox, setInbox] = useState<ApprovalDocument[]>([]);
  const [formId, setFormId] = useState("");
  const [lineId, setLineId] = useState("");
  const [title, setTitle] = useState("6월 사무용품 구입 건");
  const [summary, setSummary] = useState("구입 목적과 금액, 증빙 파일을 확인해 주세요.");
  const [toast, setToast] = useState<ToastState>(null);

  const pendingCount = useMemo(() => documents.filter((document) => document.status === "pending_approval").length, [documents]);
  const completedCount = useMemo(() => documents.filter((document) => document.status === "approved").length, [documents]);

  async function reloadApprovalData() {
    setLoadState("loading");
    setToast(null);
    try {
      const data = await fetchApprovalData();
      setForms(data.forms);
      setLines(data.lines);
      setDocuments(data.documents);
      setInbox(data.inbox);
      setFormId((current) => current || data.forms[0]?.id || "");
      setLineId((current) => current || data.lines[0]?.id || "");
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "전자결재 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => {
    void reloadApprovalData();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formId || !lineId) {
      setToast({ tone: "warning", title: "기안 실패", body: "양식과 결재선을 먼저 선택해 주세요." });
      return;
    }
    if (!title.trim() || !summary.trim()) {
      setToast({ tone: "warning", title: "기안 실패", body: "제목과 내용을 입력해 주세요." });
      return;
    }

    setMutationState("submitting");
    setToast(null);
    try {
      const document = await createApprovalDocument({
        formId,
        lineId,
        title: title.trim(),
        summary: summary.trim(),
        referenceEmployeeIds: [],
        agreementEmployeeIds: [],
      });
      await reloadApprovalData();
      setToast({ tone: "accent", title: "기안 올리기 완료", body: `${document.documentNumber} · ${documentStatusLabels[document.status]}` });
      setMutationState("success");
    } catch (error) {
      setToast({ tone: "warning", title: "기안 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
      setMutationState("error");
    }
  }

  return (
    <PageShell title="전자결재" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="전자결재 메뉴">
          <div className="feature-workspace__nav-header">
            <h1>
              <button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadApprovalData()} type="button">
                전자결재
              </button>
            </h1>
            <FeaturePageOverflowMenu label="전자결재" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="전자결재 상태 요약">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button">
              <span>내 결재함</span>
              <strong>{inbox.length}건</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>기안 작성</span>
              <strong>{forms.length > 0 ? "작성" : "대기"}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>결재선</span>
              <strong>{lines.length}개</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>문서 상태</span>
              <strong>{documents.length}건</strong>
            </button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="approvals-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="approvals-panel-heading">내 결재함</h2>
              <p>내가 처리해야 할 문서와 내 기안 문서를 실제 전자결재 API 기준으로 확인합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">approval.act 권한과 결재선 순서가 맞을 때만 처리 버튼을 노출합니다.</p>
          </div>

          {toast ? (
            <article className="info-card">
              <Pill tone={toast.tone}>{toast.tone === "accent" ? "완료" : "확인"}</Pill>
              <h3>{toast.title}</h3>
              <p>{toast.body}</p>
            </article>
          ) : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--warning">
              <span>승인 대기</span>
              <strong>{pendingCount}건</strong>
              <p>현재 조회된 결재 문서 기준</p>
            </article>
            <article className="feature-workspace__status">
              <span>내 기안</span>
              <strong>{documents.length}건</strong>
              <p>내가 접근 가능한 문서</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--accent">
              <span>완료</span>
              <strong>{completedCount}건</strong>
              <p>승인 완료 문서</p>
            </article>
          </div>

          <div className="feature-workspace__rows" aria-label="내 결재함 문서 목록">
            {loadState === "loading" && inbox.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>불러오는 중</strong>
                  <span>전자결재 문서 조회</span>
                </div>
                <em>대기</em>
              </article>
            ) : inbox.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>처리할 결재 없음</strong>
                  <span>현재 승인 대기 문서가 없거나 결재 권한이 없습니다.</span>
                  <div className="feature-workspace__row-actions" aria-label="전자결재 비어 있음 처리">
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">
                      승인
                    </button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">
                      반려
                    </button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">
                      보완 요청
                    </button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">
                      의견 남기기
                    </button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void reloadApprovalData()} type="button">
                      문서 상태 보기
                    </button>
                  </div>
                </div>
                <em>비어 있음</em>
              </article>
            ) : inbox.map((document) => <ApprovalDocumentRow document={document} key={document.id} />)}
          </div>

          <form className="feature-workspace__form" onSubmit={handleSubmit}>
            <label>
              <span>양식</span>
              <select aria-label="전자결재 양식" onChange={(event) => setFormId(event.target.value)} value={formId}>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>{form.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>결재선</span>
              <select aria-label="전자결재 결재선" onChange={(event) => setLineId(event.target.value)} value={lineId}>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>{line.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>제목</span>
              <input aria-label="전자결재 제목" onChange={(event) => setTitle(event.target.value)} value={title} />
            </label>
            <label>
              <span>내용</span>
              <textarea aria-label="전자결재 내용" onChange={(event) => setSummary(event.target.value)} rows={4} value={summary} />
            </label>
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={mutationState === "submitting" || forms.length === 0 || lines.length === 0} type="submit">
                기안 올리기
              </button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled={mutationState === "submitting"} onClick={() => void reloadApprovalData()} type="button">
                문서 상태 보기
              </button>
            </div>
          </form>

          <div className="feature-workspace__rows" aria-label="결재선 목록">
            {lines.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>결재선 후보가 없으면</strong>
                  <span>조직도와 직원 정보에서 승인자를 먼저 확인한 뒤 결재선을 다시 선택합니다.</span>
                </div>
                <em>조직도 확인</em>
              </article>
            ) : lines.map((line) => (
              <article className="feature-workspace__row" key={line.id}>
                <div>
                  <strong>{line.title}</strong>
                  <span>{line.description}</span>
                  <p>{line.steps.map((step) => `${step.stepOrder}단계 ${step.approverEmployeeId}`).join(" · ")}</p>
                </div>
                <em>{line.status}</em>
              </article>
            ))}
          </div>

          <div className="feature-workspace__rows" aria-label="전자결재 문서 상태 목록">
            {documents.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>문서 상태 없음</strong>
                  <span>기안 후 문서 진행 상태가 표시됩니다.</span>
                </div>
                <em>비어 있음</em>
              </article>
            ) : documents.map((document) => <ApprovalDocumentRow document={document} key={document.id} />)}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
