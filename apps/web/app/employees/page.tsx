import Link from "next/link";
import { appRoutes } from "@gw/shared";

const employeeHighlights = [
  "회사별 employee 목록을 /api/employees 계약으로 조회합니다.",
  "employmentStatus 는 active / on_leave / offboarded 기본값만 노출합니다.",
  "개인정보 민감 필드는 아직 placeholder 범위를 넘지 않도록 제외합니다.",
];

export default function EmployeesPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← 홈으로</Link>
      <h1>직원 조회 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        직원 페이지는 후속 인사/근태 도메인이 재사용할 employee 기본 shape를 고정하는 자리입니다.
      </p>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>이번 Phase에서 보이는 것</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {employeeHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <article style={{ border: "1px dashed #9ca3af", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>예상 컬럼</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>employee id, company id, department id, 이메일, 이름, employment status</p>
        </article>
        <article style={{ border: "1px dashed #9ca3af", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>연결 API</h2>
          <a href={appRoutes.org.employees}>{appRoutes.org.employees}</a>
        </article>
      </section>
    </main>
  );
}
