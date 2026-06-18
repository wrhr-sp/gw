import React from "react";
import { cookies } from "next/headers";
import { appRoutes } from "@gw/shared";

import { app as apiApp } from "../../../../api/src/app";
import { ApprovalDocumentDetailLiveSection } from "../../_components/real-usage-panels";
import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { Phase16PilotPanel } from "../../_components/phase-16-pilot";

type PageProps = {
  params: Promise<{ documentId: string }>;
};

const knownDocumentIds = new Set([
  "approval_document_demo",
  "approval_document_multistep",
  "approval_document_team_pending",
  "approval_document_manager_self",
]);

const uuidSuffixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isApprovalDocumentPatternMatch(documentId: string) {
  if (knownDocumentIds.has(documentId)) {
    return true;
  }

  const generatedMatch = /^approval_document_(employee_[a-z]+)_([0-9a-f-]+)$/i.exec(documentId);
  if (!generatedMatch) {
    return false;
  }

  return uuidSuffixPattern.test(generatedMatch[2]);
}

async function canAccessApprovalDocument(documentId: string) {
  if (!isApprovalDocumentPatternMatch(documentId)) {
    return false;
  }

  if (process.env.NODE_ENV === "test") {
    return knownDocumentIds.has(documentId);
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gw_session")?.value ?? null;
  if (!sessionToken) {
    return false;
  }

  const response = await apiApp.request(appRoutes.approvals.detail(documentId), {
    headers: {
      cookie: `gw_session=${encodeURIComponent(sessionToken)}`,
    },
  });

  return response.ok;
}

const detailSections = [
  "문서 번호·상태·요약을 상세 응답 기준으로 먼저 확인",
  "승인선 단계별 상태와 승인/반려 사유를 같은 화면에서 확인",
  "참조·합의 대상과 의견/댓글 흐름을 따로 구분해서 노출",
  "상태 이력은 제출 → 단계 요청 → 의견 → 최종 승인/반려 순서로 읽기",
] as const;

const happyPathChecklist = [
  "허용된 documentId 인지 확인한 뒤 상세를 엽니다.",
  "상세 화면에서 승인선·참조/합의·의견·이력을 순서대로 확인합니다.",
  "승인이 필요한 세션이면 승인/반려 버튼으로 결과와 guardrail 응답을 함께 확인합니다.",
  "기안자/참조자 세션에서는 의견 등록이 되는지와 차단 문구를 같이 확인합니다.",
] as const;

const blockedChecklist = [
  "허용된 목록이나 승인함에서 나온 documentId 인지 먼저 확인합니다.",
  "확인 전에는 승인/반려/의견 CTA 를 노출하지 않습니다.",
  "허용된 /approvals 또는 상세 route 로 다시 이동합니다.",
] as const;

const blockedNotes = [
  "unknown·forged·다른 흐름에서 주운 documentId 는 성공형 상세처럼 보이지 않게 차단 안내만 먼저 보여 줍니다.",
  "상세 액션 CTA 는 API guard 와 같은 의미로 UI 에서도 미리 숨깁니다.",
  "허용 여부가 확인되지 않으면 승인선, 의견, 이력 같은 실사용 패널을 열지 않습니다.",
] as const;

export default async function ApprovalDocumentDetailPage({ params }: PageProps) {
  const { documentId } = await params;
  const isSupportedRoute = await canAccessApprovalDocument(documentId);

  if (!isSupportedRoute) {
    return (
      <PageShell
        backHref="/approvals"
        backLabel="전자결재로"
        eyebrow="Phase 52 전자결재 상세"
        title="접근할 수 없는 전자결재 문서"
        description="이 documentId 는 허용된 전자결재 흐름에서 확인되지 않았습니다. unknown·forged 접근은 승인/반려/의견 CTA 없이 차단 안내만 먼저 보여 줍니다."
        actions={<Pill tone="warning">{documentId}</Pill>}
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

        <SurfaceSection title="다시 확인할 route" description="허용된 전자결재 목록이나 상세 route 로 돌아가 흐름을 다시 시작합니다." muted>
          <div className="link-row">
            <a href="/approvals">전자결재 목록으로 돌아가기</a>
            <a href="/approvals/approval_document_demo">허용된 예시 문서 보기</a>
            <a href="/approvals/approval_document_team_pending">승인 대기 예시 보기</a>
            <a href="/dashboard">대시보드로 돌아가기</a>
          </div>
        </SurfaceSection>

        <Phase16PilotPanel
          description="전자결재 상세는 허용된 documentId 에서만 승인선·의견·이력을 열고, forged 접근은 차단 안내를 우선합니다."
          confirmItems={[
            "invalid approval document route 에서 승인/반려/의견 CTA 가 렌더링되지 않는다.",
            "API 403 guard 와 같은 의미의 차단 문구가 먼저 보인다.",
            "허용된 전자결재 route 로만 복귀하게 안내한다.",
          ]}
          blockedItems={[
            "성공형 상세 제목, 승인선, 의견 입력창, 승인/반려 버튼 노출",
          ]}
          nextRoutes={[
            { href: "/approvals", label: "/approvals", description: "전자결재 목록에서 허용된 문서 다시 선택" },
            { href: "/approvals/approval_document_demo", label: "/approvals/approval_document_demo", description: "정상 예시 상세 확인" },
            { href: "/approvals/approval_document_team_pending", label: "/approvals/approval_document_team_pending", description: "승인 대기 문서 상세 확인" },
          ]}
          approvalGates={[
            "production 저장/발송 연동",
            "실제 영속 댓글/이력 저장소 확장",
          ]}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      backHref="/approvals"
      backLabel="전자결재로"
      eyebrow="Phase 52 전자결재 상세"
      title="전자결재 상세"
      description="documentId 기준 상세 응답이 확인된 경우에만 승인선·참조/합의·의견·상태 이력을 이어서 확인하고, forged/unknown 접근은 먼저 차단 안내로 정리합니다."
      actions={<Pill>{documentId}</Pill>}
    >
      <SurfaceSection title="실사용 상세 패널" description="상세 응답, 의견 등록, 승인/반려, 상태 이력을 한 자리에서 바로 확인합니다.">
        <ApprovalDocumentDetailLiveSection documentId={documentId} />
      </SurfaceSection>

      <SurfaceSection title="상세에서 바로 볼 정보" description="모바일에서 문서 상태와 승인선을 먼저 보게 합니다.">
        <ul className="summary-list">
          {detailSections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="전자결재 상세 happy path" description="대장이 live URL 에서 바로 눌러볼 기본 흐름입니다.">
        <ol className="number-list">
          {happyPathChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <div className="mobile-summary-grid">
        <SurfaceSection title="목록으로 돌아가기" description="내 문서함에서 다른 상세 route 를 다시 고를 수 있습니다.">
          <a href="/approvals">/approvals</a>
        </SurfaceSection>
        <SurfaceSection title="승인 대기 예시" description="승인함 첫 문서 상세로 바로 이동해 승인/반려 흐름을 이어 봅니다." muted>
          <a href="/approvals/approval_document_team_pending">/approvals/approval_document_team_pending</a>
        </SurfaceSection>
      </div>

      <Phase16PilotPanel
        description="전자결재 상세는 documentId 기준 상세/의견/이력/승인 액션 흐름을 설명하는 자리이며 forged 접근 차단이 핵심입니다."
        confirmItems={[
          "documentId 기반 상세 조회와 승인선/참조/의견/이력 구조가 유지된다.",
          "의견 등록과 승인/반려 액션이 상세 화면에서 이어진다.",
          "접근 불가 documentId 는 API 403 으로 막는다는 점이 UI 문구와 맞는다.",
        ]}
        blockedItems={[
          "실제 외부 알림, 실운영 발송, 영구 보관 스토리지 확장은 이번 상세 범위에 포함되지 않는다.",
        ]}
        nextRoutes={[
          { href: "/approvals", label: "/approvals", description: "목록으로 돌아가 다른 문서 흐름 비교" },
          { href: "/approvals/approval_document_demo", label: "/approvals/approval_document_demo", description: "기안자 시점 예시 상세 확인" },
          { href: "/approvals/approval_document_team_pending", label: "/approvals/approval_document_team_pending", description: "승인 대기 예시 상세 확인" },
        ]}
        approvalGates={[
          "production 저장/발송 연동",
          "실제 영속 댓글/이력 저장소 확장",
        ]}
      />
    </PageShell>
  );
}
