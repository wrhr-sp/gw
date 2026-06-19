import React from "react";
import { appRoutes } from "@gw/shared";

import { Phase16PilotPanel } from "../../_components/phase-16-pilot";
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
  "게시판 이름과 postId 기반 상세 조회 결과",
  "제목·본문 요약·공지 여부를 정상 응답에서만 확인",
  "댓글 목록과 댓글 작성 영역은 접근 가능한 게시글에서만 노출",
  "읽음 확인과 접근 차단 문구를 같은 화면에서 구분",
] as const;

const auditAndGuardNotes = [
  "댓글 생성은 접근 가능한 게시글에서만 `board.comment.create` 후보 action 으로 남습니다.",
  "읽음 확인은 게시글 접근 권한이 확인된 경우에만 `read receipt` 후보로 남습니다.",
  "다른 직원 placeholder·forged·unknown postId 는 성공처럼 보이지 않고 403/404 guardrail 로 막힙니다.",
] as const;

const happyPathChecklist = [
  "상세 응답이 정상 조회되면 제목과 본문 요약을 확인합니다.",
  "접근 가능한 게시글에서만 댓글 입력과 저장 결과를 확인합니다.",
  "읽음 확인 버튼은 허용된 게시글에서만 사용합니다.",
  "unknown·다른 직원 placeholder·forged postId 는 차단 안내가 먼저 보이는지 확인합니다.",
] as const;

const blockedChecklist = [
  "postId 가 허용된 게시판 흐름에서 나온 값인지 먼저 확인합니다.",
  "확인 전에는 상세 액션 CTA 를 숨깁니다.",
  "허용된 상세 route 나 게시판 목록으로 다시 이동합니다.",
] as const;

const blockedNotes = [
  "다른 직원 placeholder·forged·unknown postId 는 성공 화면처럼 보이지 않게 차단 안내만 보여 줍니다.",
  "상세 액션과 읽음 확인 CTA 는 API guard 와 같은 의미로 UI 에서도 미리 감춥니다.",
  "허용된 게시글인지 확인되지 않으면 상세 액션을 노출하지 않습니다.",
] as const;

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;
  const isSupportedRoute = isSupportedPostRoute(postId);

  if (!isSupportedRoute) {
    return (
      <PageShell
        backHref="/boards"
        backLabel="게시판 목록으로"
        eyebrow="Phase 51 게시글 상세"
        title="접근할 수 없는 게시글"
        description="이 postId 는 허용된 게시판 흐름에서 확인되지 않았습니다. 다른 직원 placeholder·forged·unknown 접근은 댓글/읽음 확인 CTA 없이 차단 안내만 보여 줍니다."
        actions={<Pill tone="warning">{postId}</Pill>}
      >
        <SurfaceSection title="접근 차단 안내" description="상세 성공 화면처럼 보이지 않게 차단 이유와 복귀 경로만 먼저 보여 줍니다.">
          <ul className="summary-list">
            {blockedNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SurfaceSection>

        <SurfaceSection title="차단 상태에서 따를 순서" description="허용 여부가 확인되기 전에는 상세 happy path 를 열지 않습니다.">
          <ol className="number-list">
            {blockedChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </SurfaceSection>

        <SurfaceSection title="다시 확인할 route" description="허용된 게시글 또는 게시판 목록으로 돌아가 흐름을 다시 시작합니다." muted>
          <div className="link-row">
            <a href="/boards">게시판 목록으로 돌아가기</a>
            <a href="/boards/board_general">자유 게시판 다시 보기</a>
            <a href="/posts/board_post_demo">허용된 예시 게시글 보기</a>
            <a href="/home">대시보드로 돌아가기</a>
          </div>
        </SurfaceSection>

        <Phase16PilotPanel
          description="다른 직원 placeholder·forged·unknown post route 는 상세 액션 CTA, 읽음 확인, 성공형 상세 문구보다 차단 안내를 우선합니다."
          confirmItems={[
            "invalid post route 에서 댓글/읽음 확인 CTA 가 렌더링되지 않는다.",
            "API 403/404 guard 와 같은 의미의 차단 문구가 먼저 보인다.",
            "허용된 게시판/게시글 route 로만 복귀하게 안내한다.",
          ]}
          blockedItems={[
            "성공형 게시글 상세 제목, 상세 입력창, 읽음 확인 버튼 노출",
          ]}
          nextRoutes={[
            { href: "/boards", label: "/boards", description: "게시판 목록에서 허용된 경로 다시 선택" },
            { href: "/boards/board_general", label: "/boards/board_general", description: "일반 게시판의 정상 흐름 다시 시작" },
            { href: "/posts/board_post_demo", label: "/posts/board_post_demo", description: "정상 예시 게시글 상세 확인" },
          ]}
          approvalGates={[
            "production 댓글/읽음 데이터 반영",
            "실제 외부 알림·멘션 연동",
          ]}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      backHref="/boards"
      backLabel="게시판 목록으로"
      eyebrow="Phase 51 게시글 상세"
      title="게시글 상세"
      description="postId 기준 상세 응답이 확인된 경우에만 댓글·읽음 확인을 이어가고, forged/unknown 접근은 먼저 차단 안내로 정리합니다."
      actions={<Pill>{postId}</Pill>}
    >
      <SurfaceSection title="실제 게시글 흐름 확인" description="상세 응답, 댓글 작성, 읽음 확인, forged 접근 차단을 한 자리에서 바로 확인합니다.">
        <PostDetailLiveSection postId={postId} />
      </SurfaceSection>

      <SurfaceSection title="상세에서 바로 볼 정보" description="모바일에서 제목·메타·CTA 우선순위를 먼저 보게 합니다.">
        <ul className="summary-list">
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="게시글 상세 happy path" description="대장이 live URL 에서 바로 눌러볼 기본 흐름입니다.">
        <ol className="number-list">
          {happyPathChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <div className="mobile-summary-grid">
        <SurfaceSection title="댓글 영역" description="댓글 목록 조회와 작성 폼은 postId 경로를 공유하되 권한은 별도로 확인합니다.">
          <a href={appRoutes.boards.comments(postId)}>{appRoutes.boards.comments(postId)}</a>
        </SurfaceSection>
        <SurfaceSection title="읽음 확인 영역" description="임의 targetId 생성은 서버에서 403 으로 막고 접근 가능한 게시글만 receipt 를 남깁니다." muted>
          <a href={appRoutes.readReceipts}>{appRoutes.readReceipts}</a>
        </SurfaceSection>
      </div>

      <SurfaceSection title="감사 후보 / forged 차단" description="게시글 상세는 단순 읽기 화면이 아니라 댓글·읽음 확인·차단 이유를 같이 검토하는 자리입니다." muted>
        <ul className="summary-list">
          {auditAndGuardNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <Phase16PilotPanel
        description="게시글 상세는 postId 기준 상세/댓글/읽음 확인 흐름을 설명하는 자리이며, forged 접근 차단이 핵심입니다."
        confirmItems={[
          "postId 기반 상세 조회와 bodyPreview 중심 본문 구조가 유지된다.",
          "댓글 영역과 읽음 확인 영역이 분리돼 각 권한을 따로 설명할 수 있다.",
          "접근 불가 postId 는 API 403 으로 막는다는 점이 UI 문구와 맞는다.",
        ]}
        blockedItems={[
          "실제 첨부 다운로드, 외부 공유, 실운영 알림 발송은 이번 게시글 상세 범위에 포함되지 않는다.",
        ]}
        nextRoutes={[
          { href: appRoutes.boards.comments(postId), label: appRoutes.boards.comments(postId), description: "댓글 목록/작성 확인" },
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
