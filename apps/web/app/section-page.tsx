import React from "react";

import { PageShell, SurfaceSection } from "./_components/page-shell";

export function buildSectionPage(title: string, description: string) {
  return function SectionPage() {
    return (
      <PageShell title={title} titleHref={null} description={description}>
        <SurfaceSection title="안내">
          이 페이지는 App Router 경로와 정보구조를 먼저 고정하기 위한 기본 구조입니다.
          실제 데이터 연결은 Workers API와 shared 계약 기준에 맞춰 단계별로 연결합니다.
        </SurfaceSection>
      </PageShell>
    );
  };
}
