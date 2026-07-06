"use client";

import React, { useEffect, useMemo, useState } from "react";

import { appRoutes, errorResponseSchema, listBranchesResponseSchema, type BranchSummary } from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

const initialBranches: BranchSummary[] = [];

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchBranches() {
  const response = await fetch(appRoutes.org.branches, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = listBranchesResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("지점 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

function branchAccess(branch: BranchSummary) {
  if (branch.branchType === "office") return "전체 운영관리";
  if (branch.branchType === "hotel") return "호텔 운영 확인";
  return "지점 운영 확인";
}

export default function PlaceOfBusinessPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [branches, setBranches] = useState<BranchSummary[]>(initialBranches);
  const [toast, setToast] = useState<ToastState>(null);

  const activeBranches = useMemo(() => branches.filter((branch) => branch.status === "active"), [branches]);
  const inactiveBranches = useMemo(() => branches.filter((branch) => branch.status !== "active"), [branches]);

  async function reloadBranches() {
    setLoadState("loading");
    setToast(null);
    try {
      setBranches(await fetchBranches());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "지점 목록을 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadBranches(); }, []);

  return (
    <PageShell title="지점관리포털 / Place of business" titlePlacement="content" titleHref={null}>
      <SurfaceSection title="지점관리포털 / Place of business" description="접근 가능한 지점을 실제 지점 API 기준으로 선택하면 해당 지점관리 페이지가 새 흐름으로 열립니다.">
        <div className="feature-workspace__nav-header">
          <div className="feature-workspace__status-grid" aria-label="지점관리포털 요약">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>접근 가능 지점</span><strong>{activeBranches.length}곳</strong><p>{loadState === "loading" ? "조회 중" : "운영 DB 조회 결과"}</p></article>
            <article className="feature-workspace__status"><span>상태 확인</span><strong>{inactiveBranches.length}곳</strong><p>비활성/차단 지점</p></article>
          </div>
          <FeaturePageOverflowMenu label="지점관리포털" />
        </div>

        {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

        <div className="feature-workspace__rows">
          {branches.map((branch) => (
            <article className="feature-workspace__row" key={branch.id}>
              <div>
                <strong>{branch.name}</strong>
                <span>{branch.code} · {branch.branchType} · {branchAccess(branch)}</span>
                <p>{branch.status === "active" ? "접근 가능한 지점입니다." : "권한 또는 상태 확인이 필요합니다."}</p>
              </div>
              <a href={`/Place of business/${branch.id}`}>지점 보기</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="보고 기능" description="지점별 매출보고, 운영이슈, 입금요청을 지점 상세 화면에서 처리합니다." muted>
        <ul className="summary-list">
          <li>매출보고: 일 매출, 결제수단, 특이사항 작성</li>
          <li>운영이슈: 시설, 인력, 고객 응대 이슈 등록</li>
          <li>입금요청: 요청 금액, 예정일, 증빙 준비</li>
        </ul>
        <button className="feature-workspace__row-action feature-workspace__row-action--secondary" onClick={() => void reloadBranches()} type="button">지점 목록 새로고침</button>
      </SurfaceSection>
    </PageShell>
  );
}
