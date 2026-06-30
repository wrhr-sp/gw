import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../../_components/feature-workspace";
import { PageShell } from "../../_components/page-shell";
import {
  getWorkItemModuleCard,
  workItemModuleCards,
  type WorkItemModuleKey,
} from "../work-items-config";

function buildModuleConfig(module: Exclude<WorkItemModuleKey, "hub">): FeatureWorkspaceConfig | null {
  const card = getWorkItemModuleCard(module);
  if (!card) {
    return null;
  }

  const relatedModules = workItemModuleCards.filter((candidate) => candidate.slug !== card.slug).slice(0, 3);
  const firstDetail = card.detailSections?.[0];
  const secondDetail = card.detailSections?.[1];

  return {
    title: card.title,
    eyebrow: card.summary,
    tabs: [
      { id: "worklist", label: "업무 목록", badge: String(card.milestones.length) },
      { id: "intake", label: "접수/분류", badge: "입력" },
      { id: "review", label: "검토/마감", badge: "확인" },
      { id: "scope", label: "권한 범위", badge: "보안" },
    ],
    utility: [
      { label: "담당 범위", value: card.roleScope },
      { label: "관련 업무", value: `${relatedModules.length}개` },
      { label: "처리 상태", value: "확인중" },
    ],
    panels: [
      {
        id: "worklist",
        heading: `${card.title} 목록`,
        summary: "오늘 확인할 업무와 후속 조치를 한 줄씩 봅니다.",
        statusCards: [
          { label: "진행", value: "4건", tone: "warning" },
          { label: "완료", value: "9건", tone: "accent" },
          { label: "보완", value: "2건" },
        ],
        rows: [...card.milestones, ...(firstDetail?.items.slice(0, 5) ?? [])].map((item, index) => ({
          title: item,
          meta: index === 0 ? "우선 확인" : "담당자 확인",
          status: index === 0 ? "진행" : "대기",
        })),
        actions: [{ label: "업무 등록", tone: "primary" }, { label: "담당자 배정" }],
      },
      {
        id: "intake",
        heading: "접수/분류",
        summary: firstDetail ? `${firstDetail.title} 기준으로 업무를 분류합니다.` : "업무 유형과 담당 범위를 입력합니다.",
        formFields: [
          { label: "업무 제목", value: `${card.title} 확인 요청` },
          { label: "담당 범위", value: card.roleScope, type: "select" },
          { label: "요청 내용", value: card.accessNote, type: "textarea" },
        ],
        actions: [{ label: "접수 저장", tone: "primary" }, { label: "임시 저장" }],
        rows: firstDetail?.items.slice(0, 4).map((item) => ({ title: item, meta: "업무 유형", status: "선택 가능" })),
      },
      {
        id: "review",
        heading: "검토/마감",
        summary: "검토 상태, 보완 요청, 마감 예정 업무를 분리합니다.",
        rows: [
          { title: "담당자 검토", meta: "자료 확인", status: "진행" },
          { title: "보완 요청", meta: "누락 자료 확인", status: "대기" },
          { title: "마감 확인", meta: "완료 전 최종 확인", status: "예정" },
        ],
        actions: [{ label: "검토 완료", tone: "primary" }, { label: "보완 요청" }],
      },
      {
        id: "scope",
        heading: "권한 범위",
        summary: "회사, 지점, 역할별로 어디까지 볼 수 있는지 확인합니다.",
        statusCards: [
          { label: "역할", value: card.roleScope, tone: "accent" },
          { label: "원문 접근", value: "제한" },
          { label: "감사 추적", value: "기록" },
        ],
        rows: (secondDetail?.items ?? [card.accessNote]).map((item) => ({ title: item, meta: "접근 기준", status: "적용" })),
        notes: [card.accessNote, "민감 원문과 외부 제출은 별도 승인 후 처리합니다."],
      },
    ],
  };
}

export function WorkItemModulePage({ module }: { module: Exclude<WorkItemModuleKey, "hub"> }) {
  const config = buildModuleConfig(module);
  if (!config) {
    return null;
  }

  return (
    <PageShell title={config.title} titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={config} />
    </PageShell>
  );
}
