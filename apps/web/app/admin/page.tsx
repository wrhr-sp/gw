import Link from "next/link";
import { appRoutes } from "@gw/shared";

const adminNotes = [
  "초대 생성은 메일 발송 없이 token/status skeleton 까지만 반환합니다.",
  "invite.manage 권한이 없는 역할은 API에서 403 으로 차단합니다.",
  "민감 endpoint 는 감사 로그 후보(action, actor, target)를 남길 수 있는 구조를 유지합니다.",
];

export default function AdminPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/">← 홈으로</Link>
      <h1>관리자 초대/권한 관리 skeleton</h1>
      <p style={{ lineHeight: 1.7 }}>
        관리자 화면은 실제 운영 초대를 발송하지 않고, 초대 요청 payload와 권한 체크 위치를 먼저 고정하기 위한 placeholder 입니다.
      </p>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>관리자 체크포인트</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {adminNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <article style={{ border: "1px dashed #9ca3af", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>초대 생성 API</h2>
          <a href={appRoutes.admin.invites}>{appRoutes.admin.invites}</a>
        </article>
        <article style={{ border: "1px dashed #9ca3af", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>함께 보는 조회 API</h2>
          <p style={{ marginBottom: 8 }}><a href={appRoutes.org.roles}>{appRoutes.org.roles}</a></p>
          <p style={{ margin: 0 }}><a href={appRoutes.org.permissions}>{appRoutes.org.permissions}</a></p>
        </article>
      </section>
    </main>
  );
}
