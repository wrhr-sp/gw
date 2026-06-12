import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../../_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";

type PageProps = {
  params: Promise<{ boardId: string }>;
};

const boardPresets = {
  board_notice: {
    title: "전사 공지 상세 placeholder",
    summary: "notice-only 게시판에서는 읽기 중심 흐름과 운영 공지 작성 guardrail 을 먼저 확인합니다.",
    posts: ["고정 공지 카드", "읽음 확인 CTA", "댓글 비활성 또는 운영 제한 안내"],
  },
  board_general: {
    title: "자유 게시판 상세 placeholder",
    summary: "일반 게시판에서는 게시글 작성, 댓글, 읽음 확인 안내를 연결합니다.",
    posts: ["최신 글 카드 목록", "게시글 작성 폼 진입", "댓글 수 / 읽음 상태 badge"],
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
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow="boardId dynamic route"
      title={preset.title}
      description={preset.summary}
      actions={<Pill>{boardId}</Pill>}
    >
      <SurfaceSection title="route / 권한 문구" description="동적 라우트와 접근 경계를 모바일 화면에서도 바로 읽을 수 있게 둡니다.">
        <p>
          현재 경로의 boardId 는 <code>{boardId}</code> 입니다. 서버/API 연결 전에도 boardId 기반 정보와 권한 문구를 먼저 고정합니다.
        </p>
      </SurfaceSection>

      <SurfaceSection title="이 화면에서 보여줄 정보" description="표 대신 카드·badge·짧은 문장 중심으로 핵심 상태를 먼저 보여 줍니다." muted>
        <div className="grid-auto-compact">
          {preset.posts.map((item) => (
            <article key={item} className="info-card">
              <Pill tone="accent">mobile card</Pill>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="다음 진입 경로" description="게시글 상세와 문서함 route 를 같은 origin 안에서 이어 줍니다.">
        <div className="link-row">
          <a href={`/posts/board_post_${boardId}_employee_employee`}>예시 게시글 상세로 이동</a>
          <a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a>
          <a href="/documents">문서함 placeholder 보기</a>
        </div>
      </SurfaceSection>

      <Phase16PilotPanel
        description="게시판 상세 화면은 boardId 별 정보구조를 고정하고, 권한 차단/placeholder 제한/다음 route 연결을 live URL 에서 바로 설명할 수 있게 남깁니다."
        confirmItems={[
          `${boardId} 경로가 boardId 기반 정보와 권한 문구를 먼저 보여 준다.`,
          "공지형과 일반 게시판이 서로 다른 책임을 갖는다는 점이 카드 구성에서 드러난다.",
          "게시글 상세와 읽음 확인, 문서함 비교 route 로 바로 이어진다.",
        ]}
        blockedItems={[
          "생성되지 않은 boardId 도 동일 정보구조 placeholder 로만 설명하며 실제 운영 게시판 생성으로 간주하지 않는다.",
        ]}
        nextRoutes={[
          { href: `/posts/board_post_${boardId}_employee_employee`, label: "/posts/[postId]", description: "댓글/읽음 확인이 postId 기준으로 이어지는지 확인" },
          { href: appRoutes.readReceipts, label: appRoutes.readReceipts, description: "게시글/문서 공통 읽음 확인 endpoint 확인" },
          { href: "/documents", label: "/documents", description: "문서 공간 경계와 협업 묶음 비교" },
        ]}
        approvalGates={[
          "production 게시판 생성/수정 반영",
          "실제 공지 발행과 운영 정책 저장",
        ]}
      />
    </PageShell>
  );
}
