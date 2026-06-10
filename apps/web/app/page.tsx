import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "./_components/page-shell";
import { installGuideSteps, mobilePrimaryNav, mobileQuickActions, mobileReviewChecklist } from "./mobile-pwa-config";

export default function HomePage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 6 모바일/PWA 1차"
      title="그룹웨어 Web/PWA 시작점"
      description="작은 화면 기준 레이아웃, 설치 안내, offline skeleton, same-origin /api 원칙을 먼저 고정한 시작 화면입니다."
      actions={
        <div className="action-row">
          <Link href="/dashboard" className="touch-button">
            모바일 대시보드 보기
          </Link>
          <a href="/offline" className="touch-button--secondary">
            오프라인 안내
          </a>
        </div>
      }
    >
      <section className="hero-card">
        <p className="brand-link__eyebrow">Cloudflare-first skeleton</p>
        <h2 style={{ margin: "8px 0 12px" }}>작은 화면에서도 핵심 업무 흐름을 먼저 찾을 수 있게 정리했습니다.</h2>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          실제 외부 배포·push·background sync 없이, 모바일에서 자주 쓰는 출퇴근/휴가/전자결재 진입점과 게시판/문서 읽기 흐름을 PWA skeleton 으로 연결합니다.
        </p>
        <div className="pill-row" style={{ marginTop: 16 }}>
          <Pill tone="accent">relative manifest 유지</Pill>
          <Pill tone="accent">same-origin /api 유지</Pill>
          <Pill tone="warning">offline write queue 제외</Pill>
        </div>
      </section>

      <SurfaceSection title="모바일 핵심 진입점" description="승인된 Phase 6 route 구조를 유지한 채 모바일 우선 탐색을 제공합니다.">
        <div className="grid-auto">
          {mobilePrimaryNav.map((item) => (
            <article key={item.href} className="route-card">
              <div className="pill-row">
                <Pill>{item.label}</Pill>
              </div>
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>바로 열기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="모바일 우선 quick action" description="홈에서도 자주 쓰는 흐름을 먼저 찾을 수 있도록 카드 순서를 재배치했습니다.">
        <div className="mobile-summary-grid">
          {mobileQuickActions.map((item) => (
            <article key={item.href} className="info-card">
              <Pill tone="accent">{item.badge}</Pill>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <a href={item.href}>해당 placeholder 보기 →</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="PWA 설치 안내 skeleton" description="실제 디바이스 배포 전, preview/production 공통으로 유지할 수 있는 설치 문구만 정리합니다." muted>
        <ol className="number-list">
          {installGuideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="모바일 UX 리뷰 메모" description="이번 Phase 에서 local responsive review 때 바로 볼 항목입니다.">
        <ul className="bullet-list">
          {mobileReviewChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
