import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const branchSummaryCards = [
  {
    title: "운영 지점",
    value: "8곳",
    detail: "정상 운영 7곳 · 확인 필요 1곳",
  },
  {
    title: "오늘 출근 현황",
    value: "94%",
    detail: "지점별 출근/지각/미출근 요약 preview",
  },
  {
    title: "미처리 요청",
    value: "6건",
    detail: "근태 정정 3건 · 휴가 확인 2건 · 담당자 확인 1건",
  },
] as const;

const branchRows = [
  { name: "강남지점", region: "서울", manager: "김지윤", employees: "28명", status: "정상 운영" },
  { name: "부산지점", region: "부산", manager: "박민재", employees: "19명", status: "근태 확인 필요" },
  { name: "대전지점", region: "대전", manager: "이서연", employees: "14명", status: "정상 운영" },
  { name: "광주지점", region: "광주", manager: "최현우", employees: "12명", status: "정상 운영" },
] as const;

export default function BranchesPage() {
  return (
    <PageShell title="지점관리" titleHref="/branches">
      <div className="grid-auto-compact">
        {branchSummaryCards.map((card) => (
          <article key={card.title} className="info-card">
            <Pill tone="accent">{card.title}</Pill>
            <h3>{card.value}</h3>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <SurfaceSection title="지점 목록" description="일반업무포털 안에서 지점 기본 정보와 운영 상태를 확인하는 별도 지점관리 화면입니다.">
        <div className="grid-auto-compact">
          {branchRows.map((branch) => (
            <article key={branch.name} className="route-card">
              <h3>{branch.name}</h3>
              <p>{branch.region} · 담당자 {branch.manager}</p>
              <p className="card-note">직원 {branch.employees} · {branch.status}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="운영 경계" description="이 화면은 기존 지점관리포털과 분리된 일반업무포털 기능입니다.">
        <ul className="summary-list">
          <li>기존 지점관리포털(`/work-items/branch`)로 전환하지 않습니다.</li>
          <li>지점 목록·담당자·운영 상태를 일반업무포털 문맥에서 확인합니다.</li>
          <li>지점 추가, 수정, 비활성화 같은 저장 기능은 별도 승인 전까지 preview 로만 둡니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
