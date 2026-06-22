import React from "react";

import { devSafeRoleOptions } from "../../dev-safe-auth";
import { phase59HelpEntryCards } from "../uat/phase59-uat-config";
import { LoginForm } from "./login-form";

const loginGuardrails = [
  "익명 시작점은 /login 뿐이며, 다른 내부 화면은 로그인 없이 바로 열리지 않습니다.",
  "dev/test/UAT 기본 계정은 admin / 1234 이지만 production 기본 계정처럼 유지하면 안 됩니다.",
  "직원 홈은 /dashboard, 감사 전용 시작점은 /admin/audit-logs 로 분리됩니다.",
] as const;

export default function LoginPage() {
  return (
    <main className="page-shell login-page-shell">
      <section className="surface-card login-card">
        <div className="surface-card__header login-card__header">
          <p className="meta-copy">로그인 전용 진입</p>
          <h1>We'reHere Login</h1>
          <p>
            내부 그룹웨어는 로그인 뒤에만 업무 화면으로 들어갑니다. 먼저 역할을 고르고, dev/test/UAT 계정으로 실제 첫 화면 이동과 권한
            분리를 바로 확인할 수 있습니다.
          </p>
        </div>
        <div className="grid-auto-compact">
          <article className="info-card">
            <h2>/login only</h2>
            <p>공개 허용은 로그인, 정적 manifest/icon, health/smoke 같은 최소 경로만 유지합니다.</p>
          </article>
          <article className="info-card">
            <h2>dev/test/UAT 계정</h2>
            <p>admin / 1234</p>
            <p className="card-note">운영 전에는 비밀번호 변경/seed 절차가 따로 필요합니다.</p>
          </article>
        </div>
        <LoginForm />
      </section>

      <section className="surface-card login-card">
        <div className="surface-card__header login-card__header">
          <h2>도움말 / UAT 체크 시작</h2>
          <p>로그인 직후 어디부터 눌러야 할지 헷갈리면 entry 도움말을 먼저 읽고, 로그인 후 메뉴·내 정보에서 통합 체크 화면으로 이어갑니다.</p>
        </div>
        <div className="grid-auto-compact">
          {phase59HelpEntryCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.followUp}</p>
              <p className="card-note">시작 route: {card.route}</p>
            </article>
          ))}
          <article className="info-card">
            <h3>통합 UAT 체크 화면</h3>
            <p>역할별 entry, 시나리오 A~F, 상태/차단 기록표, 관리자 안내 흐름은 로그인 뒤 권한에 맞는 화면에서 다시 확인합니다.</p>
            <p className="card-note">익명 화면에서는 직접 열지 않고, 로그인 후 `/menu` 또는 `/me`에서 이어서 확인합니다.</p>
          </article>
        </div>
      </section>

      <section className="surface-card login-card">
        <div className="surface-card__header login-card__header">
          <h2>로그인 후 첫 화면</h2>
          <p>같은 테스트 계정을 쓰더라도 역할별 첫 이동과 확인 레인은 다르게 읽어야 합니다.</p>
        </div>
        <div className="grid-auto-compact">
          {devSafeRoleOptions.map((option) => (
            <article key={option.value} className="info-card">
              <h3>{option.label}</h3>
              <p>{option.description}</p>
              <p className="card-note">첫 화면: {option.landingRoute}</p>
            </article>
          ))}
        </div>
        <ul className="summary-list">
          {loginGuardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
