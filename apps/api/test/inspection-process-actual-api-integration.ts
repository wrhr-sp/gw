import { readFile } from "node:fs/promises";
import { inspectionExecutionResponseSchema } from "@werehere/contracts";
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
  const itemId = literalFixture(source, "v_item_source");
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
    const body = JSON.stringify({
      processDefinitionId: null,
      targets: [
        {
          roomId: "bc000000-0000-4000-8000-000000000001",
          selectedItemIds: [itemId],
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
    if (response.status !== 201)
      throw new Error(
        `actual inspection API create failed: ${response.status}`,
      );
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
