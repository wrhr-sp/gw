"use client";

import { Button } from "@werehere/ui";
import { useEffect } from "react";

export default function HotelsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ event: "HOTEL_WEB_ROUTE_FAILURE", digest: error.digest ?? null }));
  }, [error]);

  return (
    <div className="flex min-h-96 items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-panel border border-danger/30 bg-surface p-6 text-center" role="alert">
        <h1 className="text-lg font-semibold text-text">호텔 화면을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted">잠시 후 다시 시도해 주세요. 입력 중이던 내용은 브라우저 상태에 따라 유지되지 않을 수 있습니다.</p>
        <Button className="mt-5 min-h-11" onClick={reset} type="button">다시 시도</Button>
      </section>
    </div>
  );
}
