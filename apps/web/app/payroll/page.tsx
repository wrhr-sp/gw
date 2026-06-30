import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const payrollConfig: FeatureWorkspaceConfig = {
  title: "급여 내부관리",
  eyebrow: "급여 프로필, 마감, 수당·공제, 본인 명세서 공개 상태를 확인합니다.",
  tabs: [
    { id: "overview", label: "급여 현황", badge: "6월" },
    { id: "profile", label: "급여 프로필", badge: "직원" },
    { id: "closing", label: "마감/검토", badge: "진행" },
    { id: "items", label: "수당·공제", badge: "항목" },
  ],
  utility: [
    { label: "이번 급여", value: "검토중" },
    { label: "정정 요청", value: "3건" },
    { label: "공개 대기", value: "42명" },
  ],
  panels: [
    {
      id: "overview",
      heading: "급여 현황",
      summary: "월별 급여 처리 상태와 직원 공개 전 확인 대상을 먼저 보여 줍니다.",
      statusCards: [
        { label: "수집", value: "완료", tone: "accent" },
        { label: "검토", value: "진행중", tone: "warning" },
        { label: "직원 공개", value: "대기" },
      ],
      rows: [
        { title: "2026년 6월 급여", meta: "근태·휴가 반영 확인", status: "검토" },
        { title: "정정 요청", meta: "근태 2건 · 수당 1건", status: "처리 필요" },
        { title: "본인 명세서 공개", meta: "최종 확인 후 공개", status: "대기" },
      ],
      actions: [{ label: "검토 시작", tone: "primary" }, { label: "정정 요청 보기" }],
    },
    {
      id: "profile",
      heading: "급여 프로필",
      summary: "직원별 지급 형태, 기준급, 지급일, 적용 시작일을 관리합니다.",
      formFields: [
        { label: "직원", value: "운영 매니저" },
        { label: "지급 형태", value: "월급", type: "select" },
        { label: "기준급", value: "2,800,000원" },
        { label: "적용 시작일", value: "2026-07-01", type: "date" },
      ],
      actions: [{ label: "변경 요청", tone: "primary" }, { label: "이력 보기" }],
      notes: ["실지급 확정 전에 변경 사유와 승인자를 함께 남깁니다.", "일반 직원은 본인 공개 명세서만 확인합니다."],
    },
    {
      id: "closing",
      heading: "마감/검토",
      summary: "지점 제출, 본사 검토, 직원 공개 전 단계별 상태를 확인합니다.",
      rows: [
        { title: "지점 제출", meta: "8곳 중 7곳 완료", status: "1곳 대기" },
        { title: "본사 검토", meta: "수당·공제 항목 확인", status: "진행" },
        { title: "직원 공개", meta: "검토 완료 후 공개", status: "대기" },
      ],
      actions: [{ label: "마감 확인", tone: "primary" }, { label: "보완 요청" }],
    },
    {
      id: "items",
      heading: "수당·공제",
      summary: "기본급, 연장·야간·휴일수당, 식대, 세금·보험 항목을 분리해서 봅니다.",
      rows: [
        { title: "기본급", meta: "월급 기준", status: "확인" },
        { title: "연장·야간 수당", meta: "근태 기록 반영", status: "검토" },
        { title: "식대·직책수당", meta: "수기 입력 확인", status: "보완" },
        { title: "원천세·4대보험", meta: "확정 전 검토", status: "대기" },
      ],
    },
  ],
};

export default function PayrollPage() {
  return (
    <PageShell title="급여 내부관리" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={payrollConfig} />
    </PageShell>
  );
}
