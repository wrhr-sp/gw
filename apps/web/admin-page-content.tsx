import React from "react";
import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "./app/_components/page-shell";
import type { AdminHubCard } from "./admin-config";

const adminWorkButtons = [
  { href: "/admin/organization-info", title: "조직정보", meta: "지사·부서·직급·직위·직책·담당·사용자그룹" },
  { href: "/admin/policies", title: "운영정책", meta: "관리자 운영 정책" },
  { href: "/admin/audit-logs", title: "감사로그", meta: "변경 이력" },
] as const;

export function AdminPageContent({ visibleAdminHubCards }: { visibleAdminHubCards: readonly AdminHubCard[] }) {
  const visibleHrefs = new Set(visibleAdminHubCards.map((card) => card.href));
  const visibleButtons = adminWorkButtons.filter((button) => visibleHrefs.has(button.href));

  return (
    <PageShell
      backHref="/home"
      backLabel="대시보드로"
      eyebrow="관리자"
      title="그룹웨어관리자"
      actions={
        <div className="pill-row">
          <Pill tone="accent">조직정보</Pill>
          <Pill tone="accent">정책</Pill>
          <Pill tone="accent">감사</Pill>
        </div>
      }
    >
      <div className="feature-workspace" data-admin-sidebar-function-buttons="true">
        <aside className="feature-workspace__nav" aria-label="관리자페이지 기능버튼">
          <div className="feature-workspace__nav-header">
            <h1>관리자페이지</h1>
            <p className="card-note">관리자 기능은 조직정보, 운영정책, 감사로그로 분리합니다.</p>
          </div>
          <div className="feature-workspace__tab-list" role="navigation" aria-label="관리자 기능 이동">
            {visibleButtons.map((button) => (
              <Link key={button.href} className="feature-workspace__tab" href={button.href as never}>
                <span>{button.title}</span>
                <small>{button.meta}</small>
              </Link>
            ))}
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-label="관리자 기능 본문">
          <SurfaceSection title="관리자 기능">
            <div className="mobile-summary-grid">
              {visibleButtons.map((button) => (
                <article key={button.href} className="route-card">
                  <h3>{button.title}</h3>
                  <p className="card-note">{button.meta}</p>
                  <Link href={button.href as never}>열기</Link>
                </article>
              ))}
            </div>
          </SurfaceSection>
        </section>
      </div>
    </PageShell>
  );
}
