import { describe, expect, it, vi } from "vitest";
import { createHotelFileService } from "../src/files/r2";
import { createInspectionService } from "../src/inspections/service";

const principal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  displayName: "김검토",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  sessionToken: "opaque-reviewer-session-token",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF" as const,
};
const hotelId = "50000000-0000-4000-8000-000000000001";
const inspectionId = "91000000-0000-4000-8000-000000000001";

function canonicalReview() {
  return {
    inspection: {
      id: inspectionId,
      hotelId,
      source: "ROUTINE",
      businessDate: "2026-08-03",
      dueAt: "2026-08-03T14:59:59.999Z",
      status: "IN_REVIEW",
      version: 3,
      process: {
        executionId: "92000000-0000-4000-8000-000000000001",
        definitionId: "93000000-0000-4000-8000-000000000001",
        revisionId: "94000000-0000-4000-8000-000000000001",
        currentStageKey: "FACILITY_REVIEW",
        currentStageName: "시설팀 검토",
        state: "IN_REVIEW",
        version: 3,
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
          defaultSeverity: "MAJOR",
          result: {
            result: "ABNORMAL",
            description: "세면대 하부 누수",
            severity: "MAJOR",
            fileVersionIds: [],
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
      version: 3,
      currentStage: { key: "FACILITY_REVIEW", name: "시설팀 검토" },
      reviewer: {
        id: "22000000-0000-4000-8000-000000000001",
        displayName: "박시설",
      },
      delegate: null,
      dueAt: null,
      overdue: false,
      actions: [],
      history: [
        {
          id: "97000000-0000-4000-8000-000000000001",
          previousState: "PENDING_INPUT",
          nextState: "IN_REVIEW",
          previousStageName: null,
          nextStageName: "하우스키핑 검토",
          event: "SUBMIT",
          reason: "현장점검 완료",
          actor: {
            id: "21000000-0000-4000-8000-000000000001",
            displayName: "이수행",
          },
          occurredAt: "2026-08-03T00:30:00.000Z",
        },
      ],
    },
    evidence: [],
  };
}

function repository(reviewPayload: unknown, commandPayload: unknown = { id: inspectionId }) {
  return {
    close: vi.fn(),
    command: vi.fn().mockResolvedValue({
      status: "UPDATED",
      payload: commandPayload,
    }),
    readInspection: vi
      .fn()
      .mockResolvedValue({ status: "FORBIDDEN", payload: null }),
    readInspectionReview: vi
      .fn()
      .mockResolvedValue({ status: "OK", payload: reviewPayload }),
  };
}

describe("inspection review service", () => {
  it("lists only the DB-authorized assigned review queue", async () => {
    const repo = repository({
      reviews: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    const service = createInspectionService(repo);

    const result = await service.listReviews(principal, hotelId, {
      page: 1,
      pageSize: 20,
    });

    expect(repo.readInspectionReview).toHaveBeenCalledWith({
      companyId: principal.companyId,
      hotelId,
      inspectionId: null,
      query: { page: 1, pageSize: 20 },
      sessionId: principal.sessionId,
      sessionToken: principal.sessionToken,
    });
    expect(result).toEqual({
      reviews: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });

  it("returns the actor-bound canonical transition receipt without a live read", async () => {
    const canonical = canonicalReview();
    const repo = repository({ review: canonical }, canonical);
    const service = createInspectionService(repo);

    const result = await service.transition(
      principal,
      hotelId,
      inspectionId,
      {
        version: 2,
        event: "APPROVE",
        choiceValue: null,
        reason: "현장 사진과 설명을 확인했습니다.",
      },
      "inspection-review-transition-1",
    );

    expect(repo.command).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TRANSITION",
        expectedVersion: 2,
        sessionToken: principal.sessionToken,
      }),
    );
    expect(repo.readInspection).not.toHaveBeenCalled();
    expect(repo.readInspectionReview).not.toHaveBeenCalled();
    expect(result).toEqual(canonical);
  });

  it("keeps the canonical request hash stable across session renewal", async () => {
    const canonical = canonicalReview();
    const repo = repository({ review: canonical }, canonical);
    const service = createInspectionService(repo);
    const value = {
      version: 2,
      event: "APPROVE" as const,
      choiceValue: null,
      reason: "현장 사진과 설명을 확인했습니다.",
    };

    await service.transition(
      principal,
      hotelId,
      inspectionId,
      value,
      "inspection-review-session-replay",
    );
    await service.transition(
      {
        ...principal,
        sessionId: "40000000-0000-4000-8000-000000000002",
        sessionToken: "renewed-opaque-reviewer-session-token",
      },
      hotelId,
      inspectionId,
      value,
      "inspection-review-session-replay",
    );

    const first = repo.command.mock.calls[0]![0];
    const second = repo.command.mock.calls[1]![0];
    expect(second.requestHash).toBe(first.requestHash);
    expect(second.sessionId).not.toBe(first.sessionId);
  });
});

describe("inspection review evidence stream", () => {
  function setupStream(pending = false, terminalFailures = 0) {
    const terminalActions: string[] = [];
    let remainingTerminalFailures = terminalFailures;
    const close = vi.fn().mockResolvedValue(undefined);
    const fileViewCommand = vi.fn(
      async (input: { action: string; grantId: string }) => {
        if (input.action === "AUTHORIZE")
          return {
            status: "OK",
            payload: {
              cleanObjectKey: "clean/99000000-0000-4000-8000-000000000001",
              displayName: "욕실-누수.jpg",
              etag: '"0123456789abcdef0123456789abcdef"',
              grantId: input.grantId,
              mimeType: "image/jpeg",
              objectVersion: "object-version-1",
              sha256: "a".repeat(64),
              sizeBytes: 3,
            },
          };
        terminalActions.push(input.action);
        if (remainingTerminalFailures > 0) {
          remainingTerminalFailures -= 1;
          throw new Error("temporary terminal database failure");
        }
        return { status: "RECORDED", payload: null };
      },
    );
    const service = createHotelFileService(
      { close, fileViewCommand } as never,
      {
        openCleanVersion: vi.fn().mockResolvedValue({
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              if (pending) return;
              controller.enqueue(new Uint8Array([1, 2, 3]));
              controller.close();
            },
          }),
          etag: '"0123456789abcdef0123456789abcdef"',
          mimeType: "image/jpeg",
          objectVersion: "object-version-1",
          sizeBytes: 3,
        }),
      } as never,
    );
    return { close, service, terminalActions };
  }

  it("records SUCCEEDED only after the CLEAN body reaches EOF", async () => {
    const fixture = setupStream();
    const view = await fixture.service.view(
      principal,
      hotelId,
      inspectionId,
      "99000000-0000-4000-8000-000000000001",
    );
    expect(fixture.terminalActions).toEqual([]);
    expect(new Uint8Array(await new Response(view.body).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(fixture.terminalActions).toEqual(["SUCCEEDED"]);
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("records ABORTED when the browser cancels before EOF", async () => {
    const fixture = setupStream(true);
    const view = await fixture.service.view(
      principal,
      hotelId,
      inspectionId,
      "99000000-0000-4000-8000-000000000001",
    );
    await view.body.cancel("navigation");
    expect(fixture.terminalActions).toEqual(["ABORTED"]);
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("retries the same terminal proof before closing the repository", async () => {
    const fixture = setupStream(false, 2);
    const view = await fixture.service.view(
      principal,
      hotelId,
      inspectionId,
      "99000000-0000-4000-8000-000000000001",
    );
    expect(new Uint8Array(await new Response(view.body).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(fixture.terminalActions).toEqual([
      "SUCCEEDED",
      "SUCCEEDED",
      "SUCCEEDED",
    ]);
    expect(fixture.close).toHaveBeenCalledOnce();
  });
});
