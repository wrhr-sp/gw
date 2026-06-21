import React from "react";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { MeLiveSection } from "../_components/real-usage-panels";
import { phase59HelpEntryCards } from "../uat/phase59-uat-config";

const profileCards = [
  {
    title: "내 세션 상태",
    summary: "로그인 뒤 same-origin 세션과 로그아웃 흐름을 확인하는 개인 확인 단계입니다.",
    detail: "실제 비밀번호 운영 전환, 운영 토큰 저장, SSO 연결은 아직 열지 않습니다.",
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
    detail: "실지급 확정이나 동료 급여 조회가 아니라 self-only dev-safe 급여명세서 안내입니다.",
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
    state: "loading",
    meaning: "아직 내 세션·권한 정보를 불러오는 중인 상태",
    note: "성공, 세션 만료, 권한 차단으로 단정하지 말고 잠시 기다린 뒤 /me 또는 /dashboard 에서 다시 확인합니다.",
  },
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
  {
    state: "dev-safe",
    meaning: "실운영 완료가 아니라 내부 확인용 안내만 남기는 상태",
    note: "비밀번호 변경, MFA, SSO, 외부 초대 메일은 계속 승인 게이트로 남깁니다.",
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
      eyebrow="내 세션 / 권한 / 개인 확인 레인"
      title="내 정보"
      titleHref="/me"
      description="공지·문서 확인 뒤 내 세션, 역할, 회사 정보, 보안 안내를 다시 확인하고 조직/직원 조회로 이어지게 정리했으며, 관리자 설정 화면처럼 과장하지 않고 실제 same-origin 세션 확인과 로그아웃까지 바로 검증할 수 있습니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">session summary</Pill>
          <Pill>read-only personal context</Pill>
        </div>
      }
    >
      <SurfaceSection title="실사용 세션 패널" description="현재 로그인 계정, 권한 수, 로그아웃 동작을 같은 화면에서 바로 확인합니다.">
        <MeLiveSection />
      </SurfaceSection>

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

      <SurfaceSection title="상태 안내를 쉬운 말로 구분" description="내 정보 화면에서도 loading, empty, error, forbidden, offline, dev-safe 뜻을 섞지 않습니다.">
        <div className="grid-auto-compact">
          {stateGuides.map((item) => (
            <article key={item.state} className="info-card">
              <Pill tone={item.state === "error" || item.state === "forbidden" ? "warning" : "accent"}>{item.state}</Pill>
              <strong>{item.meaning}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="사용자 도움말 진입" description="내 정보에서 세션·권한·self-only 문맥을 확인한 뒤, 필요한 도움말 entry 를 다시 찾아 UAT 기록을 마무리합니다.">
        <div className="grid-auto-compact">
          {phase59HelpEntryCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone="accent">{card.route}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.followUp}</p>
            </article>
          ))}
          <article className="info-card">
            <Pill>/uat</Pill>
            <h3>통합 UAT 체크 화면</h3>
            <p>역할별 entry, 상태/차단 기록표, 관리자 안내 흐름을 한 번에 다시 확인합니다.</p>
            <a href="/uat">/uat</a>
          </article>
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
