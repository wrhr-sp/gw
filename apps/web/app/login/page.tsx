import React from "react";

import { devSafeLoginEmail, devSafeLoginId, devSafeLoginPassword } from "../../dev-safe-auth";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { LoginForm } from "./login-form";

const loginFields = [
  { label: "테스트 아이디", value: devSafeLoginId },
  { label: "테스트 비밀번호", value: devSafeLoginPassword },
  { label: "내부 매핑 이메일", value: devSafeLoginEmail },
] as const;

const guardrails = [
  "첫 진입은 아이디/비밀번호 로그인 화면으로 고정합니다.",
  "자동 로그인은 비밀번호 저장이 아니라 세션 유지 선택입니다.",
  "로그인 전에는 대시보드, 메뉴, 근태, 결재, 문서, 관리자 화면 같은 내부 기능을 열지 않습니다.",
  "로그아웃하면 세션과 자동 로그인 유지 쿠키를 함께 해제합니다.",
  "admin / 1234 는 dev/test/UAT 전용 테스트 계정이며 production 에서는 금지합니다.",
] as const;

const postLoginRoutes = [
  "/dashboard → /management → /work-items/branch → /admin/users → /admin/policies → /admin/audit-logs",
  "/dashboard → /attendance → /leave → /approvals",
  "/admin/audit-logs",
] as const;

const authApiNotes = ["/api/auth/login", "/api/auth/logout"] as const;

export default function LoginPage() {
  return (
    <PageShell
      backHref={null}
      eyebrow="Phase 42A 로그인 필수 진입"
      title="그룹웨어 로그인"
      description="첫 진입은 이 로그인 화면으로만 받습니다. 로그인 전에는 내부 업무 화면을 열지 않고, 네트워크가 불안정하면 오프라인 안내에서도 다시 로그인 경로만 안내합니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">아이디 / 비밀번호</Pill>
          <Pill tone="warning">production 금지</Pill>
        </div>
      }
    >
      <SurfaceSection
        title="로그인"
        description="PC와 모바일 모두 같은 로그인 정책을 씁니다. 기본값은 dev-safe 검증용 계정이며, 필요하면 역할만 바꿔 landing 차이를 확인합니다."
      >
        <LoginForm />
      </SurfaceSection>

      <SurfaceSection title="현재 테스트 계정 기준" description="문서·테스트·운영 안내에서 같은 기준을 쓰기 위한 고정 값입니다.">
        <div className="grid-auto-compact">
          {loginFields.map((field) => (
            <article key={field.label} className="info-card">
              <Pill>{field.label}</Pill>
              <strong>{field.value}</strong>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="로그인 뒤 역할별 첫 이동" description="역할에 따라 어디로 먼저 보내는지와 인증 API 경계를 한 화면에서 같이 확인합니다.">
        <div className="grid-auto-compact">
          {postLoginRoutes.map((route) => (
            <article key={route} className="info-card">
              <Pill tone="accent">post-login route</Pill>
              <strong>{route}</strong>
            </article>
          ))}
          {authApiNotes.map((route) => (
            <article key={route} className="info-card">
              <Pill>auth api</Pill>
              <strong>{route}</strong>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="이번 단계에서 꼭 지키는 경계" description="로그인 화면이 공개 업무 입구처럼 보이지 않게 하는 기준입니다.">
        <ul className="bullet-list">
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
