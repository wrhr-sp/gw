import React from "react";

import { WorkItemModuleLiveSection } from "../../_components/phase35-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { WorkItemModulePage } from "../_components/work-items-pages";

export default function WorkItemsLegalPage() {
  return (
    <>
      <PageShell
        backHref="/management"
        backLabel="경영업무로"
        eyebrow="Phase 35 법무 관리자흐름 UAT"
        title="법무 업무 실사용 패널"
        titleHref="/management"
        description="법무 업무 목록, company/branch visibility, review/document/deadline 흐름을 실제 same-origin API 응답으로 먼저 확인합니다."
        actions={
          <div className="pill-row">
            <Pill tone="accent">module=legal</Pill>
            <Pill>company / branch guard</Pill>
          </div>
        }
      >
        <SurfaceSection title="실사용 법무 패널" description="계약 검토, 갱신 예정, 분쟁 후속 metadata 와 승인 게이트를 API 응답 기준으로 확인합니다.">
          <WorkItemModuleLiveSection module="legal" />
        </SurfaceSection>
      </PageShell>
      <WorkItemModulePage module="legal" />
    </>
  );
}
