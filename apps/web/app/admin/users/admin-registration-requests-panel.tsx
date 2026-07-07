"use client";

import {
  adminRegistrationRequestApproveResponseSchema,
  adminRegistrationRequestsListResponseSchema,
  appRoutes,
  errorResponseSchema,
  type AuthRegistrationRequest,
  type RoleCode,
} from "@gw/shared";
import * as React from "react";
import { useEffect, useState } from "react";

const userTypeLabels: Record<AuthRegistrationRequest["userType"], string> = {
  INTERNAL_STAFF: "사내임직원",
  ROOM_OPERATIONS: "객실관리직",
  BRANCH_OWNER: "지점대표",
  PARTNER_EMPLOYEE: "거래처임직원",
};

const statusLabels: Record<AuthRegistrationRequest["registrationStatus"], string> = {
  PENDING: "승인대기",
  APPROVED: "승인완료",
  REJECTED: "반려",
  SUSPENDED: "보류",
};

const roleLabels: Record<RoleCode, string> = {
  SUPER_ADMIN: "총괄관리자",
  COMPANY_ADMIN: "회사관리자",
  HR_ADMIN: "인사관리자",
  MANAGER: "관리자",
  EMPLOYEE: "사원",
  AUDITOR: "감사담당자",
};

const roleOptions: RoleCode[] = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "COMPANY_ADMIN", "AUDITOR"];

function getErrorMessage(payload: unknown, defaultMessage: string) {
  const parsed = errorResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : defaultMessage;
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function ApprovalForm({ request, onApproved }: { request: AuthRegistrationRequest; onApproved: () => void }) {
  const [roleCode, setRoleCode] = useState<RoleCode>("EMPLOYEE");
  const [departmentName, setDepartmentName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [positionName, setPositionName] = useState("");
  const [reason, setReason] = useState("회원가입 요청 승인");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <form
      className="employee-info-form-grid registration-approval-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);

        try {
          const body: Record<string, string> = { roleCode, reason };
          if (departmentName.trim()) body.departmentName = departmentName.trim();
          if (branchName.trim()) body.branchName = branchName.trim();
          if (positionName.trim()) body.positionName = positionName.trim();

          const response = await fetch(appRoutes.admin.registrationRequestApprove(request.id), {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(getErrorMessage(payload, `승인 처리에 실패했습니다. (${response.status})`));
          }

          const parsed = adminRegistrationRequestApproveResponseSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error("승인 처리 응답을 확인하지 못했습니다.");
          }

          setMessage({ tone: "success", text: `${request.displayName} 승인 처리가 완료되었습니다.` });
          onApproved();
        } catch (error) {
          setMessage({ tone: "error", text: error instanceof Error ? error.message : "승인 처리에 실패했습니다." });
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="employee-info-column">
        <label>기본 권한<select name="roleCode" value={roleCode} onChange={(event) => setRoleCode(event.target.value as RoleCode)}>{roleOptions.map((option) => <option key={option} value={option}>{roleLabels[option]}</option>)}</select></label>
        <label>부서<input name="departmentName" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} /></label>
        <label>지점<input name="branchName" value={branchName} onChange={(event) => setBranchName(event.target.value)} /></label>
      </div>
      <div className="employee-info-column">
        <label>직책/직급<input name="positionName" value={positionName} onChange={(event) => setPositionName(event.target.value)} /></label>
        <label>승인 사유<input name="reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={1} required /></label>
        <button type="submit" disabled={pending}>{pending ? "승인 중..." : "승인"}</button>
        {message ? <p className={message.tone === "error" ? "form-error" : "form-success"} role="status">{message.text}</p> : null}
      </div>
    </form>
  );
}

export function AdminRegistrationRequestsPanel() {
  const [items, setItems] = useState<AuthRegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage(null);

    void fetch(appRoutes.admin.registrationRequests, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, `회원가입 승인 목록을 불러오지 못했습니다. (${response.status})`));
        }
        const parsed = adminRegistrationRequestsListResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("회원가입 승인 목록 응답을 확인하지 못했습니다.");
        }
        setItems(parsed.data.data.items);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "회원가입 승인 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshSeed]);

  const pendingItems = items.filter((item) => item.registrationStatus === "PENDING");

  return (
    <div className="registration-approval-panel">
      <div className="employee-management-actions" aria-label="회원가입 승인 작업">
        <button type="button" onClick={() => setRefreshSeed((value) => value + 1)} disabled={loading}>새로고침</button>
        <span>승인대기: {pendingItems.length}건</span>
      </div>
      {loading ? <article className="info-card"><h3>승인 요청을 불러오는 중입니다</h3></article> : null}
      {errorMessage ? <section className="status-banner status-banner--warning" role="alert"><strong>승인 요청 조회 실패</strong><span>{errorMessage}</span></section> : null}
      {!loading && !errorMessage && items.length === 0 ? <article className="info-card"><h3>승인 요청이 없습니다</h3></article> : null}
      {items.length > 0 ? (
        <div className="employee-info-drawer-list">
          {items.map((request) => (
            <details className="employee-info-drawer" key={request.id} open={request.registrationStatus === "PENDING"}>
              <summary>
                <span>{request.displayName} · {userTypeLabels[request.userType]}</span>
                <small>{statusLabels[request.registrationStatus]} · {formatDate(request.requestedAt)}</small>
              </summary>
              <div className="employee-info-dialog" role="group" aria-label={`${request.displayName} 회원가입 승인`}>
                <div className="grid-auto-compact">
                  <article className="info-card"><h3>{request.loginName}</h3><p>{request.email}</p></article>
                  <article className="info-card"><h3>{request.companyId}</h3><p>{statusLabels[request.registrationStatus]}</p></article>
                </div>
                {request.registrationStatus === "PENDING" ? <ApprovalForm request={request} onApproved={() => setRefreshSeed((value) => value + 1)} /> : null}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
