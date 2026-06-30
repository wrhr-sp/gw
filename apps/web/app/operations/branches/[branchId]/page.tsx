import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../../../_components/feature-workspace";
import { PageShell } from "../../../_components/page-shell";

type PageProps = {
  params: Promise<{ branchId: string }>;
};

const branchMap: Record<string, { name: string; region: string; manager: string; access: string }> = {
  gangnam: { name: "강남지점", region: "서울", manager: "김지윤", access: "전체 운영관리" },
  busan: { name: "부산지점", region: "부산", manager: "박민재", access: "운영이슈 확인" },
  daejeon: { name: "대전지점", region: "대전", manager: "이서연", access: "매출보고 확인" },
  gwangju: { name: "광주지점", region: "광주", manager: "최현우", access: "입금요청 확인" },
};

function buildBranchConfig(branchId: string): FeatureWorkspaceConfig {
  const branch = branchMap[branchId] ?? { name: "접근 제한 지점", region: "권한 확인", manager: "담당자 확인 필요", access: "권한 없음" };
  const isAllowed = Boolean(branchMap[branchId]);

  return {
    title: `${branch.name} 지점관리`,
    eyebrow: "지점별 매출보고, 운영이슈, 입금요청을 같은 화면에서 처리합니다.",
    tabs: [
      { id: "summary", label: "지점 요약", badge: branch.region },
      { id: "sales", label: "매출보고", badge: "작성" },
      { id: "issues", label: "운영이슈", badge: "검토" },
      { id: "deposit", label: "입금요청", badge: "요청" },
      { id: "access", label: "접근 권한", badge: isAllowed ? "허용" : "차단" },
    ],
    utility: [
      { label: "지역", value: branch.region },
      { label: "담당자", value: branch.manager },
      { label: "접근 범위", value: branch.access },
    ],
    panels: [
      {
        id: "summary",
        heading: "지점 요약",
        summary: "계정에 허용된 지점의 오늘 보고와 처리 상태를 먼저 확인합니다.",
        permissionHint: "branch.access 권한이 있어야 지점 상세와 보고 목록을 볼 수 있습니다.",
        statusCards: [
          { label: "오늘 매출보고", value: isAllowed ? "제출" : "차단", tone: isAllowed ? "accent" : "warning" },
          { label: "운영이슈", value: isAllowed ? "1건" : "-" },
          { label: "입금요청", value: isAllowed ? "2건" : "-" },
        ],
        rows: isAllowed
          ? [
              { title: "오늘 보고", meta: "매출보고 제출 · 특이사항 없음", status: "완료", actions: [{ label: "상세 보기", tone: "primary" }] },
              { title: "운영이슈", meta: "인력 공백 보완 요청", status: "검토", actions: [{ label: "이슈 확인" }, { label: "보완 요청" }] },
              { title: "입금요청", meta: "카드 정산 입금 확인 요청", status: "처리중", actions: [{ label: "요청 확인" }] },
            ]
          : [{ title: "접근 차단", meta: "이 계정에는 해당 지점 접근권한이 없습니다.", status: "차단" }],
      },
      {
        id: "sales",
        heading: "매출보고",
        summary: "지점 일 매출, 결제수단, 특이사항을 작성하고 제출합니다.",
        permissionHint: "branch.report.sales.write 권한이 있는 계정만 작성 버튼을 사용합니다.",
        formFields: [
          { label: "보고일", value: "2026-06-30", type: "date" },
          { label: "총 매출", value: "3,420,000원" },
          { label: "특이사항", value: "단체 고객 방문으로 오후 매출 증가", type: "textarea" },
        ],
        actions: [{ label: "매출보고 제출", tone: "primary" }, { label: "임시저장" }],
        notes: ["회계·세무 자동연동은 이번 1차 범위 밖입니다.", "실제 매출 실데이터 입력은 운영 승인 후 진행합니다."],
      },
      {
        id: "issues",
        heading: "운영이슈",
        summary: "시설, 인력, 고객 응대 등 지점 운영 이슈를 등록하고 검토 상태를 봅니다.",
        rows: [
          { title: "인력 공백", meta: "오후 파트타임 1명 결근", status: "검토", actions: [{ label: "대체 인력 요청", tone: "primary" }, { label: "보완" }] },
          { title: "시설 점검", meta: "냉난방 점검 예정", status: "예정", actions: [{ label: "일정 확인" }] },
        ],
        actions: [{ label: "이슈 등록", tone: "primary" }, { label: "처리 완료" }],
      },
      {
        id: "deposit",
        heading: "입금요청",
        summary: "입금 확인이 필요한 항목을 요청하고 처리 상태를 추적합니다.",
        formFields: [
          { label: "요청 금액", value: "1,200,000원" },
          { label: "예정일", value: "2026-07-01", type: "date" },
          { label: "요청 사유", value: "카드 정산 입금 확인 필요", type: "textarea" },
        ],
        actions: [{ label: "입금요청 제출", tone: "primary" }, { label: "증빙 첨부 준비" }],
        notes: ["은행 API 자동확인은 이번 1차 범위 밖입니다.", "계좌번호·실입금 민감정보는 별도 승인 전 입력하지 않습니다."],
      },
      {
        id: "access",
        heading: "접근 권한",
        summary: "지점별 진입 권한과 보고 기능별 작성·조회 권한을 분리합니다.",
        rows: [
          { title: "지점 진입", meta: "branch.access", status: isAllowed ? "허용" : "차단" },
          { title: "매출보고", meta: "branch.report.sales.write", status: isAllowed ? "작성 가능" : "권한 필요" },
          { title: "운영이슈", meta: "branch.report.issue.write", status: isAllowed ? "작성 가능" : "권한 필요" },
          { title: "입금요청", meta: "branch.payment.request.write", status: isAllowed ? "요청 가능" : "권한 필요" },
        ],
        emptyState: { title: "권한이 없으면", body: "검색 결과에는 표시하지 않고 직접 URL 접근은 권한 안내 화면으로 전환합니다.", actionLabel: "권한 요청" },
      },
    ],
  };
}

export default async function OperationsBranchPage({ params }: PageProps) {
  const { branchId } = await params;
  const config = buildBranchConfig(branchId);

  return (
    <PageShell title={config.title} titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={config} />
    </PageShell>
  );
}
