"use client";

import {
  appRoutes,
  authRegistrationRequestCreateResponseSchema,
  errorResponseSchema,
  type ZitadelRegistrationUserType,
} from "@gw/shared";
import * as React from "react";
import { useState } from "react";

const userTypeOptions: Array<{ value: ZitadelRegistrationUserType; label: string }> = [
  { value: "INTERNAL_STAFF", label: "사내임직원" },
  { value: "ROOM_OPERATIONS", label: "객실관리직" },
  { value: "BRANCH_OWNER", label: "지점대표" },
  { value: "PARTNER_EMPLOYEE", label: "거래처임직원" },
];

function getErrorMessage(payload: unknown, defaultMessage: string) {
  const parsed = errorResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : defaultMessage;
}

export function RegistrationRequestForm() {
  const [companyId, setCompanyId] = useState("");
  const [loginName, setLoginName] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [userType, setUserType] = useState<ZitadelRegistrationUserType>("INTERNAL_STAFF");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <details className="registration-request-panel">
      <summary>회원가입 신청</summary>
      <form
        className="form-field-stack registration-request-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage(null);

          try {
            const response = await fetch(appRoutes.auth.registrationRequests, {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                companyId,
                loginName,
                email,
                displayName,
                initialPassword,
                userType,
              }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
              throw new Error(getErrorMessage(payload, `회원가입 신청에 실패했습니다. (${response.status})`));
            }

            const parsed = authRegistrationRequestCreateResponseSchema.safeParse(payload);
            if (!parsed.success) {
              throw new Error("회원가입 신청 응답을 확인하지 못했습니다.");
            }

            setMessage({ tone: "success", text: "회원가입 신청이 접수되었습니다. 관리자 승인 후 사용할 수 있습니다." });
            setInitialPassword("");
          } catch (error) {
            setMessage({ tone: "error", text: error instanceof Error ? error.message : "회원가입 신청에 실패했습니다." });
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="field-grid">
          <label>
            <span className="meta-copy">회사 ID</span>
            <input className="field" name="companyId" value={companyId} onChange={(event) => setCompanyId(event.target.value)} required />
          </label>
          <label>
            <span className="meta-copy">로그인 ID</span>
            <input className="field" name="loginName" value={loginName} onChange={(event) => setLoginName(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            <span className="meta-copy">이메일</span>
            <input className="field" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            <span className="meta-copy">이름</span>
            <input className="field" name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" minLength={2} required />
          </label>
          <label>
            <span className="meta-copy">사용자 유형</span>
            <select className="field" name="userType" value={userType} onChange={(event) => setUserType(event.target.value as ZitadelRegistrationUserType)} required>
              {userTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="meta-copy">초기 비밀번호</span>
            <input className="field" name="initialPassword" type="password" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
        </div>
        <div className="action-row login-action-row">
          <button type="submit" className="touch-button" disabled={pending}>{pending ? "신청 중..." : "회원가입 신청"}</button>
        </div>
        {message ? <p className={message.tone === "error" ? "form-error" : "form-success"} role="status">{message.text}</p> : null}
      </form>
    </details>
  );
}
