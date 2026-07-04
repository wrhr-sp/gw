"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  erpIntegrationEventCreateRequestSchema,
  erpIntegrationEventListResponseSchema,
  erpIntegrationEventMutationResponseSchema,
  errorResponseSchema,
  type ErpIntegrationEvent,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "forbidden" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type EventFormState = {
  direction: ErpIntegrationEvent["direction"];
  resourceType: ErpIntegrationEvent["resourceType"];
  resourceId: string;
  title: string;
  status: ErpIntegrationEvent["status"];
  maxAttempts: string;
  nextRetryAt: string;
  externalReferenceId: string;
  externalStatus: string;
  failureCode: string;
  failureMessage: string;
  safePayloadSummary: string;
  safeResponseSummary: string;
};

const initialFormState: EventFormState = {
  direction: "outbound",
  resourceType: "billing",
  resourceId: "",
  title: "",
  status: "queued",
  maxAttempts: "3",
  nextRetryAt: "",
  externalReferenceId: "",
  externalStatus: "",
  failureCode: "",
  failureMessage: "",
  safePayloadSummary: "",
  safeResponseSummary: "",
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

async function fetchEvents(): Promise<ErpIntegrationEvent[]> {
  const response = await fetch(appRoutes.erp.integrationEvents, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpIntegrationEventListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("연동 로그 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function createEvent(form: EventFormState): Promise<ErpIntegrationEvent> {
  const payload = erpIntegrationEventCreateRequestSchema.parse({
    direction: form.direction,
    resourceType: form.resourceType,
    resourceId: optionalValue(form.resourceId),
    title: form.title.trim(),
    status: form.status,
    maxAttempts: Number(form.maxAttempts),
    nextRetryAt: optionalValue(form.nextRetryAt),
    externalReferenceId: optionalValue(form.externalReferenceId),
    externalStatus: optionalValue(form.externalStatus),
    failureCode: optionalValue(form.failureCode),
    failureMessage: optionalValue(form.failureMessage),
    safePayloadSummary: optionalValue(form.safePayloadSummary),
    safeResponseSummary: optionalValue(form.safeResponseSummary),
  });
  const response = await fetch(appRoutes.erp.integrationEvents, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = erpIntegrationEventMutationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("연동 로그 등록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.event;
}

function statusLabel(status: ErpIntegrationEvent["status"]) {
  if (status === "queued") return "전송대기";
  if (status === "sending") return "전송중";
  if (status === "succeeded") return "성공";
  if (status === "failed") return "실패";
  if (status === "retry_required") return "재전송필요";
  return "취소";
}

function resourceLabel(type: ErpIntegrationEvent["resourceType"]) {
  if (type === "vendor") return "거래처";
  if (type === "expense") return "지출결의";
  if (type === "evidence") return "증빙";
  if (type === "billing") return "청구";
  if (type === "payment") return "입출금";
  if (type === "accounting_mapping") return "회계코드";
  if (type === "tax_invoice") return "세금계산서";
  return "기타";
}

export default function ErpIntegrationEventsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [events, setEvents] = useState<ErpIntegrationEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(initialFormState);
  const [toast, setToast] = useState<ToastState>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null, [events, selectedEventId]);
  const failedCount = useMemo(() => events.filter((event) => event.status === "failed" || event.status === "retry_required").length, [events]);
  const successCount = useMemo(() => events.filter((event) => event.status === "succeeded").length, [events]);

  async function reloadEvents() {
    setLoadState("loading");
    setToast(null);
    try {
      const items = await fetchEvents();
      setEvents(items);
      setSelectedEventId((current) => current ?? items[0]?.id ?? null);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류입니다.";
      setLoadState(message.includes("권한") || message.includes("FORBIDDEN") ? "forbidden" : "error");
      setToast({ tone: "warning", title: "연동 로그를 불러오지 못했습니다.", body: message });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const created = await createEvent(form);
      const items = await fetchEvents();
      setEvents(items);
      setSelectedEventId(created.id);
      setForm(initialFormState);
      setLoadState("ready");
      setToast({ tone: "accent", title: "연동 로그를 등록했습니다.", body: "실제 외부 전송 없이 내부 DB 저장 상태를 재조회했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "연동 로그 등록을 완료하지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void reloadEvents(); }, []);

  return (
    <PageShell title="ERP/경리 · 연동 로그/실패함" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="ERP 경리나라 연동 로그 실패함">
        <aside className="feature-workspace__nav" aria-label="ERP 경리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadEvents()} type="button">연동 로그/실패함</button></h1>
            <FeaturePageOverflowMenu label="ERP 연동 로그" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="연동 로그 메뉴">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>전체 로그</span><strong>{events.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>실패/재전송</span><strong>{failedCount}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/accounting-mappings"><span>코드매핑</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/payment-records"><span>입출금</span><strong>이동</strong></a>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="erp-integration-events-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="erp-integration-events-heading">연동 로그 / 실패함</h2>
              <p>경리나라 실제 API 연결 전, 전송대기·성공·실패·재전송 필요 이력을 내부 DB에 먼저 저장합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">접근은 기존 부서업무포털 권한 설정을 따르고 권한 설정 자체는 변경하지 않습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          {loadState === "forbidden" ? <article className="info-card"><Pill tone="warning">권한필요</Pill><h3>부서업무포털 접근권한이 필요합니다.</h3><p>버튼은 보이지만 기존 권한 설정에 따라 실제 연동 로그 조회와 저장은 차단됩니다.</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>전체 로그</span><strong>{events.length}건</strong><p>DB 조회 기준</p></article>
            <article className="feature-workspace__status"><span>성공</span><strong>{successCount}건</strong><p>내부 상태값 기준</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>실패/재전송</span><strong>{failedCount}건</strong><p>외부 API 호출 없음</p></article>
          </div>

          <form className="feature-workspace__rows" aria-label="연동 로그 등록" onSubmit={handleSubmit}>
            <article className="feature-workspace__row">
              <div>
                <strong>연동 로그 등록</strong>
                <span>전송 대기, 실패 사유, 외부 응답 ID 후보를 안전 요약값으로 저장합니다.</span>
                <div className="form-grid form-grid--two">
                  <label>제목<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></label>
                  <label>대상<select value={form.resourceType} onChange={(event) => setForm((current) => ({ ...current, resourceType: event.target.value as EventFormState["resourceType"] }))}><option value="vendor">거래처</option><option value="expense">지출결의</option><option value="evidence">증빙</option><option value="billing">청구</option><option value="payment">입출금</option><option value="accounting_mapping">회계코드</option><option value="tax_invoice">세금계산서</option><option value="other">기타</option></select></label>
                  <label>대상 ID<input value={form.resourceId} onChange={(event) => setForm((current) => ({ ...current, resourceId: event.target.value }))} /></label>
                  <label>방향<select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as EventFormState["direction"] }))}><option value="outbound">외부전송</option><option value="inbound">외부수신</option><option value="webhook">웹훅</option></select></label>
                  <label>상태<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EventFormState["status"] }))}><option value="queued">전송대기</option><option value="sending">전송중</option><option value="succeeded">성공</option><option value="failed">실패</option><option value="retry_required">재전송필요</option><option value="cancelled">취소</option></select></label>
                  <label>최대 재시도<input min="1" max="10" type="number" value={form.maxAttempts} onChange={(event) => setForm((current) => ({ ...current, maxAttempts: event.target.value }))} required /></label>
                  <label>다음 재시도 시각<input type="datetime-local" value={form.nextRetryAt} onChange={(event) => setForm((current) => ({ ...current, nextRetryAt: event.target.value ? new Date(event.target.value).toISOString() : "" }))} /></label>
                  <label>외부 응답 ID<input value={form.externalReferenceId} onChange={(event) => setForm((current) => ({ ...current, externalReferenceId: event.target.value }))} /></label>
                  <label>외부 상태<input value={form.externalStatus} onChange={(event) => setForm((current) => ({ ...current, externalStatus: event.target.value }))} /></label>
                  <label>실패 코드<input value={form.failureCode} onChange={(event) => setForm((current) => ({ ...current, failureCode: event.target.value }))} /></label>
                  <label>실패 사유<input value={form.failureMessage} onChange={(event) => setForm((current) => ({ ...current, failureMessage: event.target.value }))} /></label>
                  <label>요청 안전 요약<input value={form.safePayloadSummary} onChange={(event) => setForm((current) => ({ ...current, safePayloadSummary: event.target.value }))} /></label>
                  <label>응답 안전 요약<input value={form.safeResponseSummary} onChange={(event) => setForm((current) => ({ ...current, safeResponseSummary: event.target.value }))} /></label>
                </div>
              </div>
              <button className="feature-workspace__row-action" disabled={submitting || loadState === "forbidden"} type="submit">{submitting ? "저장 중" : "등록"}</button>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="연동 로그 목록">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>연동 로그를 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {events.length === 0 && loadState !== "loading" && loadState !== "forbidden" ? <article className="feature-workspace__row"><div><strong>등록된 연동 로그가 없습니다.</strong><span>실제 외부 API 연결 전 내부 전송 이력 구조를 먼저 준비합니다.</span></div><em>빈 상태</em></article> : null}
            {events.map((event) => (
              <article className="feature-workspace__row" key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <span>{resourceLabel(event.resourceType)} · {statusLabel(event.status)} · 시도 {event.attemptCount}/{event.maxAttempts}</span>
                  <p>{event.failureMessage ?? event.externalStatus ?? "상세 상태 없음"}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${event.title} 연동 로그 선택`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => setSelectedEventId(event.id)} type="button">상세 보기</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">재전송</button>
                  </div>
                </div>
                <em>{event.provider}</em>
              </article>
            ))}
          </div>

          {selectedEvent ? (
            <div className="feature-workspace__rows" aria-label="연동 로그 상세">
              <article className="feature-workspace__row">
                <div>
                  <strong>{selectedEvent.title}</strong>
                  <span>{resourceLabel(selectedEvent.resourceType)} · {selectedEvent.resourceId ?? "대상 ID 없음"}</span>
                  <p>외부ID {selectedEvent.externalReferenceId ?? "미입력"} · 외부상태 {selectedEvent.externalStatus ?? "미입력"}</p>
                  <p>실패 {selectedEvent.failureCode ?? "없음"} · {selectedEvent.failureMessage ?? "실패 사유 없음"}</p>
                  <p>요청요약 {selectedEvent.safePayloadSummary ?? "없음"}</p>
                </div>
                <em>{statusLabel(selectedEvent.status)}</em>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
