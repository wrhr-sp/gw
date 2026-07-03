"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  appRoutes,
  type AdminAuditLogListResponse,
  type PayrollMyPayslipResponse,
  type PayrollOverviewResponse,
  type PayrollPeriodDetailResponse,
  type WorkItemDeadlinesResponse,
  type WorkItemDetailResponse,
  type WorkItemDocumentsResponse,
  type WorkItemListResponse,
  type WorkItemReviewsResponse,
} from "@gw/shared";

import { Pill } from "./page-shell";

type QueryError = {
  code: string | null;
  message: string;
  status: number | null;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
  loading: boolean;
};

type ModuleKey = "tax" | "labor" | "legal";

const moduleLabels: Record<ModuleKey, string> = {
  tax: "세무",
  labor: "노무",
  legal: "법무",
};

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.ok || !payload.data) {
    const message = payload?.error?.message ?? `요청 실패 (${response.status})`;
    const error = new Error(message) as Error & { status?: number; code?: string | null };
    error.status = response.status;
    error.code = payload?.error?.code ?? null;
    throw error;
  }

  return payload.data;
}

function useApiQuery<T>(url: string | null): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<QueryError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchJson<T>(url)
      .then((payload) => {
        if (active) {
          setData(payload);
        }
      })
      .catch((fetchError) => {
        if (active) {
          const typedError = fetchError as Error & { status?: number; code?: string | null };
          setError({
            code: typedError.code ?? null,
            message: typedError.message,
            status: typedError.status ?? null,
          });
          setData(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return { data, error, loading };
}

function QueryState({ query, emptyMessage }: { query: QueryResult<unknown>; emptyMessage?: string }) {
  if (query.loading) {
    return <p className="card-note">loading 상태: same-origin API 응답을 불러오는 중입니다. 저장 성공이나 권한 차단으로 단정하지 말고 잠시 기다린 뒤 다시 확인합니다.</p>;
  }

  if (query.error) {
    if (query.error.code === "FORBIDDEN") {
      return <p className="card-note">forbidden 상태: 로그인은 되었지만 현재 권한 또는 회사 scope 가 맞지 않아 API 가 403 으로 차단됩니다. ({query.error.message})</p>;
    }

    const normalizedMessage = query.error.message.toLowerCase();
    if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network") || normalizedMessage.includes("fetch failed")) {
      return <p className="card-note">offline 또는 network error 상태: 네트워크가 불안정해 same-origin API 응답을 읽지 못했습니다. 가능한 일과 막히는 일을 먼저 확인한 뒤 다시 시도합니다. ({query.error.message})</p>;
    }

    return <p className="card-note">error 상태: 조회나 불러오기에 실패했습니다. 같은 작업을 성공처럼 넘기지 말고 복구 경로를 먼저 확인합니다. ({query.error.message})</p>;
  }

  if (!query.data && emptyMessage) {
    return <p className="card-note">empty 상태: {emptyMessage}</p>;
  }

  return null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PayrollOverviewLiveSection() {
  const overview = useApiQuery<PayrollOverviewResponse["data"]>(appRoutes.payroll.overview);
  const selectedPeriodId = overview.data?.periods[0]?.id ?? null;
  const periodDetail = useApiQuery<PayrollPeriodDetailResponse["data"]>(selectedPeriodId ? appRoutes.payroll.periodDetail(selectedPeriodId) : null);

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">급여 overview 실응답</Pill>
          <QueryState query={overview} emptyMessage="급여 overview 응답이 없습니다." />
          {overview.data ? (
            <>
              <h3>프로필 {overview.data.profiles.length}건 · 기간 {overview.data.periods.length}건</h3>
              <p>급여 프로필, 기간, 수집 단계가 같은 응답에서 이어집니다.</p>
              <p className="card-note">첫 검토 단계: {overview.data.collectionSteps[0] ? `${overview.data.collectionSteps[0].scope} · ${overview.data.collectionSteps[0].status}` : "없음"}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>기간 상세 / 승인 게이트</Pill>
          <QueryState query={periodDetail} emptyMessage="선택할 급여 기간이 없습니다." />
          {periodDetail.data ? (
            <>
              <h3>{periodDetail.data.period.status} · {periodDetail.data.period.title}</h3>
              <p>{periodDetail.data.draft.employeeName} · {periodDetail.data.draft.approvalGate}</p>
              <p className="card-note">review step: {periodDetail.data.reviewSteps[0] ? `${periodDetail.data.reviewSteps[0].scope} · ${periodDetail.data.reviewSteps[0].status}` : "없음"}</p>
            </>
          ) : null}
        </article>
      </div>

      {periodDetail.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          <article className="route-card">
            <Pill>draft</Pill>
            <h3>{formatCurrency(periodDetail.data.draft.netPayPreview)}</h3>
            <p>{periodDetail.data.draft.reviewNote}</p>
            <p className="card-note">gross {formatCurrency(periodDetail.data.draft.grossPay)} · deduction {formatCurrency(periodDetail.data.draft.estimatedDeductions)}</p>
          </article>
          <article className="route-card">
            <Pill>input snapshot</Pill>
            <h3>근태 {periodDetail.data.inputSnapshot.attendanceHours}시간</h3>
            <p>연장 {periodDetail.data.inputSnapshot.overtimeHours}시간 · 야간 {periodDetail.data.inputSnapshot.nightHours}시간</p>
            <p className="card-note">source: {periodDetail.data.inputSnapshot.sourceNote}</p>
          </article>
          <article className="route-card">
            <Pill>line items</Pill>
            <h3>{periodDetail.data.lineItems.length}개 항목</h3>
            <p>{periodDetail.data.lineItems[0]?.label ?? "항목 없음"}</p>
            <p className="card-note">{periodDetail.data.lineItems[0] ? formatCurrency(periodDetail.data.lineItems[0].amount) : "산출 항목 없음"}</p>
          </article>
        </div>
      ) : null}
    </>
  );
}

export function PayrollPayslipLiveSection() {
  const payslip = useApiQuery<PayrollMyPayslipResponse["data"]>(appRoutes.payroll.myPayslip);

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">내 급여명세서 실응답</Pill>
          <QueryState query={payslip} emptyMessage="본인 급여명세서 초안 응답이 없습니다." />
          {payslip.data ? (
            <>
              <h3>{payslip.data.period.title}</h3>
              <p>{formatCurrency(payslip.data.payslip.netPayPreview)} 예상</p>
              <p className="card-note">{payslip.data.employeeMessage}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>self-only / 정정 안내</Pill>
          {payslip.data ? (
            <>
              <h3>{payslip.data.lineItems.length}개 항목</h3>
              <p>{payslip.data.correctionRequestGuide}</p>
              <p className="card-note">권한이 없으면 /api/payroll/me/payslip 이 403 으로 차단됩니다.</p>
            </>
          ) : (
            <QueryState query={payslip} emptyMessage="정정 안내는 로그인 후 표시됩니다." />
          )}
        </article>
      </div>

      {payslip.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {payslip.data.lineItems.slice(0, 4).map((item) => (
            <article key={item.id} className="route-card">
              <div className="pill-row">
                <Pill>{item.classification}</Pill>
                <Pill>{item.source}</Pill>
              </div>
              <h3>{item.label}</h3>
              <p>{formatCurrency(item.amount)}</p>
              <p className="card-note">{item.note}</p>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function WorkItemModuleLiveSection({ module }: { module: ModuleKey }) {
  const list = useApiQuery<WorkItemListResponse["data"]>(`${appRoutes.workItems.list}?module=${module}`);
  const selectedItemId = list.data?.items[0]?.id ?? null;
  const detail = useApiQuery<WorkItemDetailResponse["data"]>(selectedItemId ? appRoutes.workItems.detail(selectedItemId) : null);
  const documents = useApiQuery<WorkItemDocumentsResponse["data"]>(selectedItemId ? appRoutes.workItems.documents(selectedItemId) : null);
  const reviews = useApiQuery<WorkItemReviewsResponse["data"]>(selectedItemId ? appRoutes.workItems.reviews(selectedItemId) : null);
  const deadlines = useApiQuery<WorkItemDeadlinesResponse["data"]>(appRoutes.workItems.deadlines);

  const visibleDeadlines = useMemo(
    () => deadlines.data?.items.filter((item) => item.workItemId === selectedItemId).slice(0, 3) ?? [],
    [deadlines.data, selectedItemId],
  );

  const label = moduleLabels[module];

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">{label} 업무 목록 실응답</Pill>
          <QueryState query={list} emptyMessage={`현재 세션으로 볼 수 있는 ${label} 업무 카드가 없습니다.`} />
          {list.data ? (
            <>
              <h3>{list.data.items.length}건</h3>
              <p>list → detail → review/documents 흐름을 같은 모듈 기준으로 바로 확인합니다.</p>
              <p className="card-note">첫 카드: {list.data.items[0]?.title ?? "없음"}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>상세 / 범위</Pill>
          <QueryState query={detail} emptyMessage={`선택할 ${label} 상세 카드가 없습니다.`} />
          {detail.data ? (
            <>
              <h3>{detail.data.item.status} · {detail.data.item.priority}</h3>
              <p>{detail.data.item.access.viewerScope} scope · {detail.data.item.branchLabel ?? "company"}</p>
              <p className="card-note">허용 capability: {detail.data.item.access.capabilities.join(", ")}</p>
            </>
          ) : null}
        </article>
      </div>

      {detail.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          <article className="route-card">
            <Pill>{detail.data.item.category}</Pill>
            <h3>{detail.data.item.title}</h3>
            <p>{detail.data.item.descriptionPreview}</p>
            <p className="card-note">감사 요약: {detail.data.item.auditSummary}</p>
          </article>
          <article className="route-card">
            <Pill>review / audit</Pill>
            <h3>{reviews.data?.items.length ?? 0}개 review</h3>
            <p>{reviews.data?.items[0] ? `${reviews.data.items[0].decision} · ${reviews.data.items[0].reviewerRoleCode}` : detail.data.auditLogs[0]?.summary ?? "review 없음"}</p>
            <p className="card-note">{detail.data.auditLogs[0] ? formatDateTime(detail.data.auditLogs[0].happenedAt) : "audit.read 권한이 없으면 감사 흔적은 비워집니다."}</p>
          </article>
          <article className="route-card">
            <Pill>document</Pill>
            <h3>{documents.data?.items.length ?? 0}개 문서</h3>
            <p>{documents.data?.items[0]?.title ?? "문서 없음"}</p>
            <p className="card-note">{documents.error?.code === "FORBIDDEN" ? "민감 문서는 허용 역할만 조회합니다." : documents.data?.items[0]?.accessNote ?? "metadata-only visibility 유지"}</p>
          </article>
          <article className="route-card">
            <Pill>deadline</Pill>
            <h3>{visibleDeadlines.length}개 마감</h3>
            <p>{visibleDeadlines[0]?.title ?? "연결된 마감 없음"}</p>
            <p className="card-note">{visibleDeadlines[0] ? `${visibleDeadlines[0].status} · ${formatDateTime(visibleDeadlines[0].dueAt)}` : "같은 회사/지점 범위 안에서만 노출"}</p>
          </article>
        </div>
      ) : null}

      <article className="info-card" style={{ marginTop: 16 }}>
        <Pill>guard / 상태 확인 기준</Pill>
        <ul className="summary-list">
          <li>loading: same-origin API 응답을 기다리는 정상 상태로 표시합니다.</li>
          <li>empty: 현재 세션으로 볼 카드가 없을 때는 실패가 아니라 빈 상태로 구분합니다.</li>
          <li>forbidden: 회사 scope·restricted capability·audit 권한이 맞지 않으면 403 으로 차단합니다.</li>
          <li>error: 네트워크/응답 오류는 성공처럼 숨기지 않고 그대로 노출합니다.</li>
        </ul>
      </article>
    </>
  );
}

export function ManagementCompliancePreviewSection() {
  const auditLogs = useApiQuery<AdminAuditLogListResponse["data"]>(appRoutes.admin.auditLogs);
  const relevantItems = useMemo(
    () => auditLogs.data?.items.filter((item) => ["payroll", "tax", "labor", "legal", "policy", "audit"].includes(item.metadata.category)).slice(0, 3) ?? [],
    [auditLogs.data],
  );

  return (
    <div className="grid-auto-compact">
      <article className="info-card">
        <Pill tone="accent">컴플라이언스 / 감사</Pill>
        <QueryState query={auditLogs} emptyMessage="감사 로그 응답이 없습니다." />
        {auditLogs.data ? (
          <>
            <h3>{auditLogs.data.items.length}건</h3>
            <p>민감 운영 변경 흔적은 read-only 감사 흐름으로 먼저 확인합니다.</p>
            <p className="card-note">첫 category: {relevantItems[0]?.metadata.category ?? auditLogs.data.items[0]?.metadata.category ?? "없음"}</p>
          </>
        ) : null}
      </article>
      <article className="info-card">
        <Pill>audit.read guard</Pill>
        {auditLogs.error?.code === "FORBIDDEN" ? (
          <>
            <h3>지정 역할만 허용</h3>
            <p>{auditLogs.error.message}</p>
            <p className="card-note">/management 허브는 보여도 /api/admin/audit-logs 와 /admin/audit-logs 는 audit.read 권한으로 다시 차단됩니다.</p>
          </>
        ) : auditLogs.data ? (
          <>
            <h3>{auditLogs.data.filterOptions.categories.join(", ")}</h3>
            <p>{auditLogs.data.operationalTrail.operationalNote}</p>
            <p className="card-note">read-only 추적이며 전용 compliance 조치 엔진 완료를 뜻하지 않습니다.</p>
          </>
        ) : (
          <QueryState query={auditLogs} emptyMessage="감사 경계 설명은 로그인 후 표시됩니다." />
        )}
      </article>
    </div>
  );
}
