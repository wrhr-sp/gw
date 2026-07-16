import { describe, expect, it } from "vitest";
import {
  authRoutes,
  authSessionResponseSchema,
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
      "AUTH_FLOW_INVALID",
      "AUTH_RATE_LIMITED",
      "AUTH_PROVIDER_NOT_CONFIGURED",
      "AUTH_PROVIDER_UNAVAILABLE",
      "IDENTITY_NOT_PROVISIONED",
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

  it("defines same-origin auth routes without exposing provider details", () => {
    expect(authRoutes.login).toBe("/api/auth/login");
    expect(authRoutes.callback).toBe("/api/auth/callback");
    expect(authRoutes.logout).toBe("/api/auth/logout");
    expect(authRoutes.session).toBe("/api/auth/session");
  });

  it("parses only the approved server-derived principal fields", () => {
    const response = authSessionResponseSchema.parse({
      ok: true,
      data: {
        authenticated: true,
        principal: {
          companyId: "10000000-0000-4000-8000-000000000001",
          identityId: "30000000-0000-4000-8000-000000000001",
          sessionId: "40000000-0000-4000-8000-000000000001",
          userId: "20000000-0000-4000-8000-000000000001",
          userType: "INTERNAL_STAFF",
          displayName: "사내 임직원",
        },
      },
      error: null,
    });
    expect(response.data.principal.userType).toBe("INTERNAL_STAFF");
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
