"use client";

import { appRoutes, errorResponseSchema, type RoleCode } from "@gw/shared";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { devSafeRoleOptions, getPostLoginRoute } from "../../dev-safe-auth";

const SAVED_LOGIN_ID_KEY = "gw_saved_login_id";
const defaultRoleCode: RoleCode = "COMPANY_ADMIN";

function resolveRoleCodeFromSearch(search: string): RoleCode {
  const params = new URLSearchParams(search);
  const candidate = params.get("role");
  const matched = devSafeRoleOptions.find((option) => option.value === candidate);
  return matched?.value ?? defaultRoleCode;
}

export function LoginForm() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [rememberLoginId, setRememberLoginId] = useState(false);
  const [roleCode, setRoleCode] = useState<RoleCode>(defaultRoleCode);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedLoginId = window.localStorage.getItem(SAVED_LOGIN_ID_KEY) ?? "";
    if (savedLoginId) {
      setLoginId(savedLoginId);
      setRememberLoginId(true);
    }

    setRoleCode(resolveRoleCodeFromSearch(window.location.search));
  }, []);

  const selectedRole = useMemo(() => devSafeRoleOptions.find((item) => item.value === roleCode) ?? devSafeRoleOptions[0], [roleCode]);

  return (
    <form
      className="form-placeholder"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setErrorMessage(null);

        try {
          const response = await fetch(appRoutes.auth.login, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
              "x-dev-role": roleCode,
            },
            body: JSON.stringify({
              loginId,
              password,
              rememberSession,
            }),
          });

          if (!response.ok) {
            const payload = errorResponseSchema.safeParse(await response.json().catch(() => null));
            throw new Error(payload.success ? payload.data.error.message : `로그인에 실패했습니다. (${response.status})`);
          }

          if (rememberLoginId) {
            window.localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId);
          } else {
            window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
          }

          window.location.assign(getPostLoginRoute(roleCode));
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="field-grid">
        <label>
          <span className="meta-copy">아이디</span>
          <input
            className="field"
            name="loginId"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            autoComplete="username"
            placeholder="아이디"
            required
          />
        </label>
        <label>
          <span className="meta-copy">비밀번호</span>
          <input
            className="field"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="비밀번호"
            required
          />
        </label>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" name="rememberLoginId" checked={rememberLoginId} onChange={(event) => setRememberLoginId(event.target.checked)} />
          <span>아이디 저장</span>
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input type="checkbox" name="rememberSession" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} style={{ marginTop: 4 }} />
          <span>
            <strong>자동 로그인</strong>
            <br />
            <span className="card-note">비밀번호 저장이 아니라 이 브라우저의 로그인 세션을 더 오래 유지하는 옵션입니다.</span>
          </span>
        </label>
      </div>
      <p className="card-note">로그인 후 첫 화면: {selectedRole.landingRoute}</p>
      <div className="action-row">
        <button type="submit" className="touch-button" disabled={pending}>
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
