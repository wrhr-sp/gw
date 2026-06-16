import React from "react";
import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../../_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { PostDetailLiveSection } from "../../_components/real-usage-panels";

type PageProps = {
  params: Promise<{ postId: string }>;
};

const detailSections = [
  "게시판 정보와 postId 기반 상세 조회",
  "본문 대신 bodyPreview 중심 placeholder 본문",
  "댓글 목록/작성 영역과 읽음 확인 버튼 안내",
  "접근 불가 postId 는 API 403 으로 막는다는 설명",
] as const;

const auditAndGuardNotes = [
  "댓글 생성은 `board.comment.create` 후보 action 으로 남습니다.",
  "읽음 확인은 게시글 접근 권한이 있는 경우에만 `read receipt` 후보로 남습니다.",
  "forged·unknown postId 는 성공처럼 보이지 않고 403/404 guardrail 로 막힙니다.",
] as const;

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;

  return (
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow="Phase 41 게시글 상세 협업 흐름"
      title="게시글 상세 placeholder"
      description="postId 기준 상세, 댓글, 읽음 확인, forged 접근 차단을 작은 화면에서도 같은 협업 문장으로 읽히게 정리했습니다."
      actions={<Pill>{postId}</Pill>}
    >
      <SurfaceSection title="실제 게시글 흐름 확인" description="상세 응답, 댓글 작성, 읽음 확인, forged 접근 차단을 한 자리에서 바로 검증합니다.">
        <PostDetailLiveSection postId={postId} />
      </SurfaceSection>

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

      <SurfaceSection title="감사 후보 / forged 차단" description="게시글 상세는 단순 읽기 화면이 아니라 댓글/읽음 확인/차단 이유를 같이 검토하는 자리입니다." muted>
        <ul className="summary-list">
          {auditAndGuardNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

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
