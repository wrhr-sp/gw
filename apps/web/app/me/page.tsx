import React from "react";

import { FeatureWorkspace, type FeatureWorkspaceConfig } from "../_components/feature-workspace";
import { PageShell } from "../_components/page-shell";

const meConfig: FeatureWorkspaceConfig = {
  title: "내 정보",
  eyebrow: "내 세션, 역할, 보안 확인, 개인 업무 연결을 확인합니다.",
  tabs: [
    { id: "profile", label: "내 정보", badge: "확인" },
    { id: "security", label: "보안", badge: "점검" },
    { id: "permissions", label: "권한", badge: "역할" },
    { id: "links", label: "연결 업무", badge: "바로가기" },
  ],
  utility: [
    { label: "로그인 상태", value: "정상" },
    { label: "내 역할", value: "직원" },
    { label: "확인 필요", value: "0건" },
  ],
  panels: [
    {
      id: "profile",
      heading: "내 정보",
      summary: "이름, 부서, 직책, 연락처처럼 업무에 필요한 개인 정보를 확인합니다.",
      statusCards: [
        { label: "소속", value: "운영팀", tone: "accent" },
        { label: "직책", value: "매니저" },
        { label: "상태", value: "재직" },
      ],
      rows: [
        { title: "기본 정보", meta: "이름 · 부서 · 직책", status: "확인" },
        { title: "연락처", meta: "이메일 · 휴대전화", status: "확인" },
        { title: "근무 정보", meta: "입사일 · 근무 형태", status: "확인" },
        { title: "내 급여명세서", meta: "/payroll/me", status: "이동" },
        { title: "직원 조회", meta: "/employees", status: "이동" },
      ],
      actions: [{ label: "수정 요청", tone: "primary" }, { label: "내 정보 새로고침" }],
    },
    {
      id: "security",
      heading: "보안",
      summary: "비밀번호, 로그인 기록, 2차 비밀번호 설정 상태를 확인합니다.",
      statusCards: [
        { label: "2차 비밀번호", value: "설정됨", tone: "accent" },
        { label: "최근 로그인", value: "오늘" },
        { label: "보안 알림", value: "0건" },
      ],
      actions: [{ label: "비밀번호 변경", tone: "primary" }, { label: "로그아웃" }],
      rows: [
        { title: "최근 로그인", meta: "현재 브라우저", status: "정상" },
        { title: "접근 기기", meta: "PC · 모바일", status: "확인" },
      ],
    },
    {
      id: "permissions",
      heading: "권한",
      summary: "내가 볼 수 있는 업무와 권한 요청이 필요한 업무를 구분합니다.",
      rows: [
        { title: "근태/휴가", meta: "본인 기록과 신청", status: "허용" },
        { title: "문서함", meta: "공유 문서 기준", status: "허용" },
        { title: "경영업무", meta: "지정 관리자 전용", status: "권한 필요" },
      ],
      actions: [{ label: "권한 요청", tone: "primary" }],
    },
    {
      id: "links",
      heading: "연결 업무",
      summary: "내 정보에서 이어서 확인할 개인 업무를 바로 엽니다.",
      rows: [
        { title: "내 근태", meta: "/attendance", status: "이동" },
        { title: "내 휴가", meta: "/leave", status: "이동" },
        { title: "내 급여명세서", meta: "/payroll/me", status: "이동" },
        { title: "조직도", meta: "/org", status: "2차 확인" },
      ],
    },
  ],
};

export default function MePage() {
  return (
    <PageShell title="내 정보" titlePlacement="content" titleHref={null}>
      <FeatureWorkspace config={meConfig} />
    </PageShell>
  );
}
