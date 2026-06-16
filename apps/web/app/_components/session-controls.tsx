"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes, type RoleCode } from "@gw/shared";

export function SessionControls({ roleCode }: { roleCode: RoleCode | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!roleCode) {
    return (
      <a href="/login" className="touch-button--secondary">
        로그인
      </a>
    );
  }

  return (
    <div className="session-chip-row">
      <span className="pill pill--accent">현재 세션: {roleCode}</span>
      <button
        type="button"
        className="touch-button--secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setErrorMessage(null);
          try {
            const response = await fetch(appRoutes.auth.logout, {
              method: "POST",
              credentials: "same-origin",
            });

            if (!response.ok) {
              throw new Error(`logout failed: ${response.status}`);
            }

            router.push("/login?signedOut=1");
            router.refresh();
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "로그아웃에 실패했습니다.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "로그아웃 중..." : "로그아웃"}
      </button>
      {errorMessage ? <span className="meta-copy">{errorMessage}</span> : null}
    </div>
  );
}
