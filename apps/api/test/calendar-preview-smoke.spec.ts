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
const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);

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
    expect(source).toContain("options.includeSafeErrorCode");
    expect(source).toContain("/^[A-Z_]+$/u.test(payload?.error?.code)");
    expect(source).toContain("includeSafeErrorCode: true");
    expect(source).not.toContain("payload?.error?.message");
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
    expect(source).toContain("hotel_repair_case_command_v1");
    expect(source).toContain('"CREATE_DIRECT"');
    expect(source).toContain("PREVIEW_CALENDAR_CREATE_DIRECT_PROBE_FAILED");
    expect(source).toContain("PREVIEW_CALENDAR_CREATE_DIRECT_ROLLBACK_INVALID");
    expect(source).toContain("PREVIEW_CALENDAR_CREATE_DIRECT_ROLLBACK_OK");
    expect(source).toContain("PREVIEW_CALENDAR_TEMP_CLONE_DIAGNOSTIC_CAPTURED");
    expect(source).toContain(
      "PREVIEW_CALENDAR_TEMP_CLONE_PROBE_FAILED_${diagnosticStage}",
    );
    for (const diagnosticStage of [
      "CATALOG_READ",
      "SOURCE_VERIFY",
      "TEMP_SCHEMA_CREATE",
      "TEMP_FUNCTION_CREATE",
      "SAVEPOINT_CREATE",
      "TEMP_FUNCTION_CALL",
      "ROLLBACK_READ",
      "OUTER_ROLLBACK",
    ]) {
      expect(source).toContain(`diagnosticStage = "${diagnosticStage}"`);
    }
    expect(source).toContain("pg_get_functiondef");
    expect(source).toContain("pg_temp.preview_hotel_repair_case_probe_v1");
    expect(source).toContain("savepoint preview_calendar_constraint_probe");
    expect(source).toContain(
      "rollback to savepoint preview_calendar_constraint_probe",
    );
    expect(source).toContain("PREVIEW_CALENDAR_TEMP_CLONE_SQLSTATE_");
    expect(source).toContain("_REASON_${safeReason}");
    expect(source).toContain(
      "stableRepairDiagnosticReasons.get(errorRecord.message)",
    );
    for (const safeReason of [
      "REPAIR_HISTORY_APPEND_ONLY",
      "REPAIR_PRIORITY_DELETE_FORBIDDEN",
      "REPAIR_PRIORITY_DELETED_IMMUTABLE",
      "REPAIR_PERFORMER_INVALID",
      "REPAIR_FOLLOW_UP_INVALID",
      "REPAIR_COMPLETED_LOCKED",
      "REPAIR_EVIDENCE_REQUIRED",
      "HOTEL_IMMUTABLE_CHANGE",
      "INSPECTION_FINAL_LOCKED",
      "AUDIT_APPEND_ONLY",
      "ACCESS_SUBJECT_DELETE_FORBIDDEN",
    ]) {
      expect(source).toContain(`"${safeReason}"`);
    }
    expect(source).toContain("/^[A-Z_]+$/u.test(errorRecord.message)");
    expect(source).not.toContain("console.log(errorRecord.message)");
    expect(source).toContain("PREVIEW_CALENDAR_TEMP_CLONE_ROLLBACK_OK");
    expect(source).toContain("public.runtime_database_capabilities");
    expect(source).toContain("session_user");
    expect(source).toContain('diagnosticStage = "OWNER_CAPABILITY_SCOPE"');
    expect(source).toContain("owner_capability_absent");
    expect(source).toContain("rollback_clean");
    for (const rollbackObject of [
      "public.hotel_repair_cases",
      "public.process_executions",
      "public.idempotency_records",
      "public.audit_events",
    ]) {
      expect(source).toContain(rollbackObject);
    }
    expect(source).toContain("HOTEL_REPAIR_CASE_COMMAND_V1_SHA256");
    expect(source).not.toContain("constraintError.message");
    expect(source).not.toContain("console.log(ownerDatabaseUrl)");
    expect(source).not.toContain("console.error(ownerDatabaseUrl)");
    expect(source).toContain("hotel_repair_read_v1");
    expect(source).toContain("throw rollbackSignal");
    expect(source).not.toContain("probeError.message");
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
    expect(workflow).toContain(
      "PREVIEW_CALENDAR_OWNER_DATABASE_URL: ${{ secrets.DATABASE_URL_PREVIEW }}",
    );
    expect(source).toContain("PREVIEW_CALENDAR_OWNER_DATABASE_URL");
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
        PREVIEW_CALENDAR_OWNER_DATABASE_URL: `postgres://${sentinel}@protected/preview`,
      },
    });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toContain(sentinel);
    expect(output).not.toContain("/protected/runtime-url");
    expect(output).not.toContain("/protected/reconciler-url");
  });
});
