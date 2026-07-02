"use client";

import React, { useEffect, useState } from "react";

import { appRoutes, errorResponseSchema, healthResponseSchema } from "@gw/shared";

type CheckState = "idle" | "checking" | "online" | "offline";

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchHealth() {
  const response = await fetch(appRoutes.health, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = healthResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("헬스체크 응답 형식이 계약과 맞지 않습니다.");
  return `${parsed.data.data.service} · ${parsed.data.data.status} · ${parsed.data.data.version}`;
}

export function OfflineReconnectCheck() {
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [message, setMessage] = useState("아직 연결 확인 전입니다.");

  async function runCheck() {
    setCheckState("checking");
    try {
      setMessage(await fetchHealth());
      setCheckState("online");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "연결 확인에 실패했습니다.");
      setCheckState("offline");
    }
  }

  useEffect(() => { void runCheck(); }, []);

  return (
    <article className="feature-workspace__row">
      <div>
        <strong>연결 재확인</strong>
        <span>{message}</span>
        <p>복구 여부만 확인하며 내부 업무 성공이나 저장 완료로 표시하지 않습니다.</p>
        <div className="feature-workspace__row-actions" aria-label="네트워크 연결 재확인">
          <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void runCheck()} type="button">다시 확인</button>
          {checkState === "online" ? <a className="feature-workspace__row-action feature-workspace__row-action--secondary" href="/login">로그인으로</a> : null}
        </div>
      </div>
      <em>{checkState === "checking" ? "확인 중" : checkState === "online" ? "연결됨" : "안내"}</em>
    </article>
  );
}
