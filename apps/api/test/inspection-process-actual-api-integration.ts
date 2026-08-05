import { readFile } from "node:fs/promises";
import {
  inspectionChecklistResponseSchema,
  inspectionChecklistV2ResponseSchema,
  inspectionExecutionResponseSchema,
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
  const fixturePath = process.env.INSPECTION_SQL;
  if (!databaseUrl || !fixturePath)
    throw new Error("actual inspection API environment is incomplete");

  const source = await readFile(fixturePath, "utf8");
  const companyId = literalFixture(source, "v_company");
  const hotelId = literalFixture(source, "v_hotel");
  const sessionId = literalFixture(source, "v_session");

  const token = repeatedFixture(source, "v_token");
  const principal = {
    companyId,
    displayName: "API integration actor",
    identityId: "3f000000-0000-4000-8000-000000000001",
    sessionId,
    userId: "2f000000-0000-4000-8000-000000000001",
    userType: "INTERNAL_STAFF" as const,
  };
  const authService = {
    resolvePrincipal: async () => principal,
  } as unknown as AuthService;
  const repository = createPostgresInspectionRepository(databaseUrl);
  const service = createInspectionService(repository);
  const app = createApp({ authService, inspectionService: service });

  try {
    const path = `/api/hotels/${hotelId}/inspections/manual`;
    const legacyChecklistResponse = await app.request(
      `/api/hotels/${hotelId}/inspection-checklist`,
      { headers: { cookie: `__Host-hotel_session=${token}` } },
    );
    if (legacyChecklistResponse.status !== 200)
      throw new Error(
        `actual legacy checklist read failed: ${legacyChecklistResponse.status}`,
      );
    const legacyChecklist = inspectionChecklistResponseSchema.parse(
      await legacyChecklistResponse.json(),
    ).data.checklist;
    const currentItemId = legacyChecklist?.items[0]?.itemId;
    if (!currentItemId)
      throw new Error("actual legacy checklist had no selectable item");
    const body = JSON.stringify({
      processDefinitionId: null,
      targets: [
        {
          roomId: "bc000000-0000-4000-8000-000000000001",
          selectedItemIds: [currentItemId],
        },
      ],
    });
    const response = await app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `__Host-hotel_session=${token}`,
        "idempotency-key": "actual-api-manual-inspection-1",
      },
      body,
    });
    if (response.status !== 201) {
      const failure = (await response.json()) as {
        error?: { code?: string; message?: string } | null;
      };
      throw new Error(
        `actual inspection API create failed: ${response.status} ${failure.error?.code ?? "UNKNOWN"} ${failure.error?.message ?? ""}`,
      );
    }
    const payload = inspectionExecutionResponseSchema.parse(
      await response.json(),
    );
    if (payload.data.inspection.source !== "MANUAL")
      throw new Error("actual inspection API read-back mismatch");

    const denied = await app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "__Host-hotel_session=invalid-opaque-token",
        "idempotency-key": "actual-api-manual-inspection-denied",
      },
      body,
    });
    if (denied.status !== 403)
      throw new Error(`invalid opaque token was not denied: ${denied.status}`);

    const checklistPath = `/api/hotels/${hotelId}/inspection-checklist/v2`;
    const checklistReadResponse = await app.request(checklistPath, {
      headers: { cookie: `__Host-hotel_session=${token}` },
    });
    if (checklistReadResponse.status !== 200)
      throw new Error(
        `actual checklist v2 read failed: ${checklistReadResponse.status}`,
      );
    const checklistRead = inspectionChecklistV2ResponseSchema.parse(
      await checklistReadResponse.json(),
    ).data.checklist;
    if (!checklistRead)
      throw new Error("actual checklist v2 backfill was not readable");
    const checklistSaveBody = JSON.stringify({
      version: checklistRead.version,
      reason: "actual API 시설물 점검항목 저장",
      items: [
        ...checklistRead.items,
        {
          itemId: null,
          targetType: "FACILITY",
          source: "TARGET_TYPE_ADDED",
          facilityTypeId: "7ab00000-0000-4000-8000-000000000001",
          excludedFacilityTypeIds: [],
          name: "actual API 시설물 확인",
          description: null,
          isRequired: true,
          displayOrder: 900,
          defaultSeverity: "MAJOR",
        },
      ],
    });
    const checklistSaveResponse = await app.request(checklistPath, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: `__Host-hotel_session=${token}`,
        "idempotency-key": "actual-api-checklist-v2-1",
      },
      body: checklistSaveBody,
    });
    if (checklistSaveResponse.status !== 200)
      throw new Error(
        `actual checklist v2 save failed: ${checklistSaveResponse.status}`,
      );
    const checklistSave = inspectionChecklistV2ResponseSchema.parse(
      await checklistSaveResponse.json(),
    ).data.checklist;
    const checklistReplayResponse = await app.request(checklistPath, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: `__Host-hotel_session=${token}`,
        "idempotency-key": "actual-api-checklist-v2-1",
      },
      body: checklistSaveBody,
    });
    const checklistReplay = inspectionChecklistV2ResponseSchema.parse(
      await checklistReplayResponse.json(),
    ).data.checklist;
    if (
      checklistReplayResponse.status !== 200 ||
      !checklistSave ||
      !checklistReplay ||
      JSON.stringify(checklistReplay) !== JSON.stringify(checklistSave)
    )
      throw new Error("actual checklist v2 committed replay mismatch");
    const checklistVerifyResponse = await app.request(checklistPath, {
      headers: { cookie: `__Host-hotel_session=${token}` },
    });
    const checklistVerify = inspectionChecklistV2ResponseSchema.parse(
      await checklistVerifyResponse.json(),
    ).data.checklist;
    if (
      !checklistSave ||
      !checklistVerify ||
      checklistVerify.id !== checklistSave.id ||
      !checklistVerify.items.some((item) => item.targetType === "FACILITY")
    )
      throw new Error("actual checklist v2 canonical read-back mismatch");
    console.log("HOTEL_INSPECTION_CHECKLIST_TARGETS_ACTUAL_API_OK");
    console.log("INSPECTION_ACTUAL_API_INTEGRATION_OK");
  } finally {
    await service.close?.();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "actual inspection API probe failed",
  );
  process.exitCode = 1;
});
