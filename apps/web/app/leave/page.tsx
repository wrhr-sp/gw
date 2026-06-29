import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const leaveConfig: FeatureWorkspaceConfig = {
  title: "휴가",
  eyebrow: "잔여 확인, 신청, 승인 상태를 같은 콘텐츠 영역에서 처리합니다.",
  tabs: [
    { id: "balance", label: "잔여 휴가", badge: "11일" },
    { id: "request", label: "휴가 신청", badge: "작성" },
    { id: "history", label: "내 신청", badge: "3건" },
    { id: "approval", label: "승인 대기", badge: "2건" },
  ],
  utility: [
    { label: "올해 연차", value: "15일" },
    { label: "사용", value: "3일" },
    { label: "예정", value: "1일" },
  ],
  panels: [
    {
      id: "balance",
      heading: "잔여 휴가",
      summary: "직원이 신청 전에 사용할 수 있는 휴가와 이미 신청한 일정을 먼저 확인합니다.",
      statusCards: [
        { label: "사용 가능", value: "11일", tone: "accent" },
        { label: "승인 대기", value: "1일", tone: "warning" },
        { label: "병가", value: "10일" },
      ],
      rows: [
        { title: "연차", meta: "기본 휴가", status: "11일 남음" },
        { title: "오전 반차", meta: "반일 단위", status: "신청 가능" },
        { title: "병가", meta: "증빙 필요", status: "검토 필요" },
      ],
    },
    {
      id: "request",
      heading: "휴가 신청",
      summary: "휴가 유형, 기간, 사유를 입력하고 신청 버튼으로 바로 진행합니다.",
      formFields: [
        { label: "휴가 유형", value: "연차", type: "select" },
        { label: "시작일", value: "2026-07-08", type: "date" },
        { label: "종료일", value: "2026-07-08", type: "date" },
        { label: "사유", value: "개인 일정", type: "textarea" },
      ],
      actions: [{ label: "휴가 신청", tone: "primary" }, { label: "취소" }],
      notes: ["잔여가 부족하면 신청 전에 안내합니다.", "승인이 필요한 휴가는 신청 즉시 승인 대기 상태가 됩니다."],
    },
    {
      id: "history",
      heading: "내 신청 내역",
      summary: "신청한 휴가의 승인, 반려, 취소 가능 상태를 한눈에 봅니다.",
      rows: [
        { title: "2026-07-08 연차", meta: "1일 · 개인 일정", status: "승인 대기" },
        { title: "2026-06-21 오전 반차", meta: "0.5일 · 병원 방문", status: "승인" },
        { title: "2026-06-05 연차", meta: "1일 · 가족 일정", status: "완료" },
      ],
      actions: [{ label: "선택 신청 취소" }],
    },
    {
      id: "approval",
      heading: "승인 대기",
      summary: "승인 권한자는 팀원의 휴가 기간, 사유, 대체 근무 여부를 보고 처리합니다.",
      statusCards: [
        { label: "오늘 처리", value: "2건", tone: "warning" },
        { label: "대체 근무 확인", value: "1건" },
        { label: "반려 후 보완", value: "0건" },
      ],
      rows: [
        { title: "운영 매니저", meta: "2026-07-08 · 연차 1일", status: "승인 대기" },
        { title: "인사 코디네이터", meta: "2026-07-10 오전 · 반차", status: "대체 확인" },
      ],
      actions: [{ label: "승인", tone: "primary" }, { label: "반려", tone: "danger" }, { label: "보완 요청" }],
    },
  ],
};

export default function LeavePage() {
  return (
    <PageShell title="휴가" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={leaveConfig} />
    </PageShell>
  );
}
