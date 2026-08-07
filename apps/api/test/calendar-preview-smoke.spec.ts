import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL("../../../scripts/smoke-calendar-preview.mjs", import.meta.url);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");

describe("hosted Preview Calendar smoke", () => {
  it("is executable and verifies canonical API, UI, Axe, and provider non-mutation", () => {
    expect(() => execFileSync(process.execPath, ["--check", smokePath], { stdio: "pipe" })).not.toThrow();
    expect(source).toContain('api("/api/calendar/capabilities")');
    expect(source).toContain('api(`/api/calendar?${query}`)');
    expect(source).toContain('event.calendarProjectionStatus !== "NOT_CONNECTED"');
    expect(source).toContain("job_type like 'CALENDAR_%'");
    expect(source).toContain("RECONCILER_DATABASE_URL_FILE");
    expect(source).toContain("await reconcilerSql.begin");
    expect(source).toContain("set_config('app.company_id'");
    expect(source).toContain('page.goto(`${baseUrl}/hotels/calendar`');
    expect(source).toContain('getByRole("heading", { name: "업무 달력" })');
    expect(source).toContain("AxeBuilder");
    expect(source).toContain("PREVIEW_CALENDAR_API_UI_SMOKE_OK");
    expect(source).not.toMatch(/GOOGLE_CLIENT_SECRET|refresh_token|providerEventId\s*:/u);
  });

  it("does not echo protected environment input when configuration fails", () => {
    const sentinel = "calendar-protected-subject-sentinel";
    const result = spawnSync(process.execPath, [smokePath], {
      encoding: "utf8",
      env: {
        ...process.env,
        WEB_PREVIEW_URL: "invalid-preview-url",
        ZITADEL_PREVIEW_SUBJECT: sentinel,
        API_RUNTIME_DATABASE_URL_FILE: "/protected/runtime-url",
        RECONCILER_DATABASE_URL_FILE: "/protected/reconciler-url",
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toContain(sentinel);
    expect(output).not.toContain("/protected/runtime-url");
    expect(output).not.toContain("/protected/reconciler-url");
  });
});
