import { describe, expect, it } from "vitest";
import { appRoutes, errorResponseSchema, type RoleCode } from "@gw/shared";
import { app } from "../src/app";

async function loginAndGetCookie(role: RoleCode) {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({
      loginId: "admin",
      password: "1234",
    }),
  });

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("expected login response to include set-cookie header");
  }

  return cookie;
}

async function requestAs(role: RoleCode, route: string) {
  const cookie = await loginAndGetCookie(role);
  return app.request(route, {
    headers: {
      cookie,
    },
  });
}

async function expectDbRequired(response: Response) {
  expect(response.status).toBe(503);
  const payload = errorResponseSchema.parse(await response.json());
  expect(payload.error.code).toBe("DB_NOT_CONFIGURED");
}

describe("Phase 26 HR meeting work-item API persistence guard", () => {
  it("requires PostgreSQL before listing work items and deadlines", async () => {
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.workItems.list));
    await expectDbRequired(await requestAs("HR_ADMIN", `${appRoutes.workItems.list}?module=hr`));
    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.workItems.deadlines));
  });

  it("requires PostgreSQL before reading work-item detail metadata", async () => {
    await expectDbRequired(await requestAs("EMPLOYEE", appRoutes.workItems.detail("work_item_hr_one_on_one_checkin")));
    await expectDbRequired(await requestAs("MANAGER", appRoutes.workItems.detail("work_item_tax_month_end_evidence")));
    await expectDbRequired(await requestAs("AUDITOR", appRoutes.workItems.detail("work_item_legal_dispute_intake")));
  });

  it("requires PostgreSQL before reading work-item documents, attachments, and reviews", async () => {
    const workItemId = "work_item_legal_contract_renewal";

    await expectDbRequired(await requestAs("COMPANY_ADMIN", appRoutes.workItems.documents(workItemId)));
    await expectDbRequired(await requestAs("AUDITOR", appRoutes.workItems.attachments(workItemId)));
    await expectDbRequired(await requestAs("HR_ADMIN", appRoutes.workItems.reviews(workItemId)));
  });

  it("requires PostgreSQL for work-item deadlines even for employee viewers", async () => {
    const response = await requestAs("EMPLOYEE", appRoutes.workItems.deadlines);
    await expectDbRequired(response);
  });
});
