import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";

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
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow="모바일 게시글 상세"
      title="게시글 상세 placeholder"
      description="postId 기준 상세/댓글/읽음 확인 흐름을 작은 화면에서도 제목과 CTA 가 먼저 보이도록 정리했습니다."
      actions={<Pill>{postId}</Pill>}
    >
      <SurfaceSection title="상세 정보 placeholder" description="모바일에서 제목/메타/CTA 우선순위를 먼저 보게 합니다.">
        <ul className="summary-list">
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <div className="mobile-summary-grid">
        <SurfaceSection title="댓글 영역" description="댓글 목록 조회와 작성 폼은 postId 경로를 공유하되 권한은 별도로 확인합니다.">
          <a href={appRoutes.boards.comments(postId)}>{appRoutes.boards.comments(postId)}</a>
        </SurfaceSection>
        <SurfaceSection title="읽음 확인 영역" description="임의 targetId 생성은 서버에서 403 으로 막고 접근 가능한 게시글만 receipt 를 남깁니다." muted>
          <a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a>
        </SurfaceSection>
      </div>
    </PageShell>
  );
}
