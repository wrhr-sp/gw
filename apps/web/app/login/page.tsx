import React from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="page-shell login-page-shell">
      <section className="surface-card login-card" aria-label="로그인">
        <div className="surface-card__header login-card__header">
          <p className="meta-copy">로그인</p>
          <h1>We'reHere</h1>
          <p>아이디와 비밀번호를 입력해 그룹웨어에 로그인하세요.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
