"use client";

import { appRoutes, errorResponseSchema, meResponseSchema, type RoleCode } from "@gw/shared";
import * as React from "react";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const controller = new AbortController();

    void fetch(appRoutes.me, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const parsed = meResponseSchema.safeParse(await response.json().catch(() => null));
        if (!parsed.success) {
          return;
        }

        const primaryRoleCode = parsed.data.data.user.roleCodes[0] ?? defaultRoleCode;
        window.location.replace(getPostLoginRoute(primaryRoleCode));
      })
      .catch(() => {
        // 로그인 화면은 익명 진입이 기본이므로 세션 확인 실패는 조용히 무시합니다.
      });

    return () => controller.abort();
  }, []);

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
      <div className="login-options-row">
        <label className="login-option">
          <input type="checkbox" name="rememberLoginId" checked={rememberLoginId} onChange={(event) => setRememberLoginId(event.target.checked)} />
          <span>아이디 저장</span>
        </label>
        <label className="login-option">
          <input type="checkbox" name="rememberSession" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} />
          <span>자동 로그인</span>
        </label>
      </div>
      <div className="action-row login-action-row">
        <button type="submit" className="touch-button login-submit-button" disabled={pending}>
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
