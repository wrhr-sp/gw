"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateResponseSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveRequestCreateRequest,
  type LeaveType,
} from "@gw/shared";

type LeaveUnit = LeaveRequest["unit"];

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type MutationState = "idle" | "submitting" | "success" | "error";

type ToastState = {
  tone: "accent" | "warning";
  title: string;
  body: string;
} | null;

type LeaveData = {
  types: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
};

const unitLabels: Record<LeaveUnit, string> = {
  day: "일",
  half_day: "반차",
  hour: "시간",
};

const requestStatusLabels: Record<LeaveRequest["status"], string> = {
  pending_approval: "승인 대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

const requestStatusTones: Record<LeaveRequest["status"], "accent" | "warning" | undefined> = {
  pending_approval: "warning",
  approved: "accent",
  rejected: "warning",
  cancelled: undefined,
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDays(value: number) {
  return Number.isInteger(value) ? `${value}일` : `${value.toFixed(1)}일`;
}

function getTypeName(types: LeaveType[], leaveTypeId: string) {
  return types.find((type) => type.id === leaveTypeId)?.name ?? leaveTypeId;
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

async function fetchLeaveData(): Promise<LeaveData> {
  const [types, balances, requests] = await Promise.all([
    fetchJson(appRoutes.leave.types, (payload) => {
      const parsed = leaveTypeListResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("휴가 유형 응답 형식이 계약과 맞지 않습니다.");
      }
      return parsed.data.data.items;
    }),
    fetchJson(appRoutes.leave.balances, (payload) => {
      const parsed = leaveBalanceListResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("휴가 잔여 응답 형식이 계약과 맞지 않습니다.");
      }
      return parsed.data.data.items;
    }),
    fetchJson(appRoutes.leave.requests, (payload) => {
      const parsed = leaveRequestListResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("휴가 신청 목록 응답 형식이 계약과 맞지 않습니다.");
      }
      return parsed.data.data.items;
    }),
  ]);
  return { types, balances, requests };
}

async function submitLeaveRequest(request: LeaveRequestCreateRequest) {
  const response = await fetch(appRoutes.leave.requests, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const parsed = leaveRequestCreateResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("휴가 신청 응답 형식이 계약과 맞지 않습니다.");
  }
  return parsed.data.data.request;
}

function LeaveRequestRow({ request, types }: { request: LeaveRequest; types: LeaveType[] }) {
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{`${request.startDate} ~ ${request.endDate}`}</strong>
        <span>{`${getTypeName(types, request.leaveTypeId)} · ${formatDays(request.days)} · ${unitLabels[request.unit]}`}</span>
        <p>{request.reason}</p>
        <div className="feature-workspace__row-actions" aria-label={`${request.id} 휴가 신청 처리`}>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">
            신청 취소
          </button>
        </div>
      </div>
      <em>{requestStatusLabels[request.status]}</em>
    </article>
  );
}

export default function LeavePage() {
  const defaultStartDate = addDays(todayDate(), 1);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultStartDate);
  const [unit, setUnit] = useState<LeaveUnit>("day");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const availableBalance = useMemo(() => balances.reduce((total, balance) => total + balance.remainingDays, 0), [balances]);
  const usedBalance = useMemo(() => balances.reduce((total, balance) => total + balance.usedDays, 0), [balances]);
  const reservedBalance = useMemo(() => balances.reduce((total, balance) => total + balance.reservedDays, 0), [balances]);
  const pendingRequests = useMemo(() => requests.filter((request) => request.status === "pending_approval"), [requests]);
  const approvalRequests = useMemo(() => pendingRequests.filter((request) => request.employeeId !== requests[0]?.employeeId), [pendingRequests, requests]);

  async function reloadLeaveData() {
    setLoadState("loading");
    try {
      const data = await fetchLeaveData();
      setTypes(data.types);
      setBalances(data.balances);
      setRequests(data.requests);
      setLeaveTypeId((current) => current || data.types[0]?.id || "");
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({
        tone: "warning",
        title: "휴가 정보를 불러오지 못했습니다.",
        body: error instanceof Error ? error.message : "알 수 없는 오류입니다.",
      });
    }
  }

  useEffect(() => {
    void reloadLeaveData();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDays = Number(days);
    if (!leaveTypeId) {
      setToast({ tone: "warning", title: "휴가 신청 실패", body: "휴가 유형을 먼저 선택해 주세요." });
      return;
    }
    if (!reason.trim()) {
      setToast({ tone: "warning", title: "휴가 신청 실패", body: "신청 사유를 입력해 주세요." });
      return;
    }
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setToast({ tone: "warning", title: "휴가 신청 실패", body: "신청 일수를 올바르게 입력해 주세요." });
      return;
    }

    setMutationState("submitting");
    setToast(null);
    try {
      const request = await submitLeaveRequest({
        leaveTypeId,
        startDate,
        endDate,
        unit,
        days: parsedDays,
        reason: reason.trim(),
      });
      await reloadLeaveData();
      setReason("");
      setToast({ tone: "accent", title: "휴가 신청 완료", body: `${request.startDate} · ${requestStatusLabels[request.status]}` });
      setMutationState("success");
    } catch (error) {
      setToast({ tone: "warning", title: "휴가 신청 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
      setMutationState("error");
    }
  }

  return (
    <PageShell title="휴가" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="휴가 메뉴">
          <div className="feature-workspace__nav-header">
            <h1>
              <button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadLeaveData()} type="button">
                휴가
              </button>
            </h1>
            <FeaturePageOverflowMenu label="휴가" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="휴가 상태 요약">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button">
              <span>잔여 휴가</span>
              <strong>{formatDays(availableBalance)}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>휴가 신청</span>
              <strong>{types.length > 0 ? "작성" : "대기"}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" onClick={() => void reloadLeaveData()} role="tab" type="button">
              <span>내 신청</span>
              <strong>{requests.length}건</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" onClick={() => void reloadLeaveData()} role="tab" type="button">
              <span>승인 대기</span>
              <strong>{pendingRequests.length}건</strong>
            </button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="leave-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="leave-panel-heading">잔여 휴가</h2>
            </div>
            <p className="feature-workspace__permission-hint">leave.request 권한 기준으로 신청 CTA를 노출합니다.</p>
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
              <span>사용 가능</span>
              <strong>{formatDays(availableBalance)}</strong>
              <p>현재 조회된 휴가 잔여 합계</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--warning">
              <span>승인 대기</span>
              <strong>{formatDays(reservedBalance)}</strong>
              <p>예약 또는 승인 대기 반영</p>
            </article>
            <article className="feature-workspace__status">
              <span>사용</span>
              <strong>{formatDays(usedBalance)}</strong>
              <p>승인 완료 기준</p>
            </article>
          </div>

          <div className="feature-workspace__rows" aria-label="휴가 잔여 목록">
            {loadState === "loading" && balances.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>불러오는 중</strong>
                  <span>휴가 잔여 조회</span>
                </div>
                <em>대기</em>
              </article>
            ) : balances.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>연차</strong>
                  <span>휴가 잔여가 없거나 조회 권한이 없습니다.</span>
                  <div className="feature-workspace__row-actions" aria-label="비어 있는 휴가 잔여 처리">
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void reloadLeaveData()} type="button">
                      최근 처리 보기
                    </button>
                  </div>
                </div>
                <em>비어 있음</em>
              </article>
            ) : balances.map((balance) => (
              <article className="feature-workspace__row" key={balance.id}>
                <div>
                  <strong>{getTypeName(types, balance.leaveTypeId)}</strong>
                  <span>{`기준일 ${balance.asOfDate}`}</span>
                  <p>{`부여 ${formatDays(balance.openingDays)} · 사용 ${formatDays(balance.usedDays)} · 예정 ${formatDays(balance.reservedDays)}`}</p>
                </div>
                <em>{`${formatDays(balance.remainingDays)} 남음`}</em>
              </article>
            ))}
          </div>

          <form className="feature-workspace__form" onSubmit={handleSubmit}>
            <label>
              <span>휴가 유형</span>
              <select aria-label="휴가 유형" onChange={(event) => setLeaveTypeId(event.target.value)} value={leaveTypeId}>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>시작일</span>
              <input aria-label="휴가 시작일" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            </label>
            <label>
              <span>종료일</span>
              <input aria-label="휴가 종료일" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            </label>
            <label>
              <span>단위</span>
              <select aria-label="휴가 단위" onChange={(event) => setUnit(event.target.value as LeaveUnit)} value={unit}>
                {Object.entries(unitLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>일수</span>
              <input aria-label="휴가 일수" min="0.5" onChange={(event) => setDays(event.target.value)} step="0.5" type="number" value={days} />
            </label>
            <label>
              <span>사유</span>
              <textarea aria-label="휴가 신청 사유" onChange={(event) => setReason(event.target.value)} rows={4} value={reason} />
            </label>
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={mutationState === "submitting" || types.length === 0} type="submit">
                휴가 신청
              </button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled={mutationState === "submitting"} onClick={() => void reloadLeaveData()} type="button">
                최근 처리 보기
              </button>
            </div>
          </form>

          <div className="feature-workspace__rows" aria-label="내 휴가 신청 목록">
            {requests.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>신청 내역 없음</strong>
                  <span>휴가 신청 후 목록에 표시됩니다.</span>
                </div>
                <em>비어 있음</em>
              </article>
            ) : requests.map((request) => (
              <LeaveRequestRow key={request.id} request={request} types={types} />
            ))}
          </div>

          <div className="feature-workspace__rows" aria-label="승인 대기 휴가 목록">
            {approvalRequests.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>승인 대기가 없으면</strong>
                  <span>팀원 휴가 요청이 없을 때는 최근 처리 내역만 확인합니다.</span>
                </div>
                <em>최근 처리 보기</em>
              </article>
            ) : approvalRequests.map((request) => (
              <article className="feature-workspace__row" key={request.id}>
                <div>
                  <strong>{request.employeeId}</strong>
                  <span>{`${request.startDate} ~ ${request.endDate} · ${getTypeName(types, request.leaveTypeId)}`}</span>
                  <p>{request.reason}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${request.id} 휴가 승인 처리`}>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">승인</button>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">반려</button>
                  </div>
                </div>
                <em>{requestStatusLabels[request.status]}</em>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
