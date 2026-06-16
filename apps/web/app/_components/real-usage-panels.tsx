"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { appRoutes } from "@gw/shared";

import { Pill } from "./page-shell";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error: { code: string; message: string; details?: Record<string, unknown> | null } | null;
};

type SessionPayload = {
  session: {
    id: string;
    status: string;
    expiresAt: string;
    placeholder?: boolean;
  };
  user: {
    id: string;
    companyId: string;
    employeeId: string;
    email: string;
    fullName: string;
    roleCodes: string[];
    permissions: string[];
  };
};

type LoginRoleCode = "COMPANY_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE" | "AUDITOR";

type LoginAccountPreset = {
  username: string;
  displayLabel: string;
  roleCode: LoginRoleCode;
  email: string;
  nextRoute: string;
};

const loginAccountPresets: readonly LoginAccountPreset[] = [
  {
    username: "admin",
    displayLabel: "관리자 테스트",
    roleCode: "COMPANY_ADMIN",
    email: "admin@example.com",
    nextRoute: "/dashboard",
  },
  {
    username: "hr",
    displayLabel: "인사 담당자",
    roleCode: "HR_ADMIN",
    email: "staff@example.com",
    nextRoute: "/dashboard",
  },
  {
    username: "manager",
    displayLabel: "운영 매니저",
    roleCode: "MANAGER",
    email: "manager@example.com",
    nextRoute: "/dashboard",
  },
  {
    username: "employee",
    displayLabel: "일반 구성원",
    roleCode: "EMPLOYEE",
    email: "employee@example.com",
    nextRoute: "/dashboard",
  },
  {
    username: "auditor",
    displayLabel: "감사 전용 사용자",
    roleCode: "AUDITOR",
    email: "admin@example.com",
    nextRoute: "/dashboard",
  },
] as const;

const roleLandingLabels: Record<LoginRoleCode, string> = {
  COMPANY_ADMIN: "/dashboard → /management · /admin/users",
  HR_ADMIN: "/dashboard → /leave · /admin/users",
  MANAGER: "/dashboard → /attendance · /approvals",
  EMPLOYEE: "/dashboard → /attendance · /leave · /approvals",
  AUDITOR: "/dashboard → /admin/audit-logs",
};

function navigateTo(pathname: string) {
  if (typeof window !== "undefined") {
    window.location.assign(pathname);
  }
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function formatFileSize(value: number | null | undefined) {
  if (!value) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    const message = payload.error?.message ?? `요청 실패 (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function useApiQuery<T>(url: string, refreshSeed = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    fetchJson<T>(url)
      .then((payload) => {
        if (!active) {
          return;
        }
        setData(payload.data);
      })
      .catch((fetchError) => {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshSeed, url]);

  return { data, error, loading };
}

function QueryState({
  loading,
  error,
  emptyMessage,
}: {
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
}) {
  if (loading) {
    return <p className="card-note">실제 API 응답을 불러오는 중입니다.</p>;
  }

  if (error) {
    return <p className="card-note">{error}</p>;
  }

  if (emptyMessage) {
    return <p className="card-note">{emptyMessage}</p>;
  }

  return null;
}

function MutationResult({
  result,
}: {
  result: { tone: "accent" | "warning"; title: string; body: string } | null;
}) {
  if (!result) {
    return null;
  }

  return (
    <article className="info-card" style={{ marginTop: 16 }}>
      <Pill tone={result.tone}>{result.title}</Pill>
      <p style={{ marginBottom: 0 }}>{result.body}</p>
    </article>
  );
}

export function LoginRealUsagePanel() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("1234");
  const [roleCode, setRoleCode] = useState<LoginRoleCode>("COMPANY_ADMIN");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentPreset = useMemo(
    () => loginAccountPresets.find((item) => item.username === username) ?? loginAccountPresets[0],
    [username],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccessMessage(null);

    const preset = loginAccountPresets.find((item) => item.username === username && item.roleCode === roleCode) ?? currentPreset;

    try {
      const payload = await fetchJson<SessionPayload>(appRoutes.auth.login, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-role": roleCode,
        },
        body: JSON.stringify({
          loginId: "admin",
          email: preset.email,
          password,
        }),
      });

      setSuccessMessage(`${payload.data.user.fullName} (${payload.data.user.roleCodes.join(", ")}) 로그인 성공`);
      navigateTo(preset.nextRoute);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : String(loginError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid-auto-compact">
      <form className="info-card" onSubmit={handleSubmit}>
        <Pill tone="accent">실사용 테스트 로그인</Pill>
        <h3>admin / 1234 기본 계정</h3>
        <p className="card-note">입력값은 admin / 1234 기준으로 고정하고, 역할 차이만 dev-safe 세션 계약으로 바꿔 확인합니다.</p>
        <label className="form-placeholder" style={{ marginTop: 12 }}>
          <strong>테스트 사용자</strong>
          <select className="field" value={username} onChange={(event) => setUsername(event.target.value)}>
            {loginAccountPresets.map((preset) => (
              <option key={`${preset.username}-${preset.roleCode}`} value={preset.username}>
                {preset.username} · {preset.displayLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="form-placeholder" style={{ marginTop: 12 }}>
          <strong>비밀번호</strong>
          <input className="field" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="form-placeholder" style={{ marginTop: 12 }}>
          <strong>역할 시뮬레이션</strong>
          <select className="field" value={roleCode} onChange={(event) => setRoleCode(event.target.value as LoginRoleCode)}>
            {Object.keys(roleLandingLabels).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button className="touch-button" disabled={pending} style={{ marginTop: 16 }} type="submit">
          {pending ? "로그인 처리 중" : "로그인하고 흐름 시작"}
        </button>
        {error ? <p className="card-note">{error}</p> : null}
        {successMessage ? <p className="card-note">{successMessage}</p> : null}
      </form>

      <article className="info-card">
        <Pill>역할별 첫 이동</Pill>
        <h3>{roleLandingLabels[roleCode]}</h3>
        <p>{currentPreset.displayLabel} 기준으로 로그인 직후 확인하면 좋은 기본 경로입니다.</p>
        <p className="card-note">admin/1234 기본값으로 바로 테스트한 뒤, HR/팀장/감사 역할로 다시 들어가 화면 차이를 확인할 수 있습니다.</p>
      </article>
    </div>
  );
}

export function SessionSummaryPanel({ title = "현재 로그인 상태" }: { title?: string }) {
  const { data, error, loading } = useApiQuery<SessionPayload>("/api/session");

  return (
    <div className="grid-auto-compact">
      <article className="info-card">
        <Pill tone="accent">{title}</Pill>
        <QueryState loading={loading} error={error} emptyMessage={!data ? "로그인 전입니다." : undefined} />
        {data ? (
          <>
            <h3>{data.user.fullName}</h3>
            <p>{data.user.email}</p>
            <p className="card-note">역할: {data.user.roleCodes.join(", ")} · 세션 만료: {formatDateTime(data.session.expiresAt)}</p>
          </>
        ) : null}
      </article>
      <article className="info-card">
        <Pill>권한 요약</Pill>
        {data ? (
          <>
            <h3>{data.user.permissions.length}개 권한</h3>
            <p>{data.user.permissions.slice(0, 6).join(", ")}</p>
            <p className="card-note">같은 세션으로 /attendance, /leave, /approvals, /boards, /documents, /me 를 바로 눌러볼 수 있습니다.</p>
          </>
        ) : (
          <QueryState loading={loading} error={error} emptyMessage="로그인하면 역할과 권한이 여기에 표시됩니다." />
        )}
      </article>
    </div>
  );
}

export function AdminUsersLiveSection() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const { data, error, loading } = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.admin.users, refreshSeed);

  async function handleInviteCreate() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<{ email: string; roleCode: string; status: string; audit: { action: string } }>(appRoutes.admin.invites, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: "company_demo",
          email: "new.user@example.com",
          roleCode: "MANAGER",
          departmentId: "department_ops",
        }),
      });
      setResult({
        tone: "accent",
        title: "계정 초대 preview 생성",
        body: `${payload.data.email} · ${payload.data.roleCode} · ${payload.data.status} (${payload.data.audit.action})`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "계정 초대 preview 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">실사용 사용자 목록</Pill>
          <QueryState loading={loading} error={error} emptyMessage={!data ? "표시할 사용자가 없습니다." : undefined} />
          {data ? (
            <>
              <h3>{data.items.length}명</h3>
              <p className="card-note">관리자/HR/팀장/일반 구성원/감사 계정이 같은 회사 범위 안에서 나뉘어 보입니다.</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>계정 생성 관리</Pill>
          <h3>초대 preview</h3>
          <p>신규 사용자 계정 생성은 실제 메일 발송 대신 pending_delivery 상태로 검증합니다.</p>
          <button className="touch-button" disabled={pending} onClick={handleInviteCreate} style={{ marginTop: 12 }} type="button">
            {pending ? "초대 preview 생성 중" : "신규 매니저 초대 preview 생성"}
          </button>
        </article>
      </div>
      {data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {data.items.slice(0, 4).map((item) => (
            <article key={item.userId} className="route-card">
              <Pill tone={item.highRiskPermissions?.length ? "warning" : "accent"}>{item.roleCodes?.join(", ")}</Pill>
              <h3>{item.fullName}</h3>
              <p>{item.departmentName} · {item.employmentStatus}</p>
              <p className="card-note">다음 상태: {item.statusChangePreview?.nextStatus} · 고위험 권한 {item.highRiskPermissions?.length ?? 0}개</p>
            </article>
          ))}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function AttendanceLiveSection() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const { data, error, loading } = useApiQuery<{ items: Array<Record<string, any>>; policyContext: Record<string, any> }>(appRoutes.attendance.records, refreshSeed);

  async function runAction(url: string, title: string, body: Record<string, unknown>) {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const record = payload.data.record ?? payload.data.request;
      setResult({
        tone: "accent",
        title,
        body: `${record.status ?? "완료"} · ${record.workDate ?? record.attendanceRecordId ?? record.id ?? "-"}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: `${title} 실패`,
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">실제 근태 기록</Pill>
          <QueryState loading={loading} error={error} emptyMessage={!data ? "기록이 없습니다." : undefined} />
          {data ? (
            <>
              <h3>{data.items[0]?.status ?? "-"}</h3>
              <p>{data.policyContext.currentState}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>상태 변경 테스트</Pill>
          <div className="action-row" style={{ marginTop: 8 }}>
            <button className="touch-button" disabled={pending} onClick={() => runAction(appRoutes.attendance.checkIn, "출근 등록", { attendanceRegistrationMethod: "tag" })} type="button">
              태그 출근
            </button>
            <button className="touch-button--secondary" disabled={pending} onClick={() => runAction(appRoutes.attendance.checkOut, "퇴근 등록", { attendanceRegistrationMethod: "pc" })} type="button">
              PC 퇴근
            </button>
          </div>
          <button
            className="touch-button--secondary"
            disabled={pending}
            onClick={() =>
              runAction(appRoutes.attendance.corrections, "정정 요청", {
                attendanceRecordId: data?.items[0]?.id ?? "attendance_record_today",
                reason: "퇴근 시간이 누락되었습니다.",
                requestedCheckOutAt: "2026-06-10T18:10:00.000Z",
                note: "QR 체크아웃 누락",
              })
            }
            style={{ marginTop: 12 }}
            type="button"
          >
            정정 요청 preview
          </button>
        </article>
      </div>
      {data ? (
        <div className="mobile-record-list" style={{ marginTop: 16 }}>
          {data.items.map((item) => (
            <article key={item.id} className="record-card">
              <strong>{formatDate(item.workDate)}</strong>
              <span>{item.status}</span>
              <span>출근 {formatDateTime(item.checkInAt)} · 퇴근 {formatDateTime(item.checkOutAt)}</span>
            </article>
          ))}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function LeaveLiveSection() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const balances = useApiQuery<{ items: Array<Record<string, any>>; leavePolicySummary: Record<string, any> }>(appRoutes.leave.balances, refreshSeed);
  const requests = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.leave.requests, refreshSeed);

  async function runAction(url: string, title: string, body: Record<string, unknown>) {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const request = payload.data.request;
      setResult({
        tone: "accent",
        title,
        body: `${request.id} · ${request.approvalStatus ?? request.status}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: `${title} 실패`,
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">잔여/승인 현황</Pill>
          <QueryState loading={balances.loading || requests.loading} error={balances.error ?? requests.error} />
          {balances.data ? (
            <>
              <h3>{balances.data.items.length}개 휴가 유형</h3>
              <p className="card-note">허용 유형: {balances.data.leavePolicySummary.allowedLeaveTypeCodes?.join(", ")}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>상태 변경 테스트</Pill>
          <button
            className="touch-button"
            disabled={pending}
            onClick={() =>
              runAction(appRoutes.leave.requests, "휴가 신청", {
                leaveTypeId: "leave_type_annual",
                startDate: "2026-06-20",
                endDate: "2026-06-20",
                unit: "day",
                days: 1,
                reason: "가족 행사",
              })
            }
            type="button"
          >
            휴가 신청 preview
          </button>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              className="touch-button--secondary"
              disabled={pending}
              onClick={() => runAction(appRoutes.leave.approve("leave_request_team_pending"), "휴가 승인", { reason: "인수인계 계획 확인 완료" })}
              type="button"
            >
              팀 요청 승인
            </button>
            <button
              className="touch-button--secondary"
              disabled={pending}
              onClick={() => runAction(appRoutes.leave.reject("leave_request_team_pending"), "휴가 반려", { reason: "대체 근무자 확인 전 재조정 필요" })}
              type="button"
            >
              팀 요청 반려
            </button>
          </div>
        </article>
      </div>
      {requests.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {requests.data.items.map((item) => (
            <article key={item.id} className="info-card">
              <Pill tone={item.approvalStatus === "approved" ? "accent" : item.approvalStatus === "rejected" ? "warning" : "default"}>
                {item.approvalStatus}
              </Pill>
              <h3>{item.id}</h3>
              <p>{item.startDate} · {item.days}일 · {item.reason}</p>
            </article>
          ))}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function ApprovalsLiveSection() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const documents = useApiQuery<{ items: Array<Record<string, any>>; operationalContext: Record<string, any> }>(appRoutes.approvals.documents, refreshSeed);
  const inbox = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.approvals.inbox, refreshSeed);

  async function runAction(url: string, title: string, body: Record<string, unknown>) {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const document = payload.data.document;
      setResult({
        tone: "accent",
        title,
        body: `${document.id} · ${document.status}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: `${title} 실패`,
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">실제 결재함</Pill>
          <QueryState loading={documents.loading || inbox.loading} error={documents.error ?? inbox.error} />
          {documents.data ? (
            <>
              <h3>{documents.data.items.length}건</h3>
              <p>{documents.data.operationalContext.currentState}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>검토 / 확인 흐름</Pill>
          <button
            className="touch-button"
            disabled={pending}
            onClick={() =>
              runAction(appRoutes.approvals.documents, "결재 문서 기안", {
                formId: "approval_form_leave",
                title: "6월 연차 신청",
                summary: "6월 20일 연차 사용 placeholder",
                lineId: "approval_line_team_manager",
                referenceEmployeeIds: ["employee_staff"],
                agreementEmployeeIds: ["employee_admin"],
              })
            }
            type="button"
          >
            기안 preview 생성
          </button>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              className="touch-button--secondary"
              disabled={pending}
              onClick={() => runAction(appRoutes.approvals.approve("approval_document_team_pending"), "문서 승인", { reason: "예산 범위와 대체 장비 확인 완료" })}
              type="button"
            >
              팀 문서 승인
            </button>
            <button
              className="touch-button--secondary"
              disabled={pending}
              onClick={() => runAction(appRoutes.approvals.reject("approval_document_team_pending"), "문서 반려", { reason: "추가 증빙 확인 필요" })}
              type="button"
            >
              팀 문서 반려
            </button>
          </div>
        </article>
      </div>
      {documents.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {documents.data.items.map((item) => (
            <article key={item.id} className="info-card">
              <Pill>{item.status}</Pill>
              <h3>{item.title}</h3>
              <p>{item.documentNumber}</p>
              <p className="card-note">제출 {formatDateTime(item.submittedAt)}</p>
            </article>
          ))}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function BoardsLiveSection() {
  const notices = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.boards.notices);
  const boards = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.boards.boards);
  const posts = useApiQuery<{ board: Record<string, any>; items: Array<Record<string, any>> }>(appRoutes.boards.posts("board_general"));
  const firstPostId = posts.data?.items[0]?.id ?? "board_post_board_general_employee_employee";

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">실제 게시판 목록</Pill>
          <QueryState loading={notices.loading || boards.loading || posts.loading} error={notices.error ?? boards.error ?? posts.error} />
          {boards.data ? (
            <>
              <h3>공지 {notices.data?.items.length ?? 0}개 · 일반 {boards.data.items.length}개</h3>
              <p className="card-note">same-origin /api/notices, /api/boards, /api/boards/board_general/posts 응답을 직접 읽습니다.</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>지금 바로 눌러볼 순서</Pill>
          <ol className="number-list" style={{ marginTop: 12 }}>
            <li><a href="/boards/board_notice">공지 게시판에서 notice-only 책임 확인</a></li>
            <li><a href="/boards/board_general">일반 게시판에서 글쓰기/상세 흐름 시작</a></li>
            <li><a href={`/posts/${firstPostId}`}>최신 글 상세에서 댓글/읽음 확인</a></li>
          </ol>
        </article>
      </div>
      {boards.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {[...(notices.data?.items ?? []), ...boards.data.items].map((item) => (
            <article key={item.id} className="route-card">
              <Pill tone={item.isNoticeOnly ? "warning" : "accent"}>{item.boardType}</Pill>
              <h3>{item.name}</h3>
              <p>{item.visibility} · {item.isNoticeOnly ? "읽기 중심/운영 공지" : "글쓰기/댓글 허용"}</p>
              <a href={`/boards/${item.id}`}>이 게시판 흐름 보기 →</a>
            </article>
          ))}
        </div>
      ) : null}
      {posts.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>자유 게시판 최신 글</Pill>
          <h3>{posts.data.items[0]?.title ?? "게시글 없음"}</h3>
          <p>{posts.data.items[0]?.bodyPreview ?? "아직 생성된 일반 게시글이 없습니다."}</p>
          <p className="card-note">다음 단계: 상세로 들어가 댓글 작성 → 읽음 확인 → forged 차단 안내를 확인합니다.</p>
          <a href={`/posts/${firstPostId}`}>최신 글 상세로 이동 →</a>
        </article>
      ) : null}
    </>
  );
}

export function BoardDetailLiveSection({ boardId }: { boardId: string }) {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState(boardId === "board_notice" ? "전사 공지 preview" : "점심 메뉴 추천");
  const [bodyPreview, setBodyPreview] = useState(
    boardId === "board_notice" ? "오늘 공지 핵심만 짧게 전달합니다." : "오늘 뭐 드실래요? 댓글로 의견을 남겨 보세요.",
  );
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const posts = useApiQuery<{ board: Record<string, any>; items: Array<Record<string, any>> }>(appRoutes.boards.posts(boardId), refreshSeed);
  const samplePostId = posts.data?.items[0]?.id ?? `board_post_${boardId}_employee_employee`;

  async function handleCreatePost() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.boards.posts(boardId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          bodyPreview,
          isNotice: boardId === "board_notice",
        }),
      });
      setResult({
        tone: "accent",
        title: boardId === "board_notice" ? "공지 preview 생성" : "게시글 preview 생성",
        body: `${payload.data.post.id} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: boardId === "board_notice" ? "공지 preview 생성 실패" : "게시글 preview 생성 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleGuardProbe() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.boards.posts(boardId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "권한 점검용 작성 시도",
          bodyPreview: "현재 세션이 이 게시판에 쓸 수 있는지 확인합니다.",
          isNotice: false,
        }),
      });
      setResult({
        tone: "accent",
        title: "현재 세션 기준 작성 가능",
        body: `${payload.data.post.id} 생성 성공 — 일반 구성원 차단 확인이 필요하면 employee 역할로 다시 시도하세요.`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "현재 세션 기준 작성 차단 확인",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">현재 게시판 실응답</Pill>
          <QueryState loading={posts.loading} error={posts.error} emptyMessage={!posts.data ? "게시판 데이터를 불러오지 못했습니다." : undefined} />
          {posts.data ? (
            <>
              <h3>{posts.data.board.name}</h3>
              <p>{posts.data.board.visibility} · {posts.data.board.isNoticeOnly ? "notice-only" : "general"}</p>
              <p className="card-note">게시글 {posts.data.items.length}건 · 첫 상세 route <a href={`/posts/${samplePostId}`}>/posts/{samplePostId}</a></p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>{boardId === "board_notice" ? "운영 공지 작성" : "일반 게시글 작성"}</Pill>
          <label className="form-placeholder" style={{ marginTop: 12 }}>
            <strong>제목</strong>
            <input className="field" onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label className="form-placeholder" style={{ marginTop: 12 }}>
            <strong>본문 미리보기</strong>
            <input className="field" onChange={(event) => setBodyPreview(event.target.value)} value={bodyPreview} />
          </label>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button className="touch-button" disabled={pending} onClick={handleCreatePost} type="button">
              {pending ? "작성 처리 중" : boardId === "board_notice" ? "공지 preview 생성" : "게시글 preview 생성"}
            </button>
            <button className="touch-button--secondary" disabled={pending} onClick={handleGuardProbe} type="button">
              현재 세션 guard 확인
            </button>
          </div>
          <p className="card-note">공지형 게시판은 운영 공지 작성과 일반 구성원 차단을 분리해 봅니다.</p>
        </article>
      </div>
      {posts.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {posts.data.items.length ? (
            posts.data.items.slice(0, 4).map((item) => (
              <article key={item.id} className="info-card">
                <Pill tone={item.isNotice ? "warning" : "accent"}>{item.isNotice ? "notice" : item.status}</Pill>
                <h3>{item.title}</h3>
                <p>{item.bodyPreview}</p>
                <p className="card-note">게시글 상세 → 댓글 → 읽음 확인</p>
                <a href={`/posts/${item.id}`}>이 글 상세로 이동 →</a>
              </article>
            ))
          ) : (
            <article className="info-card">
              <Pill>빈 상태</Pill>
              <h3>아직 이 게시판에 생성된 글이 없습니다.</h3>
              <p>위 작성 폼으로 preview 글을 만든 뒤 상세 route 를 눌러 흐름을 이어가세요.</p>
            </article>
          )}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function PostDetailLiveSection({ postId }: { postId: string }) {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [commentBody, setCommentBody] = useState("오늘은 비빔밥이요.");
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const detail = useApiQuery<{ board: Record<string, any>; post: Record<string, any> }>(appRoutes.boards.postDetail(postId), refreshSeed);
  const comments = useApiQuery<{ post: Record<string, any>; items: Array<Record<string, any>> }>(appRoutes.boards.comments(postId), refreshSeed);

  async function handleAddComment() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.boards.comments(postId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      setResult({
        tone: "accent",
        title: "댓글 preview 생성",
        body: `${payload.data.comment.id} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "댓글 preview 생성 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleReadReceipt() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.readReceipts, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "post", targetId: postId }),
      });
      setResult({
        tone: "accent",
        title: "읽음 확인 등록",
        body: `${payload.data.receipt.id} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "읽음 확인 등록 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleForgedProbe() {
    setPending(true);
    setResult(null);
    try {
      await fetchJson<Record<string, any>>(appRoutes.boards.postDetail("board_post_board_general_forged"));
      setResult({
        tone: "warning",
        title: "forged 접근이 허용됨",
        body: "예상과 다릅니다. forged post 차단 규칙을 다시 확인해야 합니다.",
      });
    } catch (mutationError) {
      setResult({
        tone: "accent",
        title: "forged post 차단 확인",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">게시글 상세 실응답</Pill>
          <QueryState loading={detail.loading || comments.loading} error={detail.error ?? comments.error} emptyMessage={!detail.data ? "게시글 상세를 불러오지 못했습니다." : undefined} />
          {detail.data ? (
            <>
              <h3>{detail.data.post.title}</h3>
              <p>{detail.data.post.bodyPreview}</p>
              <p className="card-note">{detail.data.board.name} · {detail.data.post.status} · 공지 여부 {detail.data.post.isNotice ? "예" : "아니오"}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>댓글 / 읽음 확인 액션</Pill>
          <label className="form-placeholder" style={{ marginTop: 12 }}>
            <strong>댓글 본문</strong>
            <input className="field" onChange={(event) => setCommentBody(event.target.value)} value={commentBody} />
          </label>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button className="touch-button" disabled={pending} onClick={handleAddComment} type="button">
              댓글 preview 생성
            </button>
            <button className="touch-button--secondary" disabled={pending} onClick={handleReadReceipt} type="button">
              읽음 확인 등록
            </button>
          </div>
          <button className="touch-button--secondary" disabled={pending} onClick={handleForgedProbe} style={{ marginTop: 12 }} type="button">
            forged post 차단 확인
          </button>
        </article>
      </div>
      {comments.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {comments.data.items.length ? (
            comments.data.items.slice(0, 4).map((item) => (
              <article key={item.id} className="info-card">
                <Pill>{item.status}</Pill>
                <h3>{item.authorEmployeeId}</h3>
                <p>{item.body}</p>
                <p className="card-note">댓글 route: {appRoutes.boards.comments(postId)}</p>
              </article>
            ))
          ) : (
            <article className="info-card">
              <Pill>빈 상태</Pill>
              <h3>아직 댓글이 없습니다.</h3>
              <p>위 액션으로 첫 댓글을 만든 뒤 다시 목록을 확인하세요.</p>
            </article>
          )}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function DocumentsLiveSection() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const spaces = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.documents.spaces, refreshSeed);
  const files = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.documents.files, refreshSeed);
  const publicSpaceId = spaces.data?.items[0]?.id ?? "document_space_public";
  const firstFileId = files.data?.items[0]?.id;

  async function handleMetadataCreate() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.documents.fileMetadata, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId: publicSpaceId,
          fileName: "phase-32-preview.pdf",
          contentType: "application/pdf",
          fileSize: 64000,
          versionLabel: "draft-1",
          isPublicWithinCompany: true,
        }),
      });
      setResult({
        tone: "accent",
        title: "문서 metadata 생성",
        body: `${payload.data.file.id} · ${payload.data.file.storageProvider} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "문서 metadata 생성 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handlePrivateProbe() {
    setPending(true);
    setResult(null);
    try {
      await fetchJson<Record<string, any>>(`${appRoutes.documents.files}?spaceId=document_space_hr_private`);
      setResult({
        tone: "warning",
        title: "민감 문서함 접근 허용됨",
        body: "현재 세션이 민감 문서함 목록에 접근했습니다. employee 역할 차단도 다시 확인하세요.",
      });
    } catch (mutationError) {
      setResult({
        tone: "accent",
        title: "민감 문서함 차단 확인",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleMissingSpaceProbe() {
    setPending(true);
    setResult(null);
    try {
      await fetchJson<Record<string, any>>(appRoutes.documents.fileMetadata, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId: "document_space_missing",
          fileName: "missing-space.pdf",
          contentType: "application/pdf",
          fileSize: 32000,
          versionLabel: "draft-guard",
          isPublicWithinCompany: false,
        }),
      });
      setResult({
        tone: "warning",
        title: "없는 문서함 metadata 생성 허용됨",
        body: "예상과 다릅니다. spaceId 검증을 다시 확인해야 합니다.",
      });
    } catch (mutationError) {
      setResult({
        tone: "accent",
        title: "없는 문서함 차단 확인",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleFileReadReceipt() {
    if (!firstFileId) {
      setResult({ tone: "warning", title: "읽음 확인 대상 없음", body: "먼저 접근 가능한 파일 metadata 를 하나 이상 확인하세요." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.readReceipts, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "document_file", targetId: firstFileId }),
      });
      setResult({
        tone: "accent",
        title: "문서 읽음 확인 등록",
        body: `${payload.data.receipt.id} · ${payload.data.audit.action}`,
      });
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "문서 읽음 확인 등록 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">문서 공간</Pill>
          <QueryState loading={spaces.loading || files.loading} error={spaces.error ?? files.error} />
          {spaces.data ? (
            <>
              <h3>{spaces.data.items.length}개 공간</h3>
              <p>{spaces.data.items.map((item) => item.name).join(" · ")}</p>
              <p className="card-note">민감 공간은 현재 세션 권한에 따라 목록에서 숨겨지거나 403 으로 차단됩니다.</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>파일 metadata / 가드 확인</Pill>
          <div className="action-row" style={{ marginTop: 8 }}>
            <button className="touch-button" disabled={pending} onClick={handleMetadataCreate} type="button">
              metadata preview 생성
            </button>
            <button className="touch-button--secondary" disabled={pending} onClick={handleFileReadReceipt} type="button">
              문서 읽음 확인
            </button>
          </div>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button className="touch-button--secondary" disabled={pending} onClick={handlePrivateProbe} type="button">
              private space 차단 확인
            </button>
            <button className="touch-button--secondary" disabled={pending} onClick={handleMissingSpaceProbe} type="button">
              missing space 차단 확인
            </button>
          </div>
        </article>
      </div>
      {files.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {files.data.items.length ? (
            files.data.items.slice(0, 4).map((item) => (
              <article key={item.id} className="info-card">
                <Pill tone={item.isPublicWithinCompany ? "accent" : "warning"}>{item.storageStatus}</Pill>
                <h3>{item.fileName}</h3>
                <p>{formatFileSize(item.fileSize)} · {item.versionLabel}</p>
                <p className="card-note">storageProvider {item.storageProvider} · storageStatus 는 내부 lifecycle 이며 storageKey/public URL 직접 비노출</p>
              </article>
            ))
          ) : (
            <article className="info-card">
              <Pill>빈 상태</Pill>
              <h3>접근 가능한 파일 metadata 가 없습니다.</h3>
              <p>metadata preview 생성 버튼으로 문서함 상세 흐름을 바로 열 수 있습니다.</p>
            </article>
          )}
        </div>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function MeLiveSection() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, loading } = useApiQuery<SessionPayload>("/api/session");

  async function handleLogout() {
    setPending(true);
    setError(null);
    try {
      await fetchJson(appRoutes.auth.logout, { method: "POST" });
      navigateTo("/login");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : String(logoutError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid-auto-compact">
      <article className="info-card">
        <Pill tone="accent">실제 세션 요약</Pill>
        <QueryState loading={loading} error={error} emptyMessage={!data ? "로그인 세션이 없습니다." : undefined} />
        {data ? (
          <>
            <h3>{data.user.fullName}</h3>
            <p>{data.user.companyId} · {data.user.employeeId}</p>
            <p className="card-note">권한 {data.user.permissions.length}개 · 만료 {formatDateTime(data.session.expiresAt)}</p>
          </>
        ) : null}
      </article>
      <article className="info-card">
        <Pill>로그아웃</Pill>
        <p>실제 same-origin 로그아웃 API를 호출해 세션을 정리합니다.</p>
        <button className="touch-button--secondary" disabled={pending} onClick={handleLogout} type="button">
          {pending ? "로그아웃 중" : "로그아웃"}
        </button>
      </article>
    </div>
  );
}
