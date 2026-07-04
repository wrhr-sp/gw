"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  erpVendorCreateRequestSchema,
  erpVendorListResponseSchema,
  erpVendorMutationResponseSchema,
  errorResponseSchema,
  type ErpVendor,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type VendorFormState = {
  businessRegistrationNumber: string;
  name: string;
  representativeName: string;
  address: string;
  businessType: string;
  businessItem: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  taxInvoiceEmail: string;
  settlementTerm: string;
  memo: string;
};

const initialFormState: VendorFormState = {
  businessRegistrationNumber: "",
  name: "",
  representativeName: "",
  address: "",
  businessType: "",
  businessItem: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  taxInvoiceEmail: "",
  settlementTerm: "",
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

async function fetchVendors(): Promise<ErpVendor[]> {
  const response = await fetch(appRoutes.erp.vendors, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpVendorListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("거래처 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function createVendor(form: VendorFormState): Promise<ErpVendor> {
  const payload = erpVendorCreateRequestSchema.parse({
    businessRegistrationNumber: form.businessRegistrationNumber.trim(),
    name: form.name.trim(),
    representativeName: optionalValue(form.representativeName),
    address: optionalValue(form.address),
    businessType: optionalValue(form.businessType),
    businessItem: optionalValue(form.businessItem),
    contactName: optionalValue(form.contactName),
    contactPhone: optionalValue(form.contactPhone),
    contactEmail: optionalValue(form.contactEmail),
    taxInvoiceEmail: optionalValue(form.taxInvoiceEmail),
    settlementTerm: optionalValue(form.settlementTerm),
    memo: optionalValue(form.memo),
  });
  const response = await fetch(appRoutes.erp.vendors, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpVendorMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("거래처 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.vendor;
}

function statusLabel(status: ErpVendor["status"]) {
  if (status === "active") return "사용";
  if (status === "inactive") return "중지";
  return "보관";
}

function syncLabel(status: ErpVendor["syncStatus"]) {
  if (status === "not_connected") return "미연동";
  if (status === "pending") return "연동대기";
  if (status === "queued") return "전송대기";
  if (status === "synced") return "전송성공";
  return "전송실패";
}

export default function ErpVendorsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [vendors, setVendors] = useState<ErpVendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedVendor = useMemo(() => vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0] ?? null, [vendors, selectedVendorId]);
  const activeCount = useMemo(() => vendors.filter((vendor) => vendor.status === "active").length, [vendors]);
  const pendingSyncCount = useMemo(() => vendors.filter((vendor) => vendor.syncStatus !== "not_connected" && vendor.syncStatus !== "synced").length, [vendors]);

  async function reloadVendors() {
    setLoadState("loading");
    setToast(null);
    try {
      const items = await fetchVendors();
      setVendors(items);
      setSelectedVendorId((current) => current ?? items[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "거래처 정보를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createVendor(form);
      const items = await fetchVendors();
      setVendors(items);
      setSelectedVendorId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "거래처를 등록했습니다.", body: "등록 후 목록을 다시 조회해 DB 저장 상태를 확인했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "거래처 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadVendors(); }, []);

  return (
    <PageShell title="ERP/경리 · 거래처 관리" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 거래처 관리">
        <aside className="feature-workspace__nav" aria-label="ERP 거래처 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadVendors()} type="button">거래처 관리</button></h1>
            <FeaturePageOverflowMenu label="ERP 거래처 관리" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="거래처 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 거래처</span><strong>{vendors.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>사용 중</span><strong>{activeCount}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>연동 확인</span><strong>{pendingSyncCount}</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-vendors-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-vendors-heading">거래처 원장</h2>
              <p>경리나라 실제 API 연결 전, 우리 내부 DB에 거래처 기준 정보를 먼저 저장합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 거래처 데이터 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>등록 거래처</span><strong>{vendors.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>경리나라 연동</span><strong>미연동</strong><p>외부 API 호출 없음</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>확인 필요</span><strong>{pendingSyncCount}건</strong><p>내부 연동 상태값만 표시</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="거래처 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>거래처 등록</strong>
                <span>사업자등록번호와 상호명은 필수입니다.</span>
                <div className="form-grid form-grid--two">
                  <label>사업자등록번호<input value={form.businessRegistrationNumber} onChange={(event) => setForm((current) => ({ ...current, businessRegistrationNumber: event.target.value }))} required /></label>
                  <label>상호명<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
                  <label>대표자명<input value={form.representativeName} onChange={(event) => setForm((current) => ({ ...current, representativeName: event.target.value }))} /></label>
                  <label>주소<input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label>
                  <label>업태<input value={form.businessType} onChange={(event) => setForm((current) => ({ ...current, businessType: event.target.value }))} /></label>
                  <label>종목<input value={form.businessItem} onChange={(event) => setForm((current) => ({ ...current, businessItem: event.target.value }))} /></label>
                  <label>담당자<input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} /></label>
                  <label>담당자 연락처<input value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
                  <label>담당자 이메일<input value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} /></label>
                  <label>세금계산서 수신 이메일<input value={form.taxInvoiceEmail} onChange={(event) => setForm((current) => ({ ...current, taxInvoiceEmail: event.target.value }))} /></label>
                  <label>정산 조건<input value={form.settlementTerm} onChange={(event) => setForm((current) => ({ ...current, settlementTerm: event.target.value }))} /></label>
                  <label>메모<input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden"} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="거래처 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>거래처 목록을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {vendors.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 거래처가 없습니다.</strong><span>첫 거래처를 등록하면 목록과 상세가 DB 기준으로 다시 표시됩니다.</span></div><em>빈 상태</em></article> : null}
            {vendors.map((vendor) => (
              <article className="feature-workspace__row" key={vendor.id}>
                <div>
                  <strong>{vendor.name}</strong>
                  <span>{vendor.businessRegistrationNumber} · {statusLabel(vendor.status)} · {syncLabel(vendor.syncStatus)}</span>
                  <p>{vendor.representativeName ?? "대표자 미입력"} · {vendor.taxInvoiceEmail ?? "세금계산서 이메일 미입력"}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${vendor.name} 거래처 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedVendorId(vendor.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">경리나라 전송</button>
                  </div>
                </div>
                <em>{vendor.externalProvider ? "연동" : "내부"}</em>
              </article>
            ))}
          </div>

          {selectedVendor ? (
            <div className="feature-workspace__rows" aria-label="거래처 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{selectedVendor.name}</strong>
                  <span>{selectedVendor.address ?? "주소 미입력"}</span>
                  <p>{selectedVendor.businessType ?? "업태 미입력"} · {selectedVendor.businessItem ?? "종목 미입력"}</p>
                  <p>{selectedVendor.contactName ?? "담당자 미입력"} · {selectedVendor.contactPhone ?? "연락처 미입력"} · {selectedVendor.contactEmail ?? "이메일 미입력"}</p>
                  <p>{selectedVendor.settlementTerm ?? "정산 조건 미입력"}</p>
                </div>
                <em>{syncLabel(selectedVendor.syncStatus)}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
