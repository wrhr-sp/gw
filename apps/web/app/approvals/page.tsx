import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const approvalsConfig: FeatureWorkspaceConfig = {
  title: "전자결재",
  eyebrow: "기안, 결재함, 결재선, 의견을 업무 흐름대로 정리합니다.",
  tabs: [
    { id: "inbox", label: "내 결재함", badge: "4건" },
    { id: "draft", label: "기안 작성", badge: "작성" },
    { id: "lines", label: "결재선", badge: "선택" },
    { id: "history", label: "문서 상태", badge: "진행" },
  ],
  utility: [
    { label: "승인 대기", value: "4건" },
    { label: "내 기안", value: "7건" },
    { label: "보완 요청", value: "1건" },
  ],
  panels: [
    {
      id: "inbox",
      heading: "내 결재함",
      summary: "내가 처리해야 할 문서를 먼저 보여 주고, 승인·반려·보완 요청 버튼을 문서 옆에 둡니다.",
      permissionHint: "approval.act 권한과 결재선 순서가 맞을 때만 처리 버튼을 노출합니다.",
      statusCards: [
        { label: "오늘 처리", value: "2건", tone: "warning" },
        { label: "마감 임박", value: "1건" },
        { label: "완료", value: "12건", tone: "accent" },
      ],
      rows: [
        { title: "지출결의서", meta: "운영 매니저 · 128,000원", status: "승인 대기", body: "영수증 확인 후 승인 또는 보완 요청합니다.", actions: [{ label: "승인", tone: "primary" }, { label: "반려", tone: "danger" }, { label: "보완 요청" }] },
        { title: "휴가 승인 협조", meta: "인사 코디네이터 · 2026-07-08", status: "검토", actions: [{ label: "상세 보기" }, { label: "의견 남기기" }] },
      ],
      actions: [{ label: "승인", tone: "primary" }, { label: "반려", tone: "danger" }, { label: "보완 요청" }],
    },
    {
      id: "draft",
      heading: "기안 작성",
      summary: "양식 선택, 제목, 내용, 첨부, 결재선을 한 화면에서 작성합니다.",
      formFields: [
        { label: "양식", value: "지출결의서", type: "select" },
        { label: "제목", value: "6월 사무용품 구입 건" },
        { label: "내용", value: "구입 목적과 금액, 증빙 파일을 확인해 주세요.", type: "textarea" },
      ],
      actions: [{ label: "기안 올리기", tone: "primary" }, { label: "임시 저장" }],
      notes: ["문서 작성자는 자기 문서를 직접 승인할 수 없습니다.", "첨부 문서는 문서함 권한을 그대로 따릅니다."],
    },
    {
      id: "lines",
      heading: "결재선",
      summary: "문서 종류에 맞는 승인자와 참조자를 선택합니다.",
      rows: [
        { title: "1단계", meta: "팀장 승인", status: "운영 매니저" },
        { title: "2단계", meta: "경영 확인", status: "총괄관리" },
        { title: "참조", meta: "인사운영팀", status: "읽음 확인" },
      ],
      actions: [{ label: "결재선 적용", tone: "primary" }, { label: "결재선 저장" }],
      emptyState: { title: "결재선 후보가 없으면", body: "조직도와 직원 정보에서 승인자를 먼저 확인한 뒤 결재선을 다시 선택합니다.", actionLabel: "조직도 확인" },
    },
    {
      id: "history",
      heading: "문서 상태",
      summary: "내 문서가 어디까지 진행됐는지 단계와 의견을 함께 봅니다.",
      rows: [
        { title: "사무용품 구입 건", meta: "기안 → 팀장 승인 대기", status: "진행중" },
        { title: "출장 신청서", meta: "승인 완료 · 문서함 보관", status: "완료" },
        { title: "계약 검토 요청", meta: "보완 요청 의견 있음", status: "보완" },
      ],
    },
  ],
};

export default function ApprovalsPage() {
  return (
    <PageShell title="전자결재" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={approvalsConfig} />
    </PageShell>
  );
}
