import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../../_components/phase-16-pilot";
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

      <Phase16PilotPanel
        description="게시글 상세는 postId 기준 상세/댓글/읽음 확인 흐름을 설명하는 자리이며, notice-only 책임 분리와 forged 접근 차단이 핵심입니다."
        confirmItems={[
          "postId 기반 상세 조회와 bodyPreview 중심 본문 구조가 유지된다.",
          "댓글 영역과 읽음 확인 영역이 분리돼 각 권한을 따로 설명할 수 있다.",
          "접근 불가 postId 는 API 403 으로 막는다는 점이 UI 문구와 맞는다.",
        ]}
        blockedItems={[
          "실제 첨부 다운로드, 외부 공유, 실운영 알림 발송은 이번 게시글 상세 범위에 포함되지 않는다.",
        ]}
        nextRoutes={[
          { href: appRoutes.boards.comments(postId), label: appRoutes.boards.comments(postId), description: "댓글 목록/작성 placeholder 확인" },
          { href: appRoutes.readReceipts, label: appRoutes.readReceipts, description: "읽음 확인 공통 endpoint 확인" },
          { href: "/boards", label: "/boards", description: "목록으로 돌아가 notice-only/general 흐름 비교" },
        ]}
        approvalGates={[
          "production 댓글/읽음 데이터 반영",
          "실제 외부 알림·멘션 연동",
        ]}
      />
    </PageShell>
  );
}
