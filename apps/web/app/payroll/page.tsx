"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  payrollMyPayslipResponseSchema,
  payrollOverviewResponseSchema,
  payrollPeriodDetailResponseSchema,
  type PayrollDraft,
  type PayrollLineItem,
  type PayrollPeriod,
  type PayrollPeriodDetailResponse,
  type PayrollProfile,
  type PayrollReviewStep,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";

type ToastState = {
  tone: "accent" | "warning";
  title: string;
  body: string;
} | null;

type PayrollOverview = {
  profiles: PayrollProfile[];
  periods: PayrollPeriod[];
  collectionSteps: PayrollReviewStep[];
};

type PayrollPeriodDetail = PayrollPeriodDetailResponse["data"];

type PayslipDetail = {
  period: PayrollPeriod;
  payslip: PayrollDraft;
  lineItems: PayrollLineItem[];
  employeeMessage: string;
  correctionRequestGuide: string;
};

const periodStatusLabels: Record<PayrollPeriod["status"], string> = {
  draft: "초안",
  collecting: "수집",
  reviewing: "검토",
  confirmed: "확정",
  closed: "마감",
};

const reviewStatusLabels: Record<PayrollReviewStep["status"], string> = {
  pending: "대기",
  submitted: "제출",
  reviewing: "검토",
  changes_requested: "보완 요청",
  confirmed: "확인",
};

const payTypeLabels: Record<PayrollProfile["payType"], string> = {
  monthly: "월급",
  hourly: "시급",
  daily: "일급",
  annual: "연봉",
  inclusive: "포괄",
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return "미등록";
  }
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatSignedCurrency(value: number) {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}원`;
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data.error.message;
  }
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parse(await response.json());
}

async function fetchPayrollOverview(): Promise<PayrollOverview> {
  return fetchJson(appRoutes.payroll.overview, (payload) => {
    const parsed = payrollOverviewResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("급여 현황 응답 형식이 계약과 맞지 않습니다.");
    }
    return {
      profiles: parsed.data.data.profiles,
      periods: parsed.data.data.periods,
      collectionSteps: parsed.data.data.collectionSteps,
    };
  });
}

async function fetchPeriodDetail(periodId: string): Promise<PayrollPeriodDetail> {
  return fetchJson(appRoutes.payroll.periodDetail(periodId), (payload) => {
    const parsed = payrollPeriodDetailResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("급여 기간 상세 응답 형식이 계약과 맞지 않습니다.");
    }
    return parsed.data.data;
  });
}

async function fetchMyPayslip(): Promise<PayslipDetail> {
  return fetchJson(appRoutes.payroll.myPayslip, (payload) => {
    const parsed = payrollMyPayslipResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("내 급여명세서 응답 형식이 계약과 맞지 않습니다.");
    }
    return parsed.data.data;
  });
}

function PayrollLineItemRows({ items }: { items: PayrollLineItem[] }) {
  if (items.length === 0) {
    return (
      <article className="feature-workspace__row">
        <div>
          <strong>수당·공제 항목 없음</strong>
          <span>급여 기간 상세 조회 후 항목이 표시됩니다.</span>
        </div>
        <em>비어 있음</em>
      </article>
    );
  }

  return items.map((item) => (
    <article className="feature-workspace__row" key={item.id}>
      <div>
        <strong>{item.label}</strong>
        <span>{`${item.classification} · ${item.source}`}</span>
        <p>{`수량 ${item.quantity ?? "-"} · 단가 ${formatCurrency(item.unitAmount)}`}</p>
      </div>
      <em>{formatSignedCurrency(item.amount)}</em>
    </article>
  ));
}

export default function PayrollPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [overview, setOverview] = useState<PayrollOverview>({ profiles: [], periods: [], collectionSteps: [] });
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [periodDetail, setPeriodDetail] = useState<PayrollPeriodDetail | null>(null);
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const activePeriod = useMemo(() => {
    return overview.periods.find((period) => period.id === selectedPeriodId) ?? overview.periods[0] ?? null;
  }, [overview.periods, selectedPeriodId]);
  const profile = overview.profiles[0] ?? null;
  const pendingReviewCount = overview.collectionSteps.filter((step) => step.status !== "confirmed").length;
  const grossPay = periodDetail?.draft.grossPay ?? payslip?.payslip.grossPay ?? 0;
  const netPay = periodDetail?.draft.netPayPreview ?? payslip?.payslip.netPayPreview ?? 0;

  async function loadOverview() {
    setLoadState("loading");
    setToast(null);
    try {
      const data = await fetchPayrollOverview();
      setOverview(data);
      const firstPeriod = data.periods[0]?.id ?? "";
      setSelectedPeriodId((current) => current || firstPeriod);
      setLoadState("ready");
      if (firstPeriod) {
        const [detail, myPayslip] = await Promise.all([
          fetchPeriodDetail(firstPeriod),
          fetchMyPayslip().catch(() => null),
        ]);
        setPeriodDetail(detail);
        setPayslip(myPayslip);
      }
    } catch (error) {
      setLoadState("error");
      setToast({
        tone: "warning",
        title: "급여 정보를 불러오지 못했습니다.",
        body: error instanceof Error ? error.message : "알 수 없는 오류입니다.",
      });
    }
  }

  async function handlePeriodChange(periodId: string) {
    setSelectedPeriodId(periodId);
    setToast(null);
    try {
      const detail = await fetchPeriodDetail(periodId);
      setPeriodDetail(detail);
      setToast({ tone: "accent", title: "급여 기간 상세 조회 완료", body: `${detail.period.title} 상세를 불러왔습니다.` });
    } catch (error) {
      setToast({ tone: "warning", title: "급여 기간 상세 조회 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <PageShell title="급여 내부관리" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="급여 내부관리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1>
              <button className="page-shell__title-link page-shell__title-button" onClick={() => void loadOverview()} type="button">
                급여 내부관리
              </button>
            </h1>
            <FeaturePageOverflowMenu label="급여 내부관리" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="급여 상태 요약">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button">
              <span>급여 현황</span>
              <strong>{activePeriod?.title ?? "조회"}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>급여 프로필</span>
              <strong>{profile ? payTypeLabels[profile.payType] : "직원"}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>마감/검토</span>
              <strong>{pendingReviewCount}건</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>수당·공제</span>
              <strong>{periodDetail?.lineItems.length ?? 0}건</strong>
            </button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="payroll-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="payroll-panel-heading">급여 현황</h2>
              <p>{activePeriod ? `${activePeriod.startsOn} ~ ${activePeriod.endsOn} · 지급일 ${activePeriod.payDate}` : "급여 기간을 조회합니다."}</p>
            </div>
            <p className="feature-workspace__permission-hint">payroll.read 권한 기준으로 급여 현황과 명세서 조회를 연결합니다.</p>
          </div>

          {toast ? (
            <article className="info-card">
              <Pill tone={toast.tone}>{toast.tone === "accent" ? "완료" : "확인"}</Pill>
              <h3>{toast.title}</h3>
              <p>{toast.body}</p>
            </article>
          ) : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent">
              <span>이번 급여</span>
              <strong>{activePeriod ? periodStatusLabels[activePeriod.status] : "조회"}</strong>
              <p>{activePeriod?.sourceSummary ?? "급여 API 조회 대기"}</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--warning">
              <span>검토</span>
              <strong>{pendingReviewCount}건</strong>
              <p>확인 전 collection step</p>
            </article>
            <article className="feature-workspace__status">
              <span>직원 공개</span>
              <strong>{formatCurrency(netPay)}</strong>
              <p>본인 명세서 기준 실수령</p>
            </article>
          </div>

          <div className="feature-workspace__form" aria-label="급여 기간 선택">
            <label>
              <span>급여 기간</span>
              <select aria-label="급여 기간" onChange={(event) => void handlePeriodChange(event.target.value)} value={activePeriod?.id ?? ""}>
                {overview.periods.map((period) => (
                  <option key={period.id} value={period.id}>{period.title}</option>
                ))}
              </select>
            </label>
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" onClick={() => void loadOverview()} type="button">
                검토 시작
              </button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled={!activePeriod} onClick={() => activePeriod && void handlePeriodChange(activePeriod.id)} type="button">
                정정 요청 보기
              </button>
            </div>
          </div>

          <div className="feature-workspace__rows" aria-label="급여 기간 목록">
            {loadState === "loading" && overview.periods.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>불러오는 중</strong>
                  <span>급여 현황 조회</span>
                </div>
                <em>대기</em>
              </article>
            ) : overview.periods.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>급여 기간 없음</strong>
                  <span>조회 권한 또는 급여 기간 데이터가 없습니다.</span>
                </div>
                <em>비어 있음</em>
              </article>
            ) : overview.periods.map((period) => (
              <article className="feature-workspace__row" key={period.id}>
                <div>
                  <strong>{period.title}</strong>
                  <span>{`${period.startsOn} ~ ${period.endsOn}`}</span>
                  <p>{period.lockedFieldsNote}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${period.id} 급여 기간 처리`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void handlePeriodChange(period.id)} type="button">
                      상세 보기
                    </button>
                  </div>
                </div>
                <em>{periodStatusLabels[period.status]}</em>
              </article>
            ))}
          </div>

          <div className="feature-workspace__rows" aria-label="급여 프로필 목록">
            {overview.profiles.map((item) => (
              <article className="feature-workspace__row" key={item.id}>
                <div>
                  <strong>{item.employeeName}</strong>
                  <span>{`${payTypeLabels[item.payType]} · ${item.branchLabel ?? "본사"}`}</span>
                  <p>{`기준급 ${formatCurrency(item.basePay)} · 시급 ${formatCurrency(item.hourlyRate)} · 적용 ${item.effectiveFrom}`}</p>
                </div>
                <em>{item.scopeNote}</em>
              </article>
            ))}
          </div>

          <div className="feature-workspace__rows" aria-label="마감 검토 단계">
            {overview.collectionSteps.map((step) => (
              <article className="feature-workspace__row" key={step.id}>
                <div>
                  <strong>{step.scope}</strong>
                  <span>{step.note}</span>
                </div>
                <em>{reviewStatusLabels[step.status]}</em>
              </article>
            ))}
          </div>

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status">
              <span>총지급</span>
              <strong>{formatCurrency(grossPay)}</strong>
              <p>급여 상세 기준</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--warning">
              <span>공제</span>
              <strong>{formatCurrency(periodDetail?.draft.estimatedDeductions ?? payslip?.payslip.estimatedDeductions ?? 0)}</strong>
              <p>세금·보험 추정</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--accent">
              <span>실수령</span>
              <strong>{formatCurrency(netPay)}</strong>
              <p>{payslip?.employeeMessage ?? "본인 명세서 조회 후 안내됩니다."}</p>
            </article>
          </div>

          <div className="feature-workspace__rows" aria-label="수당 공제 항목">
            <PayrollLineItemRows items={periodDetail?.lineItems ?? payslip?.lineItems ?? []} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
