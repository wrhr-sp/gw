"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  appRoutes,
  erpClosingPeriodCreateRequestSchema,
  erpClosingPeriodListResponseSchema,
  erpClosingPeriodMutationResponseSchema,
  erpLedgerEntryListResponseSchema,
  errorResponseSchema,
  type ErpClosingPeriod,
  type ErpLedgerEntry,
  type ErpLedgerSummary,
} from "@gw/shared";
import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { FormField, FormGrid, FormSubmitButton, SelectInput, TextArea, TextInput } from "../../../_components/form-controls";
import { PageShell, Pill } from "../../../_components/page-shell";

type Toast = { tone: "accent" | "warning"; title: string; body: string } | null;
type ClosingStatus = ErpClosingPeriod["status"];

const emptySummary: ErpLedgerSummary = {
  totalDebitAmount: 0,
  totalCreditAmount: 0,
  balance: 0,
  accountCount: 0,
  entryCount: 0,
  postedEntryCount: 0,
};

const amount = (value: number) => new Intl.NumberFormat("ko-KR").format(value);
const statusLabel: Record<ClosingStatus, string> = { open: "열림", locked: "잠금", closed: "마감" };

async function readError(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : `${response.status} ${response.statusText}`;
}

async function fetchLedgerEntries() {
  const response = await fetch(appRoutes.erp.ledgerEntries, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const parsed = erpLedgerEntryListResponseSchema.parse(await response.json());
  return parsed.data;
}

async function fetchClosingPeriods() {
  const response = await fetch(appRoutes.erp.closingPeriods, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const parsed = erpClosingPeriodListResponseSchema.parse(await response.json());
  return parsed.data.items;
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
}

export default function LedgersPage() {
  const defaultRange = useMemo(() => getMonthRange(), []);
  const [ledgerEntries, setLedgerEntries] = useState<ErpLedgerEntry[]>([]);
  const [summary, setSummary] = useState<ErpLedgerSummary>(emptySummary);
  const [closingPeriods, setClosingPeriods] = useState<ErpClosingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [form, setForm] = useState({ ...defaultRange, status: "locked" as ClosingStatus, memo: "" });

  const accountRows = useMemo(() => {
    const grouped = new Map<string, { code: string; name: string; debit: number; credit: number; balance: number; lines: number }>();
    for (const entry of ledgerEntries) {
      const current = grouped.get(entry.accountSubjectId) ?? { code: entry.accountCode, name: entry.accountName, debit: 0, credit: 0, balance: 0, lines: 0 };
      current.debit += entry.debitAmount;
      current.credit += entry.creditAmount;
      current.balance += entry.debitAmount - entry.creditAmount;
      current.lines += 1;
      grouped.set(entry.accountSubjectId, current);
    }
    return Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [ledgerEntries]);

  async function reload() {
    setLoading(true);
    setToast(null);
    try {
      const [ledgerData, periods] = await Promise.all([fetchLedgerEntries(), fetchClosingPeriods()]);
      setLedgerEntries(ledgerData.items);
      setSummary(ledgerData.summary);
      setClosingPeriods(periods);
    } catch (error) {
      setToast({ tone: "warning", title: "원장/마감 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setLoading(false);
    }
  }

  async function createClosingPeriod(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = erpClosingPeriodCreateRequestSchema.parse({
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        status: form.status,
        memo: form.memo || undefined,
      });
      const response = await fetch(appRoutes.erp.closingPeriods, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      erpClosingPeriodMutationResponseSchema.parse(await response.json());
      setForm((current) => ({ ...current, memo: "" }));
      await reload();
      setToast({ tone: "accent", title: "마감 기간을 등록했습니다.", body: "저장 후 DB 목록을 다시 조회했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "마감 기간 등록 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <PageShell title="원장/마감" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="원장 마감">
        <aside className="feature-workspace__nav" aria-label="ERP 회계 메뉴">
          <div className="feature-workspace__nav-header">
            <h1>
              <button className="page-shell__title-link page-shell__title-button" onClick={() => void reload()} type="button">
                원장/마감
              </button>
            </h1>
            <FeaturePageOverflowMenu label="원장/마감" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="ERP 회계 메뉴">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>원장</span><strong>{summary.entryCount}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>마감</span><strong>{closingPeriods.length}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/journals"><span>전표/분개장</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/payment-records"><span>입출금/미수금</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/taxes"><span>세무/부가세</span><strong>이동</strong></a>
          </div>
        </aside>
        <section className="feature-workspace__panel" aria-labelledby="ledgers-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="ledgers-heading">원장 / 월마감 / 마감 잠금</h2>
              <p>전표/분개장 데이터를 기준으로 계정별 원장과 마감 기간을 내부 DB에서 조회·저장합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">외부 회계 서비스 호출 없이 기존 부서업무포털 권한을 따릅니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>원장 전표</span><strong>{summary.entryCount}건</strong><p>전표 기준</p></article>
            <article className="feature-workspace__status"><span>계정</span><strong>{summary.accountCount}개</strong><p>계정별 원장</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>차대 합계</span><strong>{amount(summary.totalDebitAmount)} / {amount(summary.totalCreditAmount)}</strong><p>전체 분개 기준</p></article>
          </div>

          <form className="feature-workspace__rows" onSubmit={createClosingPeriod} aria-label="마감 기간 등록">
            <article className="feature-workspace__row">
              <div>
                <strong>월마감 등록</strong>
                <span>마감 기간과 잠금 상태를 저장합니다. 실제 외부 신고/전송은 마지막 API 연동 단계에서 별도 처리합니다.</span>
                <FormGrid>
                  <FormField label="시작일"><TextInput type="date" value={form.periodStart} onChange={(event) => setForm((current) => ({ ...current, periodStart: event.target.value }))} required /></FormField>
                  <FormField label="종료일"><TextInput type="date" value={form.periodEnd} onChange={(event) => setForm((current) => ({ ...current, periodEnd: event.target.value }))} required /></FormField>
                  <FormField label="상태"><SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ClosingStatus }))}><option value="open">열림</option><option value="locked">잠금</option><option value="closed">마감</option></SelectInput></FormField>
                  <FormField label="메모"><TextArea value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></FormField>
                </FormGrid>
              </div>
              <FormSubmitButton disabled={submitting}>등록</FormSubmitButton>
            </article>
          </form>

          <div className="feature-workspace__rows" aria-label="계정별 원장 요약">
            {loading ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>원장과 마감 상태를 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {!loading && accountRows.length === 0 ? <article className="feature-workspace__row"><div><strong>원장에 표시할 분개가 없습니다.</strong><span>전표/분개장에서 전표를 등록하면 계정별 원장에 반영됩니다.</span></div><em>빈 상태</em></article> : null}
            {accountRows.map((row) => <article className="feature-workspace__row" key={row.code}><div><strong>{row.code} · {row.name}</strong><span>분개 {row.lines}건</span><p>차변 {amount(row.debit)}원 · 대변 {amount(row.credit)}원 · 잔액 {amount(row.balance)}원</p></div><em>{amount(row.balance)}원</em></article>)}
          </div>

          <div className="feature-workspace__rows" aria-label="분개 원장 상세">
            {ledgerEntries.slice(0, 80).map((entry) => <article className="feature-workspace__row" key={entry.id}><div><strong>{entry.accountCode} · {entry.accountName}</strong><span>{entry.entryDate} · {entry.journalEntryNumber} · {entry.journalStatus}</span><p>{entry.description}</p><p>상대계정: {entry.counterpartySummary ?? "-"}</p></div><em>{entry.debitAmount > 0 ? `차변 ${amount(entry.debitAmount)}원` : `대변 ${amount(entry.creditAmount)}원`}</em></article>)}
          </div>

          <div className="feature-workspace__rows" aria-label="마감 기간 목록">
            {closingPeriods.length === 0 && !loading ? <article className="feature-workspace__row"><div><strong>등록된 마감 기간이 없습니다.</strong><span>월마감을 등록하면 기간 잠금 상태를 추적할 수 있습니다.</span></div><em>빈 상태</em></article> : null}
            {closingPeriods.map((period) => <article className="feature-workspace__row" key={period.id}><div><strong>{period.periodStart} ~ {period.periodEnd}</strong><span>{statusLabel[period.status]} · 잠금 {period.lockedAt ? period.lockedAt.slice(0, 10) : "-"} · 마감 {period.closedAt ? period.closedAt.slice(0, 10) : "-"}</span><p>{period.memo ?? "메모 없음"}</p></div><em>{statusLabel[period.status]}</em></article>)}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
