import { describe, expect, it } from "vitest";
import {
  hotelErrorCodeSchema,
  hotelRoutes,
  hotelStatusSchema,
  hotelUserTypeSchema,
} from "../src/index";

describe("hotel platform contracts", () => {
  it("allows exactly the three approved MVP user types", () => {
    expect(hotelUserTypeSchema.options).toEqual([
      "INTERNAL_STAFF",
      "ROOM_OPERATIONS",
      "BRANCH_OWNER",
    ]);
    expect(hotelUserTypeSchema.safeParse("PARTNER_EMPLOYEE").success).toBe(false);
  });

  it("uses the approved hotel lifecycle states", () => {
    expect(hotelStatusSchema.options).toEqual(["PREPARING", "ACTIVE", "SUSPENDED"]);
  });

  it("defines stable infrastructure and concurrency error codes", () => {
    for (const code of [
      "VALIDATION_ERROR",
      "AUTHENTICATION_REQUIRED",
      "FORBIDDEN",
      "RESOURCE_NOT_FOUND",
      "VERSION_CONFLICT",
      "IDEMPOTENCY_CONFLICT",
      "INVALID_STATE_TRANSITION",
      "DB_NOT_CONFIGURED",
      "SCHEMA_NOT_READY",
      "FILE_STORAGE_NOT_CONFIGURED",
      "INTERNAL_ERROR",
    ]) {
      expect(hotelErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("keeps canonical hotel routes under the same-origin API namespace", () => {
    expect(hotelRoutes.list).toBe("/api/hotels");
    expect(hotelRoutes.create).toBe("/api/hotels");
    expect(hotelRoutes.detail("hotel_1")).toBe("/api/hotels/hotel_1");
    expect(hotelRoutes.staffAssignments("hotel_1")).toBe("/api/hotels/hotel_1/staff-assignments");
    expect(hotelRoutes.housekeepingLinks("hotel_1")).toBe("/api/hotels/hotel_1/housekeeping-links");
    expect(hotelRoutes.ownerTransfer("hotel_1")).toBe("/api/hotels/hotel_1/owner-transfer");
  });
});
