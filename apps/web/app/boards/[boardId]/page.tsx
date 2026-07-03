import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { BoardDetailLiveSection } from "../../_components/real-usage-panels";

type PageProps = {
  params: Promise<{ boardId: string }>;
};

type BoardPreset = {
  title: string;
  summary: string;
  representativePostId: string | null;
  cards: Array<{ title: string; body: string }>;
  usageSteps: string[];
  policyNotes: string[];
  invalidRoute?: boolean;
};

const boardPresets: Record<string, BoardPreset> = {
  board_notice: {
    title: "전사 공지",
    summary: "회사에서 꼭 확인해야 하는 공지를 모아 보고, 등록 권한이 있으면 새 공지를 올립니다.",
    representativePostId: "board_post_notice_1",
    cards: [
      { title: "공지 목록", body: "중요 공지는 목록 위쪽에서 먼저 확인합니다." },
      { title: "공지 등록", body: "등록 버튼을 눌러 제목과 본문을 작성합니다." },
      { title: "읽음 확인", body: "공지 내용을 확인한 뒤 읽음 상태를 남깁니다." },
    ],
    usageSteps: ["공지 목록을 확인합니다.", "등록 버튼으로 새 공지를 작성합니다.", "상세 화면에서 읽음 확인을 남깁니다."],
    policyNotes: ["일반 직원은 공지 읽기 중심으로 사용합니다.", "공지 등록과 수정은 운영 권한 기준으로 제한합니다."],
  },
  board_department_notice: {
    title: "부서별 공지",
    summary: "부서나 지점 단위 안내를 따로 올리고 확인하는 게시판입니다.",
    representativePostId: "board_post_department_notice_1",
    cards: [
      { title: "부서 안내", body: "인사팀, 운영팀, 지점별 안내를 구분해서 확인합니다." },
      { title: "부서 공지 등록", body: "등록 버튼으로 부서별 공지 제목과 본문을 작성합니다." },
      { title: "확인 흐름", body: "공지 확인 뒤 댓글과 읽음 확인으로 후속 반응을 남깁니다." },
    ],
    usageSteps: ["내가 볼 부서 공지를 확인합니다.", "필요하면 새 부서 공지를 등록합니다.", "작성된 글을 상세에서 다시 확인합니다."],
    policyNotes: ["부서별 공지는 department 범위 안내로 표시합니다.", "공지형 게시판이라 등록 권한이 없으면 작성이 차단될 수 있습니다."],
  },
  board_general: {
    title: "자유 게시판",
    summary: "직원들이 글을 올리고 댓글로 의견을 주고받는 사내 소통 공간입니다.",
    representativePostId: "board_post_demo",
    cards: [
      { title: "최신 글", body: "최근 올라온 글을 먼저 확인합니다." },
      { title: "게시글 등록", body: "등록 버튼을 눌러 제목과 본문을 입력합니다." },
      { title: "댓글", body: "상세 화면에서 댓글을 남기고 대화를 이어갑니다." },
    ],
    usageSteps: ["최신 글 목록에서 읽을 글을 고릅니다.", "등록 버튼으로 새 글을 작성합니다.", "상세 화면에서 댓글과 읽음 확인을 마무리합니다."],
    policyNotes: ["직원 소통용 글쓰기를 우선합니다.", "권한이 없는 글이나 잘못된 주소는 안내 화면으로 돌려보냅니다."],
  },
  board_data_share: {
    title: "자료 공유",
    summary: "업무 양식, 안내 자료, 참고 링크를 모아 직원들이 빠르게 찾는 게시판입니다.",
    representativePostId: "board_post_data_share_1",
    cards: [
      { title: "자료 목록", body: "자주 쓰는 양식과 참고 자료를 목록에서 확인합니다." },
      { title: "자료 글 등록", body: "등록 버튼으로 자료 제목과 설명을 작성합니다." },
      { title: "보완 댓글", body: "상세 화면에서 추가 설명이나 보완 요청을 댓글로 남깁니다." },
    ],
    usageSteps: ["필요한 자료 글을 찾습니다.", "새 자료가 있으면 등록 버튼으로 설명 글을 작성합니다.", "상세 화면에서 댓글로 보완 내용을 남깁니다."],
    policyNotes: ["이번 단계는 자료 설명 글 등록까지 다룹니다.", "파일 첨부/R2 업로드는 별도 승인 후 다음 단계에서 연결합니다."],
  },
} as const;

export default async function BoardDetailPage({ params }: PageProps) {
  const { boardId } = await params;
  const preset = boardPresets[boardId] ?? {
    title: "접근할 수 없는 게시판",
    summary: "등록되지 않았거나 접근 권한이 없는 게시판입니다. 게시판 목록에서 다시 선택해 주세요.",
    representativePostId: null,
    cards: [
      { title: "게시판 확인", body: "요청한 게시판이 회사에서 사용하는 게시판인지 확인합니다." },
      { title: "접근 제한", body: "권한이 없으면 글쓰기와 상세 이동을 보여 주지 않습니다." },
      { title: "다시 선택", body: "게시판 목록으로 돌아가 접근 가능한 게시판을 선택합니다." },
    ],
    usageSteps: ["게시판 목록으로 돌아갑니다.", "접근 가능한 게시판을 다시 선택합니다.", "계속 막히면 관리자에게 권한을 확인합니다."],
    policyNotes: ["알 수 없는 게시판은 실제 운영 게시판처럼 보이지 않게 처리합니다."],
    invalidRoute: true,
  } satisfies BoardPreset;

  return (
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow={preset.invalidRoute ? "접근 안내" : "게시판"}
      title={preset.title}
      description={preset.summary}
      actions={<Pill tone={preset.invalidRoute ? "warning" : "accent"}>{preset.invalidRoute ? "확인 필요" : "등록 가능"}</Pill>}
    >
      {preset.invalidRoute ? null : (
        <SurfaceSection title="게시판 내용과 등록" description="글 목록, 등록 버튼, 현재 세션 기준 권한을 한 화면에서 확인합니다.">
          <BoardDetailLiveSection boardId={boardId} />
        </SurfaceSection>
      )}

      <SurfaceSection title={preset.invalidRoute ? "접근 안내" : "이 게시판에서 할 수 있는 일"} description={preset.invalidRoute ? "잘못된 게시판 주소에서는 작성 화면을 열지 않습니다." : "게시판 성격에 따라 먼저 볼 정보와 등록 행동을 정리했습니다."}>
        <div className="grid-auto-compact">
          {preset.cards.map((item) => (
            <article key={item.title} className="info-card">
              <Pill tone={preset.invalidRoute ? "warning" : "accent"}>{item.title}</Pill>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title={preset.invalidRoute ? "다시 확인하는 순서" : "글 등록 순서"} description="실제 화면에서 바로 따라갈 수 있는 순서입니다.">
        <ol className="number-list">
          {preset.usageSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="운영 기준" description="게시판을 사용할 때 헷갈리지 않도록 권한과 제한 범위를 쉬운 말로 보여 줍니다." muted>
        <ul className="summary-list">
          {preset.policyNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="이동" description={preset.invalidRoute ? "접근 가능한 화면으로 돌아갑니다." : "게시글 상세나 다른 게시판으로 이어서 이동합니다."}>
        <div className="link-row">
          <a href="/boards">게시판 목록</a>
          {preset.representativePostId ? <a href={`/posts/${preset.representativePostId}`}>대표 글 보기</a> : null}
          <a href="/home">홈으로</a>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
