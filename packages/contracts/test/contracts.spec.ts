import { describe, expect, it } from "vitest";
import {
  authRoutes,
  authSessionResponseSchema,
  createHotelRequestSchema,
  customLoginRequestSchema,
  hotelDetailResponseSchema,
  hotelErrorCodeSchema,
  hotelErrorResponseSchema,
  hotelIdempotencyKeySchema,
  hotelListQuerySchema,
  hotelListResponseSchema,
  hotelRoutes,
  hotelStatusSchema,
  hotelUserTypeSchema,
  passwordPolicySchema,
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
    expect(authRoutes.customLoginStart).toBe("/api/auth/custom-login/start");
    expect(authRoutes.callback).toBe("/api/auth/callback");
    expect(authRoutes.logout).toBe("/api/auth/logout");
    expect(authRoutes.session).toBe("/api/auth/session");
  });

  it("requires a single-use CSRF token and provider-compatible credential bounds", () => {
    expect(customLoginRequestSchema.safeParse({
      authRequest: "request-1",
      csrf: "c".repeat(43),
      loginName: "hotel-admin",
      password: "password-value",
    }).success).toBe(true);
    expect(customLoginRequestSchema.safeParse({
      authRequest: "request-1",
      loginName: "hotel-admin",
      password: "password-value",
    }).success).toBe(false);
    expect(customLoginRequestSchema.safeParse({
      authRequest: "request-1",
      csrf: "c".repeat(43),
      loginName: "a".repeat(201),
      password: "password-value",
    }).success).toBe(false);
  });

  it("requires at least eight characters with a lowercase letter, number, and symbol", () => {
    expect(passwordPolicySchema.safeParse("Abcd123!").success).toBe(true);
    expect(passwordPolicySchema.safeParse("Abc123!").success).toBe(false);
    expect(passwordPolicySchema.safeParse("Abcd12😀").success).toBe(false);
    expect(passwordPolicySchema.safeParse("ABCD123!").success).toBe(false);
    expect(passwordPolicySchema.safeParse("1234567!").success).toBe(false);
    expect(passwordPolicySchema.safeParse("Password!").success).toBe(false);
    expect(passwordPolicySchema.safeParse("Password1").success).toBe(false);
    expect(passwordPolicySchema.safeParse("Abcd123 ").success).toBe(false);
    expect(passwordPolicySchema.safeParse("Abcd123한").success).toBe(false);
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

  it("validates the hotel create basic-information contract", () => {
    const basic = {
      name: "위아히어 강남호텔",
      roadAddress: "서울특별시 강남구 테헤란로 1",
      detailAddress: "10층",
      representativePhone: "02-1234-5678",
      contractStartDate: "2026-07-01",
      contractEndDate: "2027-06-30",
    };
    expect(createHotelRequestSchema.parse({ branchCode: " hotel-gn ", ...basic }))
      .toMatchObject({ ...basic, branchCode: "HOTEL-GN" });
    expect(createHotelRequestSchema.safeParse({ branchCode: "HOTEL GN", ...basic }).success).toBe(false);

    expect(() => createHotelRequestSchema.parse({
      branchCode: "HOTEL-GN",
      ...basic,
      contractEndDate: "2026-06-30",
    })).toThrow();
  });

  it("bounds hotel list queries, idempotency keys, and stable error envelopes", () => {
    expect(hotelListQuerySchema.parse({ q: "강남", status: "PREPARING", page: "2" }))
      .toEqual({ q: "강남", status: "PREPARING", page: 2, pageSize: 20 });
    expect(hotelListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(hotelIdempotencyKeySchema.parse("hotel-create-1")).toBe("hotel-create-1");
    expect(hotelIdempotencyKeySchema.safeParse("contains space").success).toBe(false);
    expect(hotelErrorResponseSchema.parse({
      ok: false,
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "호텔 관리 권한이 없습니다.",
        fieldErrors: [],
        retryable: false,
        retryAfterSeconds: null,
        traceId: "50000000-0000-4000-8000-000000000001",
      },
    }).error.code).toBe("FORBIDDEN");
  });

  it("publishes list and detail response schemas without placeholder metrics", () => {
    const hotel = {
      id: "10000000-0000-4000-8000-000000000001",
      branchCode: "HOTEL-GN",
      name: "위아히어 강남호텔",
      roadAddress: "서울특별시 강남구 테헤란로 1",
      detailAddress: "10층",
      representativePhone: "02-1234-5678",
      contractStartDate: "2026-07-01",
      contractEndDate: "2027-06-30",
      status: "PREPARING",
      version: 1,
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    };
    expect(hotelListResponseSchema.parse({
      ok: true,
      data: {
        capabilities: { canCreate: true },
        hotels: [hotel],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      error: null,
    })).toMatchObject({ data: { hotels: [{ name: hotel.name }] } });
    expect(hotelDetailResponseSchema.parse({ ok: true, data: { hotel }, error: null }))
      .toMatchObject({ data: { hotel: { version: 1 } } });
  });
});
