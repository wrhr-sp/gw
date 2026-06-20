import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { PostDetailLiveSection } from "../../_components/real-usage-panels";

type PageProps = {
  params: Promise<{ postId: string }>;
};

const validBoardIds = new Set(["board_notice", "board_general"]);
const validEmployeeIds = new Set(["employee_admin", "employee_manager", "employee_staff", "employee_employee"]);
const uuidSuffixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSupportedPostRoute(postId: string) {
  if (postId === "board_post_demo" || postId === "board_post_notice_1") {
    return true;
  }

  const generatedMatch = /^board_post_(board_notice|board_general)_(employee_[a-z]+)_([0-9a-f-]+)$/i.exec(postId);
  if (generatedMatch) {
    return (
      validBoardIds.has(generatedMatch[1]) &&
      validEmployeeIds.has(generatedMatch[2]) &&
      uuidSuffixPattern.test(generatedMatch[3])
    );
  }

  return false;
}

const detailSections = [
  "제목, 작성자, 게시판 이름을 먼저 확인합니다.",
  "본문을 읽은 뒤 댓글로 의견을 남깁니다.",
  "확인이 끝난 글은 읽음 상태를 남깁니다.",
  "권한이 없거나 잘못된 주소는 상세 액션을 숨기고 안내합니다.",
] as const;

const usageChecklist = [
  "게시글 제목과 본문을 확인합니다.",
  "댓글이 있으면 먼저 읽고, 필요하면 새 댓글을 작성합니다.",
  "읽음 확인 버튼으로 확인 여부를 남깁니다.",
  "목록으로 돌아가 다른 글을 이어서 확인합니다.",
] as const;

const blockedChecklist = [
  "게시판 목록으로 돌아갑니다.",
  "접근 가능한 게시판에서 글을 다시 선택합니다.",
  "계속 접근할 수 없으면 관리자에게 권한을 확인합니다.",
] as const;

const blockedNotes = [
  "알 수 없는 게시글은 제목과 댓글 입력창을 보여 주지 않습니다.",
  "다른 사람이나 다른 회사 범위의 글처럼 보이는 주소는 안내 화면으로 돌려보냅니다.",
  "접근 가능한 글인지 확인된 뒤에만 댓글과 읽음 확인을 사용할 수 있습니다.",
] as const;

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;
  const isSupportedRoute = isSupportedPostRoute(postId);

  if (!isSupportedRoute) {
    return (
      <PageShell
        backHref="/boards"
        backLabel="게시판 목록으로"
        eyebrow="접근 안내"
        title="접근할 수 없는 게시글"
        description="이 글은 현재 게시판 흐름에서 확인되지 않았습니다. 게시판 목록으로 돌아가 접근 가능한 글을 다시 선택해 주세요."
        actions={<Pill tone="warning">확인 필요</Pill>}
      >
        <SurfaceSection title="접근 안내" description="성공한 게시글 상세처럼 보이지 않도록 차단 이유와 복귀 경로만 보여 줍니다.">
          <ul className="summary-list">
            {blockedNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SurfaceSection>

        <SurfaceSection title="다시 확인하는 순서" description="접근 가능한 게시판과 글을 다시 선택합니다.">
          <ol className="number-list">
            {blockedChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </SurfaceSection>

        <SurfaceSection title="이동" description="게시판 목록이나 정상 예시 글로 돌아갑니다." muted>
          <div className="link-row">
            <a href="/boards">게시판 목록</a>
            <a href="/boards/board_general">자유 게시판</a>
            <a href="/posts/board_post_demo">대표 글 보기</a>
          </div>
        </SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow="게시글"
      title="게시글 상세"
      description="게시글을 읽고 댓글을 남긴 뒤 읽음 확인까지 한 화면에서 처리합니다."
      actions={<Pill tone="accent">댓글과 읽음 확인</Pill>}
    >
      <SurfaceSection title="게시글 내용" description="제목, 본문, 댓글, 읽음 확인을 실제 사용 순서대로 보여 줍니다.">
        <PostDetailLiveSection postId={postId} />
      </SurfaceSection>

      <SurfaceSection title="상세에서 바로 볼 정보" description="글을 읽을 때 필요한 정보를 먼저 배치합니다.">
        <ul className="summary-list">
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="사용 순서" description="대장이 live 화면에서 바로 따라갈 수 있는 흐름입니다.">
        <ol className="number-list">
          {usageChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <div className="mobile-summary-grid">
        <SurfaceSection title="댓글" description="접근 가능한 글에서만 댓글 목록과 작성 영역을 보여 줍니다.">
          <p>댓글을 읽고 필요한 의견을 남깁니다.</p>
        </SurfaceSection>
        <SurfaceSection title="읽음 확인" description="글을 확인한 사용자가 읽음 상태를 남길 수 있습니다." muted>
          <p>공지나 중요한 글을 확인했는지 남기는 용도입니다.</p>
        </SurfaceSection>
      </div>

      <SurfaceSection title="권한과 제한" description="잘못된 주소나 권한 없는 글은 상세 화면처럼 보이지 않게 안내합니다." muted>
        <ul className="summary-list">
          <li>댓글 작성은 접근 가능한 게시글에서만 사용할 수 있습니다.</li>
          <li>읽음 확인은 글을 볼 수 있는 사용자에게만 열립니다.</li>
          <li>첨부파일, 외부 공유, 알림 연동은 별도 단계에서 다룹니다.</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
