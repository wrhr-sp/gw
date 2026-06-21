import React from "react";

import { BranchOperationsLiveSection } from "../../_components/phase34-live-sections";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { WorkItemModulePage } from "../_components/work-items-pages";

const branchScopeNotes = [
  "이 화면은 일반 직원 홈이 아니라 `/management` 아래 branch scope 운영 레인입니다.",
  "본사 운영과 지점 관리자 가시 범위를 같은 full access 처럼 뭉개지 않습니다.",
  "업무 목록, 상세, 문서, 마감 응답은 회사 전체 자유 접근이 아니라 role-aware branch scope 로 설명합니다.",
  "`/employees`, `/org` 는 read-only 확인 레인이고 `/management` 운영 검토와 같은 책임으로 섞지 않습니다.",
] as const;

const branchPilotSequence = [
  "/dashboard 에서 공통 landing 뒤 지점 업무 CTA 문맥 확인",
  "/work-items/branch 에서 branch 목록 → 상세 → 문서 → 마감 흐름 확인",
  "/employees 에서 읽기 중심 직원 조회가 운영 변경 화면처럼 보이지 않는지 확인",
  "/org 에서 지점/부서/역할 구조를 read-only 로 확인",
  "/management 문맥을 보더라도 branch scope 와 company scope 를 같은 권한처럼 설명하지 않는지 확인",
] as const;

const branchRecordingPrompts = [
  "happy path: 지점 업무 흐름이 자기 지점 범위 안에서 자연스럽게 이어지는가",
  "forbidden: 회사 전체 운영 권한이 없는 역할에 branch/company 경계가 분명히 보이는가",
  "empty/error/loading: 빈 상태·실패·대기 상태가 같은 의미로 뭉개지지 않는가",
  "mobile/PC: 지점 업무 카드와 CTA 순서가 좁은 화면에서도 먼저 읽히는가",
] as const;

export default function WorkItemsBranchPage() {
  return (
    <>
      <PageShell
        backHref="/management"
        backLabel="경영업무로"
        eyebrow="Phase 42 branch scope 지점 운영 도입"
        title="지점 업무 실사용 패널"
        titleHref="/management"
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
        <SurfaceSection title="Phase 49 지점관리자 추천 순서" description="이번 파일럿/UAT 에서는 branch scope 와 company scope 차이가 같은 문장으로 남도록 아래 순서로 확인합니다.">
          <ol className="number-list">
            {branchPilotSequence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </SurfaceSection>
        <SurfaceSection title="UAT 기록 포인트" description="지점 레인에서도 happy/forbidden/empty/error/loading/mobile-PC 기준을 같은 언어로 기록합니다.">
          <ul className="summary-list">
            {branchRecordingPrompts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SurfaceSection>
      </PageShell>
      <WorkItemModulePage module="branch" />
    </>
  );
}
