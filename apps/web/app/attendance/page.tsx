import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const attendanceConfig: FeatureWorkspaceConfig = {
  title: "근태",
  eyebrow: "오늘 출퇴근과 정정 요청을 한 화면에서 처리합니다.",
  tabs: [
    { id: "today", label: "오늘 근태", badge: "진행" },
    { id: "records", label: "내 기록", badge: "6월" },
    { id: "correction", label: "정정 요청", badge: "작성" },
    { id: "manager", label: "관리 확인", badge: "승인" },
  ],
  utility: [
    { label: "허용 방식", value: "태그 · PC" },
    { label: "오늘 상태", value: "출근 확인" },
    { label: "누락 기록", value: "1건" },
  ],
  panels: [
    {
      id: "today",
      heading: "오늘 근태",
      summary: "출근 상태, 퇴근 버튼, 누락 알림을 먼저 보여 줘 직원이 바로 다음 행동을 할 수 있게 했습니다.",
      statusCards: [
        { label: "출근", value: "09:00", note: "태그 등록 완료", tone: "accent" },
        { label: "퇴근", value: "대기", note: "퇴근 시 버튼 활성" },
        { label: "근무 상태", value: "정상", note: "정책 위반 없음" },
      ],
      actions: [
        { label: "퇴근 등록", tone: "primary" },
        { label: "오늘 기록 새로고침" },
      ],
      rows: [
        { title: "오전 출근", meta: "태그 · 본사 출입", status: "확인", body: "기준 시각보다 늦지 않아 정상 근무로 표시됩니다." },
        { title: "퇴근 전 확인", meta: "오늘 18:00 예정", status: "대기", body: "퇴근 전 미처리 정정 요청이 있으면 함께 표시합니다." },
      ],
    },
    {
      id: "records",
      heading: "내 근태 기록",
      summary: "이번 달 기록을 날짜별로 보고 정상·누락·정정중 상태를 바로 구분합니다.",
      statusCards: [
        { label: "정상", value: "18일", tone: "accent" },
        { label: "정정중", value: "1건", tone: "warning" },
        { label: "미처리", value: "0건" },
      ],
      rows: [
        { title: "2026-06-30", meta: "09:00 ~ 진행중", status: "출근" },
        { title: "2026-06-29", meta: "09:05 ~ 18:00", status: "정상" },
        { title: "2026-06-28", meta: "09:00 ~ 퇴근 누락", status: "정정중" },
      ],
    },
    {
      id: "correction",
      heading: "정정 요청",
      summary: "퇴근 누락이나 시간 오류는 사유를 남겨 승인자에게 요청합니다.",
      formFields: [
        { label: "대상 날짜", value: "2026-06-28", type: "date" },
        { label: "정정 유형", value: "퇴근 누락", type: "select" },
        { label: "사유", value: "퇴근 버튼을 누르지 못했습니다.", type: "textarea" },
      ],
      actions: [{ label: "정정 요청", tone: "primary" }, { label: "임시 저장" }],
      notes: ["본인 기록만 정정 요청할 수 있습니다.", "승인 권한자는 요청 사유와 원 기록을 함께 봅니다."],
    },
    {
      id: "manager",
      heading: "관리 확인",
      summary: "팀장이나 인사 담당자는 예외 기록과 정정 요청을 한 줄씩 검토합니다.",
      statusCards: [
        { label: "승인 대기", value: "2건", tone: "warning" },
        { label: "오늘 예외", value: "1건" },
        { label: "처리 완료", value: "12건", tone: "accent" },
      ],
      rows: [
        { title: "운영 매니저", meta: "퇴근 누락 · 2026-06-28", status: "검토" },
        { title: "인사 코디네이터", meta: "지각 사유 제출", status: "확인" },
      ],
      actions: [{ label: "선택 승인", tone: "primary" }, { label: "보완 요청" }],
    },
  ],
};

export default function AttendancePage() {
  return (
    <PageShell title="근태" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={attendanceConfig} />
    </PageShell>
  );
}
