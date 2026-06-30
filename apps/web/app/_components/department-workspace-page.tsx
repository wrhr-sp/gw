import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "./feature-workspace";
import { PageShell } from "./page-shell";

type DepartmentWorkspacePageProps = {
  koreanName: string;
  englishName: string;
  roleSummary: string;
};

export function DepartmentWorkspacePage({ koreanName, englishName, roleSummary }: DepartmentWorkspacePageProps) {
  const config: FeatureWorkspaceConfig = {
    title: `${koreanName} / ${englishName}`,
    eyebrow: roleSummary,
    tabs: [
      { id: "overview", label: "업무 현황", badge: "오늘" },
      { id: "tasks", label: "업무 목록", badge: "진행" },
      { id: "reports", label: "보고", badge: "작성" },
      { id: "members", label: "구성원", badge: "권한" },
    ],
    utility: [
      { label: "현재 부서", value: koreanName },
      { label: "영문명", value: englishName },
      { label: "처리 대기", value: "3건" },
    ],
    panels: [
      {
        id: "overview",
        heading: "업무 현황",
        summary: `${koreanName}에서 오늘 확인해야 할 주요 업무와 보고 상태를 모아 봅니다.`,
        permissionHint: "부서별 접근 권한이 있는 계정만 해당 부서 화면을 볼 수 있습니다.",
        statusCards: [
          { label: "진행 업무", value: "8건", tone: "accent" },
          { label: "검토 필요", value: "3건", tone: "warning" },
          { label: "완료", value: "5건" },
        ],
        rows: [
          { title: `${koreanName} 주간 업무`, meta: "담당자별 진행률 확인", status: "진행", actions: [{ label: "업무 보기", tone: "primary" }] },
          { title: `${koreanName} 보고 대기`, meta: "승인/검토 전 보고 모음", status: "검토", actions: [{ label: "보고 확인" }] },
          { title: `${koreanName} 공지`, meta: "부서 공통 안내와 공유사항", status: "공유" },
        ],
      },
      {
        id: "tasks",
        heading: "업무 목록",
        summary: "부서 내부 업무를 상태별로 확인하고 필요한 처리를 이어갑니다.",
        rows: [
          { title: "신규 요청", meta: "부서 접수 업무", status: "대기", actions: [{ label: "접수" }] },
          { title: "진행 중", meta: "담당자 배정 업무", status: "진행", actions: [{ label: "상세" }] },
          { title: "완료 확인", meta: "결과 검토가 필요한 업무", status: "확인" },
        ],
      },
      {
        id: "reports",
        heading: "보고",
        summary: "부서별 보고를 작성하고 검토 상태를 확인합니다.",
        formFields: [
          { label: "보고 제목", value: `${koreanName} 업무 보고` },
          { label: "보고 유형", value: "일일 보고", type: "select" },
          { label: "내용", value: "주요 진행 상황과 특이사항을 입력합니다.", type: "textarea" },
        ],
        actions: [{ label: "보고 제출", tone: "primary" }, { label: "임시저장" }],
      },
      {
        id: "members",
        heading: "구성원/권한",
        summary: "부서 화면 접근과 업무 처리 권한을 구성원별로 분리합니다.",
        rows: [
          { title: "부서 관리자", meta: "부서 설정과 권한 요청 처리", status: "관리" },
          { title: "부서 담당자", meta: "업무 작성/처리", status: "작성" },
          { title: "조회 전용", meta: "부서 현황 읽기", status: "조회" },
        ],
        notes: ["실제 계정별 권한 저장은 후속 DB/API 연결 범위입니다.", "이번 단계는 부서별 전용 페이지와 화면 흐름 분리입니다."],
      },
    ],
  };

  return (
    <PageShell title={`${koreanName} / ${englishName}`} titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={config} />
    </PageShell>
  );
}
