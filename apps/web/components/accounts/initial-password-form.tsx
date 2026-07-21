"use client";

import {
  hotelErrorResponseSchema,
  initialPasswordRequestSchema,
} from "@werehere/contracts";
import { Button } from "@werehere/ui";
import { useRef, useState } from "react";

export function InitialPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  const showFormError = (message: string) => {
    setFormError(message);
    queueMicrotask(() => formErrorRef.current?.focus());
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);
    if (newPassword !== confirmation) {
      setFieldError("새 비밀번호와 확인값이 일치하지 않습니다.");
      queueMicrotask(() => confirmationRef.current?.focus());
      return;
    }
    const parsed = initialPasswordRequestSchema.safeParse({ newPassword });
    if (!parsed.success) {
      setFieldError(
        parsed.error.issues[0]?.message ?? "새 비밀번호를 확인해 주세요.",
      );
      queueMicrotask(() => newPasswordRef.current?.focus());
      return;
    }
    setPending(true);
    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const response = await fetch("/api/account/initial-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        const failure = hotelErrorResponseSchema.safeParse(body);
        if (failure.success) {
          const passwordError = failure.data.error.fieldErrors.find(
            (error) => error.field === "newPassword",
          );
          if (passwordError) {
            setFieldError(passwordError.message);
            queueMicrotask(() => newPasswordRef.current?.focus());
          }
          showFormError(failure.data.error.message);
        } else {
          showFormError("비밀번호를 변경하지 못했습니다.");
        }
        return;
      }
      window.location.assign("/login?passwordChanged=1");
    } catch {
      showFormError("서버에 연결할 수 없습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setFieldError(null);
    setFormError(null);
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        showFormError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      window.location.assign("/login");
    } catch {
      showFormError("서버에 연결할 수 없습니다. 다시 시도해 주세요.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <form
      className="mt-6 flex flex-col gap-5"
      data-endpoint="/api/account/initial-password"
      noValidate
      onSubmit={submit}
    >
      {formError ? (
        <div
          className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </div>
      ) : null}
      <p className="text-sm leading-6 text-muted" id="initial-password-policy">
        8자 이상 200자 이하이며 영문 소문자, 숫자, 기호를 각각 포함해야 합니다.
      </p>
      <label className="text-sm font-semibold" htmlFor="new-password">
        새 비밀번호
        <input
          aria-describedby={
            fieldError
              ? "initial-password-policy initial-password-field-error"
              : "initial-password-policy"
          }
          aria-invalid={Boolean(fieldError)}
          aria-required="true"
          autoComplete="new-password"
          className="mt-1 h-11 w-full rounded-control border border-border bg-surface px-3"
          id="new-password"
          maxLength={400}
          minLength={8}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setFieldError(null);
            setFormError(null);
            idempotencyKeyRef.current = null;
          }}
          ref={newPasswordRef}
          required
          type="password"
          value={newPassword}
        />
      </label>
      <label className="text-sm font-semibold" htmlFor="confirm-password">
        새 비밀번호 확인
        <input
          aria-describedby={
            fieldError
              ? "initial-password-policy initial-password-field-error"
              : "initial-password-policy"
          }
          aria-invalid={Boolean(fieldError)}
          aria-required="true"
          autoComplete="new-password"
          className="mt-1 h-11 w-full rounded-control border border-border bg-surface px-3"
          id="confirm-password"
          maxLength={400}
          minLength={8}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setFieldError(null);
            setFormError(null);
          }}
          ref={confirmationRef}
          required
          type="password"
          value={confirmation}
        />
      </label>
      {fieldError ? (
        <p className="text-sm text-danger" id="initial-password-field-error">
          {fieldError}
        </p>
      ) : null}
      <Button
        className="min-h-11"
        disabled={pending || loggingOut}
        type="submit"
      >
        {pending ? "변경 중…" : "비밀번호 변경"}
      </Button>
      <Button
        className="min-h-11"
        disabled={pending || loggingOut}
        onClick={logout}
        type="button"
        variant="secondary"
      >
        {loggingOut ? "로그아웃 중…" : "다른 계정으로 로그인"}
      </Button>
    </form>
  );
}
