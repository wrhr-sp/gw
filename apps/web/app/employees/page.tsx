import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const employeesConfig: FeatureWorkspaceConfig = {
  title: "직원",
  eyebrow: "직원 검색, 상태, 소속, 연락처를 업무용 범위 안에서 확인합니다.",
  tabs: [
    { id: "directory", label: "직원 목록", badge: "검색" },
    { id: "profile", label: "직원 상세", badge: "정보" },
    { id: "status", label: "근무 상태", badge: "상태" },
    { id: "request", label: "권한 요청", badge: "신청" },
  ],
  utility: [
    { label: "재직", value: "42명" },
    { label: "휴가", value: "3명" },
    { label: "외근", value: "5명" },
  ],
  panels: [
    {
      id: "directory",
      heading: "직원 목록",
      summary: "부서, 이름, 직책, 근무 상태로 직원을 빠르게 찾습니다.",
      formFields: [
        { label: "검색", value: "이름 또는 부서" },
        { label: "부서", value: "전체 부서", type: "select" },
      ],
      rows: [
        { title: "윤서진", meta: "전략기획팀 · 팀장", status: "재직" },
        { title: "정하늘", meta: "인사운영팀 · 팀장", status: "재직" },
        { title: "김민수", meta: "인사운영팀 · 과장", status: "휴가" },
        { title: "오민재", meta: "서울지점 · 지점장", status: "외근" },
      ],
    },
    {
      id: "profile",
      heading: "직원 상세",
      summary: "업무에 필요한 소속, 직책, 연락 가능 상태만 먼저 보여 줍니다.",
      statusCards: [
        { label: "소속", value: "인사운영팀" },
        { label: "직책", value: "팀장", tone: "accent" },
        { label: "상태", value: "재직" },
      ],
      rows: [
        { title: "정하늘", meta: "인사운영팀 · 팀장", status: "재직", body: "근태·휴가 승인 담당자입니다." },
        { title: "연락", meta: "내선 1201 · 메신저 가능", status: "온라인" },
        { title: "담당 업무", meta: "휴가 승인, 근태 정정, 조직 정보 확인", status: "운영" },
      ],
      actions: [{ label: "메신저 보내기", tone: "primary" }, { label: "조직에서 보기" }],
    },
    {
      id: "status",
      heading: "근무 상태",
      summary: "휴가, 외근, 회의 중 상태를 직원 목록에서 바로 확인합니다.",
      rows: [
        { title: "김민수", meta: "연차 · 2026-06-30", status: "휴가" },
        { title: "오민재", meta: "서울지점 점검", status: "외근" },
        { title: "최유진", meta: "QA 검토 회의", status: "회의" },
      ],
    },
    {
      id: "request",
      heading: "권한 요청",
      summary: "보이지 않는 관리 기능은 권한 요청으로 연결하고, 임의 접근은 차단합니다.",
      formFields: [
        { label: "요청 기능", value: "휴가 승인", type: "select" },
        { label: "요청 사유", value: "팀원 휴가 승인 업무를 담당하게 되었습니다.", type: "textarea" },
      ],
      actions: [{ label: "권한 요청", tone: "primary" }, { label: "취소" }],
      notes: ["관리자 권한 변경은 담당 승인 후 적용합니다.", "민감 정보는 권한이 없으면 화면에 표시하지 않습니다."],
    },
  ],
};

export default function EmployeesPage() {
  return (
    <PageShell title="직원" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={employeesConfig} />
    </PageShell>
  );
}
