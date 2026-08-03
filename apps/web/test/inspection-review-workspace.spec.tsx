import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  InspectionReviewWorkspace,
  reviewMatchesSummary,
} from "../components/inspections/inspection-review-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const inspectionId = "91000000-0000-4000-8000-000000000001";

const review = {
  inspection: {
    id: inspectionId,
    hotelId,
    source: "ROUTINE" as const,
    businessDate: "2026-08-03",
    dueAt: "2026-08-03T14:59:59.999Z",
    status: "IN_REVIEW" as const,
    version: 3,
    process: {
      executionId: "92000000-0000-4000-8000-000000000001",
      definitionId: "93000000-0000-4000-8000-000000000001",
      revisionId: "94000000-0000-4000-8000-000000000001",
      currentStageKey: "HOUSEKEEPING_REVIEW",
      currentStageName: "하우스키핑 검토",
      state: "IN_REVIEW" as const,
      version: 2,
    },
    rooms: [
      {
        id: "52000000-0000-4000-8000-000000000001",
        roomNumber: "703",
        floorLabel: "7층",
        roomTypeName: "스탠다드 더블",
      },
    ],
    items: [
      {
        id: "95000000-0000-4000-8000-000000000001",
        roomId: "52000000-0000-4000-8000-000000000001",
        itemId: "96000000-0000-4000-8000-000000000001",
        name: "욕실 배관",
        description: "누수와 배수를 확인합니다.",
        isRequired: true,
        displayOrder: 10,
        defaultSeverity: "MAJOR" as const,
        result: {
          result: "ABNORMAL" as const,
          description: "세면대 하부 누수가 확인되었습니다.",
          severity: "MAJOR" as const,
          fileVersionIds: ["99000000-0000-4000-8000-000000000001"],
          version: 1,
        },
      },
    ],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T01:00:00.000Z",
  },
  provenance: {
    submittedBy: {
      id: "21000000-0000-4000-8000-000000000001",
      displayName: "이수행",
    },
    submittedAt: "2026-08-03T00:30:00.000Z",
    lastResultChangedBy: {
      id: "21000000-0000-4000-8000-000000000001",
      displayName: "이수행",
    },
    lastResultChangedAt: "2026-08-03T00:20:00.000Z",
  },
  review: {
    executionId: "92000000-0000-4000-8000-000000000001",
    version: 2,
    currentStage: { key: "HOUSEKEEPING_REVIEW", name: "하우스키핑 검토" },
    reviewer: {
      id: "20000000-0000-4000-8000-000000000001",
      displayName: "김검토",
    },
    delegate: null,
    dueAt: "2026-08-03T02:00:00.000Z",
    overdue: true,
    actions: [
      {
        event: "APPROVE" as const,
        choiceValue: null,
        label: "시설팀 검토로 보내기",
        toStageKey: "FACILITY_REVIEW",
        toStageName: "시설팀 검토",
        completesProcess: false,
      },
      {
        event: "REJECT" as const,
        choiceValue: null,
        label: "반려 · 하우스키핑 재검토",
        toStageKey: "HOUSEKEEPING_RECHECK",
        toStageName: "하우스키핑 재검토",
        completesProcess: false,
      },
    ],
    history: [
      {
        id: "97000000-0000-4000-8000-000000000001",
        previousState: "PENDING_INPUT",
        nextState: "IN_REVIEW",
        previousStageName: null,
        nextStageName: "하우스키핑 검토",
        event: "SUBMIT" as const,
        reason: "현장점검 완료",
        actor: {
          id: "21000000-0000-4000-8000-000000000001",
          displayName: "이수행",
        },
        occurredAt: "2026-08-03T00:30:00.000Z",
      },
    ],
  },
  evidence: [
    {
      id: "99000000-0000-4000-8000-000000000001",
      itemSnapshotId: "95000000-0000-4000-8000-000000000001",
      displayName: "욕실-누수.jpg",
      mimeType: "image/jpeg" as const,
      sizeBytes: 245760,
    },
  ],
};

const summary = {
  id: inspectionId,
  hotelId,
  source: "ROUTINE" as const,
  businessDate: "2026-08-03",
  dueAt: "2026-08-03T14:59:59.999Z",
  targetSummary: "703호",
  itemCount: 1,
  abnormalCount: 1,
  cautionCount: 0,
  process: {
    executionId: review.review.executionId,
    version: 2,
    currentStageName: "하우스키핑 검토",
    reviewer: review.review.reviewer,
    delegate: null,
    dueAt: review.review.dueAt,
    overdue: true,
  },
};

describe("inspection review workspace", () => {
  it("renders assigned review list, read-only evidence and process actions", () => {
    const html = renderToStaticMarkup(
      <InspectionReviewWorkspace
        hotelId={hotelId}
        initialPagination={{
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        }}
        initialReviews={[summary]}
        initialSelectedReview={review}
      />,
    );
    expect(html).toContain("검토 대기");
    expect(html).not.toContain("<main");
    expect(html).toContain("703호");
    expect(html).toContain("하우스키핑 검토");
    expect(html).toContain("김검토");
    expect(html).toContain("지연");
    expect(html).toContain("욕실 배관");
    expect(html).toContain("세면대 하부 누수");
    expect(html).toContain("욕실-누수.jpg");
    expect(html).toContain("사진 보기");
    expect(html).toContain("시설팀 검토로 보내기");
    expect(html).toContain("반려");
    expect(html).toContain("처리 사유");
    expect(html).toContain('minLength="2"');
    expect(html).toContain('maxLength="500"');
    expect(html).toContain(
      'aria-describedby="review-reason-guidance review-reason-error"',
    );
    expect(html).toContain("점검 제출");
    expect(html).toContain("점검 검토 도움말");
    expect(html).not.toContain("결과 저장");
  });

  it("compares every canonical summary material field", () => {
    expect(reviewMatchesSummary(review, summary)).toBe(true);
    const staleSummaries = [
      { ...summary, hotelId: "50000000-0000-4000-8000-000000000002" },
      { ...summary, source: "MANUAL" as const },
      { ...summary, businessDate: "2026-08-04" },
      { ...summary, dueAt: "2026-08-04T14:59:59.999Z" },
      { ...summary, targetSummary: "704호" },
      { ...summary, itemCount: summary.itemCount + 1 },
      { ...summary, abnormalCount: summary.abnormalCount + 1 },
      { ...summary, cautionCount: summary.cautionCount + 1 },
      {
        ...summary,
        process: {
          ...summary.process,
          reviewer: { ...summary.process.reviewer, displayName: "오래된 담당자명" },
        },
      },
    ];
    for (const stale of staleSummaries)
      expect(reviewMatchesSummary(review, stale)).toBe(false);

    const delegateId = "20000000-0000-4000-8000-000000000002";
    const reviewWithDelegate = {
      ...review,
      review: {
        ...review.review,
        delegate: { id: delegateId, displayName: "현재 대리인명" },
      },
    };
    const staleDelegateSummary = {
      ...summary,
      process: {
        ...summary.process,
        delegate: { id: delegateId, displayName: "오래된 대리인명" },
      },
    };
    expect(reviewMatchesSummary(reviewWithDelegate, staleDelegateSummary)).toBe(false);
  });
});
