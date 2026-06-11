import Link from "next/link";
import { appRoutes } from "@gw/shared";
import { adminHubCards, adminPolicySections, adminUserHighlights } from "../../admin-skeleton-config";

const adminNotes = [
  "초대 생성은 메일 발송 없이 token/status skeleton 까지만 반환합니다.",
  "관리자 변경 API 는 `/admin/*` 와 `/api/admin/*` 아래에서만 확장합니다.",
  "민감 endpoint 는 감사 후보(action, actor, target)와 마스킹 규칙을 유지합니다.",
] as const;

export default function AdminPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← 홈으로</Link>
      <h1>관리자 운영 허브 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        일반 업무 화면과 분리된 운영 변경 후보 영역입니다. 실제 운영 사용자/권한/정책 반영 없이도 관리자 정보구조, 감사 후보, API 경계를 먼저 고정합니다.
      </p>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>관리자 체크포인트</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {[...adminNotes, ...adminUserHighlights].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {adminHubCards.map((card) => (
          <article key={card.href} style={{ border: "1px dashed #9ca3af", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>{card.title}</h2>
            <p style={{ lineHeight: 1.6 }}>{card.description}</p>
            <Link href={card.href}>화면 보기 →</Link>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>함께 보는 API 시작점</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li><a href={appRoutes.admin.users}>{appRoutes.admin.users}</a></li>
          <li><a href={appRoutes.admin.policies}>{appRoutes.admin.policies}</a></li>
          <li><a href={appRoutes.admin.auditLogs}>{appRoutes.admin.auditLogs}</a></li>
          <li><a href={appRoutes.admin.invites}>{appRoutes.admin.invites}</a></li>
        </ul>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>운영 정책 placeholder 범위</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {adminPolicySections.map((section) => (
            <article key={section.title} style={{ border: "1px dashed #d1d5db", borderRadius: 16, padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>{section.title}</h3>
              <ul style={{ paddingLeft: 20, lineHeight: 1.7, marginBottom: 0 }}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
