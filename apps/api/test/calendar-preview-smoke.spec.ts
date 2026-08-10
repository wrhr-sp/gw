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
const releaseWorkflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);
const reconcilerWorkerSource = readFileSync(
  new URL("../src/reconciler-index.ts", import.meta.url),
  "utf8",
);
const drainBarrierSource = readFileSync(
  new URL("../../../scripts/wait-reconciler-drain.mjs", import.meta.url),
  "utf8",
);

describe("hosted Preview Calendar smoke", () => {
  it("holds a PostgreSQL invocation lock until every scheduled task settles and drains it before smoke", () => {
    expect(reconcilerWorkerSource).toContain(
      "withPostgresScheduledReconcilerInvocation(databaseUrl",
    );
    expect(reconcilerWorkerSource).not.toContain("Promise.race");
    expect(releaseWorkflow).toContain("node scripts/wait-reconciler-drain.mjs");
    expect(releaseWorkflow).not.toContain("sleep 35");
    const contractIndex = releaseWorkflow.indexOf(
      "- name: Contract Neon Preview tenant authority",
    );
    const postContractVersionIndex = releaseWorkflow.indexOf(
      "- name: Verify exact active Workers before post-contract Calendar smoke",
    );
    expect(contractIndex).toBeGreaterThan(-1);
    expect(postContractVersionIndex).toBeGreaterThan(contractIndex);
    expect(
      releaseWorkflow.slice(contractIndex, postContractVersionIndex),
    ).toContain("node scripts/wait-reconciler-drain.mjs");
    expect(drainBarrierSource).toContain(
      "public.scheduled_reconciler_drain_barrier_v1()",
    );
    expect(drainBarrierSource).toContain(
      "set_config('lock_timeout','10min',true)",
    );
    expect(drainBarrierSource).toContain(
      'createRequire(new URL("../packages/db/package.json", import.meta.url))',
    );
    expect(drainBarrierSource).toContain('requireFromDb("postgres")');
    expect(drainBarrierSource).not.toContain('from "postgres"');
  });

  it("is executable and requires durable hosted projection evidence plus strict API, callback, UI, and Axe", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], { stdio: "pipe" }),
    ).not.toThrow();
    expect(source).toContain('api("/api/calendar/capabilities")');
    expect(source).toContain("api(`/api/calendar?${query}`)");
    expect(source).toContain(
      "projectionStatuses.has(event.calendarProjectionStatus)",
    );
    expect(source).not.toContain("public.calendar_projection_jobs");
    expect(source).not.toContain("public.calendar_event_links");
    expect(source).not.toContain("public.calendar_oauth_transactions");
    expect(source).toContain("calendar_projection_evidence_read_v1");
    expect(source).toContain("EVENT_BASELINE");
    expect(source).toContain("EVENT_FINAL");
    expect(source).toContain("baselineJobId");
    expect(source).toContain("PREVIEW_CALENDAR_CANARY_BASELINE_JOB_MISSING");
    expect(source).toContain('typeof baselineJobId !== "string"');
    expect(source).toContain("canaryMutationStartedAt");
    expect(source).toContain("calendar/visit-options");
    expect(source).toContain("canaryRepairId");
    expect(source).toContain("PREVIEW_CALENDAR_PROJECTION_EVIDENCE_SMOKE_OK");
    expect(source).toContain("PREVIEW_CALENDAR_STRICT_STATUS_DTO_SMOKE_OK");
    expect(source).toContain("expectedConnectionVersion");
    expect(source).toContain("/api/admin/calendar-connections/oauth/start");
    expect(source).toContain('"idempotency-key"');
    expect(source).toContain("parseRepairVisitMutationData");
    expect(source).toContain("assertExactKeys");
    expect(source).toContain(
      "apiMutation(path, method, body, parseResponseData)",
    );
    expect(source.match(/parseRepairVisitMutationData,/gu)).toHaveLength(2);
    expect(source).toContain("error=access_denied");
    expect(source).toContain(
      "PREVIEW_CALENDAR_OAUTH_TRANSACTION_REPLAY_SMOKE_OK",
    );
    expect(source).toContain("oauthStateHash");
    expect(source).toContain("calendar_projection_evidence_read_v1");
    expect(source).toContain("OAUTH_REPLAY_ABSENT");
    expect(source).toContain("__Host-hotel_calendar_oauth");
    expect(source).toContain("PREVIEW_CALENDAR_TOUCH_TARGET_INVALID");
    expect(source).toContain("PREVIEW_CALENDAR_GUIDE_TOUCH_TARGET_INVALID");
    expect(source).toContain("PREVIEW_CALENDAR_GUIDE_AXE_FAILED");
    expect(source).toContain("PREVIEW_CALENDAR_GUIDE_FOCUS_RETURN_FAILED");
    expect(source).not.toContain("job_type like 'CALENDAR_%'");
    expect(source).toContain("RECONCILER_DATABASE_URL_FILE");
    expect(source).toContain("calendar/visit-options");
    expect(source).toContain("canaryRepairIdFromTitle");
    expect(source).not.toContain("repairMatch = sourceEvent.detailHref.match");
    expect(source).toContain("baselineJobId");
    expect(source).toContain("await reconcilerSql.begin");
    expect(source).toContain("set_config('app.reconciler_company_id'");
    expect(source).not.toContain("public.calendar_projection_claim_v1");
    expect(source).not.toContain("PREVIEW_CALENDAR_PROJECTION_STATE_NOT_EMPTY");
    const projectionProbe = source.slice(
      source.indexOf("const projectionChains"),
      source.indexOf(
        'console.log("PREVIEW_CALENDAR_PROJECTION_EVIDENCE_SMOKE_OK")',
      ),
    );
    expect(projectionProbe).not.toContain("set_config('app.company_id'");
    expect(projectionProbe).not.toContain("count(*)");
    expect(projectionProbe).not.toContain("from public.calendar_event_links");
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
