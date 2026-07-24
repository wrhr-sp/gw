import { describe, expect, it } from "vitest";
import {
  accountRoutes,
  accountCapabilitiesResponseSchema,
  accountEligibleHotelsResponseSchema,
  accountStatusSchema,
  accountCreateCompletionPayloadSchema,
  authenticatedPrincipalSchema,
  authRoutes,
  authSessionResponseSchema,
  activateHotelRequestSchema,
  createAccountRequestSchema,
  createHotelAssignmentRequestSchema,
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
  hotelAssignmentSchema,
  hotelUserTypeSchema,
  endHotelAssignmentRequestSchema,
  initialPasswordRequestSchema,
  loginIdSchema,
  passwordPolicySchema,
  ownerTransferRequestSchema,
} from "../src/index";

describe("hotel platform contracts", () => {
  it("defines Phase A relationship mutations without scheduled owner transfer", () => {
    expect(
      createHotelAssignmentRequestSchema.parse({
        userId: "20000000-0000-4000-8000-000000000002",
        relationshipType: "HOUSEKEEPING",
        startDate: "2026-07-24",
        reason: "신규 배정",
        hotelVersion: 1,
      }),
    ).toMatchObject({ relationshipType: "HOUSEKEEPING", hotelVersion: 1 });
    expect(
      endHotelAssignmentRequestSchema.parse({
        version: 1,
        reason: "긴급 접근 차단",
        emergency: true,
      }),
    ).toMatchObject({ emergency: true });
    expect(activateHotelRequestSchema.parse({ version: 1 })).toEqual({
      version: 1,
    });
    expect(
      ownerTransferRequestSchema.safeParse({
        newOwnerUserId: "20000000-0000-4000-8000-000000000003",
        version: 1,
        reason: "대표자 변경",
        effectiveAt: "2026-07-25T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(hotelAssignmentSchema.shape.terminatedAt).toBeDefined();
  });

  it("publishes stable relationship and stale-reauth errors", () => {
    for (const code of [
      "HOTEL_ACTIVATION_READINESS_REQUIRED",
      "HOTEL_RELATIONSHIP_CONFLICT",
      "DEPENDENT_WORK_REASSIGNMENT_REQUIRED",
      "REAUTHENTICATION_REQUIRED",
    ])
      expect(hotelErrorCodeSchema.safeParse(code).success).toBe(true);
  });

  it("canonicalizes only approved MVP login IDs and blocks fixed reserved IDs", () => {
    expect(loginIdSchema.parse("HotelAdmin")).toBe("hoteladmin");
    for (const value of [
      "ab",
      "a".repeat(31),
      "hotel-admin",
      "hotel_admin",
      "hotel.admin",
      "호텔관리자",
      "admin",
      "root",
      "werehere",
    ])
      expect(loginIdSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["PW-7", "a1!aaaa"],
    ["PW-NO-LOWER", "A1!AAAAA"],
    ["PW-NO-NUMBER", "aa!aaaaa"],
    ["PW-NO-P/S", "aa1aaaaa"],
    ["PW-201", `a1!${"a".repeat(198)}`],
    ["punctuation-only", "!!!!!!!!"],
    ["symbol-only", "💡💡💡💡💡💡💡💡"],
  ])(
    "rejects %s consistently on account password surfaces",
    (_fixture, password) => {
      const accountInput = {
        displayName: "김하우스",
        loginName: "housekeeper01",
        email: "housekeeper-01@example.invalid",
        userType: "HOUSEKEEPING" as const,
        hotelIds: ["50000000-0000-4000-8000-000000000001"],
        assignmentStartDate: "2026-07-19",
        reason: "계정 생성 검증",
        initialPassword: password,
      };
      expect(passwordPolicySchema.safeParse(password).success).toBe(false);
      expect(createAccountRequestSchema.safeParse(accountInput).success).toBe(
        false,
      );
      expect(
        initialPasswordRequestSchema.safeParse({ newPassword: password })
          .success,
      ).toBe(false);
    },
  );

  it.each([
    ["PW-8", "a1!aaaaa"],
    ["uppercase-optional", "a1!bcdef"],
    ["PW-200", `a1!${"a".repeat(197)}`],
    ["Unicode punctuation", "a1가나다라。바사"],
    ["Unicode symbol", "a1가나다라💡바사"],
  ])(
    "accepts %s consistently with Unicode code-point length",
    (_fixture, password) => {
      expect(passwordPolicySchema.safeParse(password).success).toBe(true);
      expect(
        initialPasswordRequestSchema.safeParse({ newPassword: password })
          .success,
      ).toBe(true);
    },
  );

  it("accepts only typed authenticated principals", () => {
    expect(
      authenticatedPrincipalSchema.parse({
        companyId: "10000000-0000-4000-8000-000000000001",
        identityId: "20000000-0000-4000-8000-000000000001",
        sessionId: "30000000-0000-4000-8000-000000000001",
        userId: "40000000-0000-4000-8000-000000000001",
        userType: "INTERNAL_STAFF",
        displayName: "관리자",
        mustChangePassword: true,
      }).mustChangePassword,
    ).toBe(true);
  });

  it("allows exactly the three approved MVP user types", () => {
    expect(hotelUserTypeSchema.options).toEqual([
      "INTERNAL_STAFF",
      "HOUSEKEEPING",
      "HOTEL_OWNER",
    ]);
    expect(hotelUserTypeSchema.safeParse("PARTNER_EMPLOYEE").success).toBe(
      false,
    );
  });

  it("uses the approved hotel lifecycle states", () => {
    expect(hotelStatusSchema.options).toEqual([
      "PREPARING",
      "ACTIVE",
      "SUSPENDED",
    ]);
  });

  it("defines account lifecycle routes and validates account creation", () => {
    expect(accountStatusSchema.options).toEqual([
      "PENDING_SETUP",
      "ACTIVE",
      "INACTIVE",
      "LOCKED",
    ]);
    expect(accountRoutes.list).toBe("/api/admin/users");
    expect(accountRoutes.create).toBe("/api/admin/users");
    expect(accountRoutes.detail("user-1")).toBe("/api/admin/users/user-1");
    expect(accountRoutes.deactivate("user-1")).toBe(
      "/api/admin/users/user-1/deactivate",
    );
    expect(accountRoutes.initialPassword).toBe("/api/account/initial-password");
    expect(accountRoutes.capabilities).toBe("/api/admin/users/capabilities");
    expect(accountRoutes.eligibleHotels).toBe(
      "/api/admin/users/eligible-hotels",
    );
    expect(
      accountCapabilitiesResponseSchema.parse({
        data: { permissions: ["USER_READ", "USER_CREATE"] },
      }).data.permissions,
    ).toEqual(["USER_READ", "USER_CREATE"]);
    expect(
      accountEligibleHotelsResponseSchema.parse({
        ok: true,
        data: {
          hotels: [
            {
              id: "50000000-0000-4000-8000-000000000001",
              name: "위아히어 강남호텔",
            },
          ],
        },
        error: null,
      }).data.hotels,
    ).toHaveLength(1);

    const parsed = createAccountRequestSchema.parse({
      displayName: "김하우스",
      loginName: "Housekeeper01",
      email: "housekeeper-01@example.invalid",
      userType: "HOUSEKEEPING",
      hotelIds: [
        "50000000-0000-4000-8000-000000000001",
        "50000000-0000-4000-8000-000000000002",
      ],
      assignmentStartDate: "2026-07-19",
      reason: "Preview 하우스키핑 배정",
      initialPassword: "Strong-Preview-123!",
    });
    expect(parsed.userType).toBe("HOUSEKEEPING");
    expect(parsed.loginName).toBe("housekeeper01");
    expect(
      createAccountRequestSchema.safeParse({
        ...parsed,
        initialPassword: "Abcd123!",
      }).success,
    ).toBe(true);
    for (const initialPassword of [
      "Abc123!",
      "1234567!",
      "Password!",
      "Password1",
      "Abcd123 ",
      "Abcd123한",
    ]) {
      expect(
        createAccountRequestSchema.safeParse({ ...parsed, initialPassword })
          .success,
      ).toBe(false);
    }
    if (!parsed.hotelIds)
      throw new Error("HOUSEKEEPING hotelIds were not parsed");
    const parsedHotelIds = parsed.hotelIds;
    const legacyScalar = createAccountRequestSchema.parse({
      ...parsed,
      hotelId: parsedHotelIds[0],
      hotelIds: undefined,
    });
    expect(legacyScalar.hotelId).toBeUndefined();
    expect(legacyScalar.hotelIds).toEqual([parsedHotelIds[0]]);
    const dualShape = createAccountRequestSchema.parse({
      ...parsed,
      hotelId: parsedHotelIds[1],
      hotelIds: parsedHotelIds,
    });
    expect(dualShape.hotelId).toBeUndefined();
    expect(dualShape.hotelIds).toEqual(parsedHotelIds);
    const { initialPassword: _secret, ...completionPayload } = parsed;
    void _secret;
    const duplicated = createAccountRequestSchema.parse({
      ...parsed,
      hotelIds: [parsedHotelIds[0]!, parsedHotelIds[0]!, parsedHotelIds[1]!],
    });
    expect(duplicated.hotelIds).toEqual(parsedHotelIds);
    expect(
      accountCreateCompletionPayloadSchema.parse({
        ...completionPayload,
        hotelIds: [parsedHotelIds[0]!, parsedHotelIds[0]!, parsedHotelIds[1]!],
      }).hotelIds,
    ).toEqual(parsedHotelIds);
    expect(
      createAccountRequestSchema.safeParse({
        ...parsed,
        hotelIds: Array.from({ length: 101 }, (_, index) =>
          index % 2 === 0 ? parsedHotelIds[0]! : parsedHotelIds[1]!,
        ),
      }).success,
    ).toBe(false);
    expect(
      accountCreateCompletionPayloadSchema.parse(completionPayload),
    ).toEqual(completionPayload);
    expect(accountCreateCompletionPayloadSchema.safeParse(parsed).success).toBe(
      false,
    );
    expect(
      createAccountRequestSchema.safeParse({
        ...parsed,
        initialPassword: "short",
      }).success,
    ).toBe(false);
    expect(
      createAccountRequestSchema.safeParse({
        ...parsed,
        hotelIds: undefined,
      }).success,
    ).toBe(false);
    expect(
      createAccountRequestSchema.safeParse({
        ...parsed,
        userType: "INTERNAL_STAFF",
        hotelId: "50000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
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
      "EXTERNAL_AUTH_NOT_CONFIGURED",
      "EXTERNAL_AUTH_UNAVAILABLE",
      "ACCOUNT_DUPLICATE",
      "ACCOUNT_NOT_FOUND",
      "ACCOUNT_VERSION_CONFLICT",
      "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN",
      "LAST_ADMIN_DEACTIVATION_FORBIDDEN",
      "PASSWORD_CHANGE_REQUIRED",
      "PASSWORD_RECOVERY_REQUIRED",
      "COMPENSATION_REQUIRED",
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
    const canonicalLoginRequest = customLoginRequestSchema.safeParse({
      authRequest: "request-1",
      csrf: "c".repeat(43),
      loginName: "HotelAdmin",
      password: "password-value",
    });
    expect(canonicalLoginRequest.success).toBe(true);
    if (!canonicalLoginRequest.success) throw canonicalLoginRequest.error;
    expect(canonicalLoginRequest.data.loginName).toBe("HotelAdmin");
    expect(
      customLoginRequestSchema.safeParse({
        authRequest: "request-1",
        loginName: "hoteladmin",
        password: "password-value",
      }).success,
    ).toBe(false);
    expect(
      customLoginRequestSchema.safeParse({
        authRequest: "request-1",
        csrf: "c".repeat(43),
        loginName: "invalid-id",
        password: "password-value",
      }).success,
    ).toBe(true);
    expect(
      customLoginRequestSchema.safeParse({
        authRequest: "request-1",
        csrf: "c".repeat(43),
        loginName: "a".repeat(201),
        password: "password-value",
      }).success,
    ).toBe(false);
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
    expect(hotelRoutes.staffAssignments("hotel_1")).toBe(
      "/api/hotels/hotel_1/staff-assignments",
    );
    expect(hotelRoutes.housekeepingLinks("hotel_1")).toBe(
      "/api/hotels/hotel_1/housekeeping-links",
    );
    expect(hotelRoutes.ownerTransfer("hotel_1")).toBe(
      "/api/hotels/hotel_1/owner-transfer",
    );
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
    expect(
      createHotelRequestSchema.parse({ branchCode: " hotel-gn ", ...basic }),
    ).toMatchObject({ ...basic, branchCode: "HOTEL-GN" });
    expect(
      createHotelRequestSchema.safeParse({ branchCode: "HOTEL GN", ...basic })
        .success,
    ).toBe(false);

    expect(() =>
      createHotelRequestSchema.parse({
        branchCode: "HOTEL-GN",
        ...basic,
        contractEndDate: "2026-06-30",
      }),
    ).toThrow();
  });

  it("bounds hotel list queries, idempotency keys, and stable error envelopes", () => {
    expect(
      hotelListQuerySchema.parse({ q: "강남", status: "PREPARING", page: "2" }),
    ).toEqual({ q: "강남", status: "PREPARING", page: 2, pageSize: 20 });
    expect(hotelListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(
      false,
    );
    expect(hotelIdempotencyKeySchema.parse("hotel-create-1")).toBe(
      "hotel-create-1",
    );
    expect(hotelIdempotencyKeySchema.safeParse("contains space").success).toBe(
      false,
    );
    expect(
      hotelErrorResponseSchema.parse({
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
      }).error.code,
    ).toBe("FORBIDDEN");
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
    expect(
      hotelListResponseSchema.parse({
        ok: true,
        data: {
          capabilities: { canCreate: true },
          hotels: [hotel],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        error: null,
      }),
    ).toMatchObject({ data: { hotels: [{ name: hotel.name }] } });
    expect(
      hotelDetailResponseSchema.parse({
        ok: true,
        data: { hotel },
        error: null,
      }),
    ).toMatchObject({ data: { hotel: { version: 1 } } });
  });
});
