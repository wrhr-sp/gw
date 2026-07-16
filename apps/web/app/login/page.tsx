import { Button } from "@werehere/ui";
import { Building2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-login rounded-overlay border border-border bg-surface p-8" aria-labelledby="login-title">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-control bg-primary text-white" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">We’reHere</p>
            <h1 className="text-2xl font-bold text-text" id="login-title">위아히어 호텔 운영</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-muted">
          회사에서 발급한 계정으로 안전하게 로그인하세요.
        </p>

        <Button asChild className="w-full">
          <a href="/api/auth/login">
            <ShieldCheck aria-hidden="true" size={16} />
            ZITADEL로 로그인
          </a>
        </Button>
      </section>
    </main>
  );
}
