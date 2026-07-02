"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  listBranchesResponseSchema,
  workItemListResponseSchema,
  type BranchSummary,
  type WorkItem,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;
type OperationsData = { branches: BranchSummary[]; workItems: WorkItem[] };

const seedData: OperationsData = {
  branches: [
    { id: "branch_gangnam", companyId: "company_demo", code: "GN", name: "강남지점", branchType: "branch", status: "active" },
    { id: "branch_busan", companyId: "company_demo", code: "BS", name: "부산지점", branchType: "branch", status: "active" },
    { id: "branch_daejeon", companyId: "company_demo", code: "DJ", name: "대전지점", branchType: "branch", status: "active" },
  ],
  workItems: [],
};

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

async function fetchOperationsData(): Promise<OperationsData> {
  const [branches, workItems] = await Promise.all([
    fetchJson(appRoutes.org.branches, (payload) => {
      const parsed = listBranchesResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("지점 목록 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(`${appRoutes.workItems.list}?module=branch`, (payload) => {
      const parsed = workItemListResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("운영 업무 목록 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
  ]);
  return { branches, workItems };
}

const statusLabel = (status: string) => status === "active" ? "정상" : "확인";

export default function OperationsPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<OperationsData>(seedData);
  const [toast, setToast] = useState<ToastState>(null);

  const activeBranches = useMemo(() => data.branches.filter((branch) => branch.status === "active"), [data.branches]);
  const pendingItems = useMemo(() => data.workItems.filter((item) => item.status !== "done"), [data.workItems]);
  const issueItems = useMemo(() => data.workItems.filter((item) => item.title.includes("이슈") || item.descriptionPreview.includes("이슈")), [data.workItems]);

  async function reloadOperations() {
    setLoadState("loading");
    setToast(null);
    try {
      setData(await fetchOperationsData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "운영 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadOperations(); }, []);

  return (
    <PageShell title="운영사업부 포털" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="운영사업부 포털 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadOperations()} type="button">운영사업부 포털</button></h1>
            <FeaturePageOverflowMenu label="운영사업부 포털" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="운영사업부 포털 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>운영 현황</span><strong>전체</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>지점 권한</span><strong>계정별</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>보고 관리</span><strong>읽기</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>지점 생성</span><strong>권한</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="operations-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="operations-panel-heading">운영 현황</h2>
              <p>운영사업부가 먼저 봐야 할 지점별 보고와 처리 상태를 실제 API 기준으로 모아 보여줍니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">operations.portal.read 권한이 있는 계정만 운영사업부 포털에 진입합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>접근 가능 지점</span><strong>{activeBranches.length}곳</strong><p>회사/지점 범위 조회 결과</p></article>
            <article className="feature-workspace__status"><span>오늘 보고</span><strong>{data.workItems.length}건</strong><p>지점관리 업무 API 기준</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>검토 필요</span><strong>{pendingItems.length}건</strong><p>완료 전 업무</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="운영 현황">
            {loadState === "loading" && data.branches.length === 0 ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>운영 현황 조회</span></div><em>대기</em></article> : null}
            {data.branches.map((branch) => (
              <article className="feature-workspace__row" key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>{`${branch.code} · ${branch.branchType}`}</span>
                  <p>{branch.status === "active" ? "매출보고 제출 · 운영이슈 없음" : "운영 상태 확인 필요"}</p>
                  <div className="feature-workspace__row-actions" aria-label={`${branch.id} 운영 지점 처리`}>
                    <a className="feature-workspace__row-action feature-workspace__row-action--secondary" href={`/operations/branches/${branch.id}`}>지점 보기</a>
                    <button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">이슈 확인</button>
                  </div>
                </div>
                <em>{statusLabel(branch.status)}</em>
              </article>
            ))}
          </div>

          <div className="feature-workspace__rows" aria-label="보고 관리">
            <article className="feature-workspace__row"><div><strong>지점 권한</strong><span>계정별로 접근 가능한 지점만 검색 팝업과 지점 상세에 노출합니다.</span><p>branch.access 권한이 없는 지점은 검색 결과와 직접 URL 접근 모두 차단합니다.</p></div><em>계정별</em></article>
            {data.workItems.length === 0 ? <article className="feature-workspace__row"><div><strong>보고 관리</strong><span>매출보고, 운영이슈, 입금요청을 지점별로 작성·제출·검토합니다.</span><p>은행·회계 API 자동연동은 이번 1차 범위 밖입니다.</p></div><em>읽기</em></article> : data.workItems.slice(0, 4).map((item) => <article className="feature-workspace__row" key={item.id}><div><strong>{item.title}</strong><span>{item.module} · {item.status}</span><p>{item.descriptionPreview}</p></div><em>{item.priority}</em></article>)}
            <article className="feature-workspace__row"><div><strong>지점 생성 권한</strong><span>새 지점 페이지 생성은 운영사업부 관리자와 총괄관리계정만 요청할 수 있습니다.</span><p>branch.page.create 권한이 없으면 생성 버튼 대신 차단 안내만 보입니다.</p><div className="feature-workspace__row-actions" aria-label="지점 생성 요청"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">지점 생성 요청</button></div></div><em>권한</em></article>
            <article className="feature-workspace__row"><div><strong>운영이슈</strong><span>{issueItems.length}건</span><p>민감한 계좌/실입금 정보는 별도 승인 전 입력하지 않습니다.</p></div><em>검토</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
