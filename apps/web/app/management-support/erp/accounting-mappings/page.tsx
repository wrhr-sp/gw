"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  erpAccountingMappingCreateRequestSchema,
  erpAccountingMappingListResponseSchema,
  erpAccountingMappingMutationResponseSchema,
  errorResponseSchema,
  type ErpAccountingMapping,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type MappingFormState = {
  mappingType: ErpAccountingMapping["mappingType"];
  internalCode: string;
  internalName: string;
  externalCode: string;
  externalName: string;
  mappingStatus: ErpAccountingMapping["mappingStatus"];
  memo: string;
};

const initialFormState: MappingFormState = {
  mappingType: "expense_category",
  internalCode: "",
  internalName: "",
  externalCode: "",
  externalName: "",
  mappingStatus: "unmapped",
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

async function fetchMappings(): Promise<ErpAccountingMapping[]> {
  const response = await fetch(appRoutes.erp.accountingMappings, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpAccountingMappingListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("회계 코드 매핑 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function createMapping(form: MappingFormState): Promise<ErpAccountingMapping> {
  const payload = erpAccountingMappingCreateRequestSchema.parse({
    mappingType: form.mappingType,
    internalCode: form.internalCode.trim(),
    internalName: form.internalName.trim(),
    externalCode: optionalValue(form.externalCode),
    externalName: optionalValue(form.externalName),
    mappingStatus: form.mappingStatus,
    memo: optionalValue(form.memo),
  });
  const response = await fetch(appRoutes.erp.accountingMappings, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpAccountingMappingMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("회계 코드 매핑 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.mapping;
}

function typeLabel(type: ErpAccountingMapping["mappingType"]) {
  if (type === "expense_category") return "비용 항목";
  if (type === "revenue_category") return "매출 구분";
  if (type === "department") return "부서 코드";
  if (type === "branch") return "지점 코드";
  if (type === "project") return "프로젝트 코드";
  if (type === "tax_type") return "세금 구분";
  if (type === "payment_method") return "결제수단";
  return "거래처 유형";
}

function mappingStatusLabel(status: ErpAccountingMapping["mappingStatus"]) {
  if (status === "unmapped") return "미매핑";
  if (status === "mapped") return "매핑완료";
  if (status === "review_required") return "검토필요";
  return "비활성";
}

export default function ErpAccountingMappingsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mappings, setMappings] = useState<ErpAccountingMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [form, setForm] = useState<MappingFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedMapping = useMemo(() => mappings.find((mapping) => mapping.id === selectedMappingId) ?? mappings[0] ?? null, [mappings, selectedMappingId]);
  const mappedCount = useMemo(() => mappings.filter((mapping) => mapping.mappingStatus === "mapped").length, [mappings]);
  const reviewCount = useMemo(() => mappings.filter((mapping) => mapping.mappingStatus === "review_required" || mapping.mappingStatus === "unmapped").length, [mappings]);

  async function reloadMappings() {
    setLoadState("loading");
    setToast(null);
    try {
      const items = await fetchMappings();
      setMappings(items);
      setSelectedMappingId((current) => current ?? items[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "회계 코드 매핑 정보를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createMapping(form);
      const items = await fetchMappings();
      setMappings(items);
      setSelectedMappingId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "회계 코드 매핑을 등록했습니다.", body: "등록 후 목록을 다시 조회해 DB 저장 상태를 확인했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "회계 코드 매핑 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadMappings(); }, []);

  return (
    <PageShell title="ERP/경리 · 회계 코드 매핑" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 회계 코드 매핑">
        <aside className="feature-workspace__nav" aria-label="ERP 경리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadMappings()} type="button">회계 코드 매핑</button></h1>
            <FeaturePageOverflowMenu label="ERP 회계 코드 매핑" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="회계 코드 매핑 메뉴">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 코드</span><strong>{mappings.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>검토 대상</span><strong>{reviewCount}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/payment-records"><span>입출금</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/billings"><span>매출/청구</span><strong>이동</strong></a>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-accounting-mappings-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-accounting-mappings-heading">회계 코드 매핑</h2>
              <p>자체 ERP 기준으로 비용·매출·부서·지점 코드를 정리하고, 필요한 외부 회계 코드는 선택 연결합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 회계 코드 데이터 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>전체 매핑</span><strong>{mappings.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>매핑 완료</span><strong>{mappedCount}건</strong><p>외부 코드 입력 기준</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>검토 대상</span><strong>{reviewCount}건</strong><p>미매핑 또는 검토필요</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="회계 코드 매핑 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>매핑 등록</strong>
                <span>내부 코드와 선택 외부 회계 코드 후보를 저장합니다. 실제 전송은 하지 않습니다.</span>
                <div className="form-grid form-grid--two">
                  <label>매핑 유형<select value={form.mappingType} onChange={(event) => setForm((current) => ({ ...current, mappingType: event.target.value as MappingFormState["mappingType"] }))}><option value="expense_category">비용 항목</option><option value="revenue_category">매출 구분</option><option value="department">부서 코드</option><option value="branch">지점 코드</option><option value="project">프로젝트 코드</option><option value="tax_type">세금 구분</option><option value="payment_method">결제수단</option><option value="vendor_type">거래처 유형</option></select></label>
                  <label>내부 코드<input value={form.internalCode} onChange={(event) => setForm((current) => ({ ...current, internalCode: event.target.value }))} required /></label>
                  <label>내부 이름<input value={form.internalName} onChange={(event) => setForm((current) => ({ ...current, internalName: event.target.value }))} required /></label>
                  <label>외부 회계 코드 후보<input value={form.externalCode} onChange={(event) => setForm((current) => ({ ...current, externalCode: event.target.value }))} /></label>
                  <label>외부 회계 이름 후보<input value={form.externalName} onChange={(event) => setForm((current) => ({ ...current, externalName: event.target.value }))} /></label>
                  <label>매핑 상태<select value={form.mappingStatus} onChange={(event) => setForm((current) => ({ ...current, mappingStatus: event.target.value as MappingFormState["mappingStatus"] }))}><option value="unmapped">미매핑</option><option value="mapped">매핑완료</option><option value="review_required">검토필요</option><option value="disabled">비활성</option></select></label>
                  <label>메모<input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden"} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="회계 코드 매핑 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>회계 코드 매핑 목록을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {mappings.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 회계 코드 매핑이 없습니다.</strong><span>비용 항목, 매출 구분, 부서/지점 코드를 먼저 등록합니다.</span></div><em>빈 상태</em></article> : null}
            {mappings.map((mapping) => (
              <article className="feature-workspace__row" key={mapping.id}>
                <div>
                  <strong>{mapping.internalName}</strong>
                  <span>{typeLabel(mapping.mappingType)} · {mapping.internalCode} · {mappingStatusLabel(mapping.mappingStatus)}</span>
                  <p>{mapping.externalCode ? `외부 회계 후보 ${mapping.externalCode} · ${mapping.externalName ?? "이름 미입력"}` : "외부 코드 미입력"}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${mapping.internalName} 매핑 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedMappingId(mapping.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">외부 코드 검증</button>
                  </div>
                </div>
                <em>{mapping.status === "active" ? "사용" : "보관"}</em>
              </article>
            ))}
          </div>

          {selectedMapping ? (
            <div className="feature-workspace__rows" aria-label="회계 코드 매핑 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{selectedMapping.internalName}</strong>
                  <span>{typeLabel(selectedMapping.mappingType)} · 내부코드 {selectedMapping.internalCode}</span>
                  <p>외부코드 {selectedMapping.externalCode ?? "미입력"} · 외부이름 {selectedMapping.externalName ?? "미입력"}</p>
                  <p>{selectedMapping.memo ?? "메모 없음"}</p>
                </div>
                <em>{mappingStatusLabel(selectedMapping.mappingStatus)}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
