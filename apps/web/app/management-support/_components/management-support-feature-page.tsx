import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../../_components/feature-workspace";
import { PageShell } from "../../_components/page-shell";

type ManagementSupportFeatureSlug = "hr" | "branches" | "payroll" | "budget" | "vendors" | "sales-purchases" | "attendance";

const featureConfigs: Record<ManagementSupportFeatureSlug, FeatureWorkspaceConfig> = {
  hr: {
    title: "인사관리",
    eyebrow: "경영지원팀 전용 인사 업무",
    tabs: [
      { id: "employees", label: "사원정보관리" },
      { id: "appointments", label: "인사발령" },
      { id: "dormant", label: "휴면계정관리" },
    ],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/hr" },
    ],
    panels: [
      {
        id: "employees",
        heading: "사원정보관리",
        summary: "신규 입사부터 퇴사까지의 사원 생애주기를 경영지원팀 업무 기준으로 관리합니다. 변경이력과 감사로그는 관리자페이지 감사로그에서 확인합니다.",
        rows: [
          { title: "사원 목록", meta: "01", status: "검색·필터·정렬" },
          { title: "사원 등록 / 계정 생성", meta: "02", status: "운영 DB 저장 연결" },
          { title: "사원 기본정보", meta: "03", status: "인사 실무 정보" },
          { title: "조직 / 지점 / 직무", meta: "04", status: "소속·직책·직급" },
          { title: "계정 / 역할 / 권한", meta: "05", status: "관리자페이지 계정관리와 연결" },
          { title: "보안 설정", meta: "06", status: "비밀번호·2단계 인증" },
          { title: "근무 / 재직 상태", meta: "07", status: "휴직·퇴사·비활성" },
          { title: "인사 서류 / 계약", meta: "08", status: "문서·계약 연결" },
          { title: "근태 / 휴가 연결", meta: "09", status: "요약·연결" },
          { title: "급여 연결", meta: "10", status: "요약·연결" },
          { title: "업무 접근 / 포털 접근", meta: "11", status: "포털 접근 확인" },
        ],
        permissionHint: "사원정보관리 본기능은 관리자페이지가 아니라 경영지원팀 인사관리 안에서 다룹니다. 감사로그/변경이력은 관리자페이지 감사로그에서 확인합니다.",
      },
      {
        id: "appointments",
        heading: "인사발령",
        summary: "인사발령 요청, 검토, 전자결재 연결 흐름을 경영지원팀 업무로 분리합니다.",
        rows: [
          { title: "발령 요청", meta: "소항목", status: "경영지원팀 업무" },
          { title: "승인 흐름", meta: "소항목", status: "전자결재 연결 대상" },
        ],
      },
      {
        id: "dormant",
        heading: "휴면계정관리",
        summary: "휴면 계정 확인과 후속 조치를 경영지원팀 인사관리 안에서 다룹니다.",
        rows: [
          { title: "휴면 대상 확인", meta: "소항목", status: "경영지원팀 업무" },
          { title: "후속 조치", meta: "소항목", status: "경영지원팀 업무" },
        ],
      },
    ],
  },
  branches: {
    title: "지점관리",
    eyebrow: "경영지원팀 전용 지점 업무",
    tabs: [
      { id: "branch-info", label: "지점정보관리" },
      { id: "branch-sales", label: "지점매출관리" },
      { id: "monthly-close", label: "월 마감 정산" },
    ],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/branches" },
    ],
    panels: [
      {
        id: "branch-info",
        heading: "지점정보관리",
        summary: "지점 등록과 지점 기본정보 관리 프로세스를 경영지원팀 업무로 수행합니다.",
        rows: [
          { title: "계약서", meta: "소항목", status: "경영지원팀 업무" },
          { title: "객실 수·주소·사업자등록번호", meta: "소항목", status: "경영지원팀 업무" },
          { title: "사업장 대표자 연락처·비고", meta: "소항목", status: "경영지원팀 업무" },
          { title: "지점아이디 생성", meta: "소항목", status: "사업장 대표자용" },
          { title: "계약 만료 사후처리", meta: "소항목", status: "경영지원팀 업무" },
          { title: "근무자 및 지점 관리자 배정", meta: "소항목", status: "경영지원팀 업무" },
        ],
        permissionHint: "지점관리포털로 이동하지 않는 경영지원팀 전용 진입점입니다.",
      },
      {
        id: "branch-sales",
        heading: "지점매출관리",
        summary: "지점 매출과 정산 관련 경영지원 업무를 관리합니다.",
        rows: [
          { title: "정산 확인", meta: "소항목", status: "경영지원팀 업무" },
          { title: "매출 검토", meta: "소항목", status: "경영지원팀 업무" },
        ],
      },
      {
        id: "monthly-close",
        heading: "월 마감 정산",
        summary: "지점매출관리 안의 하위 목록으로 월 마감 정산과 수탁주선지출 내역을 분리합니다.",
        rows: [
          { title: "월 마감 정산", meta: "하위 목록", status: "지점매출관리 내부" },
          { title: "수탁주선지출 내역", meta: "하위 목록", status: "월 마감 정산 내부" },
        ],
      },
    ],
  },
  payroll: {
    title: "급여관리",
    eyebrow: "경영지원팀 전용 급여 업무",
    tabs: [{ id: "payroll", label: "급여관리" }],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/payroll" },
    ],
    panels: [
      {
        id: "payroll",
        heading: "급여관리",
        summary: "직원 개인 급여 조회가 아니라 경영지원팀에서 수행하는 급여 업무 진입점입니다.",
        rows: [{ title: "급여 업무", meta: "중항목", status: "경영지원팀 업무" }],
        permissionHint: "기본업무의 내 급여·급여 조회 route로 이동하지 않습니다.",
      },
    ],
  },
  budget: {
    title: "예산관리",
    eyebrow: "경영지원팀 전용 예산 업무",
    tabs: [{ id: "budget", label: "예산관리" }],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/budget" },
    ],
    panels: [
      {
        id: "budget",
        heading: "예산관리",
        summary: "예산 관련 경영지원팀 업무 진입점입니다.",
        rows: [{ title: "예산 업무", meta: "중항목", status: "경영지원팀 업무" }],
      },
    ],
  },
  vendors: {
    title: "거래처관리",
    eyebrow: "경영지원팀 전용 거래처 업무",
    tabs: [{ id: "vendors", label: "거래처관리" }],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/vendors" },
    ],
    panels: [
      {
        id: "vendors",
        heading: "거래처관리",
        summary: "거래처와 정산 기준 정보를 경영지원팀 업무로 관리하는 진입점입니다.",
        rows: [{ title: "거래처 업무", meta: "중항목", status: "경영지원팀 업무" }],
      },
    ],
  },
  "sales-purchases": {
    title: "매출입관리",
    eyebrow: "경영지원팀 전용 매출입 업무",
    tabs: [{ id: "sales-purchases", label: "매출입관리" }],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/sales-purchases" },
    ],
    panels: [
      {
        id: "sales-purchases",
        heading: "매출입관리",
        summary: "매출, 청구, 입금 예정 상태를 경영지원팀 업무로 관리하는 진입점입니다.",
        rows: [{ title: "매출입 업무", meta: "중항목", status: "경영지원팀 업무" }],
      },
    ],
  },
  attendance: {
    title: "근태관리",
    eyebrow: "경영지원팀 전용 근태 업무",
    tabs: [{ id: "attendance", label: "근태관리" }],
    utility: [
      { label: "포털", value: "경영지원팀" },
      { label: "업무 구분", value: "부서업무" },
      { label: "route", value: "/management-support/attendance" },
    ],
    panels: [
      {
        id: "attendance",
        heading: "근태관리",
        summary: "직원 개인 출퇴근 입력이 아니라 경영지원팀에서 수행하는 근태 관리 업무 진입점입니다.",
        rows: [{ title: "근태 업무", meta: "중항목", status: "경영지원팀 업무" }],
        permissionHint: "기본업무의 근태 route로 이동하지 않습니다.",
      },
    ],
  },
};

export function ManagementSupportFeaturePage({ slug }: { slug: ManagementSupportFeatureSlug }) {
  const config = featureConfigs[slug];

  return (
    <PageShell title={config.title} titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={config} />
    </PageShell>
  );
}
