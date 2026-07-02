"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  payrollMyPayslipResponseSchema,
  type PayrollLineItem,
  type PayrollMyPayslipResponse,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;
type PayslipData = PayrollMyPayslipResponse["data"];

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchPayslip(): Promise<PayslipData> {
  const response = await fetch(appRoutes.payroll.myPayslip, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = payrollMyPayslipResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("내 급여명세서 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data;
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toLocaleString("ko-KR")}원`;
}

function LineItemRow({ item }: { item: PayrollLineItem }) {
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{item.label}</strong>
        <span>{item.note}</span>
        <p>{`${item.classification === "earning" ? "지급" : "공제"} · ${item.source}`}</p>
      </div>
      <em>{formatMoney(item.amount)}</em>
    </article>
  );
}

export default function PayrollMePage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<PayslipData | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const earnings = useMemo(() => data?.lineItems.filter((item) => item.classification === "earning") ?? [], [data]);
  const deductions = useMemo(() => data?.lineItems.filter((item) => item.classification === "deduction") ?? [], [data]);

  async function reloadPayslip() {
    setLoadState("loading");
    setToast(null);
    try {
      setData(await fetchPayslip());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "급여명세서를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadPayslip(); }, []);

  return (
    <PageShell title="내 급여명세서" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="내 급여명세서 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadPayslip()} type="button">내 급여명세서</button></h1>
            <FeaturePageOverflowMenu label="내 급여명세서" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="내 급여명세서 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>명세서 요약</span><strong>{data?.period.title.replace(" 급여", "") ?? "조회"}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>지급/공제</span><strong>상세</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>정정 요청</span><strong>신청</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>이전 명세서</span><strong>내역</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="payroll-me-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="payroll-me-heading">명세서 요약</h2>
              <p>이번 달 지급 예정액, 공개 상태, 확인해야 할 항목을 실제 본인 명세서 API 기준으로 보여 줍니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">본인 명세서에 대해서만 정정 요청할 수 있습니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>예상 실수령</span><strong>{data ? formatMoney(data.payslip.netPayPreview) : "-"}</strong><p>{data?.employeeMessage ?? "실제 명세서 조회 후 표시합니다."}</p></article>
            <article className="feature-workspace__status"><span>지급일</span><strong>{data?.period.payDate ?? "-"}</strong><p>{data?.period.title ?? "조회 대기"}</p></article>
            <article className="feature-workspace__status"><span>확인 필요</span><strong>{data ? "0건" : "-"}</strong><p>{data?.payslip.reviewNote ?? "명세서를 불러오면 확인 항목을 표시합니다."}</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="명세서 요약">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>내 명세서 조회</span></div><em>대기</em></article> : null}
            {!data && loadState !== "loading" ? <article className="feature-workspace__row"><div><strong>조회된 명세서 없음</strong><span>실제 급여명세서 API 응답을 기다립니다.</span></div><em>대기</em></article> : null}
            {data ? <article className="feature-workspace__row"><div><strong>근태 반영</strong><span>{data.period.sourceSummary}</span><p>{data.period.lockedFieldsNote}</p></div><em>확인</em></article> : null}
            <article className="feature-workspace__row"><div><strong>수당 반영</strong><span>{`${earnings.length}개 지급 항목`}</span><p>급여 담당자는 근태·휴가 기록과 함께 확인합니다.</p></div><em>검토</em></article>
            <article className="feature-workspace__row"><div><strong>공제 반영</strong><span>{`${deductions.length}개 공제 항목`}</span><p>원천세와 4대보험은 확정 전 표시입니다.</p></div><em>대기</em></article>
          </div>

          <div className="feature-workspace__rows" aria-label="지급/공제 항목">
            {data?.lineItems.map((item) => <LineItemRow item={item} key={item.id} />)}
          </div>

          <div className="feature-workspace__rows" aria-label="정정 요청과 이전 명세서">
            <article className="feature-workspace__row"><div><strong>정정 요청</strong><span>연장근로 수당 · 대상 날짜 선택</span><p>{data?.correctionRequestGuide ?? "급여명세서 조회 후 정정 요청 가능 여부를 확인합니다."}</p><div className="feature-workspace__row-actions" aria-label="급여 정정 요청"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">정정 요청</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">임시 저장</button></div></div><em>신청</em></article>
            <article className="feature-workspace__row"><div><strong>이전 명세서</strong><span>이전 달 명세서 공개 여부와 확인 상태를 한 줄씩 봅니다.</span><p>/payroll/me 본인 명세서 범위만 표시합니다.</p></div><em>내역</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
