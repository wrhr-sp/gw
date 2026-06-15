import React from "react";
import Link from "next/link";
import { appRoutes } from "@gw/shared";

import { devSafeLoginEmail, devSafeLoginId, devSafeLoginPassword, devSafeRoleOptions } from "../../dev-safe-auth";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { LoginForm } from "./login-form";

const loginFields = [
  { label: "테스트 아이디", value: devSafeLoginId },
  { label: "테스트 비밀번호", value: devSafeLoginPassword },
  { label: "내부 매핑 이메일", value: devSafeLoginEmail },
] as const;

const personaCards = devSafeRoleOptions.map((option) => ({
  role: option.label,
  nextRoute: option.landingRoute,
  summary: option.description,
  note:
    option.value === "COMPANY_ADMIN"
      ? "로그인 뒤 홈(/dashboard)에서 시작하고 관리자 CTA 와 경영업무 허브를 함께 확인합니다."
      : option.value === "AUDITOR"
        ? "감사 로그와 경영업무 허브는 읽기 전용으로만 확인합니다."
        : "같은 테스트 계정으로 역할별 landing 차이만 dev-safe 로 확인합니다.",
}));

const guardrails = [
  "admin / 1234 는 dev/test/UAT 전용 테스트 계정이며 production 에서는 금지합니다.",
  "로그인 성공 시 실제 사용자 저장 대신 placeholder 세션과 역할 경계만 확인합니다.",
  "로그아웃은 gw_session 쿠키만 비우고 외부 인증 provider 와는 연결하지 않습니다.",
  "OAuth/SSO/메일 초대 발송은 승인 전까지 연결하지 않습니다.",
  "일반 사용자 기본 흐름에서는 관리자 CTA 를 숨기고 route/API guard 를 유지합니다.",
] as const;

export default function LoginPage() {
  return (
    <PageShell
      backHref="/"
      backLabel="홈으로"
      eyebrow="Phase 31 로그인/세션 UAT 입구"
      title="로그인 / dev-safe UAT 계정"
      description="대장이 실제로 admin / 1234 로 로그인하고, 역할별 landing 과 로그아웃 흐름을 같은 화면에서 바로 확인할 수 있게 바꾼 dev-safe 로그인 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">admin / 1234</Pill>
          <Pill tone="warning">production 금지</Pill>
        </div>
      }
    >
      <SurfaceSection title="바로 로그인" description="기본값은 경영관리자 UAT 입니다. 필요하면 같은 테스트 계정으로 역할만 바꿔 landing 차이를 확인합니다.">
        <LoginForm />
      </SurfaceSection>

      <SurfaceSection title="테스트 계정 기준" description="문서/코드/운영 안내에서 같은 기준을 쓰기 위한 고정 값입니다.">
        <div className="grid-auto-compact">
          {loginFields.map((field) => (
            <article key={field.label} className="info-card">
              <Pill>{field.label}</Pill>
              <strong>{field.value}</strong>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="로그인 뒤 역할별 첫 이동" description="같은 테스트 계정이어도 어떤 landing 을 먼저 보여 줄지 역할별로 분리합니다.">
        <div className="mobile-summary-grid">
          {personaCards.map((item) => (
            <article key={item.role} className="route-card">
              <Pill tone="accent">{item.role}</Pill>
              <h3>{item.nextRoute}</h3>
              <p>{item.summary}</p>
              <p className="card-note">{item.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="현재 단계 안내" description="실사용화 단계에서도 과장하지 않기 위해 고정하는 경계입니다.">
        <ul className="bullet-list">
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="로그인 뒤 바로 눌러볼 경로" description="admin / 1234 기준 추천 확인 순서입니다." muted>
        <div className="grid-auto-compact">
          <article className="info-card">
            <h3>홈 / 일반 업무</h3>
            <p>/dashboard → /attendance → /leave → /approvals → /boards → /documents → /me</p>
            <div className="pill-row">
              <Link href="/dashboard">대시보드</Link>
              <Link href="/attendance">근태</Link>
              <Link href="/leave">휴가</Link>
              <Link href="/approvals">전자결재</Link>
            </div>
          </article>
          <article className="info-card">
            <h3>경영업무 / 계정관리</h3>
            <p>/dashboard → /management → /admin/users → /admin/policies → /admin/audit-logs</p>
            <div className="pill-row">
              <Link href="/management">경영업무</Link>
              <Link href="/admin/users">계정관리</Link>
              <Link href="/admin/audit-logs">감사 로그</Link>
            </div>
          </article>
          <article className="info-card">
            <h3>세션 / 계약 확인</h3>
            <p>로그인/로그아웃 contract 와 계정관리 목록 API 를 same-origin 경로로 바로 확인할 수 있습니다.</p>
            <div className="pill-row">
              <a href={appRoutes.auth.login}>{appRoutes.auth.login}</a>
              <a href={appRoutes.auth.logout}>{appRoutes.auth.logout}</a>
              <a href={appRoutes.admin.users}>{appRoutes.admin.users}</a>
            </div>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
