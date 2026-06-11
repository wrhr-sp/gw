import Link from "next/link";
import { adminPolicyReviewChecklist, adminPolicySections } from "../../../admin-skeleton-config";

export default function AdminPoliciesPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/admin">← 관리자 허브</Link>
      <h1>관리자 / 정책</h1>
      <p style={{ lineHeight: 1.7 }}>
        근태·휴가·결재·문서·게시판 운영 정책의 저장 전 candidate 화면입니다. 실제 반영 대신 before/after diff, 변경 사유, 마스킹 규칙을 먼저 고정합니다.
      </p>
      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {adminPolicySections.map((section) => (
          <section key={section.title} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>{section.title}</h2>
            <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>리뷰 체크리스트</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
            {adminPolicyReviewChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
