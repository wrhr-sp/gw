import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const managementCards = [
  {
    title: "인사관리 / 계정관리",
    href: "/admin/users",
    summary: "사용자 생성, 역할/업무권한 지정, 활성/비활성, 비밀번호 초기화 preview 를 dev-safe 로 검토합니다.",
    roleScope: "본사 관리자 / 인사관리자",
  },
  {
    title: "급여정산",
    href: "/payroll",
    summary: "실지급 없이 자료 수집 상태, 지급 예정 기간, 명세서 초안을 관리자 관점에서 확인합니다.",
    roleScope: "본사 관리자 / 급여 담당",
  },
  {
    title: "근태 / 휴가 관리자 업무",
    href: "/attendance",
    summary: "정정 필요 근태, 등록 방식 정책, 휴가 승인 대기를 홈과 분리해서 다시 확인합니다.",
    roleScope: "본사 관리자 / 팀장 / 지점 관리자",
  },
  {
    title: "세무 업무",
    href: "/work-items/tax",
    summary: "증빙 제출, 세목별 마감, 전달 패키지 준비를 metadata 중심으로 확인합니다.",
    roleScope: "본사 세무 담당 / 지점 관리자 / 감사",
  },
  {
    title: "노무 업무",
    href: "/work-items/labor",
    summary: "계약/연차/수당/고충/징계 skeleton 을 민감도 경계와 함께 분리해 보여 줍니다.",
    roleScope: "본사 노무 담당 / 인사 / 감사",
  },
  {
    title: "법무 업무",
    href: "/work-items/legal",
    summary: "계약 검토 요청, 갱신 예정, 분쟁/클레임 후속을 경영업무 허브 아래에서만 노출합니다.",
    roleScope: "본사 법무/운영 담당 / 지점 관리자 / 감사",
  },
  {
    title: "지점 운영",
    href: "/work-items/branch",
    summary: "지점 일일 보고와 마감 placeholder 를 본사/지점 운영 언어로 확인합니다.",
    roleScope: "본사 운영 / 지점 관리자",
  },
  {
    title: "컴플라이언스 / 감사",
    href: "/admin/audit-logs",
    summary: "민감 업무 접근 흔적과 운영 변경 후보를 read-only 로 확인합니다.",
    roleScope: "본사 관리자 / 감사",
  },
] as const;

const managementGuardrails = [
  "일반 직원은 이 허브를 기본 홈에서 직접 보지 않고, 허용 역할만 별도 진입합니다.",
  "실메일/실메신저/SSO/OAuth/외부 기관 계정 연동은 계속 승인 게이트입니다.",
  "급여 지급, 실제 세무 신고, production DB 입력, migration, destructive 작업은 이번 범위가 아닙니다.",
] as const;

export default function ManagementPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="홈(대시보드)으로"
      eyebrow="Phase 31 경영업무 허브"
      title="경영업무"
      description="민감 운영 모듈을 일반 직원 홈과 분리하고, 대장이 홈 → 경영업무 → 계정관리 → 주요 업무 route 를 직접 눌러볼 수 있게 정리한 허브입니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">sensitive access</Pill>
          <Pill>home separated</Pill>
        </div>
      }
    >
      <SurfaceSection title="경영업무에서 바로 여는 화면" description="이번 단계는 전체 완성보다, 민감한 업무를 홈과 분리해서 직접 눌러볼 수 있게 이어 주는 데 집중합니다.">
        <div className="grid-auto-compact">
          {managementCards.map((card) => (
            <article key={card.href} className="info-card">
              <Pill tone="warning">{card.roleScope}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="추천 UAT 순서" description="admin / 1234 로그인 뒤 가장 짧게 확인하는 흐름입니다.">
        <ol className="number-list">
          <li>/dashboard 에서 홈과 관리자 CTA 가 분리되어 보이는지 확인</li>
          <li>/management 에서 민감 모듈 허브가 일반 홈과 분리되어 보이는지 확인</li>
          <li>/admin/users 에서 계정 생성/권한/상태/비밀번호 초기화 preview 흐름 확인</li>
          <li>/attendance, /leave, /approvals, /boards, /documents 에서 최소 happy path 링크 확인</li>
          <li>/admin/audit-logs 에서 read-only 감사 경계와 production 금지 문구 확인</li>
        </ol>
      </SurfaceSection>

      <SurfaceSection title="분리 원칙" description="단순 메뉴 숨김이 아니라 route/API/문서 언어를 같이 맞춥니다." muted>
        <ul className="summary-list">
          {managementGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
