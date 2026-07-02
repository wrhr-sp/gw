"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  workItemListResponseSchema,
  type WorkItem,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type SalesData = { contractItems: WorkItem[]; branchItems: WorkItem[] };

const seedData: SalesData = { contractItems: [], branchItems: [] };

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchWorkItems(route: string) {
  const response = await fetch(route, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const parsed = workItemListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("영업 업무 응답 형식이 계약과 맞지 않습니다.");
  return parsed.data.data.items;
}

async function fetchSalesData(): Promise<SalesData> {
  const [contractItems, branchItems] = await Promise.all([
    fetchWorkItems(`${appRoutes.workItems.list}?module=legal`),
    fetchWorkItems(`${appRoutes.workItems.list}?module=branch`),
  ]);
  return { contractItems, branchItems };
}

function statusLabel(status: WorkItem["status"]) {
  if (status === "archived") return "완료";
  if (status === "waiting_review") return "검토";
  if (status === "blocked") return "보류";
  return "진행";
}

export default function SalesPage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<SalesData>(seedData);
  const [toast, setToast] = useState<ToastState>(null);

  const activeContracts = useMemo(() => data.contractItems.filter((item) => item.status !== "archived"), [data.contractItems]);
  const followups = useMemo(() => data.branchItems.filter((item) => item.status !== "archived"), [data.branchItems]);

  async function reloadSales() {
    setLoadState("loading");
    setToast(null);
    try {
      setData(await fetchSalesData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "영업 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadSales(); }, []);

  return (
    <PageShell title="영업관리" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="영업관리 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadSales()} type="button">영업관리</button></h1>
            <FeaturePageOverflowMenu label="영업관리" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="영업관리 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>영업 현황</span><strong>{activeContracts.length + followups.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>거래처</span><strong>관리</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>후속 연락</span><strong>{followups.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>계약 검토</span><strong>{activeContracts.length}</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="sales-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="sales-heading">영업 현황</h2>
              <p>신규 문의부터 계약 검토까지 확인할 거래 흐름을 실제 업무 API 기준으로 봅니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">영업 생성/배정/완료 처리는 별도 승인된 저장 API 범위에서만 연결합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status"><span>신규 문의</span><strong>{followups.length}건</strong><p>지점 영업 운영 흐름</p></article>
            <article className="feature-workspace__status feature-workspace__status--accent"><span>상담 진행</span><strong>{activeContracts.length + followups.length}건</strong><p>{loadState === "loading" ? "조회 중" : "업무 API 반영"}</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>계약 검토</span><strong>{activeContracts.length}건</strong><p>법무 업무 API 기준</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="영업 현황">
            {data.branchItems.length === 0 && data.contractItems.length === 0 ? <article className="feature-workspace__row"><div><strong>표시할 영업 업무 없음</strong><span>현재 same-origin 업무 API에 영업/계약 검토 항목이 없습니다.</span><p>빈 상태는 샘플 고객으로 채우지 않고 실제 조회 결과 그대로 보여 줍니다.</p></div><em>empty</em></article> : null}
            {data.branchItems.slice(0, 3).map((item) => <article className="feature-workspace__row" key={item.id}><div><strong>{item.title}</strong><span>{item.branchLabel ?? item.category}</span><p>{item.descriptionPreview}</p></div><em>{statusLabel(item.status)}</em></article>)}
            {data.contractItems.slice(0, 3).map((item) => <article className="feature-workspace__row" key={item.id}><div><strong>{item.title}</strong><span>{item.category}</span><p>{item.descriptionPreview}</p></div><em>{statusLabel(item.status)}</em></article>)}
          </div>

          <div className="feature-workspace__rows" aria-label="거래처와 계약 검토">
            <article className="feature-workspace__row"><div><strong>거래처</strong><span>최근 거래처와 담당자, 다음 연락 일정을 함께 확인합니다.</span><p>거래처 등록은 현재 범위 밖이라 저장 API를 호출하지 않습니다.</p><div className="feature-workspace__row-actions" aria-label="거래처 등록"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">거래처 등록</button></div></div><em>관리</em></article>
            <article className="feature-workspace__row"><div><strong>후속 연락</strong><span>처리해야 할 연락과 이번 주 마감 건을 분리합니다.</span><p>완료 처리와 일정 변경은 실제 mutation 범위가 승인되면 연결합니다.</p><div className="feature-workspace__row-actions" aria-label="후속 연락 처리"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">완료 처리</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">일정 변경</button></div></div><em>{followups.length}건</em></article>
            <article className="feature-workspace__row"><div><strong>계약 검토</strong><span>계약 단계의 법무 검토와 보완 요청 상태를 확인합니다.</span><p>법무 검토 업무는 /api/work-items?module=legal 조회 결과를 우선 표시합니다.</p><div className="feature-workspace__row-actions" aria-label="상담 등록"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">상담 등록</button><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">담당자 배정</button></div></div><em>{activeContracts.length}건</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
