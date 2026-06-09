import Link from "next/link";
import { appRoutes } from "@gw/shared";

const loginFields = [
  { label: "회사 이메일", value: "admin@example.com" },
  { label: "비밀번호", value: "placeholder-password" },
];

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← 홈으로</Link>
      <h1>로그인 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        Phase 2에서는 실제 인증 provider 연결 대신 이메일 + 비밀번호 + HttpOnly Cookie 세션 계약을 먼저 고정합니다.
        아래 UI는 {appRoutes.auth.login} 요청/응답 shape를 확인하기 위한 placeholder 입니다.
      </p>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 24 }}>
        <article style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>예상 입력값</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            {loginFields.map((field) => (
              <li key={field.label}>
                <strong>{field.label}</strong>: {field.value}
              </li>
            ))}
          </ul>
        </article>

        <article style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>현재 단계 안내</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>실제 비밀번호 저장/해시 운영값은 아직 연결하지 않습니다.</li>
            <li>로그인 성공 시 placeholder 세션 쿠키 계약만 맞춥니다.</li>
            <li>승인 전까지 OAuth/SSO/메일 초대 발송은 연결하지 않습니다.</li>
          </ul>
        </article>
      </section>

      <section style={{ marginTop: 24, border: "1px dashed #9ca3af", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>다음 화면 연결</h2>
        <p style={{ lineHeight: 1.7, marginBottom: 12 }}>로그인 후에는 내 정보와 조직 조회 skeleton으로 이어집니다.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard">대시보드</Link>
          <Link href="/org">조직도</Link>
          <a href={appRoutes.me}>GET /api/me</a>
        </div>
      </section>
    </main>
  );
}
