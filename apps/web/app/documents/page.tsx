import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const documentsConfig: FeatureWorkspaceConfig = {
  title: "문서함",
  eyebrow: "문서 보관, 업로드, 열람 권한, 버전 상태를 한 화면에서 확인합니다.",
  tabs: [
    { id: "spaces", label: "문서함 목록", badge: "4개" },
    { id: "upload", label: "파일 올리기", badge: "업로드" },
    { id: "detail", label: "문서 상세", badge: "버전" },
    { id: "sharing", label: "공유 상태", badge: "권한" },
  ],
  utility: [
    { label: "전사 문서", value: "128개" },
    { label: "내 문서", value: "16개" },
    { label: "승인 필요", value: "3개" },
  ],
  panels: [
    {
      id: "spaces",
      heading: "문서함 목록",
      summary: "전사, 부서, 인사 전용처럼 성격이 다른 문서함을 왼쪽에서 빠르게 선택합니다.",
      permissionHint: "document.read 권한과 문서 공간 접근 범위를 함께 확인합니다.",
      rows: [
        { title: "전사 문서함", meta: "공지, 규정, 공용 양식", status: "열람 가능", actions: [{ label: "문서 열기", tone: "primary" }, { label: "권한 확인" }] },
        { title: "인사·근태 문서함", meta: "근태 신청서, 휴가 증빙", status: "권한 필요", actions: [{ label: "권한 요청" }, { label: "담당자 확인" }] },
        { title: "업무자료", meta: "회의자료, 매뉴얼, 운영 문서", status: "열람 가능" },
        { title: "계약/법무", meta: "계약 검토 자료", status: "담당자 전용" },
      ],
    },
    {
      id: "upload",
      heading: "파일 올리기",
      summary: "문서함을 선택하고 파일명, 분류, 설명을 입력해 업로드 준비를 합니다.",
      formFields: [
        { label: "문서함", value: "전사 문서함", type: "select" },
        { label: "파일명", value: "운영 매뉴얼.pdf" },
        { label: "분류", value: "업무자료", type: "select" },
        { label: "설명", value: "팀 공용 업무 처리 절차 문서입니다.", type: "textarea" },
      ],
      actions: [{ label: "업로드 준비", tone: "primary" }, { label: "문서 선택" }],
      notes: ["파일 저장은 문서함 권한을 먼저 확인한 뒤 진행합니다.", "민감 문서는 일반 직원 목록에 노출하지 않습니다."],
    },
    {
      id: "detail",
      heading: "문서 상세",
      summary: "문서 정보, 버전, 작성자, 최근 변경 내용을 한 영역에서 봅니다.",
      statusCards: [
        { label: "상태", value: "최신", tone: "accent" },
        { label: "버전", value: "v3" },
        { label: "읽음", value: "24명" },
      ],
      rows: [
        { title: "운영 매뉴얼.pdf", meta: "업무자료 · 총괄관리 업로드", status: "최신", actions: [{ label: "미리보기", tone: "primary" }, { label: "다운로드 요청" }] },
        { title: "v2 변경 내용", meta: "근태 처리 절차 추가", status: "보관" },
        { title: "v1 최초 등록", meta: "기본 운영 절차", status: "보관" },
      ],
      actions: [{ label: "다운로드 준비", tone: "primary" }, { label: "버전 비교" }],
    },
    {
      id: "sharing",
      heading: "공유 상태",
      summary: "누가 볼 수 있는지, 외부 반출이 아닌 내부 열람인지 구분합니다.",
      rows: [
        { title: "전사 열람", meta: "모든 직원", status: "허용" },
        { title: "편집 권한", meta: "총괄관리 · 문서 담당자", status: "제한" },
        { title: "민감 문서", meta: "인사 담당자 전용", status: "차단" },
      ],
      emptyState: { title: "접근 가능한 문서가 없으면", body: "공개 링크를 만들지 않고 문서 공간 담당자에게 권한 요청 흐름을 안내합니다.", actionLabel: "권한 요청" },
    },
  ],
};

export default function DocumentsPage() {
  return (
    <PageShell title="문서함" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={documentsConfig} />
    </PageShell>
  );
}
