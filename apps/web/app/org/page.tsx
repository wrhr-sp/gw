import Link from "next/link";
import { appRoutes } from "@gw/shared";

const orgPanels = [
  {
    title: "부서",
    description: "departments 는 parent_department_id 를 통해 계층 구조를 표현합니다.",
    href: appRoutes.org.departments,
  },
  {
    title: "역할",
    description: "roles 는 회사 범위/글로벌 범위를 함께 표현할 수 있는 skeleton 입니다.",
    href: appRoutes.org.roles,
  },
  {
    title: "권한",
    description: "permissions 는 초기에는 정적 카탈로그로 노출하고 후속 RBAC 단계에서 확장합니다.",
    href: appRoutes.org.permissions,
  },
];

export default function OrgPage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← 홈으로</Link>
      <h1>조직/권한 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        조직도 화면은 부서, 역할, 권한의 기본 조회 계약을 하나의 화면 흐름으로 묶기 위한 placeholder 입니다.
      </p>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 24 }}>
        {orgPanels.map((panel) => (
          <article key={panel.title} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>{panel.title}</h2>
            <p style={{ lineHeight: 1.7 }}>{panel.description}</p>
            <a href={panel.href}>{panel.href}</a>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px dashed #9ca3af", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>주의사항</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          <li>회사 범위를 넘는 cross-company 조회는 placeholder 단계에서도 허용하지 않습니다.</li>
          <li>메뉴를 숨겨도 실제 권한 검증은 API에서 다시 해야 한다는 전제를 유지합니다.</li>
          <li>권한 엔진 완성형이 아니라 조회/표시 skeleton 까지만 다룹니다.</li>
        </ul>
      </section>
    </main>
  );
}
