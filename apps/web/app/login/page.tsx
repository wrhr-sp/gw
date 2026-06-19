import React from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="page-shell login-page-shell">
      <section className="surface-card login-card">
        <div className="surface-card__header login-card__header">
          <h1>We'reHere Login</h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
