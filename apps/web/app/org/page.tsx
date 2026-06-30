import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const orgConfig: FeatureWorkspaceConfig = {
  title: "조직도",
  eyebrow: "부서 구조, 직원 배치, 담당자를 한 화면에서 찾습니다.",
  tabs: [
    { id: "tree", label: "조직 트리", badge: "부서" },
    { id: "department", label: "부서 상세", badge: "인원" },
    { id: "member", label: "구성원", badge: "목록" },
    { id: "scope", label: "접근 범위", badge: "권한" },
  ],
  utility: [
    { label: "본사", value: "3개 팀" },
    { label: "지점", value: "2곳" },
    { label: "전체 인원", value: "42명" },
  ],
  panels: [
    {
      id: "tree",
      heading: "조직 트리",
      summary: "본사, 지점, 팀 단위로 펼쳐 보며 담당 부서를 빠르게 찾습니다.",
      permissionHint: "조직 조회는 read-only이며 역할·정책 변경은 관리자 영역으로 분리합니다.",
      rows: [
        { title: "본사", meta: "전략기획팀 · 인사운영팀 · 제품개발팀", status: "펼침", actions: [{ label: "부서 펼치기", tone: "primary" }, { label: "구성원 보기" }] },
        { title: "서울지점", meta: "운영 · 고객지원", status: "확인", actions: [{ label: "지점 보기" }, { label: "담당자 확인" }] },
        { title: "부산지점", meta: "운영 · 시설", status: "확인" },
      ],
    },
    {
      id: "department",
      heading: "부서 상세",
      summary: "선택한 부서의 책임자, 구성원, 담당 업무를 보여 줍니다.",
      statusCards: [
        { label: "부서장", value: "정하늘", tone: "accent" },
        { label: "인원", value: "8명" },
        { label: "상태", value: "운영중" },
      ],
      rows: [
        { title: "인사운영팀", meta: "근태 · 휴가 · 조직 정보 관리", status: "본사" },
        { title: "주요 연결", meta: "근태, 휴가, 직원, 권한 요청", status: "사용" },
      ],
    },
    {
      id: "member",
      heading: "구성원",
      summary: "부서 안의 직원, 직책, 현재 상태를 목록으로 확인합니다.",
      rows: [
        { title: "정하늘", meta: "팀장 · 휴가 승인", status: "재직" },
        { title: "김민수", meta: "과장 · 노무", status: "휴가" },
        { title: "이서연", meta: "대리 · 채용", status: "재직" },
      ],
      actions: [{ label: "직원 목록으로 보기", tone: "primary" }, { label: "메신저 보내기" }],
    },
    {
      id: "scope",
      heading: "접근 범위",
      summary: "일반 직원은 필요한 연락·소속 정보만 보고, 민감 정보와 관리자 설정은 분리합니다.",
      rows: [
        { title: "일반 직원", meta: "부서, 직책, 근무 상태", status: "허용" },
        { title: "팀장", meta: "팀원 근태·휴가 상태", status: "부분 허용" },
        { title: "관리자", meta: "조직 변경과 권한 설정", status: "별도 관리" },
      ],
      emptyState: { title: "표시할 조직이 없으면", body: "회사 또는 지점 범위를 먼저 확인하고 조직 운영 변경은 관리자 화면에서 진행합니다.", actionLabel: "범위 확인" },
    },
  ],
};

export default function OrgPage() {
  return (
    <PageShell title="조직도" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={orgConfig} />
    </PageShell>
  );
}
