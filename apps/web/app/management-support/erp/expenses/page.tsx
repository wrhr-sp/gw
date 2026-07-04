"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  erpExpenseRequestCreateRequestSchema,
  erpExpenseRequestListResponseSchema,
  erpExpenseRequestMutationResponseSchema,
  erpVendorListResponseSchema,
  errorResponseSchema,
  type ErpExpenseRequest,
  type ErpVendor,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type ExpenseFormState = {
  vendorId: string;
  title: string;
  expenseCategory: string;
  departmentId: string;
  branchId: string;
  projectCode: string;
  paymentMethod: "corporate_card" | "bank_transfer" | "cash" | "personal_card" | "other";
  taxType: "taxable" | "zero_rated" | "tax_exempt" | "non_taxable";
  supplyAmount: string;
  taxAmount: string;
  spentAt: string;
  evidenceFileId: string;
  approvalDocumentId: string;
  memo: string;
};

const today = new Date().toISOString().slice(0, 10);

const initialFormState: ExpenseFormState = {
  vendorId: "",
  title: "",
  expenseCategory: "",
  departmentId: "",
  branchId: "",
  projectCode: "",
  paymentMethod: "corporate_card",
  taxType: "taxable",
  supplyAmount: "0",
  taxAmount: "0",
  spentAt: today,
  evidenceFileId: "",
  approvalDocumentId: "",
  memo: "",
};

function optionalValue(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
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

async function createExpense(form: ExpenseFormState): Promise<ErpExpenseRequest> {
  const payload = erpExpenseRequestCreateRequestSchema.parse({
    vendorId: optionalValue(form.vendorId),
    title: form.title.trim(),
    expenseCategory: form.expenseCategory.trim(),
    departmentId: optionalValue(form.departmentId),
    branchId: optionalValue(form.branchId),
    projectCode: optionalValue(form.projectCode),
    paymentMethod: form.paymentMethod,
    taxType: form.taxType,
    supplyAmount: Number(form.supplyAmount),
    taxAmount: Number(form.taxAmount),
    spentAt: form.spentAt,
    evidenceFileId: optionalValue(form.evidenceFileId),
    approvalDocumentId: optionalValue(form.approvalDocumentId),
    memo: optionalValue(form.memo),
  });
  const response = await fetch(appRoutes.erp.expenses, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpExpenseRequestMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("지출결의 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.expense;
}

function statusLabel(status: ErpExpenseRequest["status"]) {
  if (status === "draft") return "작성중";
  if (status === "submitted") return "제출";
  if (status === "approved") return "확정";
  if (status === "rejected") return "반려";
  return "취소";
}

function paymentLabel(method: ErpExpenseRequest["paymentMethod"]) {
  if (method === "corporate_card") return "법인카드";
  if (method === "bank_transfer") return "계좌이체";
  if (method === "cash") return "현금";
  if (method === "personal_card") return "개인카드";
  return "기타";
}

function amountLabel(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function ErpExpensesPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [expenses, setExpenses] = useState<ErpExpenseRequest[]>([]);
  const [vendors, setVendors] = useState<ErpVendor[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedExpense = useMemo(() => expenses.find((expense) => expense.id === selectedExpenseId) ?? expenses[0] ?? null, [expenses, selectedExpenseId]);
  const totalAmount = useMemo(() => expenses.reduce((sum, expense) => sum + expense.totalAmount, 0), [expenses]);
  const pendingCount = useMemo(() => expenses.filter((expense) => expense.status === "submitted" || expense.status === "draft").length, [expenses]);

  async function reloadExpenses() {
    setLoadState("loading");
    setToast(null);
    try {
      const [expenseItems, vendorItems] = await Promise.all([fetchExpenses(), fetchVendors()]);
      setExpenses(expenseItems);
      setVendors(vendorItems.filter((vendor) => vendor.status === "active"));
      setSelectedExpenseId((current) => current ?? expenseItems[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "지출결의 정보를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createExpense(form);
      const items = await fetchExpenses();
      setExpenses(items);
      setSelectedExpenseId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "지출결의를 등록했습니다.", body: "등록 후 목록을 다시 조회해 DB 저장 상태를 확인했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "지출결의 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadExpenses(); }, []);

  return (
    <PageShell title="ERP/경리 · 지출결의" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 지출결의">
        <aside className="feature-workspace__nav" aria-label="ERP 경리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadExpenses()} type="button">지출결의</button></h1>
            <FeaturePageOverflowMenu label="ERP 지출결의" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="지출결의 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 지출</span><strong>{expenses.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>처리 대기</span><strong>{pendingCount}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/vendors"><span>거래처 관리</span><strong>이동</strong></a>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-expenses-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-expenses-heading">지출결의 / 비용 처리</h2>
              <p>경리나라 실제 API 연결 전, 비용·증빙·결재 연결 기준을 우리 내부 DB에 먼저 저장합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 지출결의 데이터 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>총 지출결의</span><strong>{expenses.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>합계</span><strong>{amountLabel(totalAmount)}원</strong><p>공급가액 + 부가세</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>경리나라 연동</span><strong>미연동</strong><p>외부 API 호출 없음</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="지출결의 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>지출결의 등록</strong>
                <span>금액, 비용항목, 결제수단을 실제 API로 저장합니다.</span>
                <div className="form-grid form-grid--two">
                  <label>제목<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></label>
                  <label>비용 항목<input value={form.expenseCategory} onChange={(event) => setForm((current) => ({ ...current, expenseCategory: event.target.value }))} required /></label>
                  <label>거래처<select value={form.vendorId} onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">거래처 선택 없음</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                  <label>결제수단<select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as ExpenseFormState["paymentMethod"] }))}><option value="corporate_card">법인카드</option><option value="bank_transfer">계좌이체</option><option value="cash">현금</option><option value="personal_card">개인카드</option><option value="other">기타</option></select></label>
                  <label>공급가액<input min="0" type="number" value={form.supplyAmount} onChange={(event) => setForm((current) => ({ ...current, supplyAmount: event.target.value }))} required /></label>
                  <label>부가세<input min="0" type="number" value={form.taxAmount} onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))} required /></label>
                  <label>사용일<input type="date" value={form.spentAt} onChange={(event) => setForm((current) => ({ ...current, spentAt: event.target.value }))} required /></label>
                  <label>세금 구분<select value={form.taxType} onChange={(event) => setForm((current) => ({ ...current, taxType: event.target.value as ExpenseFormState["taxType"] }))}><option value="taxable">과세</option><option value="zero_rated">영세</option><option value="tax_exempt">면세</option><option value="non_taxable">비과세</option></select></label>
                  <label>부서 ID<input value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} /></label>
                  <label>지점 ID<input value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} /></label>
                  <label>프로젝트 코드<input value={form.projectCode} onChange={(event) => setForm((current) => ({ ...current, projectCode: event.target.value }))} /></label>
                  <label>증빙 파일 ID<input value={form.evidenceFileId} onChange={(event) => setForm((current) => ({ ...current, evidenceFileId: event.target.value }))} /></label>
                  <label>결재 문서 ID<input value={form.approvalDocumentId} onChange={(event) => setForm((current) => ({ ...current, approvalDocumentId: event.target.value }))} /></label>
                  <label>메모<input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden"} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="지출결의 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>지출결의 목록을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {expenses.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 지출결의가 없습니다.</strong><span>첫 지출결의를 등록하면 목록과 상세가 DB 기준으로 다시 표시됩니다.</span></div><em>빈 상태</em></article> : null}
            {expenses.map((expense) => (
              <article className="feature-workspace__row" key={expense.id}>
                <div>
                  <strong>{expense.title}</strong>
                  <span>{expense.expenseCategory} · {paymentLabel(expense.paymentMethod)} · {statusLabel(expense.status)}</span>
                  <p>{expense.vendorName ?? "거래처 미지정"} · {expense.spentAt} · {amountLabel(expense.totalAmount)}원</p>
                  <div className="feature-workspace__row-actions" aria-label={`${expense.title} 지출결의 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedExpenseId(expense.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">경리나라 전송</button>
                  </div>
                </div>
                <em>{expense.syncStatus === "not_connected" ? "내부" : "연동"}</em>
              </article>
            ))}
          </div>

          {selectedExpense ? (
            <div className="feature-workspace__rows" aria-label="지출결의 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{selectedExpense.title}</strong>
                  <span>{selectedExpense.vendorName ?? "거래처 미지정"} · {selectedExpense.expenseCategory}</span>
                  <p>공급가액 {amountLabel(selectedExpense.supplyAmount)}원 · 부가세 {amountLabel(selectedExpense.taxAmount)}원 · 합계 {amountLabel(selectedExpense.totalAmount)}원</p>
                  <p>증빙 파일 {selectedExpense.evidenceFileId ?? "미연결"} · 결재 문서 {selectedExpense.approvalDocumentId ?? "미연결"}</p>
                  <p>{selectedExpense.memo ?? "메모 없음"}</p>
                </div>
                <em>{statusLabel(selectedExpense.status)}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
