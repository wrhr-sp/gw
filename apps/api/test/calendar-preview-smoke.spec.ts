import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL(
  "../../../scripts/smoke-calendar-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");

describe("hosted Preview Calendar smoke", () => {
  it("is executable and verifies the canonical own-Calendar API, UI, and Axe", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], { stdio: "pipe" }),
    ).not.toThrow();
    expect(source).toContain('api("/api/calendar/capabilities")');
    expect(source).toContain("api(`/api/calendar?${query}`)");
    expect(source).toContain(
      "api(`/api/hotels/${hotelId}/calendar/visit-options`, {",
    );
    expect(source).toContain('method: "POST"');
    expect(source).toContain('"idempotency-key"');
    for (const mutationApiFailure of [
      "PREVIEW_CALENDAR_MUTATION_OPTIONS_API_INVALID",
      "PREVIEW_CALENDAR_MUTATION_REPAIR_CREATE_API_INVALID",
      "PREVIEW_CALENDAR_MUTATION_VISIT_CREATE_API_INVALID",
      "PREVIEW_CALENDAR_MUTATION_DETAIL_READ_API_INVALID",
      "PREVIEW_CALENDAR_MUTATION_HOTEL_READ_API_INVALID",
      "PREVIEW_CALENDAR_MUTATION_VISIT_DELETE_API_INVALID",
      "PREVIEW_CALENDAR_MUTATION_AFTER_DELETE_READ_API_INVALID",
    ]) {
      expect(source).toContain(mutationApiFailure);
    }
    expect(source).toContain("PREVIEW_CALENDAR_MUTATION_READBACK_INVALID");
    expect(source).toContain("PREVIEW_CALENDAR_PERMISSION_DENY_INVALID");
    expect(source).toContain('const requireMutation = mutationMode === "1";');
    expect(source).toContain("if (requireMutation) {");
    expect(source).toContain("PREVIEW_CALENDAR_MUTATION_SMOKE_OK");
    expect(source).toContain("PREVIEW_CALENDAR_MUTATION_HOTEL_UNAVAILABLE");
    expect(source).toContain(
      "PREVIEW_CALENDAR_MUTATION_CREATE_PERMISSION_UNAVAILABLE",
    );
    expect(source).toContain("PREVIEW_CALENDAR_MUTATION_PERFORMER_UNAVAILABLE");
    expect(source).toContain(
      "PREVIEW_CALENDAR_MUTATION_CREATED_REPAIR_INVALID",
    );
    expect(source).toContain("`/api/hotels/${hotelId}/repairs`");
    expect(source).toContain(
      "repair = createdRepair?.repair ?? createdRepair;",
    );
    expect(source).toContain('type: "COMMON_AREA"');
    expect(source).toContain(
      'candidate.targetName === "Preview Calendar 검증구역"',
    );
    expect(source).toContain(
      'candidate.priorityName === "Preview Calendar 검증"',
    );
    expect(source).not.toContain("options?.repairs?.[0]");
    expect(source).toContain(
      'const canaryCommonAreaId = "75000000-0000-4000-8000-000000000002";',
    );
    expect(source).toContain(
      'const canaryPriorityId = "76000000-0000-4000-8000-000000000002";',
    );
    expect(source).toContain("/repair-visits/${visitId}/delete");
    expect(source).not.toContain("/api/admin/process-definitions");
    expect(source).not.toContain("calendarProjectionStatus");
    expect(source).not.toContain("RECONCILER_DATABASE_URL_FILE");
    expect(source).not.toContain("reconcilerSql");
    expect(source).toContain("page.goto(`${baseUrl}/hotels/calendar`");
    expect(source).toContain('getByRole("heading", { name: "업무 달력" })');
    expect(source).toContain("AxeBuilder");
    expect(source).toContain("PREVIEW_CALENDAR_API_UI_SMOKE_OK");
    expect(source).not.toMatch(
      /GOOGLE_CLIENT_SECRET|refresh_token|providerEventId\s*:/u,
    );
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
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toContain(sentinel);
    expect(output).not.toContain("/protected/runtime-url");
    expect(output).not.toContain("/protected/reconciler-url");
  });
});
