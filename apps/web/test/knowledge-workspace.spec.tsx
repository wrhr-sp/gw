import type { KnowledgeEntry } from "@werehere/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  KnowledgeWorkspace,
  knowledgeCreateScopes,
} from "../components/knowledge/knowledge-workspace";
import { knowledgeReadOnlyHotelId } from "../playwright/stories/knowledge-workspace.fixture";

const hotelId = "55555555-5555-4555-8555-555555555555";
const entry: KnowledgeEntry & { hotelName: string | null } = {
  id: "66666666-6666-4666-8666-666666666666",
  scopeType: "HOTEL" as const,
  hotelId,
  hotelName: "서울호텔",
  title: "에어컨 냉방 저하 확인 순서",
  summary: "전문업체 호출 전에 확인할 항목입니다.",
  knowledgeType: "FACILITY_MAINTENANCE" as const,
  riskClassification: "STANDARD" as const,
  situation: "객실 냉방이 약한 상황",
  symptomsAndContext: "송풍은 되지만 온도가 내려가지 않습니다.",
  checks: ["운전 모드를 확인합니다."],
  recommendedResponse: ["전원을 끄고 필터 상태를 확인합니다."],
  prohibitedOrCautionResponse: ["전기 덮개를 임의로 열지 않습니다."],
  escalationCriteria: "과열이면 즉시 관리자에게 보고합니다.",
  requiredPermissionOrApproval: "판매중지는 관리자 승인이 필요합니다.",
  caseSummary: "필터 막힘 사례",
  outcomeAndLesson: "정기 점검이 필요합니다.",
  tags: ["에어컨"],
  relatedManualRefs: ["시설 안전 매뉴얼"],
  relatedIssueIds: [],
  relatedRepairIds: [],
  designatedReviewerUserId: null,
  status: "PUBLISHED" as const,
  author: { displayName: "관리자" },
  reviewer: { displayName: "검토자" },
  designatedReviewer: null,
  reviewRequestedVersion: null,
  publishedAt: "2026-08-21T00:00:00.000Z",
  reviewedAt: "2026-08-21T00:00:00.000Z",
  reviewDueAt: "2027-02-21T00:00:00.000Z",
  version: 2,
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
  isStale: false,
  helpfulCount: 4,
  notHelpfulCount: 1,
  history: [],
  links: [],
  attachments: [
    {
      fileVersionId: "88888888-8888-4888-8888-888888888888",
      displayName: "필터 상태.png",
      mimeType: "image/png" as const,
      sizeBytes: 1024,
      viewHref:
        "/api/knowledge/66666666-6666-4666-8666-666666666666/files/88888888-8888-4888-8888-888888888888/view",
    },
  ],
  actions: {
    canEdit: false,
    canRequestReview: false,
    canPublish: false,
    canMarkNeedsReview: true,
    canArchive: true,
    canAttach: false,
  },
};
const scopePermissions = {
  canRead: true,
  canCreate: true,
  canReview: true,
  canPublish: true,
  canHighRiskPublish: true,
  canArchive: true,
};
const capabilities = {
  canRead: true,
  canCreate: true,
  canReview: true,
  canPublish: true,
  canArchive: true,
  company: scopePermissions,
  hotels: [{ hotelId, hotelName: "서울호텔", permissions: scopePermissions }],
};

function render(capability = capabilities, selectedEntry = entry) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <KnowledgeWorkspace
        capabilities={capability}
        initialEntries={[selectedEntry]}
        initialReviewerCandidates={[]}
        initialSelected={selectedEntry}
        initialTotalCount={1}
      />
    </QueryClientProvider>,
  );
}

describe("knowledge workspace", () => {
  it("keeps knowledge proxy paths and methods exact and fail closed", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/[...path]/route.ts"),
      "utf8",
    );
    expect(source).toContain('["knowledge", new Set(["GET", "POST"])]');
    expect(source).toContain('["knowledge/capabilities", new Set(["GET"])]');
    expect(source).toContain(
      '["knowledge/reviewer-candidates", new Set(["GET"])]',
    );
    expect(source).toContain("^knowledge/${UUID_PATH_PATTERN}$");
    expect(source).toContain("(?:transitions|feedback)$");
    expect(source).toContain("/links$");
    expect(source).toContain("/files/upload-init$");
    expect(source).toContain("/attachments$");
    expect(source).not.toContain("knowledge/.*");
  });
  it("renders PC search/detail and mobile action-first safety order", () => {
    const html = render();
    expect(html).toContain("운영 지식뱅크");
    expect(html).toContain("증상·상황 검색");
    expect(html).toContain("먼저 확인할 사항");
    expect(html).toContain("가능한 대응");
    expect(html).toContain("하지 말아야 할 대응");
    expect(html).toContain("에스컬레이션");
    expect(html.indexOf("먼저 확인할 사항")).toBeLessThan(
      html.indexOf("가능한 대응"),
    );
    expect(html.indexOf("가능한 대응")).toBeLessThan(
      html.indexOf("하지 말아야 할 대응"),
    );
    expect(html).toContain("지식 작성");
    expect(html).toContain("게시됨");
    expect(html).toContain("private 현장 사진 1개");
    expect(html).toContain("필터 상태.png");
    expect(html).toContain(
      `/api/knowledge/${entry.id}/files/88888888-8888-4888-8888-888888888888/view`,
    );
  });

  it("hides lifecycle mutations without dynamic capability", () => {
    const deniedScopePermissions = {
      ...scopePermissions,
      canCreate: false,
    };
    const html = render(
      {
        ...capabilities,
        canCreate: false,
        canReview: false,
        canPublish: false,
        canArchive: false,
        company: deniedScopePermissions,
        hotels: [
          {
            hotelId,
            hotelName: "서울호텔",
            permissions: deniedScopePermissions,
          },
        ],
      },
      {
        ...entry,
        actions: {
          canEdit: false,
          canRequestReview: false,
          canPublish: false,
          canMarkNeedsReview: false,
          canArchive: false,
          canAttach: false,
        },
      },
    );
    expect(html).not.toContain("지식 작성");
    expect(html).not.toContain("검토 요청");
    expect(html).not.toContain("게시하기");
    expect(html).not.toContain("보관하기");
  });

  it("binds create scope and logical retries to resource-scoped durable receipts", () => {
    const source = readFileSync(
      join(process.cwd(), "components/knowledge/knowledge-workspace.tsx"),
      "utf8",
    );
    expect(source).toContain("capabilities.company.canCreate");
    expect(source).toContain("hotel.permissions.canCreate");
    expect(source).toContain("werehere:knowledge-mutation:");
    expect(source).toContain("ATTACHMENT_LINK:${selected.id}:${signature}");
    expect(source).toContain("linkOperation.idempotencyKey");
    const denied = { ...scopePermissions, canCreate: false };
    const scoped = knowledgeCreateScopes({
      ...capabilities,
      company: denied,
      hotels: [
        capabilities.hotels[0]!,
        {
          hotelId: knowledgeReadOnlyHotelId,
          hotelName: "조회 전용 호텔",
          permissions: denied,
        },
      ],
    });
    expect(scoped.canCreateCompany).toBe(false);
    expect(scoped.canCreateAny).toBe(true);
    expect(scoped.hotels.map((hotel) => hotel.hotelName)).toEqual(["서울호텔"]);
  });

  it("marks stale knowledge and never presents it as current guidance", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <KnowledgeWorkspace
          capabilities={capabilities}
          initialEntries={[{ ...entry, status: "NEEDS_REVIEW", isStale: true }]}
          initialReviewerCandidates={[]}
          initialSelected={{ ...entry, status: "NEEDS_REVIEW", isStale: true }}
          initialTotalCount={1}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain("재검토 필요");
    expect(html).toContain("현재 권장정보로 사용하지 마세요");
  });

  it("shows the designated reviewer and frozen review version for high-risk knowledge", () => {
    const html = render(capabilities, {
      ...entry,
      designatedReviewerUserId: "99999999-9999-4999-8999-999999999999",
      designatedReviewer: { displayName: "안전 지정 검토자" },
      reviewRequestedVersion: 2,
      riskClassification: "SAFETY",
    });
    expect(html).toContain("지정 검토자: 안전 지정 검토자");
    expect(html).toContain("검토 version 2");
  });
});
