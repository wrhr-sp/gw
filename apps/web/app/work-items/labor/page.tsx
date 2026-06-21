import React from "react";

import { WorkItemModuleLiveSection } from "../../_components/phase35-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { WorkItemModulePage } from "../_components/work-items-pages";

export default function WorkItemsLaborPage() {
  return (
    <>
      <PageShell
        backHref="/management"
        backLabel="경영업무로"
        eyebrow="Phase 35 노무 관리자흐름 UAT"
        title="노무 업무 실사용 패널"
        titleHref="/management"
        description="노무 업무 목록, restricted scope, review/document/deadline 흐름을 실제 same-origin API 응답으로 먼저 확인합니다."
        actions={
          <div className="pill-row">
            <Pill tone="accent">module=labor</Pill>
            <Pill>restricted capability</Pill>
          </div>
        }
      >
        <SurfaceSection title="실사용 노무 패널" description="self/branch/restricted 경계와 metadata 중심 후속 흐름을 API 응답 기준으로 확인합니다.">
          <WorkItemModuleLiveSection module="labor" />
        </SurfaceSection>
      </PageShell>
      <WorkItemModulePage module="labor" />
    </>
  );
}
