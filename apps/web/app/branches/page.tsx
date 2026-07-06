"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  listBranchesResponseSchema,
  type BranchSummary,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

const initialBranches: BranchSummary[] = [];

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchBranches(): Promise<BranchSummary[]> {
  const response = await fetch(appRoutes.org.branches, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = listBranchesResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("지점 목록 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

export default function BranchesPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [branches, setBranches] = useState<BranchSummary[]>(initialBranches);
  const [toast, setToast] = useState<ToastState>(null);

  const activeBranches = useMemo(() => branches.filter((branch) => branch.status === "active"), [branches]);
  const inactiveBranches = useMemo(() => branches.filter((branch) => branch.status !== "active"), [branches]);
  const selectedBranch = activeBranches[0] ?? branches[0] ?? null;

  async function reloadBranches() {
    setLoadState("loading");
    setToast(null);
    try {
      setBranches(await fetchBranches());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "지점 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadBranches(); }, []);

  return (
    <PageShell title="지점관리" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="지점관리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadBranches()} type="button">지점관리</button></h1>
            <FeaturePageOverflowMenu label="지점관리" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="지점관리 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>지점 현황</span><strong>{branches.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>인력/근태</span><strong>확인</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>요청 처리</span><strong>읽기</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>운영 기준</span><strong>정책</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="branches-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="branches-panel-heading">지점 현황</h2>
              <p>지역, 담당자, 운영 상태를 실제 지점 API 기준으로 봅니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">지점 추가·비활성화는 관리자 승인 후 처리합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>운영 지점</span><strong>{activeBranches.length}곳</strong><p>현재 활성 지점</p></article>
            <article className="feature-workspace__status"><span>오늘 출근</span><strong>확인</strong><p>근태 상세 API 연결 전 지점 단위 확인</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>확인 필요</span><strong>{inactiveBranches.length}곳</strong><p>비활성 또는 운영 확인 대상</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="지점 현황">
            {loadState === "loading" && branches.length === 0 ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>지점 목록 조회</span></div><em>대기</em></article> : null}
            {branches.length === 0 && loadState !== "loading" ? <article className="feature-workspace__row"><div><strong>표시할 지점이 없으면</strong><span>회사 또는 지점 접근 범위를 먼저 확인합니다.</span></div><em>범위 확인</em></article> : null}
            {branches.map((branch) => (
              <article className="feature-workspace__row" key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>{`${branch.code} · ${branch.branchType} · ${branch.companyId}`}</span>
                  <p>기존 지점관리포털 경로와 일반(공통)업무 경로를 분리합니다.</p>
                  <div className="feature-workspace__row-actions" aria-label={`${branch.id} 지점 조회`}>
                    <a className="feature-workspace__row-action feature-workspace__row-action--secondary" href={`/Place of business/${branch.id}`}>지점 보기</a>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">담당자 확인</button>
                  </div>
                </div>
                <em>{branch.status === "active" ? "정상" : "확인"}</em>
              </article>
            ))}
          </div>

          <div className="feature-workspace__rows" aria-label="지점 운영 기준">
            <article className="feature-workspace__row"><div><strong>인력/근태</strong><span>지점별 출근율, 지각, 미출근, 대체근무 필요 여부를 확인합니다.</span><p>상세 근태 변경은 /attendance 실 API 흐름에서만 처리합니다.</p></div><em>확인</em></article>
            <article className="feature-workspace__row"><div><strong>요청 처리</strong><span>근태 정정, 휴가 확인, 담당자 확인 요청을 읽기 기준으로 확인합니다.</span><p>선택 승인/보완 요청은 별도 승인 mutation 범위에서 연결합니다.</p></div><em>읽기</em></article>
            <article className="feature-workspace__row"><div><strong>운영 기준</strong><span>{selectedBranch ? `${selectedBranch.name} · ${selectedBranch.code}` : "지점 선택"}</span><p>지점 기본 정보, 담당자, 운영 상태 변경 전 확인할 기준입니다.</p><div className="feature-workspace__row-actions" aria-label="지점 변경 요청"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">변경 요청</button></div></div><em>정책</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
