import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/0043_hotel_calendar_read_model.sql", import.meta.url);
const readinessUrl = new URL("../src/client.ts", import.meta.url);
const repairsUrl = new URL("../src/repairs.ts", import.meta.url);
const provisionUrl = new URL("../scripts/provision-preview.ts", import.meta.url);

describe("hotel Calendar read model migration", () => {
  it("adds bounded tenant-safe read routines and exact runtime grants", () => {
    const migration = readFileSync(migrationUrl, "utf8");
    for (const value of [
      "0043_hotel_calendar_read_model",
      "HOTEL_CALENDAR_READ",
      "HOTEL_CALENDAR_ALL_READ",
      "REPAIR_VISIT_CANCELLED_READ",
      "REPAIR_VISIT_CANCEL_REASON_READ",
      "hotel_calendar_capabilities_v1",
      "hotel_calendar_events_read_v1",
      "hotel_calendar_visit_options_read_v1",
      "link.terminated_at is null",
      "at time zone 'Asia/Seoul'",
      "limit 5001",
      "CALENDAR_RANGE_TOO_LARGE",
      "CALENDAR_RESULT_TOO_DENSE",
      "FORCE ROW LEVEL SECURITY",
    ]) expect(migration).toContain(value);
    expect(migration).not.toContain("provider_event_id");
    expect(migration).not.toContain("refresh_token");
    expect(migration).toContain("Runtime EXECUTE grants are applied only by capability-aware provisioning");
    expect(migration).toContain("p_company_id, p_branch_id, candidate.id, 'REPAIR_VISIT_UPDATE'");
    expect(readFileSync(repairsUrl, "utf8")).toContain("set_config('TimeZone', 'Asia/Seoul', true)");
  });

  it("includes Calendar routines in capability readiness and Preview provisioning", () => {
    const readiness = readFileSync(readinessUrl, "utf8");
    const provision = readFileSync(provisionUrl, "utf8");
    for (const source of [readiness, provision]) {
      expect(source).toContain("0043_hotel_calendar_read_model");
      expect(source).toContain("hotel_calendar_capabilities_v1");
      expect(source).toContain("hotel_calendar_events_read_v1");
      expect(source).toContain("hotel_calendar_visit_options_read_v1");
    }
    for (const helper of [
      "hotel_calendar_actor_v1",
      "hotel_calendar_permission_allowed_v1",
      "hotel_calendar_accessible_hotels_v1",
    ]) expect(readiness).toContain(helper);
    expect(readiness).toContain('calendarReadModelPhase === "PRE_CONTRACT"');
  });
});
