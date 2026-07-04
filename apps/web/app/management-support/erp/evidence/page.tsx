"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  documentFileListResponseSchema,
  erpEvidenceCreateRequestSchema,
  erpEvidenceListResponseSchema,
  erpEvidenceMutationResponseSchema,
  erpExpenseRequestListResponseSchema,
  erpVendorListResponseSchema,
  errorResponseSchema,
  type DocumentFile,
  type ErpEvidence,
  type ErpExpenseRequest,
  type ErpVendor,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type EvidenceFormState = {
  expenseId: string;
  vendorId: string;
  fileId: string;
  evidenceType: "receipt" | "tax_invoice" | "transaction_statement" | "contract" | "business_registration" | "other";
  title: string;
  issuedAt: string;
  supplyAmount: string;
  taxAmount: string;
  totalAmount: string;
  memo: string;
};

const initialFormState: EvidenceFormState = {
  expenseId: "",
  vendorId: "",
  fileId: "",
  evidenceType: "receipt",
  title: "",
  issuedAt: "",
  supplyAmount: "",
  taxAmount: "",
  totalAmount: "",
  memo: "",
};

function optionalValue(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function optionalNumber(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? Number(normalized) : undefined;
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchEvidence(): Promise<ErpEvidence[]> {
  const response = await fetch(appRoutes.erp.evidence, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpEvidenceListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("증빙 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchExpenses(): Promise<ErpExpenseRequest[]> {
  const response = await fetch(appRoutes.erp.expenses, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpExpenseRequestListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("지출결의 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchVendors(): Promise<ErpVendor[]> {
  const response = await fetch(appRoutes.erp.vendors, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpVendorListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("거래처 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchFiles(): Promise<DocumentFile[]> {
  const response = await fetch(appRoutes.documents.files, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = documentFileListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("문서 파일 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items.filter((file) => file.storageStatus === "ready");
}

async function createEvidence(form: EvidenceFormState): Promise<ErpEvidence> {
  const payload = erpEvidenceCreateRequestSchema.parse({
    expenseId: optionalValue(form.expenseId),
    vendorId: optionalValue(form.vendorId),
    fileId: form.fileId.trim(),
    evidenceType: form.evidenceType,
    title: form.title.trim(),
    issuedAt: optionalValue(form.issuedAt),
    supplyAmount: optionalNumber(form.supplyAmount),
    taxAmount: optionalNumber(form.taxAmount),
    totalAmount: optionalNumber(form.totalAmount),
    memo: optionalValue(form.memo),
  });
  const response = await fetch(appRoutes.erp.evidence, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpEvidenceMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("증빙 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.evidence;
}

function typeLabel(type: ErpEvidence["evidenceType"]) {
  if (type === "receipt") return "영수증";
  if (type === "tax_invoice") return "세금계산서";
  if (type === "transaction_statement") return "거래명세서";
  if (type === "contract") return "계약서";
  if (type === "business_registration") return "사업자등록증";
  return "기타";
}

function statusLabel(status: ErpEvidence["status"]) {
  if (status === "draft") return "작성중";
  if (status === "submitted") return "제출";
  if (status === "accepted") return "확인완료";
  if (status === "rework_requested") return "보완요청";
  return "보관";
}

function amountLabel(value: number | null) {
  if (value === null) return "금액 미입력";
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export default function ErpEvidencePage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [evidence, setEvidence] = useState<ErpEvidence[]>([]);
  const [expenses, setExpenses] = useState<ErpExpenseRequest[]>([]);
  const [vendors, setVendors] = useState<ErpVendor[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [form, setForm] = useState<EvidenceFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedEvidence = useMemo(() => evidence.find((item) => item.id === selectedEvidenceId) ?? evidence[0] ?? null, [evidence, selectedEvidenceId]);
  const missingLinkCount = useMemo(() => evidence.filter((item) => !item.expenseId || !item.vendorId).length, [evidence]);
  const reworkCount = useMemo(() => evidence.filter((item) => item.status === "rework_requested").length, [evidence]);

  async function reloadEvidence() {
    setLoadState("loading");
    setToast(null);
    try {
      const [evidenceItems, expenseItems, vendorItems, fileItems] = await Promise.all([fetchEvidence(), fetchExpenses(), fetchVendors(), fetchFiles()]);
      setEvidence(evidenceItems);
      setExpenses(expenseItems);
      setVendors(vendorItems.filter((vendor) => vendor.status === "active"));
      setFiles(fileItems);
      setSelectedEvidenceId((current) => current ?? evidenceItems[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "증빙 정보를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createEvidence(form);
      const items = await fetchEvidence();
      setEvidence(items);
      setSelectedEvidenceId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "증빙을 등록했습니다.", body: "등록 후 목록을 다시 조회해 DB 저장 상태를 확인했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "증빙 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadEvidence(); }, []);

  return (
    <PageShell title="ERP/경리 · 증빙함" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 증빙함">
        <aside className="feature-workspace__nav" aria-label="ERP 경리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadEvidence()} type="button">증빙함</button></h1>
            <FeaturePageOverflowMenu label="ERP 증빙함" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="증빙함 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 증빙</span><strong>{evidence.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>보완요청</span><strong>{reworkCount}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/expenses"><span>지출결의</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/vendors"><span>거래처</span><strong>이동</strong></a>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-evidence-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-evidence-heading">증빙함</h2>
              <p>R2 문서 파일을 지출결의·거래처와 연결해 내부 경리 증빙 기준을 먼저 만듭니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 증빙 데이터 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>등록 증빙</span><strong>{evidence.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>문서 파일 후보</span><strong>{files.length}건</strong><p>ready 파일만 연결 가능</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>연결 확인</span><strong>{missingLinkCount}건</strong><p>지출결의 또는 거래처 미연결</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="증빙 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>증빙 등록</strong>
                <span>문서함에 업로드 완료된 파일 ID를 증빙으로 연결합니다.</span>
                <div className="form-grid form-grid--two">
                  <label>증빙 제목<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></label>
                  <label>증빙 종류<select value={form.evidenceType} onChange={(event) => setForm((current) => ({ ...current, evidenceType: event.target.value as EvidenceFormState["evidenceType"] }))}><option value="receipt">영수증</option><option value="tax_invoice">세금계산서</option><option value="transaction_statement">거래명세서</option><option value="contract">계약서</option><option value="business_registration">사업자등록증</option><option value="other">기타</option></select></label>
                  <label>문서 파일<select value={form.fileId} onChange={(event) => setForm((current) => ({ ...current, fileId: event.target.value }))} required><option value="">파일 선택</option>{files.map((file) => <option key={file.id} value={file.id}>{file.fileName}</option>)}</select></label>
                  <label>지출결의<select value={form.expenseId} onChange={(event) => setForm((current) => ({ ...current, expenseId: event.target.value }))}><option value="">연결 안 함</option>{expenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.title}</option>)}</select></label>
                  <label>거래처<select value={form.vendorId} onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">연결 안 함</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                  <label>발행일<input type="date" value={form.issuedAt} onChange={(event) => setForm((current) => ({ ...current, issuedAt: event.target.value }))} /></label>
                  <label>공급가액<input min="0" type="number" value={form.supplyAmount} onChange={(event) => setForm((current) => ({ ...current, supplyAmount: event.target.value }))} /></label>
                  <label>부가세<input min="0" type="number" value={form.taxAmount} onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))} /></label>
                  <label>합계<input min="0" type="number" value={form.totalAmount} onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))} /></label>
                  <label>메모<input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden" || files.length === 0} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="증빙 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>증빙 목록을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {evidence.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 증빙이 없습니다.</strong><span>문서 파일을 먼저 업로드한 뒤 증빙으로 연결합니다.</span></div><em>빈 상태</em></article> : null}
            {evidence.map((item) => (
              <article className="feature-workspace__row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{typeLabel(item.evidenceType)} · {statusLabel(item.status)} · {item.fileName ?? item.fileId}</span>
                  <p>{item.expenseTitle ?? "지출결의 미연결"} · {item.vendorName ?? "거래처 미연결"} · {amountLabel(item.totalAmount)}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${item.title} 증빙 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedEvidenceId(item.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">경리나라 전송</button>
                  </div>
                </div>
                <em>{item.syncStatus === "not_connected" ? "내부" : "연동"}</em>
              </article>
            ))}
          </div>

          {selectedEvidence ? (
            <div className="feature-workspace__rows" aria-label="증빙 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{selectedEvidence.title}</strong>
                  <span>{typeLabel(selectedEvidence.evidenceType)} · {selectedEvidence.fileName ?? selectedEvidence.fileId}</span>
                  <p>{selectedEvidence.expenseTitle ?? "지출결의 미연결"} · {selectedEvidence.vendorName ?? "거래처 미연결"}</p>
                  <p>공급가액 {amountLabel(selectedEvidence.supplyAmount)} · 부가세 {amountLabel(selectedEvidence.taxAmount)} · 합계 {amountLabel(selectedEvidence.totalAmount)}</p>
                  <p>{selectedEvidence.reworkReason ?? selectedEvidence.memo ?? "보완 사유 없음"}</p>
                </div>
                <em>{statusLabel(selectedEvidence.status)}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
