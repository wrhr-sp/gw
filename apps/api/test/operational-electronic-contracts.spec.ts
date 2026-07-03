import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import {
  appRoutes,
  electronicContractCreateResponseSchema,
  electronicContractDetailResponseSchema,
  electronicContractListResponseSchema,
  electronicContractStatusUpdateResponseSchema,
  errorResponseSchema,
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

describe("operational electronic contracts API", () => {
  it("requires PostgreSQL for authenticated electronic contract list calls", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-role": "COMPANY_ADMIN" },
      body: JSON.stringify({ loginId: "admin", password: "1234" }),
    });
    const cookie = loginResponse.headers.get("set-cookie") ?? "";

    const response = await app.request(appRoutes.electronicContracts.list, { headers: { cookie } });

    expect(response.status).toBe(503);
    const payload = errorResponseSchema.parse(await response.json());
    expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
  });

  runWhenDbConfigured("creates, lists, reads, and updates an electronic contract through PostgreSQL", async () => {
    if (!sql) throw new Error("DATABASE_URL_PREVIEW is required");
    const title = `전자계약 DB smoke ${Date.now()}`;
    await sql`delete from privacy_access_logs where company_id = 'company_demo' and resource_type = 'electronic_contract' and metadata_json->>'source' = 'electronic-contracts-api'`;
    await sql`delete from audit_logs where company_id = 'company_demo' and resource_type = 'electronic_contract' and metadata_json->>'source' = 'electronic-contracts-api'`;
    await sql`delete from electronic_contracts where company_id = 'company_demo' and title = ${title}`;

    const cookie = await login("COMPANY_ADMIN");
    const createResponse = await app.request(
      appRoutes.electronicContracts.create,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          title,
          summary: "계약 내부 기반 smoke",
          contractType: "standard_service_agreement",
          parties: [
            { employeeId: "employee_admin", name: "총괄 관리자", email: "admin@werehere.example", role: "owner", signingOrder: 1 },
            { employeeId: "employee_staff", name: "인사 관리자", email: "hr@werehere.example", role: "signer", signingOrder: 2 },
          ],
        }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(createResponse.status).toBe(201);
    const createPayload = electronicContractCreateResponseSchema.parse(await createResponse.json());
    expect(createPayload.data.source).toBe("postgres-r2");
    expect(createPayload.data.contract.title).toBe(title);
    expect(createPayload.data.contract.status).toBe("draft");
    expect(createPayload.data.parties).toHaveLength(2);

    const listResponse = await app.request(appRoutes.electronicContracts.list, { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(listResponse.status).toBe(200);
    const listPayload = electronicContractListResponseSchema.parse(await listResponse.json());
    expect(listPayload.data.items.some((item) => item.id === createPayload.data.contract.id)).toBe(true);

    const detailResponse = await app.request(appRoutes.electronicContracts.detail(createPayload.data.contract.id), { headers: { cookie } }, { DATABASE_URL: databaseUrl });
    expect(detailResponse.status).toBe(200);
    const detailPayload = electronicContractDetailResponseSchema.parse(await detailResponse.json());
    expect(detailPayload.data.parties.map((party) => party.status)).toEqual(["pending", "pending"]);

    const statusResponse = await app.request(
      appRoutes.electronicContracts.updateStatus(createPayload.data.contract.id),
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ status: "signature_requested", reason: "서명 요청 smoke" }),
      },
      { DATABASE_URL: databaseUrl },
    );
    expect(statusResponse.status).toBe(200);
    const statusPayload = electronicContractStatusUpdateResponseSchema.parse(await statusResponse.json());
    expect(statusPayload.data.contract.status).toBe("signature_requested");
    expect(statusPayload.data.parties.map((party) => party.status)).toEqual(["requested", "requested"]);

    const auditRows = await sql`select count(*)::int as count from privacy_access_logs where company_id = 'company_demo' and resource_id = ${createPayload.data.contract.id}`;
    expect(auditRows[0].count).toBeGreaterThanOrEqual(2);

    await sql`delete from privacy_access_logs where company_id = 'company_demo' and resource_id = ${createPayload.data.contract.id}`;
    await sql`delete from audit_logs where company_id = 'company_demo' and resource_id = ${createPayload.data.contract.id}`;
    await sql`delete from electronic_contracts where id = ${createPayload.data.contract.id}`;
  });
});
