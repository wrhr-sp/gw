import { Button } from "@werehere/ui";
import { Building2, LogIn } from "lucide-react";

export function HotelLoginCard({
  authRequest,
  csrf,
  errorMessage,
}: {
  authRequest?: string | undefined;
  csrf?: string | undefined;
  errorMessage?: string | undefined;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-login rounded-overlay border border-border bg-surface p-8" aria-labelledby="login-title">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-control bg-primary text-white" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">We’reHere</p>
            <h1 className="text-2xl font-bold text-text" id="login-title">위아히어 호텔 운영</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-muted">
          회사에서 발급한 호텔관리 아이디와 비밀번호를 입력하세요.
        </p>
        {errorMessage ? (
          <div className="mb-5 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {authRequest && csrf ? (
          <form action="/api/auth/custom-login" className="space-y-5" method="post">
            <input name="authRequest" type="hidden" value={authRequest} />
            <input name="csrf" type="hidden" value={csrf} />
            <label className="block space-y-2 text-[13px] font-semibold text-text" htmlFor="login-name">
              아이디
              <input autoComplete="username" autoFocus className="h-mobile-action w-full rounded-control border border-border bg-surface px-3 text-sm font-normal text-text outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-10" id="login-name" maxLength={200} name="loginName" placeholder="회사에서 발급한 아이디" required type="text" />
            </label>
            <label className="block space-y-2 text-[13px] font-semibold text-text" htmlFor="login-password">
              비밀번호
              <input autoComplete="current-password" className="h-mobile-action w-full rounded-control border border-border bg-surface px-3 text-sm font-normal text-text outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-10" id="login-password" maxLength={200} name="password" required type="password" />
            </label>
            <Button className="h-mobile-action w-full sm:h-10" type="submit">로그인</Button>
          </form>
        ) : (
          <Button asChild className="h-mobile-action w-full sm:h-10">
            <a href="/api/auth/login"><LogIn aria-hidden="true" size={16} />호텔관리 로그인</a>
          </Button>
        )}
      </section>
    </main>
  );
}
