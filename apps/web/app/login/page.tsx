import React from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="surface-card" style={{ maxWidth: 460, margin: "48px auto" }}>
        <div className="surface-card__header">
          <p className="page-shell__eyebrow">로그인 전용 진입</p>
          <h1>그룹웨어 로그인</h1>
          <p>PC와 모바일 모두 첫 진입은 이 로그인 화면만 보여 줍니다.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
