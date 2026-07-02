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

const seedData: PayslipData = {
  period: {
    id: "payroll_period_seed",
    companyId: "company_demo",
    title: "2026년 6월 급여",
    branchScopeLabel: "본인 명세서",
    startsOn: "2026-06-01",
    endsOn: "2026-06-30",
    payDate: "2026-07-10",
    status: "reviewing",
    sourceSummary: "근태와 수당 반영 대기",
    lockedFieldsNote: "확정 전 정정 요청 가능",
    placeholder: true,
  },
  payslip: {
    id: "payroll_draft_seed",
    periodId: "payroll_period_seed",
    profileId: "payroll_profile_seed",
    employeeId: "employee_admin",
    employeeName: "관리자 테스트",
    branchLabel: "본인",
    payType: "monthly",
    status: "reviewing",
    grossPay: 2443200,
    estimatedDeductions: 259800,
    netPayPreview: 2183400,
    reviewNote: "본인 확인 전",
    approvalGate: "급여 담당자 확인",
    placeholder: true,
  },
  lineItems: [
    { id: "base", code: "base", label: "기본 근무시간", classification: "earning", source: "attendance", quantity: 168, unitAmount: null, premiumRate: null, amount: 2150400, note: "168시간", placeholder: true },
    { id: "overtime", code: "overtime", label: "연장근로 수당", classification: "earning", source: "attendance", quantity: 9, unitAmount: null, premiumRate: null, amount: 172800, note: "9시간", placeholder: true },
    { id: "meal", code: "meal", label: "식대", classification: "earning", source: "manual", quantity: null, unitAmount: null, premiumRate: null, amount: 120000, note: "월 고정", placeholder: true },
    { id: "tax", code: "tax", label: "원천세", classification: "deduction", source: "manual", quantity: null, unitAmount: null, premiumRate: null, amount: -187000, note: "확정 전", placeholder: true },
    { id: "insurance", code: "insurance", label: "4대보험", classification: "deduction", source: "manual", quantity: null, unitAmount: null, premiumRate: null, amount: -140000, note: "확정 전", placeholder: true },
  ],
  employeeMessage: "본인 명세서만 확인할 수 있습니다.",
  correctionRequestGuide: "근태나 수당이 다르면 공개 전 담당자에게 정정을 요청합니다.",
  placeholder: true,
};

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
  const [data, setData] = useState<PayslipData>(seedData);
  const [toast, setToast] = useState<ToastState>(null);

  const earnings = useMemo(() => data.lineItems.filter((item) => item.classification === "earning"), [data.lineItems]);
  const deductions = useMemo(() => data.lineItems.filter((item) => item.classification === "deduction"), [data.lineItems]);

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
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>명세서 요약</span><strong>{data.period.title.replace(" 급여", "")}</strong></button>
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
            <article className="feature-workspace__status feature-workspace__status--accent"><span>예상 실수령</span><strong>{formatMoney(data.payslip.netPayPreview)}</strong><p>{data.employeeMessage}</p></article>
            <article className="feature-workspace__status"><span>지급일</span><strong>{data.period.payDate}</strong><p>{data.period.title}</p></article>
            <article className="feature-workspace__status"><span>확인 필요</span><strong>0건</strong><p>{data.payslip.reviewNote}</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="명세서 요약">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>내 명세서 조회</span></div><em>대기</em></article> : null}
            <article className="feature-workspace__row"><div><strong>근태 반영</strong><span>{data.period.sourceSummary}</span><p>{data.period.lockedFieldsNote}</p></div><em>확인</em></article>
            <article className="feature-workspace__row"><div><strong>수당 반영</strong><span>{`${earnings.length}개 지급 항목`}</span><p>급여 담당자는 근태·휴가 기록과 함께 확인합니다.</p></div><em>검토</em></article>
            <article className="feature-workspace__row"><div><strong>공제 반영</strong><span>{`${deductions.length}개 공제 항목`}</span><p>원천세와 4대보험은 확정 전 표시입니다.</p></div><em>대기</em></article>
          </div>

          <div className="feature-workspace__rows" aria-label="지급/공제 항목">
            {data.lineItems.map((item) => <LineItemRow item={item} key={item.id} />)}
          </div>

          <div className="feature-workspace__rows" aria-label="정정 요청과 이전 명세서">
            <article className="feature-workspace__row"><div><strong>정정 요청</strong><span>연장근로 수당 · 대상 날짜 선택</span><p>{data.correctionRequestGuide}</p><div className="feature-workspace__row-actions" aria-label="급여 정정 요청"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">정정 요청</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">임시 저장</button></div></div><em>신청</em></article>
            <article className="feature-workspace__row"><div><strong>이전 명세서</strong><span>이전 달 명세서 공개 여부와 확인 상태를 한 줄씩 봅니다.</span><p>/payroll/me 본인 명세서 범위만 표시합니다.</p></div><em>내역</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
