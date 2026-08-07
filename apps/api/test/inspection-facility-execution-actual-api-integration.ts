import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  inspectionChecklistV2ResponseSchema,
  inspectionExecutionV2ListResponseSchema,
  inspectionExecutionV2ResponseSchema,
} from "@werehere/contracts";
import { createPostgresInspectionRepository } from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createInspectionService } from "../src/inspections/service";


function literalFixture(source: string, name: string) {
  const match = source.match(
    new RegExp(`${name}\\s+(?:constant\\s+)?uuid\\s*:=\\s*'([^']+)'`),
  );
  if (!match?.[1]) throw new Error(`missing UUID fixture ${name}`);
  return match[1];
}

function repeatedFixture(source: string, name: string) {
  const match = source.match(
    new RegExp(`${name}\\s+text\\s*:=\\s*repeat\\('([^']+)',\\s*(\\d+)\\)`),
  );
  if (!match?.[1] || !match[2])
    throw new Error(`missing repeated fixture ${name}`);
  return match[1].repeat(Number(match[2]));
}

async function main() {
  const databaseUrl = process.env.TEST_READY_URL;
  const fixturePath = process.env.INSPECTION_FACILITY_SQL;
  if (!databaseUrl || !fixturePath)
    throw new Error("actual facility inspection API environment is incomplete");

  const source = await readFile(fixturePath, "utf8");
  const companyId = literalFixture(source, "v_company");
  const hotelId = literalFixture(source, "v_hotel");
  const sessionId = literalFixture(source, "v_session");
  const facilityId = literalFixture(source, "v_facility");
  const facilityTypeId = literalFixture(source, "v_facility_type");
  const roomId = literalFixture(source, "v_room");
  const token = repeatedFixture(source, "v_token");
  const principal = {
    companyId,
    displayName: "Facility API integration actor",
    identityId: "3f000000-0000-4000-8000-000000000001",
    sessionId,
    userId: "2f000000-0000-4000-8000-000000000001",
    userType: "INTERNAL_STAFF" as const,
  };
  const authService = {
    resolvePrincipal: async () => principal,
  } as unknown as AuthService;
  const service = createInspectionService(
    createPostgresInspectionRepository(databaseUrl),
  );
  const app = createApp({ authService, inspectionService: service });

  try {
    const checklistResponse = await app.request(
      `/api/hotels/${hotelId}/inspection-checklist/v2`,
      { headers: { cookie: `__Host-hotel_session=${token}` } },
    );
    if (checklistResponse.status !== 200)
      throw new Error(`facility checklist read failed: ${checklistResponse.status}`);
    const checklist = inspectionChecklistV2ResponseSchema.parse(
      await checklistResponse.json(),
    ).data.checklist;

    const sourceItem = checklist?.items.find(
      (item) =>
        item.targetType === "FACILITY" &&
        item.facilityTypeId === facilityTypeId,
    );
    if (!sourceItem)
      throw new Error("facility checklist had no selectable item");

    const path = `/api/hotels/${hotelId}/inspections/v2/manual`;
    const body = JSON.stringify({
      processDefinitionId: null,
      targets: [
        {
          type: "FACILITY",
          facilityId,
          selectedItemIds: [sourceItem.itemId],
        },
      ],
    });
    const headers = {
      "content-type": "application/json",
      cookie: `__Host-hotel_session=${token}`,
      "idempotency-key": "actual-api-facility-manual-1",
    };
    const response = await app.request(path, { method: "POST", headers, body });
    if (response.status !== 201) {
      const failure = (await response.json()) as {
        error?: { code?: string; message?: string } | null;
      };
      throw new Error(
        `facility inspection API create failed: ${response.status} ${failure.error?.code ?? "UNKNOWN"} ${failure.error?.message ?? ""}`,
      );
    }
    const created = inspectionExecutionV2ResponseSchema.parse(
      await response.json(),
    ).data.inspection;
    const target = created.targets[0];
    if (
      target?.type !== "FACILITY" ||
      target.facilityId !== facilityId ||
      created.items.length < 1 ||
      created.items.some(
        (item) =>
          item.targetType !== "FACILITY" ||
          item.executionTargetId !== target.id,
      )
    )
      throw new Error("facility inspection API snapshot read-back mismatch");

    const replayResponse = await app.request(path, {
      method: "POST",
      headers,
      body,
    });
    const replay = inspectionExecutionV2ResponseSchema.parse(
      await replayResponse.json(),
    ).data.inspection;
    if (replayResponse.status !== 201 || replay.id !== created.id)
      throw new Error("facility inspection API committed replay mismatch");

    const detailResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${created.id}`,
      { headers: { cookie: `__Host-hotel_session=${token}` } },
    );
    const detail = inspectionExecutionV2ResponseSchema.parse(
      await detailResponse.json(),
    ).data.inspection;
    if (detailResponse.status !== 200 || detail.id !== created.id)
      throw new Error("facility inspection API canonical detail mismatch");

    const listResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2?page=1&pageSize=1`,
      { headers: { cookie: `__Host-hotel_session=${token}` } },
    );
    const list = inspectionExecutionV2ListResponseSchema.parse(
      await listResponse.json(),
    ).data;
    if (
      listResponse.status !== 200 ||
      list.inspections.length !== 1 ||
      list.pagination.page !== 1 ||
      list.pagination.pageSize !== 1 ||
      list.pagination.total < 1 ||
      list.pagination.totalPages < 1
    )
      throw new Error("facility inspection API pagination mismatch");

    const itemSnapshotId = created.items[0]?.id;
    if (!itemSnapshotId)
      throw new Error("facility inspection API had no result item");
    const resultResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${created.id}/items/${itemSnapshotId}/result`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `__Host-hotel_session=${token}`,
          "idempotency-key": "actual-api-facility-result-1",
        },
        body: JSON.stringify({
          itemSnapshotId,
          version: 0,
          result: "NORMAL",
          description: null,
          severity: null,
          fileVersionIds: [],
          changeReason: null,
        }),
      },
    );
    if (resultResponse.status !== 200)
      throw new Error(`facility result API save failed: ${resultResponse.status}`);
    const resultSaved = inspectionExecutionV2ResponseSchema.parse(
      await resultResponse.json(),
    ).data.inspection;
    if (resultSaved.items[0]?.result?.result !== "NORMAL")
      throw new Error("facility result API canonical read-back mismatch");

    const submitResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${created.id}/submit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `__Host-hotel_session=${token}`,
          "idempotency-key": "actual-api-facility-submit-1",
        },
        body: JSON.stringify({
          version: resultSaved.version,
          reason: "시설물 현장점검 제출",
        }),
      },
    );
    if (submitResponse.status !== 200) {
      const failure = (await submitResponse.json()) as {
        error?: { code?: string; message?: string } | null;
      };
      throw new Error(
        `facility submit API failed: ${submitResponse.status} ${failure.error?.code ?? "UNKNOWN"} ${failure.error?.message ?? ""}`,
      );
    }
    const submitted = inspectionExecutionV2ResponseSchema.parse(
      await submitResponse.json(),
    ).data.inspection;
    if (submitted.status !== "IN_REVIEW")
      throw new Error("facility submit API canonical state mismatch");

    const repairSourceCreateResponse = await app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `__Host-hotel_session=${token}`,
        "idempotency-key": "actual-api-facility-repair-source-1",
      },
      body,
    });
    if (repairSourceCreateResponse.status !== 201)
      throw new Error(
        `repair-source inspection API create failed: ${repairSourceCreateResponse.status}`,
      );
    const repairSourceInspection = inspectionExecutionV2ResponseSchema.parse(
      await repairSourceCreateResponse.json(),
    ).data.inspection;
    const repairSourceTarget = repairSourceInspection.targets[0];
    const repairSourceItem = repairSourceInspection.items[0];
    if (!repairSourceTarget || !repairSourceItem)
      throw new Error("repair-source inspection snapshot is incomplete");
    const repairSourceResultResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${repairSourceInspection.id}/items/${repairSourceItem.id}/result`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `__Host-hotel_session=${token}`,
          "idempotency-key": "actual-api-facility-repair-result-1",
        },
        body: JSON.stringify({
          itemSnapshotId: repairSourceItem.id,
          version: 0,
          result: "ABNORMAL",
          description: "시설물 현장점검에서 실제 보수가 필요한 이상을 확인했습니다.",
          severity: "MAJOR",
          fileVersionIds: [],
          changeReason: null,
        }),
      },
    );
    if (repairSourceResultResponse.status !== 200)
      throw new Error(
        `repair-source result API save failed: ${repairSourceResultResponse.status}`,
      );
    const repairSourceSaved = inspectionExecutionV2ResponseSchema.parse(
      await repairSourceResultResponse.json(),
    ).data.inspection;
    const repairSourceResult = repairSourceSaved.items[0]?.result;
    if (repairSourceResult?.result !== "ABNORMAL")
      throw new Error("repair-source result read-back mismatch");
    const repairSourcePath = `/tmp/werehere-repair-inspection-${createHash("sha256").update(fixturePath).digest("hex").slice(0, 16)}.json`;
    await writeFile(
      repairSourcePath,
      JSON.stringify({
        executionTargetId: repairSourceTarget.id,
        facilityId,
        inspectionId: repairSourceInspection.id,
        itemSnapshotId: repairSourceItem.id,
        resultVersion: repairSourceResult.version,
      }),
      { mode: 0o600 },
    );

    const roomSourceItem = checklist?.items.find(
      (item) =>
        item.targetType === "ROOM" &&
        item.source === "HOTEL_COMMON" &&
        item.excludedRoomTypeIds.length === 0,
    );
    if (!roomSourceItem) throw new Error("ROOM checklist had no applicable item");
    const roomBody = JSON.stringify({
      processDefinitionId: null,
      targets: [
        {
          type: "ROOM",
          roomId,
          selectedItemIds: [roomSourceItem.itemId],
        },
      ],
    });
    const roomCreateResponse = await app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `__Host-hotel_session=${token}`,
        "idempotency-key": "actual-api-room-manual-1",
      },
      body: roomBody,
    });
    if (roomCreateResponse.status !== 201)
      throw new Error(`ROOM inspection API create failed: ${roomCreateResponse.status}`);
    const roomCreated = inspectionExecutionV2ResponseSchema.parse(
      await roomCreateResponse.json(),
    ).data.inspection;
    const roomTarget = roomCreated.targets[0];
    const roomItemId = roomCreated.items[0]?.id;
    if (
      roomTarget?.type !== "ROOM" ||
      roomTarget.roomId !== roomId ||
      !roomItemId ||
      roomCreated.items.some(
        (item) => item.targetType !== "ROOM" || item.executionTargetId !== roomTarget.id,
      )
    )
      throw new Error("ROOM inspection API snapshot read-back mismatch");
    const roomDetailResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${roomCreated.id}`,
      { headers: { cookie: `__Host-hotel_session=${token}` } },
    );
    const roomDetail = inspectionExecutionV2ResponseSchema.parse(
      await roomDetailResponse.json(),
    ).data.inspection;
    if (roomDetailResponse.status !== 200 || roomDetail.id !== roomCreated.id)
      throw new Error("ROOM inspection API canonical detail mismatch");
    const roomResultResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${roomCreated.id}/items/${roomItemId}/result`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `__Host-hotel_session=${token}`,
          "idempotency-key": "actual-api-room-result-1",
        },
        body: JSON.stringify({
          itemSnapshotId: roomItemId,
          version: 0,
          result: "NORMAL",
          description: null,
          severity: null,
          fileVersionIds: [],
          changeReason: null,
        }),
      },
    );
    if (roomResultResponse.status !== 200)
      throw new Error(`ROOM result API save failed: ${roomResultResponse.status}`);
    const roomSaved = inspectionExecutionV2ResponseSchema.parse(
      await roomResultResponse.json(),
    ).data.inspection;
    if (roomSaved.items[0]?.result?.result !== "NORMAL")
      throw new Error("ROOM result API canonical read-back mismatch");
    const roomSubmitResponse = await app.request(
      `/api/hotels/${hotelId}/inspections/v2/${roomCreated.id}/submit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `__Host-hotel_session=${token}`,
          "idempotency-key": "actual-api-room-submit-1",
        },
        body: JSON.stringify({
          version: roomSaved.version,
          reason: "객실 현장점검 제출",
        }),
      },
    );
    if (roomSubmitResponse.status !== 200)
      throw new Error(`ROOM submit API failed: ${roomSubmitResponse.status}`);
    const roomSubmitted = inspectionExecutionV2ResponseSchema.parse(
      await roomSubmitResponse.json(),
    ).data.inspection;
    if (roomSubmitted.status !== "IN_REVIEW")
      throw new Error("ROOM submit API canonical state mismatch");

    const denied = await app.request(path, {
      method: "POST",
      headers: {
        ...headers,
        cookie: "__Host-hotel_session=invalid-opaque-token",
        "idempotency-key": "actual-api-facility-manual-denied",
      },
      body,
    });
    if (denied.status !== 403)
      throw new Error(`invalid opaque token was not denied: ${denied.status}`);

    console.log("HOTEL_INSPECTION_FACILITY_ACTUAL_API_OK");
  } finally {
    await service.close?.();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "actual facility inspection API probe failed",
  );
  process.exitCode = 1;
});
