import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const operationsConfig: FeatureWorkspaceConfig = {
  title: "운영사업부 포털",
  eyebrow: "전체 지점의 매출보고, 운영이슈, 입금요청을 운영사업부 기준으로 확인합니다.",
  tabs: [
    { id: "overview", label: "운영 현황", badge: "전체" },
    { id: "branches", label: "지점 권한", badge: "계정별" },
    { id: "reports", label: "보고 관리", badge: "3종" },
    { id: "create", label: "지점 생성", badge: "권한" },
  ],
  utility: [
    { label: "접근 가능 지점", value: "4곳" },
    { label: "오늘 보고", value: "9건" },
    { label: "검토 필요", value: "3건" },
  ],
  panels: [
    {
      id: "overview",
      heading: "운영 현황",
      summary: "운영사업부가 먼저 봐야 할 지점별 보고와 처리 상태를 모아 보여줍니다.",
      permissionHint: "operations.portal.read 권한이 있는 계정만 운영사업부 포털에 진입합니다.",
      statusCards: [
        { label: "정상 지점", value: "3곳", tone: "accent" },
        { label: "운영이슈", value: "2건", tone: "warning" },
        { label: "입금요청", value: "4건" },
      ],
      rows: [
        { title: "강남지점", meta: "매출보고 제출 · 운영이슈 없음", status: "정상", actions: [{ label: "지점 보기", tone: "primary" }] },
        { title: "부산지점", meta: "운영이슈 1건 · 입금요청 2건", status: "검토", actions: [{ label: "이슈 확인" }, { label: "입금요청 확인" }] },
        { title: "대전지점", meta: "매출보고 대기", status: "대기", actions: [{ label: "보고 요청" }] },
      ],
    },
    {
      id: "branches",
      heading: "지점 권한",
      summary: "계정별로 접근 가능한 지점만 검색 팝업과 지점 상세에 노출합니다.",
      permissionHint: "branch.access 권한이 없는 지점은 검색 결과와 직접 URL 접근 모두 차단합니다.",
      rows: [
        { title: "총괄관리계정", meta: "전체 지점 접근", status: "전체" },
        { title: "운영사업부 관리자", meta: "강남 · 부산 · 대전 · 광주", status: "전체 운영" },
        { title: "지점 담당자", meta: "배정된 지점만 접근", status: "제한" },
      ],
      emptyState: { title: "접근 가능한 지점이 없으면", body: "지점관리포털 검색 팝업에는 결과를 숨기고 관리자에게 권한 요청 흐름을 안내합니다.", actionLabel: "권한 요청" },
    },
    {
      id: "reports",
      heading: "보고 관리",
      summary: "매출보고, 운영이슈, 입금요청을 지점별로 작성·제출·검토합니다.",
      rows: [
        { title: "매출보고", meta: "일 매출 · 결제수단 · 특이사항", status: "작성/제출", actions: [{ label: "보고 작성", tone: "primary" }, { label: "목록 보기" }] },
        { title: "운영이슈", meta: "시설 · 인력 · 고객 응대 이슈", status: "검토", actions: [{ label: "이슈 등록" }, { label: "보완 요청" }] },
        { title: "입금요청", meta: "요청 금액 · 예정일 · 증빙", status: "처리중", actions: [{ label: "요청 작성" }, { label: "처리 상태" }] },
      ],
      notes: ["은행·회계 API 자동연동은 이번 1차 범위 밖입니다.", "민감한 계좌/실입금 정보는 별도 승인 전 입력하지 않습니다."],
    },
    {
      id: "create",
      heading: "지점 생성 권한",
      summary: "새 지점 페이지 생성은 운영사업부 관리자와 총괄관리계정만 요청할 수 있습니다.",
      permissionHint: "branch.page.create 권한이 없으면 생성 버튼 대신 차단 안내만 보입니다.",
      formFields: [
        { label: "지점명", value: "신규 지점" },
        { label: "지역", value: "지역 선택", type: "select" },
        { label: "담당자", value: "운영사업부 관리자", type: "select" },
      ],
      actions: [{ label: "지점 생성 요청", tone: "primary" }, { label: "취소" }],
      notes: ["지점 생성은 권한 검토 후 활성화합니다.", "기존 /work-items/branch 지점관리포털 레인은 폐기하지 않습니다."],
    },
  ],
};

export default function OperationsPage() {
  return (
    <PageShell title="운영사업부 포털" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={operationsConfig} />
    </PageShell>
  );
}
