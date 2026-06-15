import React from "react";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const profileCards = [
  {
    title: "내 세션 상태",
    summary: "placeholder authenticated 세션으로 로그인 뒤 흐름을 확인하는 단계입니다.",
    detail: "실제 비밀번호 검증, 운영 토큰 저장, SSO 연결은 아직 열지 않습니다.",
    href: appRoutes.me,
  },
  {
    title: "내 역할과 권한",
    summary: "EMPLOYEE 기본 흐름을 기준으로 근태, 휴가, 전자결재, 공지 읽기 권한을 먼저 설명합니다.",
    detail: "forbidden 상태는 로그인이 안 된 것이 아니라 현재 업무 권한이 없는 상태로 따로 안내합니다.",
    href: "/org",
  },
  {
    title: "내 급여명세서 초안",
    summary: "근태·휴가 확인 다음에 내 급여 preview 와 정정 안내를 보는 개인 화면입니다.",
    detail: "실지급 확정이나 동료 급여 조회가 아니라 self-only 급여명세서 skeleton 입니다.",
    href: "/payroll/me",
  },
  {
    title: "회사 / 직원 맥락",
    summary: "내 정보 확인 뒤 조직 구조와 직원 상태 조회로 이어지는 마무리 확인 단계입니다.",
    detail: "운영 변경은 /admin/users 로 넘기고 여기서는 읽기 전용 조회만 유지합니다.",
    href: "/employees",
  },
] as const;

const stateGuides = [
  {
    state: "empty",
    meaning: "할 일이 없는 정상 상태",
    note: "휴가 대기나 승인 문서가 비어 있어도 오류처럼 경고하지 않습니다.",
  },
  {
    state: "error",
    meaning: "다시 확인이 필요한 실패 상태",
    note: "세션 만료, 응답 실패, 연결 오류는 성공처럼 넘어가지 않습니다.",
  },
  {
    state: "forbidden",
    meaning: "로그인은 되었지만 지금 이 업무 권한이 없는 상태",
    note: "관리자 운영 화면과 승인 전용 CTA 는 숨기거나 별도 안내로 막습니다.",
  },
  {
    state: "offline",
    meaning: "읽기 중심 확인만 가능하고 서버 반영형 작업은 막아야 하는 상태",
    note: "로그아웃, 보안 설정 변경, 저장형 작업은 온라인에서만 성공처럼 보이게 합니다.",
  },
] as const;

const securityNotes = [
  "세션 확인은 same-origin /api/me 응답으로만 설명합니다.",
  "비밀번호 변경, MFA, SSO, 생체인증, 외부 초대 메일은 승인 게이트로 남깁니다.",
  "내 정보 화면에서 관리자 정책 변경 CTA 를 기본 흐름처럼 노출하지 않습니다.",
] as const;

export default function MePage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 22 내 정보 / 세션 마무리 확인"
      title="내 정보 skeleton"
      description="공지·문서 확인 뒤 내 세션, 역할, 회사 정보, 보안 안내를 다시 확인하고 조직/직원 조회로 이어지게 정리한 dev-safe placeholder 입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">session summary</Pill>
          <Pill>read-only personal context</Pill>
        </div>
      }
    >
      <SurfaceSection title="내 정보에서 먼저 보는 카드" description="업무 처리 뒤 마지막에 확인하는 개인 맥락을 짧게 정리합니다.">
        <div className="grid-auto-compact">
          {profileCards.map((card) => (
            <article key={card.title} className="route-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.detail}</p>
              <a href={card.href}>{card.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="상태 안내를 쉬운 말로 구분" description="내 정보 화면에서도 empty/error/forbidden/offline 뜻을 섞지 않습니다.">
        <div className="grid-auto-compact">
          {stateGuides.map((item) => (
            <article key={item.state} className="info-card">
              <Pill tone={item.state === "error" ? "warning" : item.state === "forbidden" ? "warning" : "accent"}>{item.state}</Pill>
              <strong>{item.meaning}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="보안 / 승인 게이트 메모" description="실운영처럼 과장하지 않기 위한 고정 문구입니다." muted>
        <ul className="summary-list">
          {securityNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
