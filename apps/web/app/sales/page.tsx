import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const salesSummaryCards = [
  {
    title: "오늘 상담",
    value: "12건",
    detail: "신규 문의 4건 · 재상담 8건",
  },
  {
    title: "진행 중 거래",
    value: "7건",
    detail: "제안 3건 · 계약 검토 4건",
  },
  {
    title: "후속 연락",
    value: "5건",
    detail: "오늘 마감 2건 · 이번 주 마감 3건",
  },
] as const;

const salesPipeline = [
  { stage: "신규 문의", count: 4, owner: "영업 1팀" },
  { stage: "상담 진행", count: 8, owner: "담당 영업" },
  { stage: "제안 전달", count: 3, owner: "영업 관리자" },
  { stage: "계약 검토", count: 4, owner: "영업/법무" },
] as const;

export default function SalesPage() {
  return (
    <PageShell title="영업관리" titleHref="/sales">
      <div className="grid-auto-compact">
        {salesSummaryCards.map((card) => (
          <article key={card.title} className="info-card">
            <Pill tone="accent">{card.title}</Pill>
            <h3>{card.value}</h3>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <SurfaceSection title="영업 현황" description="상담, 제안, 계약 검토처럼 오늘 바로 확인할 영업 흐름을 한곳에 모읍니다.">
        <div className="grid-auto-compact">
          {salesPipeline.map((item) => (
            <article key={item.stage} className="route-card">
              <h3>{item.stage}</h3>
              <p>{item.count}건 진행 중</p>
              <p className="card-note">담당: {item.owner}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="거래처/고객" description="최근 거래처와 후속 연락 대상을 먼저 확인하는 1차 영업관리 화면입니다.">
        <ul className="summary-list">
          <li>최근 상담 거래처와 담당자를 확인합니다.</li>
          <li>미처리 후속 연락과 계약 검토 상태를 분리해서 봅니다.</li>
          <li>실제 CRM·외부 영업 도구 연동은 별도 승인 전까지 연결하지 않습니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
