import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  appRoutes,
  errorResponseSchema,
  vehicleListResponseSchema,
  vehicleOperationLogDetailResponseSchema,
  vehicleOperationLogListResponseSchema,
  vehicleOperationLogMutationResponseSchema,
} from "@gw/shared";
import { app } from "../src/app";

const databaseUrl = process.env.DATABASE_URL_PREVIEW;
const runWhenDbConfigured = databaseUrl ? it : it.skip;
const sql = databaseUrl ? neon(databaseUrl, { fullResults: false }) : null;

async function login(roleCode: "COMPANY_ADMIN" | "HR_ADMIN" = "COMPANY_ADMIN") {
  const response = await app.request(
    appRoutes.auth.login,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": roleCode },
      body: JSON.stringify({ loginId: "admin", password: "1234", rememberSession: true }),
    },
    { DATABASE_URL: databaseUrl },
  );
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie") ?? "";
}

describe("operational vehicle operation log API", () => {
  it("requires PostgreSQL for authenticated vehicle operation log list calls", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(appRoutes.vehicleOperationLogs.logs, { headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  runWhenDbConfigured("creates, lists, updates, reads, and submits vehicle operation logs through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    await sql`delete from privacy_access_logs where company_id = 'company_demo' and resource_type = 'vehicle_operation_log' and metadata_json->>'source' = 'vehicle-operation-api'`;

    const cookie = await login("COMPANY_ADMIN");
    const vehiclesResponse = await app.request(appRoutes.vehicleOperationLogs.vehicles, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(vehiclesResponse.status).toBe(200);
    const vehiclesPayload = vehicleListResponseSchema.parse(await vehiclesResponse.json());
    expect(vehiclesPayload.data.source).toBe("postgres");
    const vehicle = vehiclesPayload.data.items.find((item) => item.id === "vehicle_demo_1") ?? vehiclesPayload.data.items[0];
    expect(vehicle).toBeTruthy();

    const createResponse = await app.request(
      appRoutes.vehicleOperationLogs.create,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          operationDate: "2026-07-03",
          purpose: "site_visit",
          purposeDetail: "지점 점검",
          departurePlace: "본사",
          arrivalPlace: "강남 지점",
          distanceKm: 18.4,
          fuelCost: 15000,
          tollCost: 0,
          parkingCost: 3000,
          otherCost: 0,
          memo: "차량운행일지 API smoke",
        }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(createResponse.status).toBe(201);
    const createPayload = vehicleOperationLogMutationResponseSchema.parse(await createResponse.json());
    expect(createPayload.data.source).toBe("postgres");
    expect(createPayload.data.log.status).toBe("draft");
    expect(createPayload.data.log.vehicleId).toBe(vehicle.id);

    const updateResponse = await app.request(
      appRoutes.vehicleOperationLogs.update(createPayload.data.log.id),
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ distanceKm: 19.2, reason: "주행거리 보정" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(updateResponse.status).toBe(200);
    const updatePayload = vehicleOperationLogMutationResponseSchema.parse(await updateResponse.json());
    expect(updatePayload.data.log.distanceKm).toBe(19.2);

    const listResponse = await app.request(appRoutes.vehicleOperationLogs.logs, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(listResponse.status).toBe(200);
    const listPayload = vehicleOperationLogListResponseSchema.parse(await listResponse.json());
    expect(listPayload.data.items.some((item) => item.id === createPayload.data.log.id)).toBe(true);

    const detailResponse = await app.request(appRoutes.vehicleOperationLogs.detail(createPayload.data.log.id), { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(detailResponse.status).toBe(200);
    const detailPayload = vehicleOperationLogDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.log.memo).toBe("차량운행일지 API smoke");

    const submitResponse = await app.request(
      appRoutes.vehicleOperationLogs.submit(createPayload.data.log.id),
      { method: "POST", headers: { cookie } },
      { DATABASE_URL: databaseUrl },
    );
    expect(submitResponse.status).toBe(200);
    const submitPayload = vehicleOperationLogMutationResponseSchema.parse(await submitResponse.json());
    expect(submitPayload.data.log.status).toBe("submitted");
    expect(submitPayload.data.log.submittedAt).not.toBeNull();

    const auditRows = await sql`select count(*)::int as count from privacy_access_logs where company_id = 'company_demo' and resource_id = ${createPayload.data.log.id}`;
    expect(auditRows[0].count).toBeGreaterThanOrEqual(3);

    await sql`delete from privacy_access_logs where company_id = 'company_demo' and resource_id in (${createPayload.data.log.id}, 'vehicle_operation_log_list')`;
    await sql`delete from audit_logs where company_id = 'company_demo' and resource_id = ${createPayload.data.log.id}`;
    await sql`delete from vehicle_operation_logs where id = ${createPayload.data.log.id}`;
  });
});
