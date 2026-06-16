import React from "react";

import { BranchOperationsLiveSection } from "../../_components/phase34-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { WorkItemModulePage } from "../_components/work-items-pages";

export default function WorkItemsBranchPage() {
  return (
    <>
      <PageShell
        backHref="/dashboard"
        backLabel="대시보드로"
        eyebrow="Phase 34 지점 운영흐름 실사용화"
        title="지점 업무 실사용 패널"
        description="branch scope 업무 목록, 상세, 문서, 마감 응답을 먼저 직접 확인한 뒤 공통 설명 섹션으로 이어집니다."
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
      </PageShell>
      <WorkItemModulePage module="branch" />
    </>
  );
}
