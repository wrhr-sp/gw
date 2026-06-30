import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const branchesConfig: FeatureWorkspaceConfig = {
  title: "지점관리",
  eyebrow: "지점별 운영 상태, 담당자, 근태 이슈, 처리 요청을 확인합니다.",
  tabs: [
    { id: "overview", label: "지점 현황", badge: "8" },
    { id: "staffing", label: "인력/근태", badge: "확인" },
    { id: "requests", label: "요청 처리", badge: "6" },
    { id: "settings", label: "운영 기준", badge: "정책" },
  ],
  utility: [
    { label: "운영 지점", value: "8곳" },
    { label: "오늘 출근", value: "94%" },
    { label: "확인 필요", value: "1곳" },
  ],
  panels: [
    {
      id: "overview",
      heading: "지점 현황",
      summary: "지역, 담당자, 운영 상태를 지점 단위로 봅니다.",
      rows: [
        { title: "강남지점", meta: "서울 · 담당 김지윤 · 직원 28명", status: "정상" },
        { title: "부산지점", meta: "부산 · 담당 박민재 · 직원 19명", status: "근태 확인" },
        { title: "대전지점", meta: "대전 · 담당 이서연 · 직원 14명", status: "정상" },
        { title: "광주지점", meta: "광주 · 담당 최현우 · 직원 12명", status: "정상" },
      ],
      statusCards: [
        { label: "정상 운영", value: "7곳", tone: "accent" },
        { label: "확인 필요", value: "1곳", tone: "warning" },
        { label: "미처리 요청", value: "6건" },
      ],
    },
    {
      id: "staffing",
      heading: "인력/근태",
      summary: "지점별 출근율, 지각, 미출근, 대체근무 필요 여부를 확인합니다.",
      rows: [
        { title: "부산지점", meta: "지각 2명 · 미출근 1명", status: "확인" },
        { title: "강남지점", meta: "정상 출근 27명 · 휴가 1명", status: "정상" },
        { title: "대전지점", meta: "정정 요청 1건", status: "처리중" },
      ],
      actions: [{ label: "근태 확인", tone: "primary" }, { label: "지점장에게 요청" }],
    },
    {
      id: "requests",
      heading: "요청 처리",
      summary: "근태 정정, 휴가 확인, 담당자 확인 요청을 한 줄씩 처리합니다.",
      rows: [
        { title: "근태 정정", meta: "부산지점 · 3건", status: "대기" },
        { title: "휴가 확인", meta: "강남지점 · 2건", status: "승인" },
        { title: "담당자 확인", meta: "광주지점 · 1건", status: "보완" },
      ],
      actions: [{ label: "선택 승인", tone: "primary" }, { label: "보완 요청" }],
    },
    {
      id: "settings",
      heading: "운영 기준",
      summary: "지점 기본 정보, 담당자, 운영 상태 변경 전 확인할 기준입니다.",
      formFields: [
        { label: "지점명", value: "부산지점" },
        { label: "담당자", value: "박민재" },
        { label: "운영 상태", value: "근태 확인 필요", type: "select" },
      ],
      actions: [{ label: "변경 요청", tone: "primary" }],
      notes: ["지점 추가·비활성화는 관리자 승인 후 처리합니다.", "기존 지점관리포털 경로와 일반업무포털 경로를 분리합니다."],
    },
  ],
};

export default function BranchesPage() {
  return (
    <PageShell title="지점관리" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={branchesConfig} />
    </PageShell>
  );
}
