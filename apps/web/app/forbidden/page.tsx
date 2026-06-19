import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/home">← 대시보드로</Link>
      <h1>접근 권한이 없습니다</h1>
      <p style={{ lineHeight: 1.7 }}>
        이 preview 에서는 로그인 여부만이 아니라 역할 경계도 함께 확인합니다. 일반 사용자와 감사 전용 사용자는 허용된 운영 경로만 열리고,
        나머지 관리자 화면은 이 안내 페이지로 막습니다.
      </p>
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>안내</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li>일반 업무는 대시보드, 조직도, 직원, 근태, 휴가 화면에서 계속 진행합니다.</li>
          <li>감사 권한 사용자는 허용된 경우 <a href="/admin/audit-logs">/admin/audit-logs</a> 로 이동해 주세요.</li>
          <li>운영 권한이 필요한 변경은 관리자 권한 계정으로 다시 확인합니다.</li>
        </ul>
      </section>
    </main>
  );
}
