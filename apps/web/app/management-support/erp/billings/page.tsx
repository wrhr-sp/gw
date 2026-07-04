"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  erpBillingCreateRequestSchema,
  erpBillingListResponseSchema,
  erpBillingMutationResponseSchema,
  erpVendorListResponseSchema,
  errorResponseSchema,
  type ErpBilling,
  type ErpVendor,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type BillingFormState = {
  vendorId: string;
  contractId: string;
  title: string;
  billingCategory: string;
  departmentId: string;
  branchId: string;
  projectCode: string;
  supplyAmount: string;
  taxAmount: string;
  billingDueDate: string;
  paymentDueDate: string;
  memo: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialFormState: BillingFormState = {
  vendorId: "",
  contractId: "",
  title: "",
  billingCategory: "",
  departmentId: "",
  branchId: "",
  projectCode: "",
  supplyAmount: "0",
  taxAmount: "0",
  billingDueDate: today,
  paymentDueDate: "",
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

async function fetchBillings(): Promise<ErpBilling[]> {
  const response = await fetch(appRoutes.erp.billings, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpBillingListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("매출/청구 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchVendors(): Promise<ErpVendor[]> {
  const response = await fetch(appRoutes.erp.vendors, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpVendorListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("거래처 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function createBilling(form: BillingFormState): Promise<ErpBilling> {
  const payload = erpBillingCreateRequestSchema.parse({
    vendorId: form.vendorId,
    contractId: optionalValue(form.contractId),
    title: form.title.trim(),
    billingCategory: form.billingCategory.trim(),
    departmentId: optionalValue(form.departmentId),
    branchId: optionalValue(form.branchId),
    projectCode: optionalValue(form.projectCode),
    supplyAmount: Number(form.supplyAmount),
    taxAmount: Number(form.taxAmount),
    billingDueDate: form.billingDueDate,
    paymentDueDate: optionalValue(form.paymentDueDate),
    memo: optionalValue(form.memo),
  });
  const response = await fetch(appRoutes.erp.billings, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpBillingMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("매출/청구 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.billing;
}

function statusLabel(status: ErpBilling["status"]) {
  if (status === "draft") return "작성중";
  if (status === "requested") return "청구요청";
  if (status === "approved") return "승인";
  if (status === "issued") return "발행";
  if (status === "paid") return "입금완료";
  if (status === "overdue") return "미수";
  return "취소";
}

function taxInvoiceLabel(status: ErpBilling["taxInvoiceStatus"]) {
  if (status === "not_requested") return "요청전";
  if (status === "requested") return "요청";
  if (status === "issued") return "발행완료";
  if (status === "failed") return "실패";
  return "취소";
}

function amountLabel(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function ErpBillingsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [billings, setBillings] = useState<ErpBilling[]>([]);
  const [vendors, setVendors] = useState<ErpVendor[]>([]);
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);
  const [form, setForm] = useState<BillingFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedBilling = useMemo(() => billings.find((billing) => billing.id === selectedBillingId) ?? billings[0] ?? null, [billings, selectedBillingId]);
  const totalAmount = useMemo(() => billings.reduce((sum, billing) => sum + billing.totalAmount, 0), [billings]);
  const receivableCount = useMemo(() => billings.filter((billing) => billing.paymentStatus !== "paid" && billing.status !== "cancelled").length, [billings]);

  async function reloadBillings() {
    setLoadState("loading");
    setToast(null);
    try {
      const [billingItems, vendorItems] = await Promise.all([fetchBillings(), fetchVendors()]);
      setBillings(billingItems);
      setVendors(vendorItems.filter((vendor) => vendor.status === "active"));
      setSelectedBillingId((current) => current ?? billingItems[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "매출/청구 정보를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createBilling(form);
      const items = await fetchBillings();
      setBillings(items);
      setSelectedBillingId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "청구 건을 등록했습니다.", body: "등록 후 목록을 다시 조회해 DB 저장 상태를 확인했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "청구 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadBillings(); }, []);

  return (
    <PageShell title="ERP/경리 · 매출/청구 관리" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 매출 청구 관리">
        <aside className="feature-workspace__nav" aria-label="ERP 경리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadBillings()} type="button">매출/청구</button></h1>
            <FeaturePageOverflowMenu label="ERP 매출 청구" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="매출 청구 메뉴">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 청구</span><strong>{billings.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>입금 대기</span><strong>{receivableCount}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/evidence"><span>증빙함</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/vendors"><span>거래처</span><strong>이동</strong></a>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-billings-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-billings-heading">매출 / 청구 관리</h2>
              <p>경리나라 실제 API 연결 전, 거래처 기준 청구·입금 예정 상태를 우리 내부 DB에 먼저 저장합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 매출/청구 데이터 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>총 청구</span><strong>{billings.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>청구 합계</span><strong>{amountLabel(totalAmount)}원</strong><p>공급가액 + 부가세</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>경리나라 연동</span><strong>미연동</strong><p>외부 API 호출 없음</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="청구 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>청구 등록</strong>
                <span>거래처, 금액, 청구 예정일, 입금 예정일을 실제 API로 저장합니다.</span>
                <div className="form-grid form-grid--two">
                  <label>청구 제목<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></label>
                  <label>청구 구분<input value={form.billingCategory} onChange={(event) => setForm((current) => ({ ...current, billingCategory: event.target.value }))} required /></label>
                  <label>거래처<select value={form.vendorId} onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))} required><option value="">거래처 선택</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                  <label>계약 ID<input value={form.contractId} onChange={(event) => setForm((current) => ({ ...current, contractId: event.target.value }))} /></label>
                  <label>공급가액<input min="0" type="number" value={form.supplyAmount} onChange={(event) => setForm((current) => ({ ...current, supplyAmount: event.target.value }))} required /></label>
                  <label>부가세<input min="0" type="number" value={form.taxAmount} onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))} required /></label>
                  <label>청구 예정일<input type="date" value={form.billingDueDate} onChange={(event) => setForm((current) => ({ ...current, billingDueDate: event.target.value }))} required /></label>
                  <label>입금 예정일<input type="date" value={form.paymentDueDate} onChange={(event) => setForm((current) => ({ ...current, paymentDueDate: event.target.value }))} /></label>
                  <label>부서 ID<input value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))} /></label>
                  <label>지점 ID<input value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} /></label>
                  <label>프로젝트 코드<input value={form.projectCode} onChange={(event) => setForm((current) => ({ ...current, projectCode: event.target.value }))} /></label>
                  <label>메모<input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden" || vendors.length === 0} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="청구 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>청구 목록을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {billings.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 청구 건이 없습니다.</strong><span>거래처를 먼저 등록한 뒤 청구 건을 만들 수 있습니다.</span></div><em>빈 상태</em></article> : null}
            {billings.map((billing) => (
              <article className="feature-workspace__row" key={billing.id}>
                <div>
                  <strong>{billing.title}</strong>
                  <span>{billing.billingCategory} · {billing.vendorName ?? "거래처 미확인"} · {statusLabel(billing.status)}</span>
                  <p>청구 {billing.billingDueDate} · 입금 {billing.paymentDueDate ?? "미정"} · {amountLabel(billing.totalAmount)}원</p>
                  <div className="feature-workspace__row-actions" aria-label={`${billing.title} 청구 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedBillingId(billing.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">경리나라 전송</button>
                  </div>
                </div>
                <em>{billing.syncStatus === "not_connected" ? "내부" : "연동"}</em>
              </article>
            ))}
          </div>

          {selectedBilling ? (
            <div className="feature-workspace__rows" aria-label="청구 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{selectedBilling.title}</strong>
                  <span>{selectedBilling.vendorName ?? "거래처 미확인"} · {selectedBilling.billingCategory}</span>
                  <p>공급가액 {amountLabel(selectedBilling.supplyAmount)}원 · 부가세 {amountLabel(selectedBilling.taxAmount)}원 · 합계 {amountLabel(selectedBilling.totalAmount)}원</p>
                  <p>세금계산서 {taxInvoiceLabel(selectedBilling.taxInvoiceStatus)} · 입금상태 {selectedBilling.paymentStatus}</p>
                  <p>{selectedBilling.memo ?? "메모 없음"}</p>
                </div>
                <em>{statusLabel(selectedBilling.status)}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
