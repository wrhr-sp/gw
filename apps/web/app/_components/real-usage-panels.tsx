"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Editor } from "@tinymce/tinymce-react";
import {
  appRoutes,
  type AttendanceListRecordsResponse,
  type AttendanceRegistrationMethod,
  type LeaveBalanceListResponse,
  type LeaveRequest,
  type LeaveRequestListResponse,
  type LeaveTypeListResponse,
} from "@gw/shared";

import {
  attendanceRegistrationMethodLabels,
  employeeAttendanceEffectivePolicy,
  getAttendancePagePolicyView,
  leaveTypeCodeLabels,
} from "../../admin-skeleton-config";
import { getPostLoginRoute } from "../../dev-safe-auth";
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

type DocumentSpaceSummary = {
  id: string;
  name: string;
  visibility: "company" | "department" | "private";
  isPublicWithinCompany: boolean;
  status: "active" | "archived";
  ownerEmployeeId: string;
};

type DocumentFileSummary = {
  id: string;
  spaceId: string;
  ownerEmployeeId: string;
  versionId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  versionLabel: string;
  isPublicWithinCompany: boolean;
  storageProvider: "mock" | "r2";
  storageStatus: "pending" | "ready" | "deleted" | "failed";
  checksumSha256: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

type DocumentActionEnvelope = {
  file: DocumentFileSummary;
  action?: {
    kind: string;
    provider: "mock" | "r2";
    expiresAt: string;
    uploadToken?: string;
    downloadToken?: string;
    objectKeyPreview: string;
    message: string;
  };
  audit?: {
    action: string;
  };
};

type LoginRoleCode = "COMPANY_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE" | "AUDITOR";

type LoginAccountPreset = {
  username: string;
  displayLabel: string;
  roleCode: LoginRoleCode;
  email: string;
};

const loginAccountPresets: readonly LoginAccountPreset[] = [
  {
    username: "admin",
    displayLabel: "관리자 테스트",
    roleCode: "COMPANY_ADMIN",
    email: "admin@example.com",
  },
  {
    username: "hr",
    displayLabel: "인사 담당자",
    roleCode: "HR_ADMIN",
    email: "staff@example.com",
  },
  {
    username: "manager",
    displayLabel: "운영 매니저",
    roleCode: "MANAGER",
    email: "manager@example.com",
  },
  {
    username: "employee",
    displayLabel: "일반 구성원",
    roleCode: "EMPLOYEE",
    email: "employee@example.com",
  },
  {
    username: "auditor",
    displayLabel: "감사 전용 사용자",
    roleCode: "AUDITOR",
    email: "admin@example.com",
  },
] as const;

const roleLandingLabels: Record<LoginRoleCode, string> = {
  COMPANY_ADMIN: "/home → /management · /admin/users",
  HR_ADMIN: "/home → /admin/users",
  MANAGER: "/home → /management",
  EMPLOYEE: "/home → /attendance · /leave · /approvals",
  AUDITOR: "/admin/audit-logs",
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

function formatIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNoticePeriodRange(preset: NoticePeriodPreset, baseDate = new Date()) {
  const startDate = formatIsoDate(baseDate);
  if (preset === "indefinite") {
    return { startDate, endDate: "", rangeText: `${startDate} ~ 무기한` };
  }
  if (preset === "custom") {
    return { startDate: "", endDate: "", rangeText: "" };
  }

  const endDateValue = new Date(baseDate);
  endDateValue.setDate(baseDate.getDate() + Number(preset) - 1);
  const endDate = formatIsoDate(endDateValue);
  return { startDate, endDate, rangeText: `${startDate} ~ ${endDate}` };
}

function parseNoticePeriodRange(value: string) {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2}|무기한)$/);
  if (!match) {
    return null;
  }

  return {
    startDate: match[1],
    endDate: match[2] === "무기한" ? "" : match[2],
  };
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

function useApiQuery<T>(url: string | null, refreshSeed = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(Boolean(url));
    setError(null);

    if (!url) {
      setData(null);
      return () => {
        active = false;
      };
    }

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
    return <p className="card-note">loading 상태: 실제 API 응답을 불러오는 중입니다. 저장 성공이나 권한 차단으로 단정하지 말고 잠시 기다린 뒤 다시 확인합니다.</p>;
  }

  if (error) {
    const normalizedError = error.toLowerCase();
    if (normalizedError.includes("failed to fetch") || normalizedError.includes("network") || normalizedError.includes("fetch failed")) {
      return <p className="card-note">offline 또는 network error 상태: 네트워크가 불안정해 same-origin API 응답을 읽지 못했습니다. 가능한 일과 막히는 일을 먼저 확인한 뒤 다시 시도합니다. ({error})</p>;
    }

    return <p className="card-note">error 상태: 조회나 불러오기에 실패했습니다. 같은 작업을 성공처럼 넘기지 말고 복구 경로를 먼저 확인합니다. ({error})</p>;
  }

  if (emptyMessage) {
    return <p className="card-note">empty 상태: {emptyMessage}</p>;
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

function hasSessionPermission(session: SessionPayload | null, permission: string) {
  return session?.user.permissions.includes(permission) ?? false;
}

const attendanceLivePolicyView = getAttendancePagePolicyView(employeeAttendanceEffectivePolicy);
const attendanceLiveAllowedMethods = attendanceLivePolicyView.allowedMethods;
const attendancePrimaryMethod = attendanceLiveAllowedMethods[0] ?? "tag";

export function pickLeaveApprovalRequest(session: SessionPayload | null, requests: readonly LeaveRequest[] | null | undefined) {
  if (!session || !requests?.length) {
    return null;
  }

  return requests.find((request) => request.approvalStatus === "pending" && request.employeeId !== session.user.employeeId) ?? null;
}

export function canShowLeaveApprovalActions(
  session: SessionPayload | null,
  policySummary: LeaveBalanceListResponse["data"]["leavePolicySummary"] | LeaveRequestListResponse["data"]["leavePolicySummary"] | null | undefined,
  approvalRequest: LeaveRequest | null,
) {
  if (!session || !approvalRequest || !policySummary) {
    return false;
  }

  return hasSessionPermission(session, "leave.approve") && policySummary.approvalQueueVisibleToCurrentUser;
}

type ApprovalDetailLike = {
  document: {
    status?: string | null;
    drafterEmployeeId?: string | null;
  };
  steps: Array<{
    approverEmployeeId?: string | null;
    decisionStatus?: string | null;
  }>;
};

export function canReviewApprovalDocument(session: SessionPayload | null, detail: ApprovalDetailLike | null) {
  if (!session || !detail) {
    return false;
  }

  if (!hasSessionPermission(session, "approval.document.approve")) {
    return false;
  }

  if (detail.document.status !== "pending_approval") {
    return false;
  }

  if (detail.document.drafterEmployeeId === session.user.employeeId) {
    return false;
  }

  const currentPendingStep = detail.steps.find((step) => step.decisionStatus === "pending");
  return currentPendingStep?.approverEmployeeId === session.user.employeeId;
}

function formatBoardWriterGuide(boardId: string, session: SessionPayload | null) {
  const canWriteGeneral = hasSessionPermission(session, "board.post.write");
  const canManageBoard = hasSessionPermission(session, "board.manage");

  if (boardId === "board_notice" || boardId === "board_department_notice") {
    return canManageBoard
      ? "현재 세션은 공지 등록이 가능합니다. 등록 버튼으로 새 공지를 작성할 수 있습니다."
      : "공지 등록은 운영 권한이 있어야 가능하고, 일반 구성원은 읽기와 확인 중심입니다.";
  }

  return canWriteGeneral ? "현재 세션은 등록 버튼으로 게시글을 작성할 수 있습니다." : "글쓰기 권한이 없으면 목록/상세 읽기만 가능합니다.";
}

function getDefaultBoardPostId(boardId: string) {
  if (boardId === "board_notice") {
    return "board_post_notice_1";
  }

  if (boardId === "board_department_notice") {
    return "board_post_department_notice_1";
  }

  if (boardId === "board_general") {
    return "board_post_demo";
  }

  if (boardId === "board_data_share") {
    return "board_post_data_share_1";
  }

  return "board_post_demo";
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
      navigateTo(getPostLoginRoute(roleCode));
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
        <p>{currentPreset.displayLabel} 기준으로 로그인 직후 실제로 이어지는 기본 경로를 보여 줍니다.</p>
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
  const { data, error, loading } = useApiQuery<AttendanceListRecordsResponse["data"]>(appRoutes.attendance.records, refreshSeed);
  const session = useApiQuery<SessionPayload>("/api/session", refreshSeed);
  const canUseAttendance = hasSessionPermission(session.data ?? null, "attendance.read");
  const correctionTargetId = data?.items[0]?.id ?? null;
  const correctionBlocked = !correctionTargetId || pending || !canUseAttendance;
  const attendanceActionLabel = attendanceRegistrationMethodLabels[attendancePrimaryMethod as AttendanceRegistrationMethod];

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
          <QueryState loading={loading} error={error} emptyMessage={!data ? "오늘 근태 기록이 아직 없습니다. 로그인 후 출근 등록부터 시작하세요." : undefined} />
          {data ? (
            <>
              <h3>{data.items[0]?.status ?? "-"}</h3>
              <p>{data.policyContext.currentState}</p>
              <p className="card-note">
                {session.data
                  ? `${session.data.user.fullName} · ${session.data.user.roleCodes.join(", ")} 세션으로 본인 기록을 확인합니다.`
                  : "로그인 전이면 /login 에서 admin / 1234 로 먼저 시작하세요."}
              </p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>직원 실행 레인</Pill>
          <h3>{attendanceActionLabel} 기준 출근 → 상태 확인 → 퇴근</h3>
          <p className="card-note">승인자 검토와 운영 정책 확인은 이 카드에서 섞지 않고, 직원이 직접 해보는 순서만 남깁니다.</p>
          <div className="action-row" style={{ marginTop: 8 }}>
            <button
              className="touch-button"
              disabled={pending || !canUseAttendance}
              onClick={() => runAction(appRoutes.attendance.checkIn, `${attendanceActionLabel} 출근 등록`, { attendanceRegistrationMethod: attendancePrimaryMethod })}
              type="button"
            >
              {attendanceActionLabel} 출근 등록
            </button>
            <button
              className="touch-button--secondary"
              disabled={pending || !canUseAttendance}
              onClick={() => runAction(appRoutes.attendance.checkOut, `${attendanceActionLabel} 퇴근 등록`, { attendanceRegistrationMethod: attendancePrimaryMethod })}
              type="button"
            >
              {attendanceActionLabel} 퇴근 등록
            </button>
          </div>
          <button
            className="touch-button--secondary"
            disabled={correctionBlocked}
            onClick={() =>
              runAction(appRoutes.attendance.corrections, "정정 요청", {
                attendanceRecordId: correctionTargetId,
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
          <p className="card-note" style={{ marginTop: 12 }}>
            {!canUseAttendance
              ? "attendance.read 권한이 없으면 버튼 대신 차단 안내만 확인합니다."
              : correctionTargetId
                ? "정정 요청은 방금 조회한 본인 기록에만 연결합니다. 다른 직원 기록이나 forged id 는 성공처럼 처리하지 않습니다."
                : "먼저 오늘 기록을 조회하거나 출근/퇴근 등록을 한 뒤 정정 요청을 이어가세요."}
          </p>
        </article>
        <article className="info-card">
          <Pill>승인자 / 운영자 분리</Pill>
          <h3>직원 화면은 오늘 기록과 예외 요청까지만</h3>
          <p>예외 검토와 정책 source 비교는 승인자/운영자 레인에서 확인합니다.</p>
          <ul className="summary-list" style={{ marginTop: 12 }}>
            <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a> — 본인 최근 기록과 현재 상태</li>
            <li><a href={appRoutes.attendance.corrections}>{appRoutes.attendance.corrections}</a> — 본인 정정 요청 생성 preview</li>
            <li><a href="/admin/policies">/admin/policies</a> — 허용 방식과 운영 기준 source 비교</li>
          </ul>
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
  const session = useApiQuery<SessionPayload>("/api/session", refreshSeed);
  const types = useApiQuery<LeaveTypeListResponse["data"]>(appRoutes.leave.types, refreshSeed);
  const balances = useApiQuery<LeaveBalanceListResponse["data"]>(appRoutes.leave.balances, refreshSeed);
  const requests = useApiQuery<LeaveRequestListResponse["data"]>(appRoutes.leave.requests, refreshSeed);
  const canRequestLeave = hasSessionPermission(session.data ?? null, "leave.request");
  const approvalRequest = pickLeaveApprovalRequest(session.data ?? null, requests.data?.items);
  const showApprovalActions = canShowLeaveApprovalActions(session.data ?? null, requests.data?.leavePolicySummary ?? balances.data?.leavePolicySummary, approvalRequest);
  const selectedLeaveType = types.data?.items.find((item) => item.code === balances.data?.leavePolicySummary.allowedLeaveTypeCodes[0]) ?? types.data?.items[0] ?? null;

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
          <QueryState loading={types.loading || balances.loading || requests.loading} error={types.error ?? balances.error ?? requests.error} />
          {balances.data ? (
            <>
              <h3>{balances.data.items.length}개 휴가 유형</h3>
              <p className="card-note">
                허용 유형: {balances.data.leavePolicySummary.allowedLeaveTypeCodes.map((code) => leaveTypeCodeLabels[code as keyof typeof leaveTypeCodeLabels] ?? code).join(", ")}
              </p>
              <p className="card-note">
                {session.data
                  ? `${session.data.user.fullName} · ${session.data.user.roleCodes.join(", ")} 세션으로 내 잔여와 요청 상태를 읽고 있습니다.`
                  : "로그인 전이면 /login 에서 admin / 1234 로 먼저 시작하세요."}
              </p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>신청자 실행 레인</Pill>
          <h3>잔여 확인 → 신청 → 내 상태 확인</h3>
          <p className="card-note">일반 직원은 승인 버튼 대신 본인 신청과 잔여 snapshot 을 중심으로 확인합니다.</p>
          <button
            className="touch-button"
            disabled={pending || !canRequestLeave || !selectedLeaveType}
            onClick={() =>
              runAction(appRoutes.leave.requests, "휴가 신청", {
                leaveTypeId: selectedLeaveType?.id,
                startDate: "2026-06-20",
                endDate: "2026-06-20",
                unit: selectedLeaveType?.unit ?? "day",
                days: 1,
                reason: "가족 행사",
              })
            }
            type="button"
          >
            휴가 신청 preview
          </button>
          <p className="card-note" style={{ marginTop: 12 }}>
            {!canRequestLeave
              ? "leave.request 권한이 없으면 신청 버튼 대신 차단 안내만 확인합니다."
              : selectedLeaveType
                ? `${selectedLeaveType.name} 유형으로 dev-safe 신청 preview 를 생성합니다. 실차감/급여 반영은 이번 단계 범위 밖입니다.`
                : "허용된 휴가 유형을 먼저 불러온 뒤 신청 흐름을 시작하세요."}
          </p>
        </article>
        <article className="info-card">
          <Pill>승인자 레인</Pill>
          <h3>{showApprovalActions ? `승인 대기 ${approvalRequest?.id}` : "승인 버튼은 승인 권한자에게만 노출"}</h3>
          <p className="card-note">
            {showApprovalActions
              ? "승인/반려는 현재 세션이 승인 권한을 갖고, 자기 요청이 아닌 pending 요청이 있을 때만 실행합니다."
              : session.data
                ? "일반 직원 세션에서는 승인 대기열을 설명만 하고 버튼은 열지 않습니다. self-approval 과 forged/unknown id 도 같은 원칙으로 차단합니다."
                : "로그인 후 팀장/인사 승인자 세션으로 다시 열면 승인 대기 레인을 확인할 수 있습니다."}
          </p>
          {showApprovalActions && approvalRequest ? (
            <div className="action-row" style={{ marginTop: 12 }}>
              <button
                className="touch-button--secondary"
                disabled={pending}
                onClick={() => runAction(appRoutes.leave.approve(approvalRequest.id), "휴가 승인", { reason: "인수인계 계획 확인 완료" })}
                type="button"
              >
                팀 요청 승인
              </button>
              <button
                className="touch-button--secondary"
                disabled={pending}
                onClick={() => runAction(appRoutes.leave.reject(approvalRequest.id), "휴가 반려", { reason: "대체 근무자 확인 전 재조정 필요" })}
                type="button"
              >
                팀 요청 반려
              </button>
            </div>
          ) : null}
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
  const [title, setTitle] = useState("6월 연차 신청");
  const [summary, setSummary] = useState("6월 20일 연차 사용 placeholder");
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const documents = useApiQuery<{ items: Array<Record<string, any>>; operationalContext: Record<string, any> }>(appRoutes.approvals.documents, refreshSeed);
  const inbox = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.approvals.inbox, refreshSeed);
  const forms = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.approvals.forms, refreshSeed);
  const lines = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.approvals.lines, refreshSeed);
  const session = useApiQuery<SessionPayload>("/api/session", refreshSeed);
  const firstDocumentId = documents.data?.items[0]?.id ?? "approval_document_demo";
  const firstInboxId = inbox.data?.items[0]?.id ?? "approval_document_team_pending";
  const selectedFormId = forms.data?.items[0]?.id ?? "approval_form_leave";
  const selectedLineId = lines.data?.items[0]?.id ?? "approval_line_team_manager";

  async function runAction(url: string, actionTitle: string, body: Record<string, unknown>) {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const document = payload.data.document ?? payload.data.comment;
      setResult({
        tone: "accent",
        title: actionTitle,
        body: `${document.id}${document.status ? ` · ${document.status}` : ""}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: `${actionTitle} 실패`,
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
          <QueryState loading={documents.loading || inbox.loading || forms.loading || lines.loading} error={documents.error ?? inbox.error ?? forms.error ?? lines.error} />
          {documents.data ? (
            <>
              <h3>내 문서 {documents.data.items.length}건 · 승인함 {inbox.data?.items.length ?? 0}건</h3>
              <p>{documents.data.operationalContext.currentState}</p>
              <p className="card-note">
                {session.data
                  ? `${session.data.user.fullName} · ${session.data.user.roleCodes.join(", ")} 세션으로 조회 중입니다.`
                  : "로그인 전이면 /login 에서 admin / 1234 로 먼저 시작하세요."}
              </p>
              <p className="card-note">상세 route 시작점: <a href={`/approvals/${firstDocumentId}`}>/approvals/{firstDocumentId}</a></p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>기안 / 승인 / 반려</Pill>
          <label className="form-placeholder" style={{ marginTop: 12 }}>
            <strong>제목</strong>
            <input className="field" onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label className="form-placeholder" style={{ marginTop: 12 }}>
            <strong>요약</strong>
            <textarea className="field" onChange={(event) => setSummary(event.target.value)} rows={3} value={summary} />
          </label>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              className="touch-button"
              disabled={pending}
              onClick={() =>
                runAction(appRoutes.approvals.documents, "결재 문서 기안", {
                  formId: selectedFormId,
                  title,
                  summary,
                  lineId: selectedLineId,
                  referenceEmployeeIds: ["employee_staff"],
                  agreementEmployeeIds: ["employee_admin"],
                })
              }
              type="button"
            >
              기안 preview 생성
            </button>
            <button
              className="touch-button--secondary"
              disabled={pending}
              onClick={() => runAction(appRoutes.approvals.approve(firstInboxId), "문서 승인", { reason: "예산 범위와 대체 장비 확인 완료" })}
              type="button"
            >
              승인함 첫 문서 승인
            </button>
            <button
              className="touch-button--secondary"
              disabled={pending}
              onClick={() => runAction(appRoutes.approvals.reject(firstInboxId), "문서 반려", { reason: "추가 증빙 확인 필요" })}
              type="button"
            >
              승인함 첫 문서 반려
            </button>
          </div>
          <p className="card-note" style={{ marginTop: 12 }}>기안은 forms/lines API 응답의 첫 항목을 기본값으로 사용하고, 승인/반려는 현재 승인함 첫 문서를 대상으로 합니다.</p>
        </article>
      </div>
      {documents.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {documents.data.items.map((item) => (
            <article key={item.id} className="route-card">
              <Pill tone={item.status === "approved" ? "accent" : item.status === "rejected" ? "warning" : "default"}>{item.status}</Pill>
              <h3>{item.title}</h3>
              <p>{item.documentNumber}</p>
              <p className="card-note">제출 {formatDateTime(item.submittedAt)}</p>
              <a href={`/approvals/${item.id}`}>상세에서 승인선 / 의견 / 이력 보기 →</a>
            </article>
          ))}
        </div>
      ) : null}
      {inbox.data?.items.length ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>지금 승인 가능한 문서</Pill>
          <h3>{inbox.data.items[0]?.title}</h3>
          <p>{inbox.data.items[0]?.summary}</p>
          <a href={`/approvals/${firstInboxId}`}>승인함 첫 문서 상세 열기 →</a>
        </article>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

export function ApprovalDocumentDetailLiveSection({ documentId }: { documentId: string }) {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [commentBody, setCommentBody] = useState("증빙과 사유를 확인했습니다.");
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const detail = useApiQuery<{
    document: Record<string, any>;
    steps: Array<Record<string, any>>;
    references: Array<Record<string, any>>;
    comments: Array<Record<string, any>>;
    history: Array<Record<string, any>>;
    operationalContext: Record<string, any>;
  }>(appRoutes.approvals.detail(documentId), refreshSeed);
  const comments = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.approvals.comments(documentId), refreshSeed);
  const session = useApiQuery<SessionPayload>("/api/session", refreshSeed);
  const canReview = canReviewApprovalDocument(session.data ?? null, detail.data ?? null);

  async function handleAction(url: string, title: string, body: Record<string, unknown>) {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const primary = payload.data.document ?? payload.data.comment;
      setResult({ tone: "accent", title, body: `${primary.id}${primary.status ? ` · ${primary.status}` : ""}` });
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
          <Pill tone="accent">문서 상세 실응답</Pill>
          <QueryState loading={detail.loading || comments.loading} error={detail.error ?? comments.error} />
          {detail.data ? (
            <>
              <h3>{detail.data.document.title}</h3>
              <p>{detail.data.document.documentNumber} · {detail.data.document.status}</p>
              <p className="card-note">{detail.data.operationalContext.currentState}</p>
            </>
          ) : null}
        </article>
        <article className="info-card">
          <Pill>상세에서 바로 실행</Pill>
          <label className="form-placeholder" style={{ marginTop: 12 }}>
            <strong>의견 / 댓글</strong>
            <textarea className="field" onChange={(event) => setCommentBody(event.target.value)} rows={3} value={commentBody} />
          </label>
          <p className="card-note" style={{ marginTop: 12 }}>
            승인/반려 버튼은 approval.document.approve 권한이 있으면서 현재 승인 단계 담당자인 세션에서만 보입니다.
          </p>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button className="touch-button" disabled={pending} onClick={() => handleAction(appRoutes.approvals.comments(documentId), "의견 등록", { body: commentBody })} type="button">
              의견 남기기
            </button>
            {canReview ? (
              <>
                <button className="touch-button--secondary" disabled={pending} onClick={() => handleAction(appRoutes.approvals.approve(documentId), "문서 승인", { reason: "상세 화면에서 승인 처리" })} type="button">
                  승인
                </button>
                <button className="touch-button--secondary" disabled={pending} onClick={() => handleAction(appRoutes.approvals.reject(documentId), "문서 반려", { reason: "상세 화면에서 보완 요청" })} type="button">
                  반려
                </button>
              </>
            ) : null}
          </div>
        </article>
      </div>
      {detail.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          <article className="info-card">
            <Pill>승인선</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              {detail.data.steps.map((step) => (
                <li key={step.id}>{step.stepOrder}차 · {step.approverEmployeeId} · {step.decisionStatus}{step.decisionComment ? ` · ${step.decisionComment}` : ""}</li>
              ))}
            </ul>
          </article>
          <article className="info-card">
            <Pill>참조 / 합의</Pill>
            <ul className="summary-list" style={{ marginTop: 12 }}>
              {detail.data.references.map((reference) => (
                <li key={reference.id}>{reference.referenceType} · {reference.employeeId}{reference.readAt ? ` · 읽음 ${formatDateTime(reference.readAt)}` : " · 미열람"}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
      {comments.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>의견 / 댓글</Pill>
          <ul className="summary-list" style={{ marginTop: 12 }}>
            {comments.data.items.map((comment) => (
              <li key={comment.id}>{comment.authorEmployeeId} · {comment.body}</li>
            ))}
          </ul>
        </article>
      ) : null}
      {detail.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill>상태 이력</Pill>
          <ol className="number-list" style={{ marginTop: 12 }}>
            {detail.data.history.map((item) => (
              <li key={item.id}>{item.eventType} · {item.actorEmployeeId ?? "system"} · {item.message}</li>
            ))}
          </ol>
        </article>
      ) : null}
      <MutationResult result={result} />
    </>
  );
}

type BoardInlineNavigationProps = {
  onOpenBoard?: (boardId: string) => void;
  onOpenPost?: (postId: string, boardId?: string) => void;
};

type BoardFeedScope = "all" | "company" | "department";

type BoardFeedItem = {
  board: Record<string, any>;
  post: Record<string, any>;
};

type BoardFeedTab = "all" | "favorites";

function isDepartmentBoard(board: Record<string, any>) {
  return board.visibility === "department" || board.boardType === "department";
}

function filterBoardsByFeedScope(boards: Array<Record<string, any>>, scope: BoardFeedScope) {
  if (scope === "department") {
    return boards.filter((board) => isDepartmentBoard(board));
  }
  if (scope === "company") {
    return boards.filter((board) => !isDepartmentBoard(board));
  }

  return boards;
}

function getBoardFeedCopy(scope: BoardFeedScope) {
  if (scope === "company") {
    return {
      empty: "현재 권한으로 볼 수 있는 전사게시판 글이 없습니다.",
    };
  }
  if (scope === "department") {
    return {
      empty: "현재 권한으로 볼 수 있는 부서게시판 글이 없습니다.",
    };
  }

  return {
    empty: "현재 권한으로 볼 수 있는 게시글이 없습니다.",
  };
}

function isFavoriteBoardPost(post: Record<string, any>) {
  return post.isFavorite === true || post.favorite === true || post.bookmarked === true;
}

function formatBoardPostDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getBoardAuthorProfile(post: Record<string, any>, employees: Array<Record<string, any>>, summaries: Array<Record<string, any>>) {
  const authorEmployeeId = String(post.authorEmployeeId ?? "");
  const employee = employees.find((item) => String(item.id) === authorEmployeeId);
  const summary = summaries.find((item) => String(item.employeeId) === authorEmployeeId);
  const name = employee?.fullName ? String(employee.fullName) : authorEmployeeId || "작성자";
  const position = summary?.roleSummary ? String(summary.roleSummary) : "구성원";
  const initials = name.trim().slice(0, 1) || "작";

  return { name, position, initials };
}

function useBoardFeedItems(boards: Array<Record<string, any>>, scope: BoardFeedScope) {
  const [items, setItems] = useState<BoardFeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const boardIdsKey = boards.map((board) => String(board.id)).join("|");

  useEffect(() => {
    let active = true;
    const scopedBoards = filterBoardsByFeedScope(boards, scope);

    setError(null);
    setItems([]);
    if (!scopedBoards.length) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    Promise.all(
      scopedBoards.map(async (board) => {
        const payload = await fetchJson<{ board: Record<string, any>; items: Array<Record<string, any>> }>(appRoutes.boards.posts(String(board.id)));
        return (payload.data.items ?? []).map((post) => ({ board: payload.data.board ?? board, post }));
      }),
    )
      .then((groups) => {
        if (!active) {
          return;
        }
        const nextItems = groups.flat().sort((left, right) => String(right.post.publishedAt ?? right.post.createdAt ?? "").localeCompare(String(left.post.publishedAt ?? left.post.createdAt ?? "")));
        setItems(nextItems);
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
  }, [boardIdsKey, boards, scope]);

  return { items, error, loading };
}

function InlineNavigationLink({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button className="inline-navigation-button" onClick={onClick} type="button">
        {children}
      </button>
    );
  }

  return <a href={href}>{children}</a>;
}

export function BoardsLiveSection({ onOpenPost, scope = "all" }: BoardInlineNavigationProps & { scope?: BoardFeedScope } = {}) {
  const [activeTab, setActiveTab] = useState<BoardFeedTab>("all");
  const notices = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.boards.notices);
  const boards = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.boards.boards);
  const employees = useApiQuery<{ items: Array<Record<string, any>>; summaries?: Array<Record<string, any>> }>(appRoutes.org.employees);
  const accessibleBoards = useMemo(() => [...(notices.data?.items ?? []), ...(boards.data?.items ?? [])], [boards.data?.items, notices.data?.items]);
  const feed = useBoardFeedItems(accessibleBoards, scope);
  const feedCopy = getBoardFeedCopy(scope);
  const visibleItems = activeTab === "favorites" ? feed.items.filter(({ post }) => isFavoriteBoardPost(post)) : feed.items;
  const loading = notices.loading || boards.loading || employees.loading || feed.loading;
  const error = notices.error ?? boards.error ?? employees.error ?? feed.error ?? null;
  const emptyMessage = activeTab === "favorites" ? "즐겨찾기한 게시글이 없습니다." : feedCopy.empty;

  return (
    <article className="board-home-feed">
      <div className="board-home-tabs" role="tablist" aria-label="게시판 홈 필터">
        <button aria-selected={activeTab === "all"} onClick={() => setActiveTab("all")} role="tab" type="button">전체</button>
        <button aria-selected={activeTab === "favorites"} onClick={() => setActiveTab("favorites")} role="tab" type="button">즐겨찾기</button>
      </div>
      <QueryState loading={loading} error={error} emptyMessage={!visibleItems.length ? emptyMessage : undefined} />
      {visibleItems.length ? (
        <div className="board-post-list">
          {visibleItems.map(({ board, post }) => {
            const author = getBoardAuthorProfile(post, employees.data?.items ?? [], employees.data?.summaries ?? []);
            const publishedAt = formatBoardPostDate(post.publishedAt ?? post.createdAt);

            return (
              <button
                key={`${board.id}-${post.id}`}
                className="board-post-row board-post-row--feed"
                onClick={() => onOpenPost?.(String(post.id), String(board.id))}
                type="button"
              >
                <strong className="board-post-row__title">{post.title}</strong>
                <p className="board-post-row__preview">{post.bodyPreview}</p>
                <span className="board-post-row__meta">
                  <span className="board-post-row__avatar" aria-hidden="true">{author.initials}</span>
                  <span>{author.name}{author.position ? ` ${author.position}` : ""}</span>
                  {publishedAt ? <span>{publishedAt}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
function stripHtmlToPreview(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

type BoardWriteSettings = {
  prefixOptions?: string[];
  accessScopes?: Array<{ id: string; label: string }>;
};

type NoticePeriodPreset = "1" | "3" | "5" | "7" | "15" | "30" | "indefinite" | "custom";

const noticePeriodOptions: Array<{ value: NoticePeriodPreset; label: string }> = [
  { value: "1", label: "1일" },
  { value: "3", label: "3일" },
  { value: "5", label: "5일" },
  { value: "7", label: "7일" },
  { value: "15", label: "15일" },
  { value: "30", label: "30일" },
  { value: "indefinite", label: "무기한등록" },
  { value: "custom", label: "직접설정" },
];

type BoardCategory = "" | "company" | "department";

function readBoardWriteSettings(board: Record<string, any> | null | undefined): BoardWriteSettings {
  const settings = board?.writeSettings ?? board?.settings ?? {};
  return {
    prefixOptions: Array.isArray(settings.prefixOptions) ? settings.prefixOptions.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0) : [],
    accessScopes: Array.isArray(settings.accessScopes)
      ? settings.accessScopes.filter((item: unknown): item is { id: string; label: string } => {
        return Boolean(item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && typeof (item as { label?: unknown }).label === "string");
      })
      : [],
  };
}

function getBoardCategory(board: Record<string, any> | null | undefined): Exclude<BoardCategory, ""> {
  return board?.visibility === "department" || board?.boardType === "department" ? "department" : "company";
}

// 게시판 본문 글꼴은 한글 후보를 먼저, 영문 후보를 나중에 나열한다.
// 시스템 글꼴은 파일을 번들링하지 않고 family name만 참조해 라이선스 재배포 위험을 피한다.
const boardTinymceFontFamilyFormats = [
  "기본 글꼴=Pretendard Variable,Pretendard,'Malgun Gothic','맑은 고딕',sans-serif",
  "프리텐다드=Pretendard Variable,Pretendard,sans-serif",
  "본고딕=Noto Sans KR,Noto Sans CJK KR,Source Han Sans KR,sans-serif",
  "Source Han Sans KR=Source Han Sans KR,Noto Sans CJK KR,Noto Sans KR,sans-serif",
  "수트=SUIT,sans-serif",
  "스포카 한 산스=Spoqa Han Sans Neo,Spoqa Han Sans,sans-serif",
  "나눔고딕=Nanum Gothic,NanumGothic,sans-serif",
  "나눔스퀘어=NanumSquare,Nanum Square,sans-serif",
  "맑은 고딕='Malgun Gothic','맑은 고딕',sans-serif",
  "맑은 고딕 Light='Malgun Gothic Semilight','맑은 고딕 Semilight','Malgun Gothic','맑은 고딕',sans-serif",
  "돋움=Dotum,'돋움',sans-serif",
  "돋움체=DotumChe,'돋움체',monospace",
  "굴림=Gulim,'굴림',sans-serif",
  "굴림체=GulimChe,'굴림체',monospace",
  "바탕=Batang,'바탕',serif",
  "바탕체=BatangChe,'바탕체',monospace",
  "궁서=Gungsuh,'궁서',serif",
  "궁서체=GungsuhChe,'궁서체',monospace",
  "Arial=Arial,Helvetica,sans-serif",
  "Arial Black=Arial Black,Arial,sans-serif",
  "Calibri=Calibri,Arial,sans-serif",
  "Cambria=Cambria,Georgia,serif",
  "Georgia=Georgia,serif",
  "Times New Roman=Times New Roman,Times,serif",
  "Verdana=Verdana,Geneva,sans-serif",
  "Tahoma=Tahoma,Geneva,sans-serif",
  "Trebuchet MS=Trebuchet MS,Helvetica,sans-serif",
  "Courier New=Courier New,Courier,monospace",
  "Lucida Console=Lucida Console,Monaco,monospace",
  "Inter=Inter,Arial,sans-serif",
  "Roboto=Roboto,Arial,sans-serif",
  "Open Sans=Open Sans,Arial,sans-serif",
  "Lato=Lato,Arial,sans-serif",
  "Montserrat=Montserrat,Arial,sans-serif",
  "Merriweather=Merriweather,Georgia,serif",
  "Source Sans 3=Source Sans 3,Source Sans Pro,Arial,sans-serif",
  "Source Serif 4=Source Serif 4,Source Serif Pro,Georgia,serif",
  "IBM Plex Sans=IBM Plex Sans,Arial,sans-serif",
  "IBM Plex Serif=IBM Plex Serif,Georgia,serif",
  "Fira Sans=Fira Sans,Arial,sans-serif",
  "Fira Code=Fira Code,Courier New,monospace",
].join("; ");

const boardTinymceContentStyle = "body { font-family: Pretendard Variable, Pretendard, 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 14px; }";

export function BoardDetailLiveSection({ boardId, intent = "list", onOpenPost }: { boardId: string | null; intent?: "write" | "list"; onOpenPost?: (postId: string) => void }) {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const notices = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.boards.notices, refreshSeed);
  const boards = useApiQuery<{ items: Array<Record<string, any>> }>(appRoutes.boards.boards, refreshSeed);
  const [selectedBoardId, setSelectedBoardId] = useState(boardId ?? "");
  const [selectedCategory, setSelectedCategory] = useState<BoardCategory>("");
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isNotice, setIsNotice] = useState(false);
  const [noticePeriodPreset, setNoticePeriodPreset] = useState<NoticePeriodPreset>("7");
  const defaultNoticeRange = getNoticePeriodRange("7");
  const [noticePeriodRange, setNoticePeriodRange] = useState(defaultNoticeRange.rangeText);
  const [noticeCustomStartDate, setNoticeCustomStartDate] = useState("");
  const [noticeCustomEndDate, setNoticeCustomEndDate] = useState("");
  const [noticeCalendarOpen, setNoticeCalendarOpen] = useState(false);
  const [mailAlert, setMailAlert] = useState(false);
  const [pushAlert, setPushAlert] = useState(false);
  const [accessScope, setAccessScope] = useState("board-default");
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const availableBoards = useMemo(() => [...(notices.data?.items ?? []), ...(boards.data?.items ?? [])], [notices.data, boards.data]);
  const categoryBoards = useMemo(() => (selectedCategory ? availableBoards.filter((board) => getBoardCategory(board) === selectedCategory) : []), [availableBoards, selectedCategory]);
  const selectedBoard = availableBoards.find((item) => item.id === selectedBoardId) ?? null;
  const effectiveBoardId = selectedBoard?.id ?? selectedBoardId;
  const posts = useApiQuery<{ board: Record<string, any>; items: Array<Record<string, any>> }>(effectiveBoardId ? appRoutes.boards.posts(effectiveBoardId) : null, refreshSeed);
  const session = useApiQuery<SessionPayload>("/api/session", refreshSeed);
  const samplePostId = posts.data?.items[0]?.id ?? getDefaultBoardPostId(effectiveBoardId);
  const canShowBoardFlow = Boolean(posts.data || selectedBoard);
  const boardSettings = readBoardWriteSettings(selectedBoard ?? posts.data?.board);
  const prefixOptions = boardSettings.prefixOptions ?? [];
  const accessScopes = boardSettings.accessScopes ?? [];
  const showWriteForm = intent === "write";

  useEffect(() => {
    setSelectedBoardId(boardId ?? "");
    const initialBoard = boardId ? availableBoards.find((item) => item.id === boardId) : null;
    setSelectedCategory(initialBoard ? getBoardCategory(initialBoard) : "");
  }, [availableBoards, boardId]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const selectedStillInCategory = categoryBoards.some((board) => board.id === selectedBoardId);
    if (!selectedStillInCategory) {
      setSelectedBoardId("");
    }
  }, [categoryBoards, selectedBoardId, selectedCategory]);

  useEffect(() => {
    setSelectedPrefix("");
    const nextIsNotice = Boolean((selectedBoard ?? posts.data?.board)?.isNoticeOnly);
    setIsNotice(nextIsNotice);
    setNoticePeriodPreset("7");
    const nextNoticeRange = getNoticePeriodRange("7");
    setNoticePeriodRange(nextNoticeRange.rangeText);
    setNoticeCustomStartDate("");
    setNoticeCustomEndDate("");
    setNoticeCalendarOpen(false);
    setAccessScope("board-default");
  }, [effectiveBoardId, selectedBoard, posts.data?.board]);

  function handleNoticeToggle(checked: boolean) {
    setIsNotice(checked);
    setNoticeCalendarOpen(false);
    if (checked && !noticePeriodRange) {
      const nextPreset = noticePeriodPreset === "custom" ? "7" : noticePeriodPreset;
      const nextRange = getNoticePeriodRange(nextPreset);
      setNoticePeriodPreset(nextPreset);
      setNoticePeriodRange(nextRange.rangeText);
    }
  }

  function handleNoticePeriodPresetChange(value: NoticePeriodPreset) {
    setNoticePeriodPreset(value);
    setNoticeCalendarOpen(false);
    if (value === "custom") {
      setNoticeCustomStartDate("");
      setNoticeCustomEndDate("");
      setNoticePeriodRange("");
      return;
    }

    const nextRange = getNoticePeriodRange(value);
    setNoticePeriodRange(nextRange.rangeText);
    setNoticeCustomStartDate(nextRange.startDate);
    setNoticeCustomEndDate(nextRange.endDate);
  }

  function handleNoticePeriodRangeOpen() {
    const parsedRange = parseNoticePeriodRange(noticePeriodRange);
    if (parsedRange) {
      setNoticeCustomStartDate(parsedRange.startDate);
      setNoticeCustomEndDate(parsedRange.endDate);
    }
    setNoticeCalendarOpen((value) => !value);
  }

  function handleNoticeCustomDateChange(part: "start" | "end", value: string) {
    const nextStartDate = part === "start" ? value : noticeCustomStartDate;
    const nextEndDate = part === "end" ? value : noticeCustomEndDate;
    setNoticePeriodPreset("custom");
    setNoticeCustomStartDate(nextStartDate);
    setNoticeCustomEndDate(nextEndDate);
    setNoticePeriodRange(nextStartDate && nextEndDate ? `${nextStartDate} ~ ${nextEndDate}` : "");
  }

  async function handleCreatePost() {
    const bodyPreview = stripHtmlToPreview(bodyHtml);
    if (!effectiveBoardId) {
      setResult({ tone: "warning", title: "게시글 등록 실패", body: "게시판을 선택해 주세요." });
      return;
    }

    if (!title.trim() || !bodyPreview) {
      setResult({ tone: "warning", title: "게시글 등록 실패", body: "제목과 본문을 입력해 주세요." });
      return;
    }

    const noticePeriodForPayload = isNotice ? parseNoticePeriodRange(noticePeriodRange) : null;
    if (isNotice && !noticePeriodForPayload) {
      setResult({ tone: "warning", title: "공지 등록 실패", body: "직접설정 기간을 YYYY-MM-DD ~ YYYY-MM-DD 형식으로 입력해 주세요." });
      return;
    }

    setPending(true);
    setResult(null);
    try {
      const fullTitle = selectedPrefix ? `[${selectedPrefix}] ${title.trim()}` : title.trim();
      const payload = await fetchJson<Record<string, any>>(appRoutes.boards.posts(effectiveBoardId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: fullTitle,
          bodyPreview,
          bodyHtml,
          prefix: selectedPrefix || null,
          visibility,
          isNotice,
          noticePeriod: isNotice && noticePeriodForPayload
            ? {
              startDate: noticePeriodForPayload.startDate || null,
              endDate: noticePeriodForPayload.endDate || null,
            }
            : null,
          notificationSettings: {
            mail: mailAlert,
            push: pushAlert,
          },
          accessPolicy: {
            scope: accessScope,
          },
        }),
      });
      setResult({
        tone: "accent",
        title: isNotice ? "공지 등록 완료" : "게시글 등록 완료",
        body: `${payload.data.post.id} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
      onOpenPost?.(payload.data.post.id);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: isNotice ? "공지 등록 실패" : "게시글 등록 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className={showWriteForm ? "board-write-form-only" : "grid-auto-compact"}>
        {showWriteForm ? (
          <section className="board-write-form" aria-labelledby="board-write-form-title">
            <h2 className="board-write-heading" id="board-write-form-title">글쓰기</h2>
            <div className="board-write-line board-write-line--board">
              <strong>게시판 선택</strong>
              <select className="field" onChange={(event) => setSelectedCategory(event.target.value as BoardCategory)} value={selectedCategory}>
                <option value="">게시판 구분 선택</option>
                <option value="company">전사게시판</option>
                <option value="department">부서게시판</option>
              </select>
              <select className="field" disabled={!selectedCategory || !categoryBoards.length} onChange={(event) => setSelectedBoardId(event.target.value)} value={effectiveBoardId}>
                <option value="">하위게시판 선택</option>
                {categoryBoards.map((board) => (
                  <option key={board.id} value={board.id}>{board.name}</option>
                ))}
              </select>
            </div>
            <div className="board-write-line board-write-line--title">
              <strong>제목</strong>
              <select className="field" disabled={!prefixOptions.length} onChange={(event) => setSelectedPrefix(event.target.value)} value={selectedPrefix}>
                <option value="">{prefixOptions.length ? "말머리 선택" : "설정된 말머리 없음"}</option>
                {prefixOptions.map((prefix) => (
                  <option key={prefix} value={prefix}>{prefix}</option>
                ))}
              </select>
              <input className="field" onChange={(event) => setTitle(event.target.value)} placeholder="제목 입력" value={title} />
            </div>
            <div className="board-tinymce-field">
              <strong>본문</strong>
              <Editor
                apiKey="no-api-key"
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                licenseKey="gpl"
                value={bodyHtml}
                onEditorChange={(value) => setBodyHtml(value)}
                init={{
                  height: 550,
                  min_height: 550,
                  menubar: false,
                  plugins: "lists link table code autoresize",
                  toolbar: "undo redo | blocks fontfamily fontsize | bold italic underline forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link table | code",
                  font_family_formats: boardTinymceFontFamilyFormats,
                  elementpath: false,
                  branding: false,
                  promotion: false,
                  content_style: boardTinymceContentStyle,
                }}
              />
            </div>
            <div className="board-write-choice-row" role="group" aria-label="공개설정">
              <strong>공개설정</strong>
              <label><input checked={visibility === "public"} onChange={() => setVisibility("public")} name="board-post-visibility" type="radio" /> 공개</label>
              <label><input checked={visibility === "private"} onChange={() => setVisibility("private")} name="board-post-visibility" type="radio" /> 비공개</label>
            </div>
            <div className="board-write-notice">
              <strong>공지등록여부</strong>
              <label><input checked={isNotice} onChange={(event) => handleNoticeToggle(event.target.checked)} type="checkbox" /> 공지등록</label>
              {isNotice ? (
                <>
                  <span className="board-write-notice-period-label">공지등록기간</span>
                  <select
                    className="field board-write-notice-period-select"
                    onChange={(event) => handleNoticePeriodPresetChange(event.target.value as NoticePeriodPreset)}
                    value={noticePeriodPreset}
                  >
                    {noticePeriodOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className="board-write-period-range">
                    <button
                      className="field board-write-period-range__trigger"
                      onClick={handleNoticePeriodRangeOpen}
                      type="button"
                    >
                      {noticePeriodRange || "YYYY-MM-DD ~ YYYY-MM-DD"}
                    </button>
                    {noticeCalendarOpen ? (
                      <div className="board-write-period-calendar" aria-label="공지 등록기간 선택">
                        <label>
                          <span>시작일</span>
                          <input className="field" onChange={(event) => handleNoticeCustomDateChange("start", event.target.value)} type="date" value={noticeCustomStartDate} />
                        </label>
                        <label>
                          <span>종료일</span>
                          <input className="field" onChange={(event) => handleNoticeCustomDateChange("end", event.target.value)} type="date" value={noticeCustomEndDate} />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
            <div className="board-write-options">
              <strong>알림</strong>
              <label><input checked={mailAlert} onChange={(event) => setMailAlert(event.target.checked)} type="checkbox" /> 메일알림</label>
              <label><input checked={pushAlert} onChange={(event) => setPushAlert(event.target.checked)} type="checkbox" /> 푸시알림</label>
            </div>
            <div className="action-row" style={{ marginTop: 12 }}>
              <button className="touch-button" disabled={pending || !effectiveBoardId || !canShowBoardFlow} onClick={handleCreatePost} type="button">
                {pending ? "작성 처리 중" : "게시글 등록"}
              </button>
            </div>
          </section>
        ) : null}
        {!showWriteForm ? (
          <article className="info-card">
            <Pill>현재 게시판</Pill>
            <QueryState loading={notices.loading || boards.loading || posts.loading} error={notices.error ?? boards.error ?? posts.error} emptyMessage={!canShowBoardFlow ? "선택 가능한 게시판이 없습니다." : undefined} />
            {posts.data ? (
              <>
                <h3>{posts.data.board.name}</h3>
                <p>{posts.data.board.visibility} · {posts.data.board.isNoticeOnly ? "공지 중심" : "게시글 작성 가능"}</p>
                <p className="card-note">게시글 {posts.data.items.length}건 · <InlineNavigationLink href={`/posts/${samplePostId}`} onClick={onOpenPost ? () => onOpenPost(samplePostId) : undefined}>대표 글 보기</InlineNavigationLink></p>
                <p className="card-note">{formatBoardWriterGuide(effectiveBoardId, session.data ?? null)}</p>
              </>
            ) : null}
          </article>
        ) : null}
      </div>
      {!showWriteForm && session.data ? (
        <article className="info-card" style={{ marginTop: 16 }}>
          <Pill tone="accent">현재 세션 권한</Pill>
          <h3>{session.data.user.fullName}</h3>
          <p>{session.data.user.roleCodes.join(", ")}</p>
          <p className="card-note">
            공지 등록 {hasSessionPermission(session.data, "board.manage") ? "가능" : "불가"} · 일반 게시글 작성 {hasSessionPermission(session.data, "board.post.write") ? "가능" : "불가"}
          </p>
        </article>
      ) : null}
      {!showWriteForm && posts.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {posts.data.items.length ? (
            posts.data.items.slice(0, 4).map((item) => (
              <article key={item.id} className="info-card">
                <Pill tone={item.isNotice ? "warning" : "accent"}>{item.isNotice ? "공지" : item.status}</Pill>
                <h3>{item.title}</h3>
                <p>{item.bodyPreview}</p>
                <p className="card-note">상세에서 댓글과 읽음 확인을 이어갑니다.</p>
                <InlineNavigationLink href={`/posts/${item.id}`} onClick={onOpenPost ? () => onOpenPost(item.id) : undefined}>이 글 상세로 이동 →</InlineNavigationLink>
              </article>
            ))
          ) : (
            <article className="info-card">
              <Pill>빈 상태</Pill>
              <h3>아직 이 게시판에 생성된 글이 없습니다.</h3>
              <p>위 작성 폼으로 첫 글을 만든 뒤 상세 화면에서 댓글을 이어가세요.</p>
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
  const session = useApiQuery<SessionPayload>("/api/session", refreshSeed);
  const canShowPostActions = Boolean(detail.data && comments.data);

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
        title: "댓글 등록 완료",
        body: `${payload.data.comment.id} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "댓글 등록 실패",
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
        title: "읽음 확인",
        body: `${payload.data.receipt.id} · ${payload.data.audit.action}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "읽음 확인 실패",
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
        title: "잘못된 글 접근이 허용됨",
        body: "예상과 다릅니다. 게시글 접근 제한을 다시 확인해야 합니다.",
      });
    } catch (mutationError) {
      setResult({
        tone: "accent",
        title: "잘못된 글 접근 확인",
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
          <Pill tone="accent">게시글 내용</Pill>
          <QueryState loading={detail.loading || comments.loading} error={detail.error ?? comments.error} emptyMessage={!detail.data ? "게시글 상세를 불러오지 못했습니다." : undefined} />
          {detail.data ? (
            <>
              <h3>{detail.data.post.title}</h3>
              <p>{detail.data.post.bodyPreview}</p>
              <p className="card-note">{detail.data.board.name} · {detail.data.post.status} · {detail.data.post.isNotice ? "공지" : "일반 글"}</p>
              <p className="card-note">
                댓글 작성 {hasSessionPermission(session.data ?? null, "board.comment.write") ? "가능" : "불가"} · 읽음 확인은 접근 가능한 게시글에서만 가능합니다.
              </p>
            </>
          ) : null}
        </article>
        {canShowPostActions ? (
          <article className="info-card">
            <Pill>댓글과 읽음 확인</Pill>
            <label className="form-placeholder" style={{ marginTop: 12 }}>
              <strong>댓글 본문</strong>
              <input className="field" onChange={(event) => setCommentBody(event.target.value)} value={commentBody} />
            </label>
            <div className="action-row" style={{ marginTop: 12 }}>
              <button className="touch-button" disabled={pending} onClick={handleAddComment} type="button">
                댓글 작성
              </button>
              <button className="touch-button--secondary" disabled={pending} onClick={handleReadReceipt} type="button">
                읽음 확인
              </button>
            </div>
            <button className="touch-button--secondary" disabled={pending} onClick={handleForgedProbe} style={{ marginTop: 12 }} type="button">
              잘못된 글 접근 확인
            </button>
          </article>
        ) : (
          <article className="info-card">
            <Pill tone="warning">게시글 접근 차단 상태</Pill>
            <h3>상세 응답이 확인되기 전에는 댓글·읽음 확인 액션을 노출하지 않습니다.</h3>
            <p>현재 postId 는 허용된 게시글인지 확인되지 않았습니다. 차단 사유를 확인한 뒤 /boards 로 돌아가 접근 가능한 글을 다시 선택하세요.</p>
          </article>
        )}
      </div>
      {comments.data ? (
        <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
          {session.data ? (
            <article className="info-card">
              <Pill tone="accent">현재 세션 권한</Pill>
              <h3>{session.data.user.fullName}</h3>
              <p>{session.data.user.roleCodes.join(", ")}</p>
              <p className="card-note">댓글 작성 {hasSessionPermission(session.data, "board.comment.write") ? "가능" : "불가"} · 게시글 열람 {hasSessionPermission(session.data, "board.notice.read") ? "가능" : "불가"}</p>
            </article>
          ) : null}
          {comments.data.items.length ? (
            comments.data.items.slice(0, 4).map((item) => (
              <article key={item.id} className="info-card">
                <Pill>{item.status}</Pill>
                <h3>{item.authorEmployeeId}</h3>
                <p>{item.body}</p>
                <p className="card-note">이 글에 남긴 의견입니다.</p>
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

function getDocumentAudienceLabel(item: Pick<DocumentFileSummary, "isPublicWithinCompany">) {
  return item.isPublicWithinCompany ? "전사 공개" : "제한 공개";
}

function getDocumentClassificationLabel(item: Pick<DocumentFileSummary, "contentType">) {
  if (item.contentType.includes("pdf")) {
    return "정책/안내";
  }
  if (item.contentType.includes("wordprocessingml")) {
    return "인사/계약 초안";
  }
  if (item.contentType.includes("sheet") || item.contentType.includes("excel")) {
    return "정산/집계";
  }
  return "일반 문서";
}

function getDocumentStorageGuide(item: Pick<DocumentFileSummary, "storageStatus" | "status">) {
  if (item.storageStatus === "pending") {
    return "업로드 준비 단계입니다. upload-complete 전까지는 원문 배포가 아니라 metadata/검증 흐름만 확인합니다.";
  }
  if (item.storageStatus === "ready" && item.status === "active") {
    return "내부 열람 가능한 준비 상태입니다. download-init 과 읽음 확인으로 같은 회사 범위 흐름을 이어갑니다.";
  }
  if (item.storageStatus === "deleted" || item.status === "archived") {
    return "삭제/보관 처리된 문서입니다. storageStatus 와 문서 status 를 분리해서 기록합니다.";
  }
  return "실패 또는 예외 상태입니다. error/forbidden 안내와 함께 운영 확인이 필요합니다.";
}

function getDocumentSpaceGuardLabel(space: Pick<DocumentSpaceSummary, "visibility" | "isPublicWithinCompany">) {
  if (space.visibility === "private") {
    return "private HR scope · 권한 없으면 목록 비노출 또는 403";
  }
  if (space.visibility === "department") {
    return "부서 범위 문서함 · 관련 구성원만 접근";
  }
  return space.isPublicWithinCompany ? "company scope · 일반 협업 entry" : "company scope · 제한 공개";
}

export function getSelectedDocumentFile(
  visibleFiles: readonly DocumentFileSummary[],
  selectedFileId: string | null,
) {
  if (!visibleFiles.length) {
    return null;
  }

  return visibleFiles.find((item) => item.id === selectedFileId) ?? visibleFiles[0] ?? null;
}

export function DocumentsLiveSection() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pending, setPending] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [stagedUpload, setStagedUpload] = useState<DocumentActionEnvelope | null>(null);
  const [downloadPreview, setDownloadPreview] = useState<DocumentActionEnvelope | null>(null);
  const [result, setResult] = useState<{ tone: "accent" | "warning"; title: string; body: string } | null>(null);
  const session = useApiQuery<SessionPayload>("/api/session");
  const spaces = useApiQuery<{ items: DocumentSpaceSummary[] }>(appRoutes.documents.spaces, refreshSeed);
  const files = useApiQuery<{ items: DocumentFileSummary[] }>(appRoutes.documents.files, refreshSeed);

  const visibleSpaces = spaces.data?.items ?? [];
  const allFiles = files.data?.items ?? [];
  const activeSpaceId = selectedSpaceId ?? visibleSpaces[0]?.id ?? "document_space_public";
  const visibleFiles = allFiles.filter((item) => item.spaceId === activeSpaceId);
  const selectedFile = getSelectedDocumentFile(visibleFiles, selectedFileId);
  const canRead = hasSessionPermission(session.data ?? null, "document.file.read");
  const canWrite = hasSessionPermission(session.data ?? null, "document.file.write");
  const canManageSpace = hasSessionPermission(session.data ?? null, "document.space.manage");

  useEffect(() => {
    if (!selectedSpaceId && visibleSpaces[0]?.id) {
      setSelectedSpaceId(visibleSpaces[0].id);
    }
  }, [selectedSpaceId, visibleSpaces]);

  useEffect(() => {
    if (!selectedFileId && visibleFiles[0]?.id) {
      setSelectedFileId(visibleFiles[0].id);
      return;
    }

    if (selectedFileId && !visibleFiles.some((item) => item.id === selectedFileId)) {
      setSelectedFileId(visibleFiles[0]?.id ?? null);
    }
  }, [selectedFileId, visibleFiles]);

  async function handleMetadataCreate() {
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<DocumentActionEnvelope>(appRoutes.documents.fileMetadata, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          fileName: "phase-54-documents-preview.pdf",
          contentType: "application/pdf",
          fileSize: 64000,
          versionLabel: "draft-1",
          isPublicWithinCompany: true,
        }),
      });
      setSelectedFileId(payload.data.file.id);
      setResult({
        tone: "accent",
        title: "문서 metadata 생성",
        body: `${payload.data.file.id} · ${payload.data.file.storageProvider} · ${payload.data.audit?.action ?? "document.file.metadata.create"}`,
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

  async function handleUploadInit() {
    setPending(true);
    setResult(null);
    setDownloadPreview(null);
    try {
      const payload = await fetchJson<DocumentActionEnvelope>(appRoutes.documents.uploadInit, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          fileName: "phase-54-handoff.pdf",
          contentType: "application/pdf",
          fileSize: 2048,
          versionLabel: "draft-upload",
          isPublicWithinCompany: false,
        }),
      });
      setStagedUpload(payload.data);
      setSelectedFileId(payload.data.file.id);
      setResult({
        tone: "accent",
        title: "upload-init 완료",
        body: `${payload.data.file.id} · ${payload.data.file.storageStatus} · ${payload.data.action?.message ?? "업로드 준비 생성"}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "upload-init 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleUploadComplete() {
    if (!stagedUpload?.action?.uploadToken) {
      setResult({
        tone: "warning",
        title: "upload-complete 대기 중",
        body: "먼저 upload-init 을 실행해 업로드 토큰과 pending 상태를 만든 뒤 완료 단계로 이어가세요.",
      });
      return;
    }

    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<DocumentActionEnvelope>(appRoutes.documents.uploadComplete(stagedUpload.file.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uploadToken: stagedUpload.action.uploadToken,
          checksumSha256: "a".repeat(64),
        }),
      });
      setStagedUpload(null);
      setSelectedFileId(payload.data.file.id);
      setResult({
        tone: "accent",
        title: "upload-complete 완료",
        body: `${payload.data.file.id} · ${payload.data.file.storageStatus} · checksum 기록 완료`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "upload-complete 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleDownloadInit() {
    if (!selectedFile) {
      setResult({ tone: "warning", title: "다운로드 대상 없음", body: "먼저 문서 공간에서 파일 하나를 선택하세요." });
      return;
    }

    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<DocumentActionEnvelope>(appRoutes.documents.downloadInit(selectedFile.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      setDownloadPreview(payload.data);
      setResult({
        tone: "accent",
        title: "download-init 완료",
        body: `${payload.data.file.id} · ${payload.data.action?.kind ?? "download"} · ${payload.data.action?.message ?? "내부 다운로드 준비"}`,
      });
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "download-init 실패",
        body: mutationError instanceof Error ? mutationError.message : String(mutationError),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteFile() {
    if (!selectedFile) {
      setResult({ tone: "warning", title: "삭제 대상 없음", body: "먼저 문서 상세에서 처리할 파일을 선택하세요." });
      return;
    }

    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<DocumentActionEnvelope>(appRoutes.documents.deleteFile(selectedFile.id), {
        method: "DELETE",
      });
      setStagedUpload(null);
      setDownloadPreview(null);
      setResult({
        tone: "accent",
        title: "문서 보관/삭제 기록 완료",
        body: `${payload.data.file.id} · ${payload.data.file.storageStatus} · ${payload.data.file.status}`,
      });
      setRefreshSeed((value) => value + 1);
    } catch (mutationError) {
      setResult({
        tone: "warning",
        title: "문서 보관/삭제 실패",
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
      await fetchJson<Record<string, unknown>>(`${appRoutes.documents.files}?spaceId=document_space_hr_private`);
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
      await fetchJson<Record<string, unknown>>(appRoutes.documents.fileMetadata, {
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
    if (!selectedFile) {
      setResult({ tone: "warning", title: "읽음 확인 대상 없음", body: "먼저 접근 가능한 파일 metadata 를 하나 이상 확인하세요." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const payload = await fetchJson<Record<string, any>>(appRoutes.readReceipts, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "document_file", targetId: selectedFile.id }),
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
          <Pill tone="accent">문서 공간 목록</Pill>
          <QueryState loading={spaces.loading || session.loading} error={spaces.error ?? session.error} />
          {session.data ? (
            <>
              <h3>{session.data.user.fullName}</h3>
              <p>{session.data.user.roleCodes.join(" · ")} · 문서 read {canRead ? "허용" : "차단"} · write {canWrite ? "허용" : "차단"}</p>
              <p className="card-note">space.manage {canManageSpace ? "허용" : "없음"} · private/missing/foreign company 는 목록 비노출 또는 403 으로 끊습니다.</p>
            </>
          ) : null}
          {visibleSpaces.length ? (
            <div className="mobile-summary-grid" style={{ marginTop: 12 }}>
              {visibleSpaces.map((space) => (
                <article key={space.id} className="route-card">
                  <div className="pill-row">
                    <Pill tone={space.id === activeSpaceId ? "accent" : undefined}>{space.visibility}</Pill>
                    <Pill>{space.status}</Pill>
                  </div>
                  <h3>{space.name}</h3>
                  <p>{getDocumentSpaceGuardLabel(space)}</p>
                  <p className="card-note">owner {space.ownerEmployeeId} · {space.id}</p>
                  <button className="touch-button--secondary" onClick={() => setSelectedSpaceId(space.id)} type="button">
                    이 문서함 보기
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </article>

        <article className="info-card">
          <Pill>happy path / guardrail</Pill>
          <h3>1) 목록 → 2) 상세 → 3) upload-init → 4) upload-complete → 5) download-init → 6) read receipt</h3>
          <p>문서 분류, 상태, 권한 차단을 같은 화면에서 따라가되 외부 공유 완료처럼 과장하지 않습니다.</p>
          <ul className="summary-list">
            <li>empty: 접근 가능한 파일이 없어도 문서함 자체는 정상 응답일 수 있습니다.</li>
            <li>loading/error/forbidden: 같은 same-origin API 기준으로 설명합니다.</li>
            <li>classification: 정책/안내, 인사/계약 초안, 정산/집계 같은 업무 언어로만 보여 줍니다.</li>
          </ul>
        </article>
      </div>

      <div className="mobile-summary-grid" style={{ marginTop: 16 }}>
        <article className="info-card">
          <Pill tone="accent">파일 목록</Pill>
          <QueryState loading={files.loading} error={files.error} emptyMessage={visibleFiles.length === 0 && files.data ? "이 문서함에서 접근 가능한 파일 metadata 가 없습니다." : undefined} />
          {visibleFiles.length ? (
            <div className="grid-auto-compact" style={{ marginTop: 12 }}>
              {visibleFiles.slice(0, 5).map((item) => (
                <article key={item.id} className="route-card">
                  <div className="pill-row">
                    <Pill tone={item.id === selectedFile?.id ? "accent" : undefined}>{item.storageStatus}</Pill>
                    <Pill>{getDocumentAudienceLabel(item)}</Pill>
                    <Pill>{getDocumentClassificationLabel(item)}</Pill>
                  </div>
                  <h3>{item.fileName}</h3>
                  <p>{formatFileSize(item.fileSize)} · {item.versionLabel}</p>
                  <p className="card-note">{getDocumentStorageGuide(item)}</p>
                  <button className="touch-button--secondary" onClick={() => setSelectedFileId(item.id)} type="button">
                    상세 보기
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </article>

        <article className="info-card">
          <Pill>문서 상세</Pill>
          {selectedFile ? (
            <>
              <h3>{selectedFile.fileName}</h3>
              <p>{selectedFile.id} · {selectedFile.versionId}</p>
              <ul className="summary-list">
                <li>분류: {getDocumentClassificationLabel(selectedFile)} / 공개범위: {getDocumentAudienceLabel(selectedFile)}</li>
                <li>storageStatus: {selectedFile.storageStatus} / 문서 status: {selectedFile.status}</li>
                <li>spaceId: {selectedFile.spaceId} / owner: {selectedFile.ownerEmployeeId}</li>
                <li>contentType: {selectedFile.contentType} / updated: {formatDateTime(selectedFile.updatedAt)}</li>
              </ul>
              <p className="card-note">상세 패널에서 storageStatus 와 문서 status 를 따로 보여 주어 내부 저장 lifecycle 과 문서 보관 상태를 섞지 않습니다.</p>
            </>
          ) : (
            <>
              <h3>선택된 문서가 없습니다.</h3>
              <p>목록에서 파일을 선택하거나 metadata preview 생성으로 상세 흐름을 시작하세요.</p>
            </>
          )}
        </article>
      </div>

      <div className="grid-auto-compact" style={{ marginTop: 16 }}>
        <article className="info-card">
          <Pill tone="accent">실행 액션</Pill>
          <div className="action-row" style={{ marginTop: 8 }}>
            <button className="touch-button" disabled={pending || !canWrite} onClick={handleMetadataCreate} type="button">
              metadata preview 생성
            </button>
            <button className="touch-button" disabled={pending || !canWrite} onClick={handleUploadInit} type="button">
              upload-init
            </button>
            <button className="touch-button--secondary" disabled={pending || !canWrite} onClick={handleUploadComplete} type="button">
              upload-complete
            </button>
          </div>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button className="touch-button--secondary" disabled={pending || !canRead || !selectedFile} onClick={handleDownloadInit} type="button">
              download-init
            </button>
            <button className="touch-button--secondary" disabled={pending || !canRead || !selectedFile} onClick={handleFileReadReceipt} type="button">
              문서 읽음 확인
            </button>
            <button className="touch-button--secondary" disabled={pending || !canWrite || !selectedFile} onClick={handleDeleteFile} type="button">
              delete / archive
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
          <p className="card-note">권한이 없는 세션에서는 버튼이 비활성화되고, 직접 probe 하면 API 가 403 또는 validation error 로 끊어야 합니다.</p>
        </article>

        <article className="info-card">
          <Pill>최근 액션 상세</Pill>
          {stagedUpload?.action ? (
            <>
              <h3>upload-init 대기 중</h3>
              <p>{stagedUpload.file.id} · {stagedUpload.action.kind}</p>
              <p className="card-note">objectKeyPreview {stagedUpload.action.objectKeyPreview}</p>
              <p className="card-note">raw storage key/bucket/public URL 전문은 계속 비노출입니다.</p>
            </>
          ) : downloadPreview?.action ? (
            <>
              <h3>download-init 확인</h3>
              <p>{downloadPreview.file.id} · {downloadPreview.action.kind}</p>
              <p className="card-note">download token 만 확인하고 외부 공유 URL 전문은 노출하지 않습니다.</p>
            </>
          ) : (
            <>
              <h3>액션 대기</h3>
              <p>upload-init 또는 download-init 을 실행하면 최근 토큰/preview 요약이 여기 보입니다.</p>
            </>
          )}
        </article>
      </div>
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
