import Link from "next/link";
import { appRoutes } from "@gw/shared";

type PageProps = {
  params: Promise<{ postId: string }>;
};

const detailSections = [
  "게시판 정보와 postId 기반 상세 조회",
  "본문 대신 bodyPreview 중심 placeholder 본문",
  "댓글 목록/작성 영역과 읽음 확인 버튼 안내",
  "접근 불가 postId 는 API 403 으로 막는다는 설명",
] as const;

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/boards">← 게시판 목록으로</Link>
      <h1>게시글 상세 placeholder</h1>
      <p style={{ lineHeight: 1.7 }}>
        postId <code>{postId}</code> 를 기준으로 상세/댓글/읽음 확인 흐름이 이어지는 자리를 고정합니다.
        실제 본문 저장과 첨부 미리보기는 아직 연결하지 않습니다.
      </p>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>상세 정보 placeholder</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <article style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>댓글 영역</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 12 }}>댓글 목록 조회와 작성 폼은 postId 경로를 공유하되 권한은 별도로 확인합니다.</p>
          <a href={appRoutes.boards.comments(postId)}>{appRoutes.boards.comments(postId)}</a>
        </article>
        <article style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>읽음 확인 영역</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 12 }}>임의 targetId 생성은 서버에서 403 으로 막고 접근 가능한 게시글만 receipt 를 남깁니다.</p>
          <a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a>
        </article>
      </section>
    </main>
  );
}
