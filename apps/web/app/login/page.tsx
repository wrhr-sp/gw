import React from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="surface-card" style={{ maxWidth: 460, margin: "48px auto" }}>
        <div className="surface-card__header">
          <h1>그룹웨어 로그인</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
