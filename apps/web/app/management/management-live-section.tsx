"use client";

import React, { useEffect, useState } from "react";

import { appRoutes, errorResponseSchema, healthResponseSchema, meResponseSchema, type MeResponse } from "@gw/shared";

import { Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ManagementLiveData = {
  user: MeResponse["data"]["user"] | null;
  health: string;
};

const seedData: ManagementLiveData = { user: null, health: "확인 전" };

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parse(await response.json());
}

async function fetchManagementLiveData(): Promise<ManagementLiveData> {
  const [me, health] = await Promise.all([
    fetchJson(appRoutes.me, (payload) => {
      const parsed = meResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("내 정보 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.user;
    }),
    fetchJson(appRoutes.health, (payload) => {
      const parsed = healthResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("헬스체크 응답 형식이 계약과 맞지 않습니다.");
      return `${parsed.data.data.service} · ${parsed.data.data.status} · ${parsed.data.data.version}`;
    }),
  ]);
  return { user: me, health };
}

export function ManagementLiveSection() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<ManagementLiveData>(seedData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function reloadManagement() {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      setData(await fetchManagementLiveData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류입니다.");
    }
  }

  useEffect(() => { void reloadManagement(); }, []);

  return (
    <div className="feature-workspace__rows" aria-label="경영업무 실제 운영 기준선">
      <article className="feature-workspace__row">
        <div>
          <strong>세션/역할 기준선</strong>
          <span>{data.user ? `${data.user.fullName} · ${data.user.roleCodes.join(", ")}` : "세션 확인 전"}</span>
          <p>{errorMessage ?? "현재 로그인 사용자의 역할과 권한을 실제 /api/me 응답으로 확인합니다."}</p>
        </div>
        <em>{loadState === "error" ? "오류" : "확인"}</em>
      </article>
      <article className="feature-workspace__row">
        <div>
          <strong>운영 최소 liveness</strong>
          <span>{data.health}</span>
          <p>/api/health 로 서비스 상태만 확인하며 관제 완료처럼 표시하지 않습니다.</p>
        </div>
        <em>{loadState === "loading" ? "조회" : "기준선"}</em>
      </article>
      <article className="feature-workspace__row">
        <div>
          <strong>운영 레인 이동</strong>
          <span>/management → /admin/users → /admin/policies → /admin/audit-logs → /api/health</span>
          <p>역할별 허용 범위 안에서만 민감 운영 레인을 이어 봅니다.</p>
          <div className="pill-row">
            <Pill tone="warning">role guard</Pill>
            <Pill>same-origin API</Pill>
          </div>
        </div>
        <em>분리</em>
      </article>
    </div>
  );
}
