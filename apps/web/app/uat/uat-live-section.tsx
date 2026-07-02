"use client";

import React, { useEffect, useState } from "react";

import { appRoutes, errorResponseSchema, healthResponseSchema, meResponseSchema, type MeResponse } from "@gw/shared";

import { Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type UatLiveData = {
  user: MeResponse["data"]["user"] | null;
  health: string;
};

const seedData: UatLiveData = { user: null, health: "확인 전" };

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

async function fetchUatLiveData(): Promise<UatLiveData> {
  const [user, health] = await Promise.all([
    fetchJson(appRoutes.me, (payload) => {
      const parsed = meResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("UAT 세션 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.user;
    }),
    fetchJson(appRoutes.health, (payload) => {
      const parsed = healthResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("UAT 헬스체크 응답 형식이 계약과 맞지 않습니다.");
      return `${parsed.data.data.service} · ${parsed.data.data.status} · ${parsed.data.data.version}`;
    }),
  ]);
  return { user, health };
}

export function UatLiveSection() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<UatLiveData>(seedData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function reloadUat() {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      setData(await fetchUatLiveData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류입니다.");
    }
  }

  useEffect(() => { void reloadUat(); }, []);

  return (
    <div className="feature-workspace__rows" aria-label="UAT 실환경 기준선">
      <article className="feature-workspace__row">
        <div>
          <strong>세션 기준선</strong>
          <span>{data.user ? `${data.user.fullName} · ${data.user.roleCodes.join(", ")}` : "세션 확인 전"}</span>
          <p>{errorMessage ?? "UAT 참가자가 같은 로그인/권한 상태에서 시작하는지 /api/me 로 확인합니다."}</p>
        </div>
        <em>{loadState === "error" ? "오류" : "확인"}</em>
      </article>
      <article className="feature-workspace__row">
        <div>
          <strong>서비스 기준선</strong>
          <span>{data.health}</span>
          <p>리허설 전에 /api/health 로 live 환경의 최소 liveness 를 확인합니다.</p>
          <div className="pill-row">
            <Pill tone="accent">same-origin</Pill>
            <Pill tone="warning">approval gates kept</Pill>
          </div>
        </div>
        <em>{loadState === "loading" ? "조회" : "기준선"}</em>
      </article>
    </div>
  );
}
