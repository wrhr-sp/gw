"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  erpBillingListResponseSchema,
  erpPaymentRecordCreateRequestSchema,
  erpPaymentRecordListResponseSchema,
  erpPaymentRecordMutationResponseSchema,
  erpVendorListResponseSchema,
  errorResponseSchema,
  type ErpBilling,
  type ErpPaymentRecord,
  type ErpVendor,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type PaymentFormState = {
  billingId: string;
  vendorId: string;
  direction: "inbound" | "outbound";
  paymentMethod: "bank_transfer" | "card" | "cash" | "virtual_account" | "other";
  amount: string;
  expectedAt: string;
  occurredAt: string;
  matchStatus: "unmatched" | "partially_matched" | "matched" | "overpaid" | "cancelled";
  receivableStatus: "not_due" | "due" | "partial" | "paid" | "overdue" | "write_off" | "cancelled";
  bankAccountLabel: string;
  transactionMemo: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialFormState: PaymentFormState = {
  billingId: "",
  vendorId: "",
  direction: "inbound",
  paymentMethod: "bank_transfer",
  amount: "0",
  expectedAt: today,
  occurredAt: "",
  matchStatus: "unmatched",
  receivableStatus: "not_due",
  bankAccountLabel: "",
  transactionMemo: "",
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

async function fetchPaymentRecords(): Promise<ErpPaymentRecord[]> {
  const response = await fetch(appRoutes.erp.paymentRecords, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpPaymentRecordListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("입출금/미수금 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchBillings(): Promise<ErpBilling[]> {
  const response = await fetch(appRoutes.erp.billings, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpBillingListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("청구 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchVendors(): Promise<ErpVendor[]> {
  const response = await fetch(appRoutes.erp.vendors, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpVendorListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("거래처 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function createPaymentRecord(form: PaymentFormState): Promise<ErpPaymentRecord> {
  const payload = erpPaymentRecordCreateRequestSchema.parse({
    billingId: optionalValue(form.billingId),
    vendorId: optionalValue(form.vendorId),
    direction: form.direction,
    paymentMethod: form.paymentMethod,
    amount: Number(form.amount),
    expectedAt: optionalValue(form.expectedAt),
    occurredAt: optionalValue(form.occurredAt),
    matchStatus: form.matchStatus,
    receivableStatus: form.receivableStatus,
    bankAccountLabel: optionalValue(form.bankAccountLabel),
    transactionMemo: optionalValue(form.transactionMemo),
  });
  const response = await fetch(appRoutes.erp.paymentRecords, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpPaymentRecordMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("입출금/미수금 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.paymentRecord;
}

function directionLabel(direction: ErpPaymentRecord["direction"]) {
  return direction === "inbound" ? "입금" : "출금";
}

function receivableLabel(status: ErpPaymentRecord["receivableStatus"]) {
  if (status === "not_due") return "예정";
  if (status === "due") return "도래";
  if (status === "partial") return "부분입금";
  if (status === "paid") return "입금완료";
  if (status === "overdue") return "미수";
  if (status === "write_off") return "대손";
  return "취소";
}

function matchLabel(status: ErpPaymentRecord["matchStatus"]) {
  if (status === "unmatched") return "미매칭";
  if (status === "partially_matched") return "부분매칭";
  if (status === "matched") return "매칭완료";
  if (status === "overpaid") return "과입금";
  return "취소";
}

function amountLabel(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function ErpPaymentRecordsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [paymentRecords, setPaymentRecords] = useState<ErpPaymentRecord[]>([]);
  const [billings, setBillings] = useState<ErpBilling[]>([]);
  const [vendors, setVendors] = useState<ErpVendor[]>([]);
  const [selectedPaymentRecordId, setSelectedPaymentRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPaymentRecord = useMemo(() => paymentRecords.find((record) => record.id === selectedPaymentRecordId) ?? paymentRecords[0] ?? null, [paymentRecords, selectedPaymentRecordId]);
  const inboundTotal = useMemo(() => paymentRecords.filter((record) => record.direction === "inbound").reduce((sum, record) => sum + record.amount, 0), [paymentRecords]);
  const overdueCount = useMemo(() => paymentRecords.filter((record) => record.receivableStatus === "overdue").length, [paymentRecords]);

  async function reloadPaymentRecords() {
    setLoadState("loading");
    setToast(null);
    try {
      const [recordItems, billingItems, vendorItems] = await Promise.all([fetchPaymentRecords(), fetchBillings(), fetchVendors()]);
      setPaymentRecords(recordItems);
      setBillings(billingItems.filter((billing) => billing.status !== "cancelled"));
      setVendors(vendorItems.filter((vendor) => vendor.status === "active"));
      setSelectedPaymentRecordId((current) => current ?? recordItems[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "입출금/미수금 정보를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createPaymentRecord(form);
      const items = await fetchPaymentRecords();
      setPaymentRecords(items);
      setSelectedPaymentRecordId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "입출금/미수금 기록을 등록했습니다.", body: "등록 후 목록을 다시 조회해 DB 저장 상태를 확인했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "입출금/미수금 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadPaymentRecords(); }, []);

  return (
    <PageShell title="ERP/경리 · 입출금/미수금" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 입출금 미수금 관리">
        <aside className="feature-workspace__nav" aria-label="ERP 경리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadPaymentRecords()} type="button">입출금/미수금</button></h1>
            <FeaturePageOverflowMenu label="ERP 입출금 미수금" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="입출금 미수금 메뉴">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 기록</span><strong>{paymentRecords.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>미수</span><strong>{overdueCount}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/billings"><span>매출/청구</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/vendors"><span>거래처</span><strong>이동</strong></a>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-payment-records-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-payment-records-heading">입출금 / 미수금 상태</h2>
              <p>자체 ERP 기준으로 청구 건별 입금 예정과 실제 입금 매칭 상태를 내부 DB에 저장합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 입출금/미수금 데이터 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>입출금 기록</span><strong>{paymentRecords.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>입금 합계</span><strong>{amountLabel(inboundTotal)}원</strong><p>내부 입력 기준</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>미수 건</span><strong>{overdueCount}건</strong><p>외부 API 호출 없음</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="입출금 기록 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>입출금 기록 등록</strong>
                <span>청구 건과 거래처를 연결해 입금 예정, 실제 입금, 미수 상태를 저장합니다.</span>
                <div className="form-grid form-grid--two">
                  <label>청구 건<select value={form.billingId} onChange={(event) => setForm((current) => ({ ...current, billingId: event.target.value }))}><option value="">청구 연결 없음</option>{billings.map((billing) => <option key={billing.id} value={billing.id}>{billing.title}</option>)}</select></label>
                  <label>거래처<select value={form.vendorId} onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}><option value="">거래처 연결 없음</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                  <label>구분<select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as PaymentFormState["direction"] }))}><option value="inbound">입금</option><option value="outbound">출금</option></select></label>
                  <label>수단<select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentFormState["paymentMethod"] }))}><option value="bank_transfer">계좌이체</option><option value="card">카드</option><option value="cash">현금</option><option value="virtual_account">가상계좌</option><option value="other">기타</option></select></label>
                  <label>금액<input min="0" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required /></label>
                  <label>입금/출금 예정일<input type="date" value={form.expectedAt} onChange={(event) => setForm((current) => ({ ...current, expectedAt: event.target.value }))} /></label>
                  <label>실제 처리일<input type="date" value={form.occurredAt} onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} /></label>
                  <label>매칭 상태<select value={form.matchStatus} onChange={(event) => setForm((current) => ({ ...current, matchStatus: event.target.value as PaymentFormState["matchStatus"] }))}><option value="unmatched">미매칭</option><option value="partially_matched">부분매칭</option><option value="matched">매칭완료</option><option value="overpaid">과입금</option><option value="cancelled">취소</option></select></label>
                  <label>미수 상태<select value={form.receivableStatus} onChange={(event) => setForm((current) => ({ ...current, receivableStatus: event.target.value as PaymentFormState["receivableStatus"] }))}><option value="not_due">예정</option><option value="due">도래</option><option value="partial">부분입금</option><option value="paid">입금완료</option><option value="overdue">미수</option><option value="write_off">대손</option><option value="cancelled">취소</option></select></label>
                  <label>계좌 표시명<input value={form.bankAccountLabel} onChange={(event) => setForm((current) => ({ ...current, bankAccountLabel: event.target.value }))} /></label>
                  <label>거래 메모<input value={form.transactionMemo} onChange={(event) => setForm((current) => ({ ...current, transactionMemo: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden"} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="입출금 기록 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>입출금 기록을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {paymentRecords.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 입출금 기록이 없습니다.</strong><span>청구 건을 만든 뒤 입금 예정 또는 실제 입금 기록을 등록할 수 있습니다.</span></div><em>빈 상태</em></article> : null}
            {paymentRecords.map((record) => (
              <article className="feature-workspace__row" key={record.id}>
                <div>
                  <strong>{directionLabel(record.direction)} {amountLabel(record.amount)}원</strong>
                  <span>{record.billingTitle ?? "청구 미연결"} · {record.vendorName ?? "거래처 미연결"} · {receivableLabel(record.receivableStatus)}</span>
                  <p>예정 {record.expectedAt ?? "미정"} · 실제 {record.occurredAt ?? "미처리"} · {matchLabel(record.matchStatus)}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${record.id} 입출금 기록 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedPaymentRecordId(record.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">외부 동기화</button>
                  </div>
                </div>
                <em>{record.syncStatus === "not_connected" ? "내부" : "연동"}</em>
              </article>
            ))}
          </div>

          {selectedPaymentRecord ? (
            <div className="feature-workspace__rows" aria-label="입출금 기록 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{directionLabel(selectedPaymentRecord.direction)} {amountLabel(selectedPaymentRecord.amount)}원</strong>
                  <span>{selectedPaymentRecord.billingTitle ?? "청구 미연결"} · {selectedPaymentRecord.vendorName ?? "거래처 미연결"}</span>
                  <p>미수 상태 {receivableLabel(selectedPaymentRecord.receivableStatus)} · 매칭 상태 {matchLabel(selectedPaymentRecord.matchStatus)}</p>
                  <p>계좌 {selectedPaymentRecord.bankAccountLabel ?? "미입력"} · {selectedPaymentRecord.transactionMemo ?? "메모 없음"}</p>
                </div>
                <em>{selectedPaymentRecord.syncStatus === "not_connected" ? "내부" : "연동"}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
