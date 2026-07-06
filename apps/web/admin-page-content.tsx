import React from "react";
import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import type { AdminHubCard } from "./admin-config";

const adminWorkButtons = [
  { href: "/admin/users", title: "사원 계정 관리", meta: "계정 · 상태 · 역할" },
  { href: "/admin/users#permission-matrix", title: "권한 관리", meta: "기능별 세부권한" },
  { href: "/admin/policies", title: "운영 정책", meta: "관리자 설정" },
  { href: "/admin/audit-logs", title: "감사로그", meta: "변경 이력" },
] as const;

export function AdminPageContent({ visibleAdminHubCards }: { visibleAdminHubCards: readonly AdminHubCard[] }) {
  const visibleHrefs = new Set(visibleAdminHubCards.map((card) => card.href));
  const visibleButtons = adminWorkButtons.filter((button) => button.href.includes("#") || visibleHrefs.has(button.href as AdminHubCard["href"]));

  return (
    <PageShell
      backHref="/home"
      backLabel="대시보드로"
      eyebrow="관리자"
      title="그룹웨어관리자"
      actions={
        <div className="pill-row">
          <Pill tone="accent">계정</Pill>
          <Pill tone="accent">권한</Pill>
          <Pill tone="accent">정책</Pill>
          <Pill tone="accent">감사</Pill>
        </div>
      }
    >
      <SurfaceSection title="관리자 기능">
        <div className="mobile-summary-grid">
          {visibleButtons.map((button) => (
            <article key={button.href} className="route-card">
              <h3>{button.title}</h3>
              <p className="card-note">{button.meta}</p>
              <Link href={button.href}>열기</Link>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
