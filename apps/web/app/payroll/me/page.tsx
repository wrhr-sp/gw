import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../../_components/feature-workspace";
import { PageShell } from "../../_components/page-shell";

const payrollMeConfig: FeatureWorkspaceConfig = {
  title: "내 급여명세서",
  eyebrow: "본인 명세서, 지급·공제 항목, 정정 요청 상태를 확인합니다.",
  tabs: [
    { id: "summary", label: "명세서 요약", badge: "6월" },
    { id: "items", label: "지급/공제", badge: "상세" },
    { id: "correction", label: "정정 요청", badge: "신청" },
    { id: "history", label: "이전 명세서", badge: "12" },
  ],
  utility: [
    { label: "지급 기간", value: "2026년 6월" },
    { label: "공개 상태", value: "대기" },
    { label: "문의 상태", value: "없음" },
  ],
  panels: [
    {
      id: "summary",
      heading: "명세서 요약",
      summary: "이번 달 지급 예정액, 공개 상태, 확인해야 할 항목을 직원 눈높이로 보여 줍니다.",
      statusCards: [
        { label: "예상 실수령", value: "2,183,400원", tone: "accent" },
        { label: "지급일", value: "7월 10일" },
        { label: "확인 필요", value: "0건" },
      ],
      rows: [
        { title: "근태 반영", meta: "정상 근무 18일 · 휴가 1일", status: "확인" },
        { title: "수당 반영", meta: "연장 9시간 · 야간 2시간", status: "검토" },
        { title: "공제 반영", meta: "원천세 · 4대보험", status: "대기" },
      ],
    },
    {
      id: "items",
      heading: "지급/공제 항목",
      summary: "지급 항목과 공제 항목을 나누어 금액과 사유를 확인합니다.",
      rows: [
        { title: "기본 근무시간", meta: "168시간", status: "2,150,400원" },
        { title: "연장근로 수당", meta: "9시간", status: "172,800원" },
        { title: "식대", meta: "월 고정", status: "120,000원" },
        { title: "원천세", meta: "확정 전", status: "-187,000원" },
        { title: "4대보험", meta: "확정 전", status: "-140,000원" },
      ],
    },
    {
      id: "correction",
      heading: "정정 요청",
      summary: "근태나 수당이 다르면 공개 전 담당자에게 정정을 요청합니다.",
      formFields: [
        { label: "정정 항목", value: "연장근로 수당", type: "select" },
        { label: "대상 날짜", value: "2026-06-18", type: "date" },
        { label: "요청 사유", value: "근무시간 확인이 필요합니다.", type: "textarea" },
      ],
      actions: [{ label: "정정 요청", tone: "primary" }, { label: "임시 저장" }],
      notes: ["본인 명세서에 대해서만 정정 요청할 수 있습니다.", "급여 담당자는 근태·휴가 기록과 함께 확인합니다."],
    },
    {
      id: "history",
      heading: "이전 명세서",
      summary: "이전 달 명세서 공개 여부와 확인 상태를 한 줄씩 봅니다.",
      rows: [
        { title: "2026년 5월", meta: "지급 완료", status: "확인" },
        { title: "2026년 4월", meta: "지급 완료", status: "확인" },
        { title: "2026년 3월", meta: "지급 완료", status: "확인" },
      ],
    },
  ],
};

export default function PayrollMePage() {
  return (
    <PageShell title="내 급여명세서" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={payrollMeConfig} />
    </PageShell>
  );
}
