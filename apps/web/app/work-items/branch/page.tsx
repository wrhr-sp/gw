import React from "react";

import { BranchOperationsLiveSection } from "../../_components/phase34-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { WorkItemModulePage } from "../_components/work-items-pages";

const branchScopeNotes = [
  "이 화면은 일반 직원 홈이 아니라 `/management` 아래 branch scope 운영 레인입니다.",
  "본사 운영과 지점 관리자 가시 범위를 같은 full access 처럼 뭉개지 않습니다.",
  "업무 목록, 상세, 문서, 마감 응답은 회사 전체 자유 접근이 아니라 role-aware branch scope 로 설명합니다.",
] as const;

export default function WorkItemsBranchPage() {
  return (
    <>
      <PageShell
        backHref="/management"
        backLabel="경영업무로"
        eyebrow="Phase 42 branch scope 지점 운영 도입"
        title="지점 업무 실사용 패널"
        description="경영업무 허브 아래에서 branch scope 업무 목록, 상세, 문서, 마감 응답을 먼저 직접 확인한 뒤 공통 설명 섹션으로 이어집니다."
        actions={
          <div className="pill-row">
            <Pill tone="accent">module=branch</Pill>
            <Pill>list → detail</Pill>
          </div>
        }
      >
        <SurfaceSection title="실사용 branch 패널" description="지점 업무 happy path 를 공통 work item API 응답으로 바로 확인합니다.">
          <BranchOperationsLiveSection />
        </SurfaceSection>
        <SurfaceSection title="branch scope 가드레일" description="일반 직원 홈과 섞이지 않도록 지점 운영 책임 경계를 먼저 적어 둡니다.">
          <ul className="summary-list">
            {branchScopeNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SurfaceSection>
      </PageShell>
      <WorkItemModulePage module="branch" />
    </>
  );
}
