import Link from "next/link";

type PageProps = {
  params: Promise<{ boardId: string }>;
};

const boardPresets = {
  board_notice: {
    title: "전사 공지 상세 placeholder",
    summary: "notice-only 게시판에서는 읽기 중심 흐름과 운영 공지 작성 guardrail 을 먼저 확인합니다.",
    posts: ["공지 카드 목록", "고정 공지 / pinnedUntil 상태", "읽음 확인 CTA"],
  },
  board_general: {
    title: "자유 게시판 상세 placeholder",
    summary: "일반 게시판에서는 게시글 작성, 댓글, 읽음 확인 안내를 연결합니다.",
    posts: ["최신 글 목록", "게시글 작성 폼 진입", "댓글 수 / 읽음 상태 badge"],
  },
} as const;

export default async function BoardDetailPage({ params }: PageProps) {
  const { boardId } = await params;
  const preset = boardPresets[boardId as keyof typeof boardPresets] ?? {
    title: `${boardId} placeholder`,
    summary: "생성된 게시판도 동일한 정보구조로 확장할 수 있도록 boardId 경로를 비워 둔 상태입니다.",
    posts: ["게시판 메타데이터", "게시글 목록", "권한 안내"],
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/boards">← 게시판 목록으로</Link>
      <h1>{preset.title}</h1>
      <p style={{ lineHeight: 1.7 }}>{preset.summary}</p>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>boardId route 확인</h2>
        <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
          현재 경로의 boardId 는 <code>{boardId}</code> 입니다. 서버/API 연결 전에도 동적 라우트와 권한 문구를 먼저 고정합니다.
        </p>
      </section>

      <section style={{ marginTop: 24, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f9fafb" }}>
        <h2 style={{ marginTop: 0 }}>이 화면에서 보여줄 정보</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, marginBottom: 0 }}>
          {preset.posts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href={`/posts/board_post_${boardId}_employee_employee`}>예시 게시글 상세로 이동</a>
        <Link href="/documents">문서함 placeholder 보기</Link>
      </section>
    </main>
  );
}
