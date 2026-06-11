import Link from "next/link";
import { adminAuditLogPreviewFilters, adminAuditNotes } from "../../../admin-skeleton-config";

export default function AdminAuditLogsPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/admin">← 관리자 허브</Link>
      <h1>관리자 / 감사 로그</h1>
      <p style={{ lineHeight: 1.7 }}>
        운영 변경 이력을 actor/action/target/time 기준으로 점검하는 skeleton 입니다. 이번 단계에서는 raw storage key, bucket, signed URL 없이도 추적 가능한 metadata 후보만 보여줍니다.
      </p>
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>미리 보는 필터</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {adminAuditLogPreviewFilters.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>마스킹 규칙</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {adminAuditNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
