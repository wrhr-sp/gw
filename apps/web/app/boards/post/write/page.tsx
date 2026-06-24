"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageShell } from "../../../_components/page-shell";
import { BoardDetailLiveSection } from "../../../_components/real-usage-panels";

function BoardPostWriteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardId = searchParams.get("boardId") || "board_notice";

  return (
    <PageShell title="글쓰기">
      <BoardDetailLiveSection
        boardId={boardId}
        intent="write"
        onOpenPost={(postId) => router.push(`/posts/${postId}`)}
      />
    </PageShell>
  );
}

export default function BoardPostWritePage() {
  return (
    <Suspense fallback={null}>
      <BoardPostWriteContent />
    </Suspense>
  );
}
