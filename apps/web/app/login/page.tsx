import React from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="page-shell login-page-shell">
      <section className="surface-card login-card" aria-label="로그인">
        <div className="surface-card__header login-card__header">
          <h1>We'reHere</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
