import Link from "next/link";
import { appRoutes } from "@gw/shared";

const sessionCards = [
  { title: "인증 상태", body: "placeholder HttpOnly Cookie 세션으로 /api/me 계약을 확인합니다." },
  { title: "현재 회사", body: "company_id 기준 멀티테넌시 범위를 유지한 mock 회사 정보만 노출합니다." },
  { title: "권한 표시", body: "roleCodes / permissions 를 UI placeholder에 노출해 후속 RBAC 연결 지점을 고정합니다." },
];

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← 홈으로</Link>
      <h1>대시보드 / 내 정보 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        이 화면은 실제 로그인 완료 화면이 아니라, 세션 상태와 현재 사용자 계약을 어디에 표시할지 먼저 합의하기 위한 placeholder 입니다.
      </p>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 24 }}>
        {sessionCards.map((card) => (
          <article key={card.title} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>{card.title}</h2>
            <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{card.body}</p>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>연결할 API</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li><a href={appRoutes.me}>{appRoutes.me}</a> — 현재 사용자와 세션 상태</li>
          <li><a href={appRoutes.org.companies}>{appRoutes.org.companies}</a> — 회사 기본 조회</li>
          <li><a href={appRoutes.org.roles}>{appRoutes.org.roles}</a> — 역할/권한 요약</li>
        </ul>
      </section>
    </main>
  );
}
