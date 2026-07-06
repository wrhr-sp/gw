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

import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { Pill } from "../../../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type BranchDetailData = { branches: BranchSummary[]; workItems: WorkItem[] };

const branchMap: Record<string, { name: string; region: string; manager: string; access: string }> = {
  gangnam: { name: "강남지점", region: "서울", manager: "담당자 미지정", access: "운영관리" },
  seoul: { name: "서울지점", region: "서울", manager: "담당자 미지정", access: "운영관리" },
  busan: { name: "부산지점", region: "부산", manager: "담당자 미지정", access: "운영관리" },
  daejeon: { name: "대전지점", region: "대전", manager: "담당자 미지정", access: "운영관리" },
  gwangju: { name: "광주지점", region: "광주", manager: "담당자 미지정", access: "운영관리" },
};

const initialData: BranchDetailData = { branches: [], workItems: [] };

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

async function fetchBranchDetailData(): Promise<BranchDetailData> {
  const [branches, workItems] = await Promise.all([
    fetchJson(appRoutes.org.branches, (payload) => {
      const parsed = listBranchesResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("지점 목록 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
    fetchJson(`${appRoutes.workItems.list}?module=branch`, (payload) => {
      const parsed = workItemListResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("지점 업무 목록 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data.items;
    }),
  ]);
  return { branches, workItems };
}

function resolveBranch(branchId: string, branches: BranchSummary[]) {
  const mapped = branchMap[branchId];
  const apiBranch = branches.find((branch) => branch.id === branchId || branch.code.toLowerCase() === branchId.toLowerCase());
  if (apiBranch) return { name: apiBranch.name, region: apiBranch.code, manager: "담당자 확인", access: "branch.access" };
  return mapped ?? { name: "접근 제한 지점", region: "권한 확인", manager: "담당자 확인 필요", access: "권한 없음" };
}

export function BranchDetailClient({ branchId }: { branchId: string }) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<BranchDetailData>(initialData);
  const [toast, setToast] = useState<ToastState>(null);

  const branch = resolveBranch(branchId, data.branches);
  const isAllowed = branch.access !== "권한 없음";
  const branchItems = useMemo(() => data.workItems.filter((item) => item.branchId === branchId || item.branchLabel === branch.name), [branch.name, branchId, data.workItems]);
  const issueItems = useMemo(() => branchItems.filter((item) => item.title.includes("이슈") || item.descriptionPreview.includes("이슈")), [branchItems]);

  async function reloadDetail() {
    setLoadState("loading");
    setToast(null);
    try {
      setData(await fetchBranchDetailData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "지점 상세를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadDetail(); }, []);

  return (
    <div className="feature-workspace">
      <aside className="feature-workspace__nav" aria-label={`${branch.name} 지점관리 메뉴`}>
        <div className="feature-workspace__nav-header">
          <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadDetail()} type="button">{`${branch.name} 지점관리`}</button></h1>
          <FeaturePageOverflowMenu label={`${branch.name} 지점관리`} />
        </div>
        <div className="feature-workspace__tab-list" role="tablist" aria-label="지점 상세 상태">
          <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>지점 요약</span><strong>{branch.region}</strong></button>
          <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>매출보고</span><strong>작성</strong></button>
          <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>운영이슈</span><strong>검토</strong></button>
          <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>입금요청</span><strong>요청</strong></button>
          <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>접근 권한</span><strong>{isAllowed ? "허용" : "차단"}</strong></button>
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-labelledby="branch-detail-heading">
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id="branch-detail-heading">지점 요약</h2>
            <p>계정에 허용된 지점의 오늘 보고와 처리 상태를 실제 API 기준으로 확인합니다.</p>
          </div>
          <p className="feature-workspace__permission-hint">branch.access 권한이 있어야 지점 상세와 보고 목록을 볼 수 있습니다.</p>
        </div>

        {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

        <div className="feature-workspace__status-grid">
          <article className="feature-workspace__status feature-workspace__status--accent"><span>오늘 매출보고</span><strong>{isAllowed ? "제출" : "차단"}</strong><p>{loadState === "loading" ? "조회 중" : "지점 업무 API 기준"}</p></article>
          <article className="feature-workspace__status"><span>운영이슈</span><strong>{issueItems.length}건</strong><p>시설, 인력, 고객 응대 이슈</p></article>
          <article className="feature-workspace__status"><span>입금요청</span><strong>{branchItems.length}건</strong><p>처리 상태 추적</p></article>
        </div>

        <div className="feature-workspace__rows" aria-label="지점 요약">
          {isAllowed ? (
            <article className="feature-workspace__row"><div><strong>오늘 보고</strong><span>{`${branch.region} · ${branch.manager}`}</span><p>매출보고 제출 · 특이사항 없음</p><div className="feature-workspace__row-actions" aria-label="오늘 보고 처리"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">상세 보기</button></div></div><em>완료</em></article>
          ) : <article className="feature-workspace__row"><div><strong>접근 차단</strong><span>이 계정에는 해당 지점 접근권한이 없습니다.</span></div><em>차단</em></article>}
          {branchItems.length === 0 ? <article className="feature-workspace__row"><div><strong>운영이슈</strong><span>인력 공백 보완 요청</span><p>현재 API 기준 지점 업무가 없으면 작성 버튼 대신 안내만 표시합니다.</p></div><em>검토</em></article> : branchItems.slice(0, 3).map((item) => <article className="feature-workspace__row" key={item.id}><div><strong>{item.title}</strong><span>{item.status} · {item.priority}</span><p>{item.descriptionPreview}</p></div><em>{item.module}</em></article>)}
          <article className="feature-workspace__row"><div><strong>입금요청</strong><span>카드 정산 입금 확인 요청</span><p>계좌번호·실입금 민감정보는 별도 승인 전 입력하지 않습니다.</p></div><em>처리중</em></article>
        </div>

        <div className="feature-workspace__rows" aria-label="접근 권한">
          <article className="feature-workspace__row"><div><strong>매출보고</strong><span>branch.report.sales.write</span><p>매출보고 제출과 임시저장은 실제 매출 실데이터 승인 후 연결합니다.</p><div className="feature-workspace__row-actions" aria-label="매출보고 제출"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">매출보고 제출</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">임시저장</button></div></div><em>{isAllowed ? "작성 가능" : "권한 필요"}</em></article>
          <article className="feature-workspace__row"><div><strong>운영이슈</strong><span>branch.report.issue.write</span><p>대체 인력 요청과 처리 완료는 별도 mutation 범위에서 연결합니다.</p><div className="feature-workspace__row-actions" aria-label="이슈 등록"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">이슈 등록</button></div></div><em>{isAllowed ? "작성 가능" : "권한 필요"}</em></article>
          <article className="feature-workspace__row"><div><strong>입금요청</strong><span>branch.payment.request.write</span><p>은행 API 자동확인은 이번 1차 범위 밖입니다.</p><div className="feature-workspace__row-actions" aria-label="입금요청 제출"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">입금요청 제출</button></div></div><em>{isAllowed ? "요청 가능" : "권한 필요"}</em></article>
        </div>
      </section>
    </div>
  );
}
