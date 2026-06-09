import Link from "next/link";
import { appRoutes, appSections } from "@gw/shared";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
      <section style={{ background: "#111827", color: "#f9fafb", borderRadius: 24, padding: 32, marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>Cloudflare-first skeleton</p>
        <h1 style={{ margin: "12px 0 16px", fontSize: 40 }}>그룹웨어 Web/PWA 시작점</h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          OpenNext on Cloudflare, Workers + Hono API, Cloudflare D1 구성을 전제로
          다음 구현 단계가 바로 이어질 수 있도록 화면 골격과 계약을 정리했습니다.
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard">대시보드 보기</Link>
          <a href={appRoutes.health}>API health 계약</a>
        </div>
      </section>

      <section>
        <h2>초기 모듈 맵</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {appSections.map((section) => (
            <article key={section.href} style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
              <h3 style={{ marginTop: 0 }}>{section.label}</h3>
              <p style={{ lineHeight: 1.6, minHeight: 48 }}>{section.description}</p>
              <Link href={section.href}>{section.href}</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
