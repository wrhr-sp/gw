import React from "react";
import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../../_components/phase-16-pilot";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { BoardDetailLiveSection } from "../../_components/real-usage-panels";

type PageProps = {
  params: Promise<{ boardId: string }>;
};

type BoardPreset = {
  title: string;
  summary: string;
  samplePostId: string | null;
  infoCards: string[];
  auditNotes: string[];
  happyPath: string[];
  invalidRoute?: boolean;
};

const boardPresets: Record<string, BoardPreset> = {
  board_notice: {
    title: "전사 공지 게시판",
    summary: "공지 확인과 읽음 확인은 모두가 할 수 있지만, 공지 등록은 운영 권한이 있는 사용자만 진행합니다.",
    samplePostId: "board_post_notice_1",
    infoCards: ["고정 공지와 최신 공지 구분", "읽음 확인 CTA", "일반 구성원 공지 등록 차단 안내"],
    auditNotes: ["board.manage 권한으로 공지 등록", "공지 읽음 확인 기록", "일반 구성원 공지 등록 차단"],
    happyPath: [
      "공지 제목과 본문 요약을 확인합니다.",
      "읽음 확인 버튼으로 공지 수신 여부를 남깁니다.",
      "운영자만 공지 등록을 진행하고 일반 구성원은 읽기 전용 안내를 봅니다.",
    ],
  },
  board_general: {
    title: "자유 게시판",
    summary: "일반 게시판에서는 글 목록 확인, 글 작성, 게시글 상세 이동, 댓글, 읽음 확인이 한 흐름으로 이어집니다.",
    samplePostId: "board_post_demo",
    infoCards: ["최신 글 카드 목록", "글 작성 폼", "댓글 수와 읽음 확인 안내"],
    auditNotes: ["board.post.create", "board.comment.create", "post read receipt"],
    happyPath: [
      "글 목록에서 최신 글을 확인합니다.",
      "새 글을 등록한 뒤 상세 route 로 이동합니다.",
      "상세에서 댓글 작성과 읽음 확인까지 마무리합니다.",
    ],
  },
} as const;

export default async function BoardDetailPage({ params }: PageProps) {
  const { boardId } = await params;
  const preset = boardPresets[boardId] ?? {
    title: `${boardId} 접근 차단 안내`,
    summary: "등록되지 않은 게시판 ID 는 운영 게시판처럼 보이지 않도록 즉시 차단하고, 허용된 게시판으로 돌아가 다시 확인합니다.",
    samplePostId: null,
    infoCards: ["요청한 boardId", "권한 또는 존재 여부 확인", "허용된 게시판으로 복귀"],
    auditNotes: ["존재하지 않는 boardId 차단", "권한 없는 게시판 접근 차단", "허용된 게시판 재진입 안내"],
    happyPath: [
      "현재 boardId 가 허용된 게시판인지 먼저 확인합니다.",
      "차단되면 게시글 상세·글쓰기 같은 다음 행동을 노출하지 않습니다.",
      "게시판 목록으로 돌아가 허용된 게시판을 다시 선택합니다.",
    ],
    invalidRoute: true,
  } satisfies BoardPreset;
  const nextRoutes = preset.samplePostId
    ? [
        { href: `/posts/${preset.samplePostId}`, label: "/posts/[postId]", description: "댓글/읽음 확인이 postId 기준으로 이어지는지 확인" },
        { href: appRoutes.readReceipts, label: appRoutes.readReceipts, description: "게시글 읽음 확인 endpoint 확인" },
        { href: "/documents", label: "/documents", description: "문서 공간 경계와 협업 묶음 비교" },
      ]
    : [
        { href: "/boards", label: "/boards", description: "허용된 게시판 목록으로 돌아가기" },
        { href: "/dashboard", label: "/dashboard", description: "기본 업무 화면으로 복귀" },
        { href: "/login", label: "/login", description: "세션/권한을 바꿔 다시 확인" },
      ];

  return (
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow="Phase 51 게시판 상세"
      title={preset.title}
      description={preset.summary}
      actions={<Pill tone={preset.invalidRoute ? "warning" : "accent"}>{boardId}</Pill>}
    >
      {preset.invalidRoute ? null : (
        <SurfaceSection title="실제 게시판 흐름 확인" description="게시판 실응답, 글쓰기, 현재 세션 기준 권한 결과를 한 화면에서 바로 확인합니다.">
          <BoardDetailLiveSection boardId={boardId} />
        </SurfaceSection>
      )}

      <SurfaceSection title="이 게시판에서 바로 확인할 것" description="게시판 종류에 따라 먼저 봐야 할 정보와 행동 순서를 짧게 고정합니다.">
        <div className="grid-auto-compact">
          {preset.infoCards.map((item) => (
            <article key={item} className="info-card">
              <Pill tone="accent">핵심 확인</Pill>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title={preset.invalidRoute ? "차단 route 확인 순서" : "게시판별 happy path"} description={preset.invalidRoute ? "허용되지 않은 boardId 는 실제 게시판처럼 보이지 않도록 차단 순서를 먼저 고정합니다." : "대장이 live URL 에서 바로 따라갈 수 있게 route 단위 기본 순서를 고정합니다."}>
        <ol className="number-list">
          {preset.happyPath.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="운영 검토용 action 언어" description="게시판 상세에서 어떤 행동이 기록 후보로 남는지 쉬운 말로 고정합니다." muted>
        <ul className="summary-list">
          {preset.auditNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="다음 진입 경로" description={preset.invalidRoute ? "차단된 게시판에서는 허용된 목록이나 기본 화면으로만 돌아가게 합니다." : "게시글 상세와 읽음 확인 API, 대시보드 복귀 route 를 같은 흐름으로 이어 줍니다."}>
        <div className="link-row">
          {nextRoutes.map((route) => (
            <a key={route.href} href={route.href}>{route.label}</a>
          ))}
        </div>
      </SurfaceSection>

      <Phase16PilotPanel
        description={preset.invalidRoute ? "허용되지 않은 게시판 route 는 차단 안내와 복귀 경로만 보여 주고, 실제 게시글 흐름처럼 보이지 않게 유지합니다." : "게시판 상세 화면은 boardId 별 정보구조를 고정하고, 권한 차단과 다음 route 연결을 live URL 에서 바로 설명할 수 있게 남깁니다."}
        confirmItems={
          preset.invalidRoute
            ? [
                `${boardId} 경로가 허용된 게시판인지 먼저 확인한다.`,
                "차단된 boardId 는 게시글 상세·글쓰기 같은 happy path 를 노출하지 않는다.",
                "사용자는 /boards 또는 /dashboard 로 되돌아간다.",
              ]
            : [
                `${boardId} 경로가 boardId 기반 정보와 권한 문구를 먼저 보여 준다.`,
                "공지형과 일반 게시판이 서로 다른 책임을 갖는다는 점이 카드 구성에서 드러난다.",
                "게시글 상세와 읽음 확인, 문서함 비교 route 로 바로 이어진다.",
              ]
        }
        blockedItems={
          preset.invalidRoute
            ? ["허용되지 않은 boardId 는 실제 운영 게시판처럼 보이지 않고 접근 차단 안내로 정리한다."]
            : ["허용되지 않은 boardId 는 실제 운영 게시판처럼 보이지 않고 접근 차단 안내로 정리한다."]
        }
        nextRoutes={nextRoutes}
        approvalGates={[
          "production 게시판 생성/수정 반영",
          "실제 공지 발행과 운영 정책 저장",
        ]}
      />
    </PageShell>
  );
}
