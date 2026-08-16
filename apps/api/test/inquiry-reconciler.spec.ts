import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reconcileExpiredInquiriesFromBindings } from "../src/inquiries/factory";
describe("hotel inquiry reconciler", () => {
  it("fails closed without the RECONCILER database binding", async () => {
    await expect(
      reconcileExpiredInquiriesFromBindings(undefined),
    ).rejects.toThrow("INQUIRY_RECONCILER_NOT_CONFIGURED");
  });
  it("wires seven-day auto close into the scheduled worker", () => {
    const worker = readFileSync(
        new URL("../src/reconciler-index.ts", import.meta.url),
        "utf8",
      ),
      migration = readFileSync(
        new URL(
          "../../../packages/db/migrations/0052_hotel_owner_inquiries.sql",
          import.meta.url,
        ),
        "utf8",
      );
    expect(worker).toContain("reconcileExpiredInquiriesFromBindings(env)");
    expect(migration).toContain(
      "answered_at<=statement_timestamp()-interval'7 days'",
    );
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("runtime_has_capability('RECONCILER')");
  });
});
