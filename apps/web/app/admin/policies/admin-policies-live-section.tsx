"use client";

import React, { useEffect, useState } from "react";

import { adminPoliciesListResponseSchema, appRoutes, errorResponseSchema, type AdminPolicySummary } from "@gw/shared";

import { Pill } from "../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";

type AdminPoliciesData = {
  items: AdminPolicySummary[];
  summary: string;
};

const seedData: AdminPoliciesData = {
  items: [],
  summary: "정책 candidate 를 불러오기 전입니다.",
};

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchAdminPolicies(): Promise<AdminPoliciesData> {
  const response = await fetch(appRoutes.admin.policies, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = adminPoliciesListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("관리자 정책 응답 형식이 계약과 맞지 않습니다.");
  return {
    items: parsed.data.data.items,
    summary: parsed.data.data.bridgeSummary.currentState,
  };
}

export function AdminPoliciesLiveSection() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<AdminPoliciesData>(seedData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function reloadPolicies() {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      setData(await fetchAdminPolicies());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류입니다.");
    }
  }

  useEffect(() => { void reloadPolicies(); }, []);

  return (
    <div className="feature-workspace__rows" aria-label="실제 관리자 정책 API 목록">
      <article className="feature-workspace__row">
        <div>
          <strong>정책 API 상태</strong>
          <span>{loadState === "loading" ? "조회 중" : data.summary}</span>
          <p>{errorMessage ?? "저장 전 current/candidate/capability/audit preview 를 실제 응답 기준으로 확인합니다."}</p>
        </div>
        <em>{loadState === "error" ? "오류" : "조회"}</em>
      </article>
      {data.items.map((item) => (
        <article className="feature-workspace__row" key={item.category}>
          <div>
            <strong>{item.category}</strong>
            <span>{item.summary}</span>
            <p>{`${item.diffPreview.before} → ${item.diffPreview.after}`}</p>
            <div className="pill-row">
              <Pill>{item.capability}</Pill>
              <Pill tone="warning">reason required</Pill>
            </div>
          </div>
          <em>{item.companyId}</em>
        </article>
      ))}
      {data.items.length === 0 ? (
        <article className="feature-workspace__row">
          <div>
            <strong>정책 candidate 대기</strong>
            <span>정책 목록이 비어 있거나 아직 불러오는 중입니다.</span>
            <p>성공처럼 보이는 대체 저장 결과는 표시하지 않습니다.</p>
          </div>
          <em>대기</em>
        </article>
      ) : null}
    </div>
  );
}
