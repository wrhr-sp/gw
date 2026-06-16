import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { appRoutes } from "@gw/shared";

async function login(role: string) {
  const response = await app.request(appRoutes.auth.login, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-role": role,
    },
    body: JSON.stringify({ loginId: "admin", password: "1234" }),
  });
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("missing cookie");
  return cookie;
}

describe("phase35 review checks", () => {
  it("manager sees payroll overview and can open branch payroll period detail", async () => {
    const cookie = await login("MANAGER");
    const overview = await app.request(appRoutes.payroll.overview, { headers: { cookie } });
    const overviewPayload: any = await overview.json();
    const periodId = overviewPayload.data.periods[0]?.id;

    expect(overview.status).toBe(200);
    expect(periodId).toBeTruthy();

    const detail = await app.request(appRoutes.payroll.periodDetail(periodId), { headers: { cookie } });
    const detailPayload: any = await detail.json();

    expect(detail.status).toBe(200);
    expect(detailPayload.data.period.id).toBe(periodId);
    expect(detailPayload.data.draft.branchLabel).toBe("서울 시티 호텔");
    expect(detailPayload.data.reviewSteps.every((step: { scope: string }) => ["branch_manager", "headquarters_payroll"].includes(step.scope))).toBe(true);
  });
});
