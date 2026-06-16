"use client";

import { appRoutes, errorResponseSchema, type RoleCode } from "@gw/shared";
import * as React from "react";
import { useMemo, useState } from "react";

import { devSafeLoginId, devSafeLoginPassword, devSafeRoleOptions, getPostLoginRoute } from "../../dev-safe-auth";

export function LoginForm() {
  const [loginId, setLoginId] = useState(devSafeLoginId);
  const [password, setPassword] = useState(devSafeLoginPassword);
  const [roleCode, setRoleCode] = useState<RoleCode>("COMPANY_ADMIN");
  const [rememberSession, setRememberSession] = useState(true);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          <span className="meta-copy">테스트 아이디</span>
          <input className="field" name="loginId" value={loginId} onChange={(event) => setLoginId(event.target.value)} autoComplete="username" />
        </label>
        <label>
          <span className="meta-copy">테스트 비밀번호</span>
          <input
            className="field"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label>
          <span className="meta-copy">미리 볼 역할</span>
          <select className="field" name="roleCode" value={roleCode} onChange={(event) => setRoleCode(event.target.value as RoleCode)}>
            {devSafeRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16 }}>
        <input
          type="checkbox"
          name="rememberSession"
          checked={rememberSession}
          onChange={(event) => setRememberSession(event.target.checked)}
          style={{ marginTop: 4 }}
        />
        <span>
          <strong>자동 로그인</strong>
          <br />
          <span className="card-note">비밀번호를 저장하는 기능이 아니라, 이 브라우저에서 로그인 세션을 더 오래 유지할지 선택하는 옵션입니다.</span>
        </span>
      </label>
      <p className="card-note">선택한 landing: {selectedRole.landingRoute} — {selectedRole.description}</p>
      <div className="action-row">
        <button type="submit" className="touch-button" disabled={pending}>
          {pending ? "로그인 중..." : "admin / 1234로 로그인"}
        </button>
        <button
          type="button"
          className="touch-button--secondary"
          onClick={() => {
            setLoginId(devSafeLoginId);
            setPassword(devSafeLoginPassword);
            setRoleCode("COMPANY_ADMIN");
            setRememberSession(true);
            setErrorMessage(null);
          }}
        >
          기본값으로 되돌리기
        </button>
      </div>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </form>
  );
}
