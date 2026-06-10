import Link from "next/link";
import { appRoutes } from "@gw/shared";

const sessionCards = [
  { title: "인증 상태", body: "placeholder HttpOnly Cookie 세션으로 /api/me 계약을 확인합니다." },
  { title: "현재 회사", body: "company_id 기준 멀티테넌시 범위를 유지한 mock 회사 정보만 노출합니다." },
  { title: "권한 표시", body: "roleCodes / permissions 를 UI placeholder에 노출해 후속 RBAC 연결 지점을 고정합니다." },
] as const;

const phaseThreeCards = [
  { href: "/attendance", title: "근태", body: "출퇴근, 기록 목록, 정정 요청 skeleton 과 attendance.read/manage 권한 분리를 확인합니다." },
  { href: "/leave", title: "휴가", body: "휴가 유형/잔여 snapshot, 신청, 승인 대기 skeleton 과 leave.request/approve 경계를 확인합니다." },
] as const;

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

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Phase 3 근태/휴가 진입점</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {phaseThreeCards.map((card) => (
            <article key={card.href} style={{ border: "1px solid #f3f4f6", borderRadius: 16, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>{card.title}</h3>
              <p style={{ lineHeight: 1.7 }}>{card.body}</p>
              <Link href={card.href}>바로가기 →</Link>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>연결할 API</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li><a href={appRoutes.me}>{appRoutes.me}</a> — 현재 사용자와 세션 상태</li>
          <li><a href={appRoutes.org.companies}>{appRoutes.org.companies}</a> — 회사 기본 조회</li>
          <li><a href={appRoutes.org.roles}>{appRoutes.org.roles}</a> — 역할/권한 요약</li>
          <li><a href={appRoutes.attendance.records}>{appRoutes.attendance.records}</a> — 근태 목록 contract</li>
          <li><a href={appRoutes.leave.requests}>{appRoutes.leave.requests}</a> — 휴가 신청/대기 목록 contract</li>
        </ul>
      </section>
    </main>
  );
}
