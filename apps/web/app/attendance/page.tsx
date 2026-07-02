"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  attendanceActionResponseSchema,
  attendanceCorrectionResponseSchema,
  attendanceListRecordsResponseSchema,
  errorResponseSchema,
  type AttendanceCorrectionRequest,
  type AttendanceRecord,
  type AttendanceRegistrationMethod,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type MutationState = "idle" | "submitting" | "success" | "error";

type ToastState = {
  tone: "accent" | "warning";
  title: string;
  body: string;
} | null;

const attendanceMethodLabels: Record<AttendanceRegistrationMethod, string> = {
  pc: "PC",
  mobile: "모바일",
  tag: "태그",
};

const attendanceStatusLabels: Record<AttendanceRecord["status"], string> = {
  checked_in: "출근",
  checked_out: "퇴근",
  needs_correction: "정정 필요",
};

const attendanceStatusTones: Record<AttendanceRecord["status"], "accent" | "warning" | undefined> = {
  checked_in: "warning",
  checked_out: "accent",
  needs_correction: "warning",
};

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getMonthStartDate() {
  const now = new Date();
  return toDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

function getTodayDate() {
  return toDateOnly(new Date());
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getRecordTimeSummary(record: AttendanceRecord) {
  return `${formatDateTime(record.checkInAt)} ~ ${formatDateTime(record.checkOutAt)}`;
}

function getLatestTodayRecord(records: AttendanceRecord[]) {
  const today = getTodayDate();
  return records.find((record) => record.workDate === today) ?? null;
}

function countByStatus(records: AttendanceRecord[], status: AttendanceRecord["status"]) {
  return records.filter((record) => record.status === status).length;
}

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);

  if (parsed.success) {
    return parsed.data.error.message;
  }

  return `${response.status} ${response.statusText}`;
}

async function fetchAttendanceRecords() {
  const query = new URLSearchParams({
    workDateFrom: getMonthStartDate(),
    workDateTo: getTodayDate(),
  });
  const response = await fetch(`${appRoutes.attendance.records}?${query.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = attendanceListRecordsResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("근태 기록 응답 형식이 계약과 맞지 않습니다.");
  }

  return parsed.data.data.items;
}

async function submitAttendanceAction(route: string, method: AttendanceRegistrationMethod) {
  const response = await fetch(route, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ attendanceRegistrationMethod: method }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = attendanceActionResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("근태 등록 응답 형식이 계약과 맞지 않습니다.");
  }

  return parsed.data.data.record;
}

async function submitAttendanceCorrection(request: AttendanceCorrectionRequest) {
  const response = await fetch(appRoutes.attendance.corrections, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const parsed = attendanceCorrectionResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("근태 정정 요청 응답 형식이 계약과 맞지 않습니다.");
  }

  return parsed.data.data.request;
}

function AttendanceRecordRow({ record, onSelectCorrection }: { record: AttendanceRecord; onSelectCorrection: (record: AttendanceRecord) => void }) {
  return (
    <article className="feature-workspace__row">
      <div>
        <strong>{record.workDate}</strong>
        <span>{getRecordTimeSummary(record)}</span>
        <p>{attendanceMethodLabels[record.source === "web" ? "pc" : record.source === "mobile" ? "mobile" : "tag"] ?? record.source}</p>
        <div className="feature-workspace__row-actions" aria-label={`${record.workDate} 근태 처리`}>
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => onSelectCorrection(record)} type="button">
            정정 요청
          </button>
        </div>
      </div>
      <em>{attendanceStatusLabels[record.status]}</em>
    </article>
  );
}

export default function AttendancePage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [method, setMethod] = useState<AttendanceRegistrationMethod>("pc");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [requestedCheckInAt, setRequestedCheckInAt] = useState("");
  const [requestedCheckOutAt, setRequestedCheckOutAt] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const todayRecord = useMemo(() => getLatestTodayRecord(records), [records]);
  const correctionTarget = useMemo(() => records.find((record) => record.id === selectedRecordId) ?? todayRecord ?? records[0] ?? null, [records, selectedRecordId, todayRecord]);

  async function reloadRecords() {
    setLoadState("loading");
    try {
      const items = await fetchAttendanceRecords();
      setRecords(items);
      setSelectedRecordId((current) => current || items[0]?.id || "");
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({
        tone: "warning",
        title: "근태 기록을 불러오지 못했습니다.",
        body: error instanceof Error ? error.message : "알 수 없는 오류입니다.",
      });
    }
  }

  useEffect(() => {
    void reloadRecords();
  }, []);

  useEffect(() => {
    if (!correctionTarget) {
      return;
    }

    setRequestedCheckInAt(toLocalDateTimeInput(correctionTarget.checkInAt));
    setRequestedCheckOutAt(toLocalDateTimeInput(correctionTarget.checkOutAt));
  }, [correctionTarget?.id]);

  async function handleAttendanceAction(route: string, successTitle: string) {
    setMutationState("submitting");
    setToast(null);

    try {
      const record = await submitAttendanceAction(route, method);
      await reloadRecords();
      setSelectedRecordId(record.id);
      setToast({ tone: "accent", title: successTitle, body: `${record.workDate} · ${attendanceStatusLabels[record.status]}` });
      setMutationState("success");
    } catch (error) {
      setToast({ tone: "warning", title: "근태 등록 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
      setMutationState("error");
    }
  }

  async function handleCorrectionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!correctionTarget) {
      setToast({ tone: "warning", title: "정정 요청 실패", body: "정정할 근태 기록을 먼저 선택해 주세요." });
      return;
    }

    if (!reason.trim()) {
      setToast({ tone: "warning", title: "정정 요청 실패", body: "정정 사유를 입력해 주세요." });
      return;
    }

    const request: AttendanceCorrectionRequest = {
      attendanceRecordId: correctionTarget.id,
      reason: reason.trim(),
      requestedCheckInAt: localInputToIso(requestedCheckInAt),
      requestedCheckOutAt: localInputToIso(requestedCheckOutAt),
      note: note.trim() || undefined,
    };

    setMutationState("submitting");
    setToast(null);

    try {
      const correction = await submitAttendanceCorrection(request);
      await reloadRecords();
      setReason("");
      setNote("");
      setToast({ tone: "accent", title: "정정 요청 완료", body: `${correction.attendanceRecordId} · ${correction.status}` });
      setMutationState("success");
    } catch (error) {
      setToast({ tone: "warning", title: "정정 요청 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
      setMutationState("error");
    }
  }

  function handleSelectCorrection(record: AttendanceRecord) {
    setSelectedRecordId(record.id);
    setRequestedCheckInAt(toLocalDateTimeInput(record.checkInAt));
    setRequestedCheckOutAt(toLocalDateTimeInput(record.checkOutAt));
  }

  return (
    <PageShell title="근태" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="근태 메뉴">
          <div className="feature-workspace__nav-header">
            <h1>
              <button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadRecords()} type="button">
                근태
              </button>
            </h1>
            <FeaturePageOverflowMenu label="근태" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="근태 상태 요약">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button">
              <span>오늘 근태</span>
              <strong>{todayRecord ? attendanceStatusLabels[todayRecord.status] : "미등록"}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" onClick={() => void reloadRecords()} role="tab" type="button">
              <span>내 기록</span>
              <strong>{records.length}건</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button">
              <span>정정 요청</span>
              <strong>{correctionTarget ? "선택" : "대기"}</strong>
            </button>
            <button aria-selected="false" className="feature-workspace__tab" onClick={() => void reloadRecords()} role="tab" type="button">
              <span>관리 확인</span>
              <strong>처리 완료 보기</strong>
            </button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="attendance-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="attendance-panel-heading">오늘 근태</h2>
            </div>
            <p className="feature-workspace__permission-hint">attendance.read 권한이 없으면 버튼 대신 차단 안내만 확인합니다.</p>
          </div>

          {toast ? (
            <article className="info-card">
              <Pill tone={toast.tone}>{toast.tone === "accent" ? "완료" : "확인"}</Pill>
              <h3>{toast.title}</h3>
              <p>{toast.body}</p>
            </article>
          ) : null}

          <div className="feature-workspace__status-grid">
            <article className={`feature-workspace__status feature-workspace__status--${todayRecord ? attendanceStatusTones[todayRecord.status] ?? "default" : "default"}`}>
              <span>오늘 상태</span>
              <strong>{todayRecord ? attendanceStatusLabels[todayRecord.status] : "미등록"}</strong>
              <p>{todayRecord ? getRecordTimeSummary(todayRecord) : "아직 등록된 근태 기록이 없습니다."}</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--accent">
              <span>퇴근 완료</span>
              <strong>{countByStatus(records, "checked_out")}건</strong>
              <p>이번 조회 기간 기준</p>
            </article>
            <article className="feature-workspace__status feature-workspace__status--warning">
              <span>정정 필요</span>
              <strong>{countByStatus(records, "needs_correction")}건</strong>
              <p>정정 요청으로 처리</p>
            </article>
          </div>

          <form className="feature-workspace__form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>등록 방식</span>
              <select aria-label="근태 등록 방식" onChange={(event) => setMethod(event.target.value as AttendanceRegistrationMethod)} value={method}>
                {Object.entries(attendanceMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={mutationState === "submitting"} onClick={() => void handleAttendanceAction(appRoutes.attendance.checkIn, "출근 등록 완료")} type="button">
                출근 등록
              </button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled={mutationState === "submitting"} onClick={() => void handleAttendanceAction(appRoutes.attendance.checkOut, "퇴근 등록 완료")} type="button">
                퇴근 등록
              </button>
              <button className="touch-button feature-workspace__action feature-workspace__action--secondary" disabled={loadState === "loading"} onClick={() => void reloadRecords()} type="button">
                기록 새로고침
              </button>
            </div>
          </form>

          <div className="feature-workspace__rows" aria-label="근태 기록 목록">
            {loadState === "loading" && records.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>불러오는 중</strong>
                  <span>근태 기록 조회</span>
                </div>
                <em>대기</em>
              </article>
            ) : records.length === 0 ? (
              <article className="feature-workspace__row">
                <div>
                  <strong>오전 출근</strong>
                  <span>출근 등록 후 목록에 표시됩니다.</span>
                  <div className="feature-workspace__row-actions" aria-label="비어 있는 근태 기록 처리">
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void reloadRecords()} type="button">
                      처리 완료 보기
                    </button>
                  </div>
                </div>
                <em>비어 있음</em>
              </article>
            ) : records.map((record) => (
              <AttendanceRecordRow key={record.id} record={record} onSelectCorrection={handleSelectCorrection} />
            ))}
          </div>

          <form className="feature-workspace__form" onSubmit={handleCorrectionSubmit}>
            <label>
              <span>정정 대상</span>
              <select aria-label="정정 대상 근태 기록" onChange={(event) => setSelectedRecordId(event.target.value)} value={correctionTarget?.id ?? ""}>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>{record.workDate} · {attendanceStatusLabels[record.status]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>출근 시각</span>
              <input aria-label="정정 출근 시각" onChange={(event) => setRequestedCheckInAt(event.target.value)} type="datetime-local" value={requestedCheckInAt} />
            </label>
            <label>
              <span>퇴근 시각</span>
              <input aria-label="정정 퇴근 시각" onChange={(event) => setRequestedCheckOutAt(event.target.value)} type="datetime-local" value={requestedCheckOutAt} />
            </label>
            <label>
              <span>사유</span>
              <textarea aria-label="정정 사유" onChange={(event) => setReason(event.target.value)} rows={4} value={reason} />
            </label>
            <label>
              <span>메모</span>
              <input aria-label="정정 메모" onChange={(event) => setNote(event.target.value)} value={note} />
            </label>
            <div className="feature-workspace__actions">
              <button className="touch-button feature-workspace__action feature-workspace__action--primary" disabled={mutationState === "submitting" || !correctionTarget} type="submit">
                정정 요청
              </button>
            </div>
          </form>
        </section>
      </div>
    </PageShell>
  );
}
