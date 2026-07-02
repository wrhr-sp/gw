"use client";

import React, { useEffect, useState } from "react";

import { appRoutes, errorResponseSchema, meResponseSchema, type MeResponse } from "@gw/shared";

import { Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ForbiddenAccessData = {
  user: MeResponse["data"]["user"] | null;
};

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchForbiddenAccessData(): Promise<ForbiddenAccessData> {
  const response = await fetch(appRoutes.me, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = meResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("권한 확인 응답 형식이 계약과 맞지 않습니다.");
  return { user: parsed.data.data.user };
}

export function ForbiddenAccessPanel() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<ForbiddenAccessData>({ user: null });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function reloadAccess() {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      setData(await fetchForbiddenAccessData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "권한 확인에 실패했습니다.");
    }
  }

  useEffect(() => { void reloadAccess(); }, []);

  return (
    <div className="feature-workspace__rows" aria-label="접근 차단 실제 권한 확인">
      <article className="feature-workspace__row">
        <div>
          <strong>현재 세션 권한</strong>
          <span>{data.user ? `${data.user.fullName} · ${data.user.roleCodes.join(", ")}` : "세션 확인 전"}</span>
          <p>{errorMessage ?? "접근 차단 안내도 실제 /api/me 응답을 기준으로 현재 역할을 다시 확인합니다."}</p>
          <div className="pill-row">
            <Pill tone="warning">권한 경계 유지</Pill>
            <Pill>same-origin API</Pill>
          </div>
        </div>
        <em>{loadState === "loading" ? "조회" : loadState === "error" ? "오류" : "확인"}</em>
      </article>
    </div>
  );
}
