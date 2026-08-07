import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  inspectionExecutionV2ResponseSchema,
  repairCaseResponseSchema,
  repairListResponseSchema,
  repairPriorityListResponseSchema,
} from "@werehere/contracts";
import {
  createPostgresInspectionRepository,
  createPostgresRepairRepository,
} from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createInspectionService } from "../src/inspections/service";
import { createRepairService } from "../src/repairs/service";

function literalFixture(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\s+(?:constant\\s+)?uuid\\s*:=\\s*'([^']+)'`));
  if (!match?.[1]) throw new Error(`missing UUID fixture ${name}`);
  return match[1];
}
function repeatedFixture(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\s+text\\s*:=\\s*repeat\\('([^']+)',\\s*(\\d+)\\)`));
  if (!match?.[1] || !match[2]) throw new Error(`missing token fixture ${name}`);
  return match[1].repeat(Number(match[2]));
}
async function jsonRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = { cookie: `__Host-hotel_session=${token}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return app.request(path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers,
    method,
  });
}
async function expectStatus(response: Response, status: number, label: string) {
  if (response.status === status) return;
  const value = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } | null } | null;
  throw new Error(`${label}: expected ${status}, received ${response.status} ${value?.error?.code ?? "UNKNOWN"} ${value?.error?.message ?? ""}`);
}

async function main() {
  const databaseUrl = process.env.TEST_READY_URL;
  const fixturePath = process.env.INSPECTION_FACILITY_SQL;
  if (!databaseUrl || !fixturePath) throw new Error("repair actual API environment is incomplete");
  const source = await readFile(fixturePath, "utf8");
  const companyId = literalFixture(source, "v_company");
  const hotelId = literalFixture(source, "v_hotel");
  const roomId = literalFixture(source, "v_room");
  const sessionId = literalFixture(source, "v_session");
  const token = repeatedFixture(source, "v_token");
  const userId = "2f000000-0000-4000-8000-000000000001";
  const priorityId = "ab000000-0000-4000-8000-000000000004";
  const repairId = "ac000000-0000-4000-8000-000000000001";
  const principal = {
    companyId,
    displayName: "Repair API integration actor",
    identityId: "3f000000-0000-4000-8000-000000000001",
    sessionId,
    userId,
    userType: "INTERNAL_STAFF" as const,
  };
  const authService = { resolvePrincipal: async () => principal } as unknown as AuthService;
  const repository = createPostgresRepairRepository(databaseUrl);
  const service = createRepairService(repository);
  const inspectionService = createInspectionService(
    createPostgresInspectionRepository(databaseUrl),
  );
  const app = createApp({ authService, inspectionService, repairService: service });
  try {
    const prioritiesResponse = await jsonRequest(app, `/api/hotels/${hotelId}/repair-priorities`, token);
    await expectStatus(prioritiesResponse, 200, "priority read");
    const priorities = repairPriorityListResponseSchema.parse(await prioritiesResponse.json()).data.priorities;
    if (priorities.length !== 1 || priorities[0]?.id !== priorityId)
      throw new Error("priority read-back mismatch");

    const inspectionSource = JSON.parse(
      await readFile(
        `/tmp/werehere-repair-inspection-${createHash("sha256").update(fixturePath).digest("hex").slice(0, 16)}.json`,
        "utf8",
      ),
    ) as {
      executionTargetId: string;
      facilityId: string;
      inspectionId: string;
      itemSnapshotId: string;
      resultVersion: number;
    };
    const inspectionDetailResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/inspections/v2/${inspectionSource.inspectionId}`,
      token,
    );
    await expectStatus(inspectionDetailResponse, 200, "inspection source detail");
    const inspectionDetail = inspectionExecutionV2ResponseSchema.parse(
      await inspectionDetailResponse.json(),
    ).data.inspection;
    const inspectionResult = inspectionDetail.items.find(
      (item) => item.id === inspectionSource.itemSnapshotId,
    )?.result;
    if (!inspectionResult?.id)
      throw new Error("inspection source result identity is missing after repair migration");
    const inspectionRepairId = "ac000000-0000-4000-8000-000000000002";
    const inspectionRepairResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repairs`,
      token,
      "POST",
      {
        followUpOfRepairCaseId: null,
        followUpParentVersion: null,
        priorityId,
        repairCaseId: inspectionRepairId,
        source: {
          executionTargetId: inspectionSource.executionTargetId,
          inspectionId: inspectionSource.inspectionId,
          itemSnapshotId: inspectionSource.itemSnapshotId,
          resultId: inspectionResult.id,
          resultVersion: inspectionSource.resultVersion,
          type: "INSPECTION",
        },
        target: { facilityId: inspectionSource.facilityId, type: "FACILITY" },
      },
      "repair-actual-inspection-create-1",
    );
    await expectStatus(inspectionRepairResponse, 201, "inspection repair create");
    const inspectionRepair = repairCaseResponseSchema.parse(
      await inspectionRepairResponse.json(),
    ).data.repair;
    if (
      inspectionRepair.id !== inspectionRepairId ||
      inspectionRepair.source.type !== "INSPECTION" ||
      inspectionRepair.source.resultId !== inspectionResult.id ||
      inspectionRepair.target.id !== inspectionSource.facilityId
    )
      throw new Error("inspection repair source snapshot mismatch");

    const createBody = {
      followUpOfRepairCaseId: null,
      followUpParentVersion: null,
      priorityId,
      repairCaseId: repairId,
      source: {
        description: "욕실 천장 누수 실제 통합검증",
        fileVersionIds: ["ad000000-0000-4000-8000-000000000002"],
        type: "DIRECT",
        unavailableReason: null,
      },
      target: { roomId, type: "ROOM" },
    };
    const createPath = `/api/hotels/${hotelId}/repairs`;
    const createdResponse = await jsonRequest(app, createPath, token, "POST", createBody, "repair-actual-create-1");
    await expectStatus(createdResponse, 201, "repair create");
    const created = repairCaseResponseSchema.parse(await createdResponse.json()).data.repair;
    if (created.id !== repairId || created.target.id !== roomId || created.process.state !== "PENDING_INPUT")
      throw new Error("repair create snapshot mismatch");
    const replayResponse = await jsonRequest(app, createPath, token, "POST", createBody, "repair-actual-create-1");
    await expectStatus(replayResponse, 201, "repair replay");
    const replay = repairCaseResponseSchema.parse(await replayResponse.json()).data.repair;
    if (replay.id !== repairId) throw new Error("repair committed replay mismatch");

    const invalidPerformerResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repair-visits`,
      token,
      "POST",
      {
        endsAt: "2026-08-09T02:00:00.000Z",
        performer: { type: "INTERNAL", userId: "ac000000-0000-4000-8000-000000000099" },
        repairCaseId: repairId,
        startsAt: "2026-08-09T01:00:00.000Z",
        title: "권한 없는 수행자 차단",
      },
      "repair-actual-invalid-performer-1",
    );
    await expectStatus(invalidPerformerResponse, 422, "invalid performer denial");

    const visitResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repair-visits`,
      token,
      "POST",
      {
        endsAt: "2026-08-09T04:00:00.000Z",
        performer: { type: "INTERNAL", userId },
        repairCaseId: repairId,
        startsAt: "2026-08-09T03:00:00.000Z",
        title: "욕실 누수 현장 방문",
      },
      "repair-actual-visit-1",
    );
    await expectStatus(visitResponse, 201, "visit create");
    const detailAfterVisitResponse = await jsonRequest(app, `/api/hotels/${hotelId}/repairs/${repairId}`, token);
    await expectStatus(detailAfterVisitResponse, 200, "repair detail after visit");
    const detailAfterVisit = repairCaseResponseSchema.parse(await detailAfterVisitResponse.json()).data.repair;
    const visit = detailAfterVisit.visits[0];
    if (!visit || visit.performer.type !== "INTERNAL" || visit.performer.userId !== userId)
      throw new Error("visit canonical performer mismatch");

    const completeVisitResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repair-visits/${visit.id}/complete`,
      token,
      "POST",
      {
        fileVersionIds: [],
        result: "누수 연결부를 교체하고 재점검했습니다.",
        unavailableReason: "통합검증 환경에는 촬영 장비가 없습니다.",
        version: visit.version,
      },
      "repair-actual-visit-complete-1",
    );
    await expectStatus(completeVisitResponse, 200, "visit complete");

    const beforeReviewResponse = await jsonRequest(app, `/api/hotels/${hotelId}/repairs/${repairId}`, token);
    const beforeReview = repairCaseResponseSchema.parse(await beforeReviewResponse.json()).data.repair;
    const submitResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repairs/${repairId}/submit-review`,
      token,
      "POST",
      { processVersion: beforeReview.process.version, version: beforeReview.version },
      "repair-actual-submit-1",
    );
    await expectStatus(submitResponse, 200, "repair submit review");
    const submitted = repairCaseResponseSchema.parse(await submitResponse.json()).data.repair;
    if (submitted.process.state !== "IN_REVIEW") throw new Error("repair submit state mismatch");

    const approveResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repairs/${repairId}/process/transition`,
      token,
      "POST",
      { choiceValue: null, event: "APPROVE", processVersion: submitted.process.version, reason: "보수 결과 실제 통합 승인" },
      "repair-actual-approve-1",
    );
    await expectStatus(approveResponse, 200, "repair approve");
    const approved = repairCaseResponseSchema.parse(await approveResponse.json()).data.repair;
    if (approved.process.state !== "COMPLETED") throw new Error("repair approval state mismatch");

    const completeResponse = await jsonRequest(
      app,
      `/api/hotels/${hotelId}/repairs/${repairId}/complete`,
      token,
      "POST",
      { processVersion: approved.process.version, version: approved.version },
      "repair-actual-complete-1",
    );
    await expectStatus(completeResponse, 200, "repair final completion");
    const completed = repairCaseResponseSchema.parse(await completeResponse.json()).data.repair;
    if (completed.status !== "COMPLETED") throw new Error("repair final state mismatch");

    const listResponse = await jsonRequest(app, `/api/hotels/${hotelId}/repairs?page=1&pageSize=100&status=COMPLETED`, token);
    await expectStatus(listResponse, 200, "completed repair list");
    const list = repairListResponseSchema.parse(await listResponse.json()).data;
    if (!list.repairs.some((repair) => repair.id === repairId)) throw new Error("completed repair list read-back mismatch");

    console.log("HOTEL_REPAIR_LIFECYCLE_ACTUAL_API_OK");
  } finally {
    await service.close?.();
  }
}

await main();
