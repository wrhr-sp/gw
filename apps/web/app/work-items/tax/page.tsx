import React from "react";

import { WorkItemModuleLiveSection } from "../../_components/phase35-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { WorkItemModulePage } from "../_components/work-items-pages";

export default function WorkItemsTaxPage() {
  return (
    <>
      <PageShell
        backHref="/management"
        backLabel="경영업무로"
        eyebrow="Phase 35 세무 관리자흐름 UAT"
        title="세무 업무 실사용 패널"
        description="세무 업무 목록, 상세, review/document/deadline 흐름을 실제 same-origin API 응답으로 먼저 확인합니다."
        actions={
          <div className="pill-row">
            <Pill tone="accent">module=tax</Pill>
            <Pill>list → detail → review</Pill>
          </div>
        }
      >
        <SurfaceSection title="실사용 세무 패널" description="증빙 제출, HQ review, 마감 상태를 API 응답 기준으로 바로 확인합니다.">
          <WorkItemModuleLiveSection module="tax" />
        </SurfaceSection>
      </PageShell>
      <WorkItemModulePage module="tax" />
    </>
  );
}
