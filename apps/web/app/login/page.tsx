import React from "react";
import Link from "next/link";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const loginFields = [
  { label: "회사 이메일", value: "admin@example.com" },
  { label: "비밀번호", value: "placeholder-password" },
] as const;

const personaCards = [
  {
    role: "일반 직원",
    nextRoute: "/dashboard",
    summary: "로그인 후 오늘 할 일과 내 상태를 먼저 확인합니다.",
    note: "근태, 전자결재, 조직/직원 조회로 이어지고 관리자 CTA 는 보이지 않습니다.",
  },
  {
    role: "팀장 / 결재자",
    nextRoute: "/approvals",
    summary: "대시보드 요약을 본 뒤 승인 대기와 팀 병목 확인을 먼저 처리합니다.",
    note: "일반 조회는 /employees 에서만 참고하고 관리자 운영 흐름과 섞지 않습니다.",
  },
  {
    role: "인사 / 운영 관리자",
    nextRoute: "/admin",
    summary: "권한 기반 CTA 와 admin host guard 를 통과한 뒤 사용자/정책/감사 검토로 이동합니다.",
    note: "일반 host 에서 /admin* 을 직접 열면 redirect/forbidden guard 가 먼저 동작합니다.",
  },
  {
    role: "감사 전용 사용자",
    nextRoute: "/admin/audit-logs",
    summary: "감사 로그 조회 전용 경로가 우선이며 전체 관리자 허브와 권한이 분리됩니다.",
    note: "조회/마스킹/회사 경계 규칙만 확인하고 실제 반출은 열지 않습니다.",
  },
] as const;

const guardrails = [
  "실제 비밀번호 저장/해시 운영값은 아직 연결하지 않습니다.",
  "로그인 성공 시 placeholder 세션 계약과 역할 경계만 확인합니다.",
  "OAuth/SSO/메일 초대 발송은 승인 전까지 연결하지 않습니다.",
  "일반 사용자 기본 흐름에서는 관리자 CTA 를 숨기고 route/API guard 를 유지합니다.",
] as const;

export default function LoginPage() {
  return (
    <PageShell
      backHref="/"
      backLabel="홈으로"
      eyebrow="Phase 14 로그인/권한 시작점"
      title="로그인 skeleton"
      description="실제 인증 provider 연결 없이도 로그인 뒤 어떤 역할이 어떤 화면으로 이어지는지 확인할 수 있게 정리한 placeholder 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">placeholder session contract</Pill>
          <Pill tone="warning">no real auth provider</Pill>
        </div>
      }
    >
      <SurfaceSection title="예상 입력값" description="실인증 대신 API shape 와 안내 문구를 맞추기 위한 예시 값입니다.">
        <div className="grid-auto-compact">
          {loginFields.map((field) => (
            <article key={field.label} className="info-card">
              <Pill>{field.label}</Pill>
              <strong>{field.value}</strong>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="로그인 뒤 역할별 첫 이동" description="같은 로그인 화면에서도 역할에 따라 이어지는 첫 경로가 다르다는 점을 먼저 보여 줍니다.">
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

      <SurfaceSection title="현재 단계 안내" description="실사용 MVP 검토 단계에서 거짓 완료처럼 보이지 않도록 고정하는 문구입니다.">
        <ul className="bullet-list">
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="다음 화면 연결" description="로그인 뒤에는 대시보드에서 일반 업무 흐름을, 권한 있는 사용자만 관리자 검토 흐름을 이어서 봅니다." muted>
        <div className="grid-auto-compact">
          <article className="info-card">
            <h3>일반 업무 흐름</h3>
            <p>/dashboard → /attendance → /approvals → /org → /employees</p>
            <div className="pill-row">
              <Link href="/dashboard">대시보드</Link>
              <Link href="/attendance">근태</Link>
              <Link href="/approvals">전자결재</Link>
            </div>
          </article>
          <article className="info-card">
            <h3>세션 / 계약 확인</h3>
            <p>역할과 권한 요약은 same-origin API 로만 확인합니다.</p>
            <div className="pill-row">
              <a href={appRoutes.me}>GET /api/me</a>
              <a href={appRoutes.auth.login}>{appRoutes.auth.login}</a>
            </div>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}