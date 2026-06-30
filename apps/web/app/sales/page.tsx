import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const salesConfig: FeatureWorkspaceConfig = {
  title: "영업관리",
  eyebrow: "상담, 제안, 계약 검토, 후속 연락을 업무 단계별로 확인합니다.",
  tabs: [
    { id: "pipeline", label: "영업 현황", badge: "27" },
    { id: "customer", label: "거래처", badge: "관리" },
    { id: "followup", label: "후속 연락", badge: "5" },
    { id: "contract", label: "계약 검토", badge: "4" },
  ],
  utility: [
    { label: "오늘 상담", value: "12건" },
    { label: "진행 거래", value: "7건" },
    { label: "오늘 마감", value: "2건" },
  ],
  panels: [
    {
      id: "pipeline",
      heading: "영업 현황",
      summary: "신규 문의부터 계약 검토까지 오늘 확인할 거래 흐름을 봅니다.",
      statusCards: [
        { label: "신규 문의", value: "4건" },
        { label: "상담 진행", value: "8건", tone: "accent" },
        { label: "계약 검토", value: "4건", tone: "warning" },
      ],
      rows: [
        { title: "강남 법인 고객", meta: "제안 전달 · 영업 1팀", status: "진행" },
        { title: "부산 지점 계약", meta: "법무 검토 요청", status: "검토" },
        { title: "신규 문의 4건", meta: "오늘 접수", status: "배정 대기" },
      ],
      actions: [{ label: "상담 등록", tone: "primary" }, { label: "담당자 배정" }],
    },
    {
      id: "customer",
      heading: "거래처",
      summary: "최근 거래처와 담당자, 다음 연락 일정을 함께 확인합니다.",
      rows: [
        { title: "위어히어 호텔", meta: "담당 김지윤 · 서울", status: "활성" },
        { title: "부산 파트너사", meta: "담당 박민재 · 부산", status: "제안" },
        { title: "대전 운영사", meta: "담당 이서연 · 대전", status: "후속" },
      ],
      formFields: [
        { label: "거래처명", value: "신규 거래처" },
        { label: "담당자", value: "담당 영업" },
      ],
      actions: [{ label: "거래처 등록", tone: "primary" }],
    },
    {
      id: "followup",
      heading: "후속 연락",
      summary: "오늘 처리해야 할 연락과 이번 주 마감 건을 분리합니다.",
      rows: [
        { title: "견적 회신", meta: "오늘 15:00", status: "오늘" },
        { title: "계약 조건 재확인", meta: "내일 오전", status: "예정" },
        { title: "방문 일정 조율", meta: "이번 주", status: "대기" },
      ],
      actions: [{ label: "완료 처리", tone: "primary" }, { label: "일정 변경" }],
    },
    {
      id: "contract",
      heading: "계약 검토",
      summary: "계약 단계의 법무 검토와 보완 요청 상태를 확인합니다.",
      statusCards: [
        { label: "검토중", value: "4건", tone: "warning" },
        { label: "보완요청", value: "1건" },
        { label: "완료", value: "9건", tone: "accent" },
      ],
      rows: [
        { title: "위탁 운영 계약", meta: "법무 검토", status: "진행" },
        { title: "개인정보 처리 위탁", meta: "보완 요청", status: "보완" },
      ],
    },
  ],
};

export default function SalesPage() {
  return (
    <PageShell title="영업관리" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={salesConfig} />
    </PageShell>
  );
}
