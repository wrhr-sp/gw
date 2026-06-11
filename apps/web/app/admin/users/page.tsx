import React from "react";
import Link from "next/link";
import { adminUserHighlights, adminUserReviewFields } from "../../../admin-skeleton-config";

const userChecks = [
  "사용자 초대/비활성화 placeholder",
  "직원-계정 연결 상태 확인",
  "고위험 권한 diff 요약과 감사 후보 생성",
] as const;

export default function AdminUsersPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/admin">← 관리자 허브</Link>
      <h1>관리자 / 사용자</h1>
      <p style={{ lineHeight: 1.7 }}>
        운영 사용자와 직원 연결, 역할 후보, 상태 변경 diff 를 먼저 정리하는 skeleton 입니다. 실제 권한 저장 대신 변경 전/후 요약과 감사 후보만 보여주는 범위를 유지합니다.
      </p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 24 }}>
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>핵심 점검</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
            {userChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>검토 필드 skeleton</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
            {adminUserReviewFields.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>가드레일</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
            {adminUserHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
