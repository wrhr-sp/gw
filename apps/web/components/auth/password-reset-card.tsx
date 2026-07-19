"use client";

import { Button } from "@werehere/ui";
import { Building2, KeyRound, LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

export type PasswordResetMode = "exchange" | "form" | "invalid";
const PASSWORD_RESET_EXCHANGE_PENDING_COOKIE = "__Host-hotel_password_reset_exchange_pending";

function setExchangePendingCookie(pending: boolean) {
  document.cookie = `${PASSWORD_RESET_EXCHANGE_PENDING_COOKIE}=${pending ? "1" : ""}; Max-Age=${pending ? "600" : "0"}; Path=/; SameSite=Strict; Secure`;
}

export function PasswordResetCard({
  errorCode,
  errorMessage,
  mode = "form",
}: {
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  mode?: PasswordResetMode | undefined;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [fragmentChecked, setFragmentChecked] = useState(mode !== "form");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasFragment = window.location.hash.length > 1;
    if (!hasFragment) {
      if (mode === "exchange") window.location.replace("/password/set?error=invalid-link");
      else setFragmentChecked(true);
      return;
    }
    setExchangePendingCookie(true);
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const allowedFields = new Set(["code", "orgID", "userID"]);
    const valid =
      [...parameters.keys()].every((name) => allowedFields.has(name)) &&
      parameters.getAll("userID").length === 1 &&
      parameters.getAll("code").length === 1 &&
      parameters.getAll("orgID").length <= 1 &&
      Boolean(parameters.get("userID")) &&
      Boolean(parameters.get("code"));
    const body = valid ? new URLSearchParams({
      code: parameters.get("code")!,
      ...(parameters.get("orgID") ? { orgID: parameters.get("orgID")! } : {}),
      userID: parameters.get("userID")!,
    }) : new URLSearchParams();

    window.history.replaceState(null, "", "/password/set");

    let active = true;
    void fetch("/api/auth/password/exchange", {
      body,
      credentials: "same-origin",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      redirect: "manual",
    }).then((response) => {
      if (!active) return;
      if (response.status === 204) {
        setExchangePendingCookie(false);
        window.location.replace("/password/set");
      } else {
        window.location.replace("/password/set?error=invalid-link");
      }
    }).catch(() => {
      if (active) window.location.replace("/password/set?error=exchange-unavailable");
    });
    return () => {
      active = false;
    };
  }, [mode]);

  const visibleError = localError ?? errorMessage;
  const visibleMode = mode === "form" && !fragmentChecked ? "exchange" : mode;
  const mismatch = localError !== null || errorCode === "password-mismatch";
  const passwordRejected = errorCode === "password-policy" || errorCode === "password-rejected";

  useEffect(() => {
    if (
      (visibleMode === "invalid" && errorMessage) ||
      (visibleMode === "form" && errorMessage && localError === null)
    ) errorRef.current?.focus();
  }, [errorMessage, localError, visibleMode]);

  function validateConfirmation(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const password = form.elements.namedItem("newPassword");
    const confirmation = form.elements.namedItem("confirmation");
    if (
      password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement &&
      password.value !== confirmation.value
    ) {
      event.preventDefault();
      setLocalError("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      confirmation.focus();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-login rounded-overlay border border-border bg-surface p-4 sm:p-8" aria-labelledby="password-reset-title">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-control bg-primary text-white" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">We’reHere</p>
            <h1 className="text-2xl font-bold text-text" id="password-reset-title">새 비밀번호 설정</h1>
          </div>
        </div>

        {visibleMode === "exchange" ? (
          <div className="flex items-center gap-3 rounded-control border border-border bg-background px-4 py-3 text-sm leading-6 text-muted" role="status">
            <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
            <span>재설정 링크를 안전하게 확인하고 있습니다.</span>
          </div>
        ) : visibleMode === "invalid" ? (
          <div className="space-y-5">
            <div className="rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700" ref={errorRef} role="alert" tabIndex={-1}>
              {errorMessage}
            </div>
            <Button asChild className="h-mobile-action w-full sm:h-10" variant="secondary">
              <a href="/login">로그인 화면으로 돌아가기</a>
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm leading-6 text-muted">
              다른 곳에서 사용하지 않는 12자 이상의 새 비밀번호를 입력하세요.
            </p>
            {visibleError ? (
              <div className="mb-5 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700" id="password-reset-error" ref={errorRef} role="alert" tabIndex={-1}>
                {visibleError}
              </div>
            ) : null}
            <form action="/api/auth/password/set" className="space-y-5" method="post" onSubmit={validateConfirmation}>
              <label className="block space-y-2 text-[13px] font-semibold text-text" htmlFor="new-password">
                새 비밀번호
                <input
                  aria-describedby={passwordRejected ? "password-reset-error" : undefined}
                  aria-invalid={passwordRejected || undefined}
                  autoComplete="new-password"
                  className="h-mobile-action w-full rounded-control border border-border bg-surface px-3 text-base font-normal text-text outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-10 sm:text-sm"
                  id="new-password"
                  maxLength={200}
                  minLength={12}
                  name="newPassword"
                  required
                  type="password"
                />
              </label>
              <label className="block space-y-2 text-[13px] font-semibold text-text" htmlFor="password-confirmation">
                새 비밀번호 확인
                <input
                  aria-describedby={mismatch ? "password-reset-error" : undefined}
                  aria-invalid={mismatch || undefined}
                  autoComplete="new-password"
                  className="h-mobile-action w-full rounded-control border border-border bg-surface px-3 text-base font-normal text-text outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-10 sm:text-sm"
                  id="password-confirmation"
                  maxLength={200}
                  minLength={12}
                  name="confirmation"
                  required
                  type="password"
                />
              </label>
              <Button className="h-mobile-action w-full sm:h-10" type="submit">
                <KeyRound aria-hidden="true" size={16} />비밀번호 변경
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
