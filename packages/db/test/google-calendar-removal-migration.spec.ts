import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const migration = source(
  "../migrations/0045_remove_google_calendar_projection.sql",
);
const removalIntegration = source("./google-calendar-removal-integration.sql");
const readiness = source("../src/client.ts");
const foundationRunner = source("./run-foundation-integration.sh");

describe("Cloudflare 자체 호텔 달력 전환", () => {
  it("removes Google projection storage while preserving canonical calendar reads and the generic scheduled drain lock", () => {
    expect(migration).toContain("0045_remove_google_calendar_projection");
    expect(migration).toContain("GOOGLE_CALENDAR_DISPOSITION_REQUIRED");
    expect(migration).toContain("'calendar_connection_credentials'");
    expect(migration).toContain(
      "pg_catalog.to_regclass('public.' || relation_name)",
    );
    expect(migration).toContain("pg_catalog.format(");
    expect(foundationRunner).toContain(
      "GOOGLE_CALENDAR_DISPOSITION_PREFLIGHT_OK",
    );
    expect(foundationRunner).toContain(
      "GOOGLE_CALENDAR_LEGACY_REMOVAL_ACTUAL_OK",
    );
    expect(foundationRunner).toContain(
      "subject.runPreviewGoogleDecommission({",
    );
    expect(foundationRunner).toContain(
      "GOOGLE_CALENDAR_DECOMMISSION_ACTUAL_OK",
    );
    expect(foundationRunner).toContain("SCHEDULED_RECONCILER_LOCK_RUNTIME_OK");
    expect(migration).toContain(
      "drop trigger if exists calendar_projection_visit_signal",
    );
    expect(migration).toContain(
      "drop function if exists public.calendar_projection_visit_signal_v1()",
    );
    expect(removalIntegration).toContain("calendar_projection_visit_signal_v1");
    expect(readiness).toContain("retired_calendar_object_count");
    expect(readiness).toContain("retired_calendar_routine_count");
    expect(migration).toContain(
      "drop table if exists public.calendar_connection_credentials",
    );
    expect(migration).toContain(
      "alter table if exists public.calendar_connections",
    );
    expect(migration).toContain(
      "drop table if exists public.calendar_projection_jobs",
    );
    expect(migration).toContain("delete from public.permission_grants");
    expect(migration).toContain("'CALENDAR_CONNECTION_MANAGE'");
    expect(migration).toContain(
      "create or replace function public.repair_snapshot_v1",
    );
    expect(migration).toContain(
      "create or replace function public.hotel_calendar_events_read_v1",
    );
    expect(migration).not.toContain("calendarProjectionStatus");
    expect(migration).not.toContain(
      "drop function public.scheduled_reconciler_invocation_enter_v1",
    );
    expect(migration).not.toContain(
      "drop function public.scheduled_reconciler_invocation_exit_v1",
    );
    expect(migration).not.toContain(
      "drop function public.scheduled_reconciler_drain_barrier_v1",
    );
    expect(
      foundationRunner.match(/run_actual_calendar_api_probe "\$ADMIN_URL"/gu),
    ).toHaveLength(3);
    expect(foundationRunner).toContain(
      'run_actual_calendar_api_probe "$LEGACY_REMOVAL_ADMIN_URL"',
    );
  });

  it("keeps the own-calendar API and removes the Google connection and provider release surface", () => {
    const contracts = source("../../contracts/src/index.ts");
    const api = source("../../../apps/api/src/app.ts");
    const workflow = source("../../../.github/workflows/preview-release.yml");
    expect(contracts).toContain('all: "/api/calendar"');
    expect(contracts).not.toContain("calendarConnectionRoutes");
    expect(contracts).not.toMatch(/calendarProjectionStatus\s*:/u);
    expect(api).toContain('hotelApp.get("/api/calendar"');
    expect(api).not.toContain("calendar-connections");
    expect(api).not.toContain("createCalendarConnectionServiceFromBindings");
    const cleanupMarker =
      "      - name: Retire Preview Google Calendar Worker secrets\n";
    const cleanupStart = workflow.indexOf(cleanupMarker);
    const cleanupEnd = workflow.indexOf(
      "\n      - name: ",
      cleanupStart + cleanupMarker.length,
    );
    expect(cleanupStart).toBeGreaterThanOrEqual(0);
    expect(cleanupEnd).toBeGreaterThan(cleanupStart);
    const cleanupStep = workflow.slice(cleanupStart, cleanupEnd);
    const dispositionMarker =
      "      - name: Decommission Preview Google Calendar provider artifacts and grants\n";
    const dispositionStart = workflow.indexOf(dispositionMarker);
    const dispositionEnd = workflow.indexOf(
      "\n      - name: ",
      dispositionStart + dispositionMarker.length,
    );
    expect(dispositionStart).toBeGreaterThanOrEqual(0);
    expect(dispositionEnd).toBeGreaterThan(dispositionStart);
    const dispositionStep = workflow.slice(dispositionStart, dispositionEnd);
    const workflowWithoutProviderLifecycle = workflow
      .replace(cleanupStep, "")
      .replace(dispositionStep, "");
    for (const retiredKey of [
      "GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET",
      "CALENDAR_CREDENTIAL_AES_KEYRING_JSON",
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
    ]) {
      expect(cleanupStep).toContain(retiredKey);
      expect(workflowWithoutProviderLifecycle).not.toContain(retiredKey);
    }
    expect(dispositionStep).toContain("GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET");
    expect(dispositionStep).toContain("CALENDAR_CREDENTIAL_AES_KEYRING_JSON");
    expect(dispositionStep).not.toContain(
      "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON",
    );
    expect(workflowWithoutProviderLifecycle).not.toContain("GOOGLE_CALENDAR");
    expect(cleanupStep).not.toContain("secrets.GOOGLE_CALENDAR");
    expect(cleanupStep).not.toContain("vars.GOOGLE_CALENDAR");
    expect(workflow).not.toContain("Calendar API and responsive UI");
  });
});
