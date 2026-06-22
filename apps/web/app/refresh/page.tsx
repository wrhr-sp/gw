"use client";

import React, { useEffect } from "react";

const APP_REFRESH_RETURN_PATH_STORAGE_KEY = "gw.appRefreshReturnPath";
const APP_REFRESH_VISIBLE_MS = 900;
const APP_REFRESH_PRELOAD_TIMEOUT_MS = 2600;

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
  useEffect(() => {
    const returnPath = getSafeReturnPath();
    let cancelled = false;

    const waitForMinimumDisplay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, APP_REFRESH_VISIBLE_MS);
    });
    const preloadReturnPage = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), APP_REFRESH_PRELOAD_TIMEOUT_MS);
      try {
        await fetch(returnPath, {
          cache: "reload",
          credentials: "same-origin",
          signal: controller.signal,
        });
      } catch {
        // 네트워크/권한/브라우저 캐시 정책상 사전 요청이 막히면 실제 이동 새로고침으로 보완한다.
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void Promise.all([waitForMinimumDisplay, preloadReturnPage()]).then(() => {
      if (cancelled) {
        return;
      }
      try {
        window.sessionStorage.removeItem(APP_REFRESH_RETURN_PATH_STORAGE_KEY);
      } catch {
        // 저장소 접근이 막힌 환경은 무시한다.
      }
      window.location.replace(returnPath);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="refresh-page" aria-label="새로고침 중">
      <section className="refresh-page__card" role="status" aria-live="polite">
        <div className="refresh-page__flag" aria-label="WE’REHERE">
          <span className="refresh-page__flag-word" aria-hidden="true">
            {"WE’REHERE".split("").map((letter, index) => (
              <span key={`${letter}-${index}`} className="refresh-page__flag-letter" style={{ "--wave-index": index } as React.CSSProperties}>
                {letter}
              </span>
            ))}
          </span>
        </div>
        <p>새로고침 중</p>
      </section>
    </main>
  );
}
