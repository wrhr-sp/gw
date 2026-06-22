"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const APP_REFRESH_RETURN_PATH_STORAGE_KEY = "gw.appRefreshReturnPath";
const APP_REFRESH_VISIBLE_MS = 900;

function getSafeReturnPath() {
  if (typeof window === "undefined") {
    return "/dashboard";
  }

  try {
    const storedPath = window.sessionStorage.getItem(APP_REFRESH_RETURN_PATH_STORAGE_KEY);
    if (storedPath?.startsWith("/") && !storedPath.startsWith("//") && !storedPath.startsWith("/refresh")) {
      return storedPath;
    }
  } catch {
    // sessionStorage가 막힌 환경에서는 기본 화면으로 복귀한다.
  }

  return "/dashboard";
}

export default function RefreshPage() {
  const router = useRouter();

  useEffect(() => {
    const returnPath = getSafeReturnPath();
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(APP_REFRESH_RETURN_PATH_STORAGE_KEY);
      } catch {
        // 저장소 접근이 막힌 환경은 무시한다.
      }
      router.replace(returnPath as never);
      window.setTimeout(() => router.refresh(), 0);
    }, APP_REFRESH_VISIBLE_MS);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="refresh-page" aria-label="새로고침 중">
      <section className="refresh-page__card" role="status" aria-live="polite">
        <div className="refresh-page__flag" aria-hidden="true">
          <span>WE&apos;REHERE</span>
        </div>
        <p>새로고침 중</p>
      </section>
    </main>
  );
}
