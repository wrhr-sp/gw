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
  hotelAssignmentListResponseSchema,
  hotelAssignmentMutationResponseSchema,
  hotelActivationMutationResponseSchema,
  hotelCandidateQuerySchema,
  hotelEligibleCandidatesResponseSchema,
  hotelOwnerRelationshipsResponseSchema,
  hotelUserTypeSchema,
  endHotelAssignmentRequestSchema,
  initialPasswordRequestSchema,
  loginIdSchema,
  passwordPolicySchema,
  ownerTransferRequestSchema,
  changeHotelRoomStatusRequestSchema,
  createHotelRoomRequestSchema,
  createHotelRoomTypeRequestSchema,
  createInspectionChecklistRevisionRequestSchema,
  createInspectionRoutineRequestSchema,
  createManualInspectionRequestSchema,
  createProcessDefinitionRequestSchema,
  processDefaultResponseSchema,
  processReviewerCandidatesResponseSchema,
  deleteHotelRoomRequestSchema,
  hotelFileRoutes,
  hotelFileUploadCompleteRequestSchema,
  hotelFileUploadInitRequestSchema,
  hotelFileUploadStatusResponseSchema,
  inspectionRoutes,
  processRoutes,
  saveInspectionItemResultRequestSchema,
  submitInspectionRequestSchema,
  transitionProcessExecutionRequestSchema,
  hotelRoomInternalDetailResponseSchema,
  hotelRoomInternalListResponseSchema,
  hotelRoomInternalSchema,
  hotelRoomListQuerySchema,
  hotelRoomOwnerDetailResponseSchema,
  hotelRoomOwnerSchema,
  hotelRoomStatusSchema,
  updateHotelRoomRequestSchema,
  updateHotelRoomTypeRequestSchema,
} from "../src/index";

describe("hotel platform contracts", () => {
  it("keeps room inputs strict, versioned, and reasoned", () => {
    expect(hotelRoomStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
    expect(hotelRoomStatusSchema.parse("INACTIVE")).toBe("INACTIVE");
    expect(hotelRoomStatusSchema.parse("DELETED")).toBe("DELETED");
    expect(hotelRoomStatusSchema.safeParse("TEMP_SUSPENDED").success).toBe(
      false,
    );
    expect(hotelRoomStatusSchema.safeParse("OUT_OF_SERVICE").success).toBe(
      false,
    );
    expect(
      createHotelRoomTypeRequestSchema.parse({
        name: "디럭스 더블",
        scope: "HOTEL",
        displayOrder: 10,
      }),
    ).toMatchObject({ scope: "HOTEL", isActive: true });
    expect(
      createHotelRoomRequestSchema.parse({
        roomNumber: "1201",
        floorLabel: "12층",
        floorSortKey: 12,
        roomTypeId: "70000000-0000-4000-8000-000000000001",
        internalNote: "내부 점검 필요",
        ownerVisibleNote: "창가 객실",
      }),
    ).toMatchObject({ roomNumber: "1201", floorSortKey: 12 });
    expect(
      createHotelRoomRequestSchema.parse({
        roomNumber: " b01 ",
        floorLabel: "B1",
        floorSortKey: -1,
        roomTypeId: "70000000-0000-4000-8000-000000000001",
        internalNote: null,
        ownerVisibleNote: null,
      }).roomNumber,
    ).toBe("B01");
    for (const roomNumber of ["\u00a0b01\u00a0", "ß01", "객실101"]) {
      expect(
        createHotelRoomRequestSchema.safeParse({
          roomNumber,
          floorLabel: "1층",
          floorSortKey: 1,
          roomTypeId: "70000000-0000-4000-8000-000000000001",
          internalNote: null,
          ownerVisibleNote: null,
        }).success,
      ).toBe(false);
    }
    expect(
      hotelRoomListQuerySchema.safeParse({ status: "DELETED" }).success,
    ).toBe(false);
    expect(
      updateHotelRoomRequestSchema.safeParse({
        version: 2,
        roomNumber: "1201",
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      changeHotelRoomStatusRequestSchema.safeParse({
        version: 1,
        status: "INACTIVE",
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      changeHotelRoomStatusRequestSchema.parse({
        version: 1,
        status: "INACTIVE",
        reason: "누수 보수",
      }).status,
    ).toBe("INACTIVE");
    expect(
      changeHotelRoomStatusRequestSchema.safeParse({
        version: 1,
        status: "INACTIVE",
        reason: "누수 보수",
        plannedResumeDate: "2026-08-01",
      }).success,
    ).toBe(false);
    expect(
      changeHotelRoomStatusRequestSchema.safeParse({
        version: 1,
        status: "DELETED",
        reason: "영구 종료",
      }).success,
    ).toBe(false);
    expect(
      deleteHotelRoomRequestSchema.parse({
        version: 2,
        reason: "객실 기준정보 삭제",
      }),
    ).toEqual({ version: 2, reason: "객실 기준정보 삭제" });
  });

  it("returns all room field issues with user-facing Korean messages", () => {
    const parsed = createHotelRoomRequestSchema.safeParse({
      roomNumber: " ",
      floorLabel: " ",
      floorSortKey: 1.5,
      roomTypeId: "",
      internalNote: "가".repeat(1001),
      ownerVisibleNote: null,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("invalid room input was accepted");
    expect(parsed.error.issues.map((issue) => String(issue.path[0]))).toEqual([
      "roomNumber",
      "floorLabel",
      "floorSortKey",
      "roomTypeId",
      "internalNote",
    ]);
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual([
      "객실번호를 입력해 주세요.",
      "층 표시를 입력해 주세요.",
      "층 정렬순서는 정수여야 합니다.",
      "객실유형을 선택해 주세요.",
      "객실 메모는 1,000자 이하여야 합니다.",
    ]);
    const roomTypeUpdate = updateHotelRoomTypeRequestSchema.safeParse({
      displayOrder: Number.NaN,
      version: 1,
    });
    expect(roomTypeUpdate.success).toBe(false);
    if (roomTypeUpdate.success)
      throw new Error("invalid room type display order was accepted");
    expect(roomTypeUpdate.error.issues[0]).toMatchObject({
      path: ["displayOrder"],
      message: "정렬순서를 숫자로 입력해 주세요.",
    });
  });

  it("separates internal room notes from owner projections", () => {
    const room = {
      id: "71000000-0000-4000-8000-000000000001",
      hotelId: "50000000-0000-4000-8000-000000000001",
      roomNumber: "1201",
      floorLabel: "12층",
      floorSortKey: 12,
      roomType: {
        id: "70000000-0000-4000-8000-000000000001",
        name: "디럭스 더블",
        scope: "HOTEL" as const,
      },
      status: "ACTIVE" as const,
      ownerVisibleNote: "창가 객실",
      version: 1,
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
    };
    expect(
      hotelRoomInternalSchema.parse({ ...room, internalNote: "내부 점검 필요" })
        .internalNote,
    ).toBe("내부 점검 필요");
    expect(
      hotelRoomOwnerSchema.safeParse({ ...room, internalNote: "노출 금지" })
        .success,
    ).toBe(false);
    expect(
      hotelRoomInternalDetailResponseSchema.parse({
        ok: true,
        data: { room: { ...room, internalNote: "내부 점검 필요" } },
        error: null,
      }).data.room.internalNote,
    ).toBe("내부 점검 필요");
    expect(
      hotelRoomOwnerDetailResponseSchema.safeParse({
        ok: true,
        data: { room: { ...room, internalNote: "노출 금지" } },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      hotelRoomInternalListResponseSchema.parse({
        ok: true,
        data: {
          capabilities: { canManage: true, canManageTypes: false },
          rooms: [{ ...room, internalNote: "내부 점검 필요" }],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        error: null,
      }).data.capabilities,
    ).toEqual({ canManage: true, canManageTypes: false });
    expect(
      hotelRoomInternalListResponseSchema.safeParse({
        ok: true,
        data: {
          rooms: [{ ...room, internalNote: "내부 점검 필요" }],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        error: null,
      }).success,
    ).toBe(false);
    expect(hotelRoomListQuerySchema.parse({ q: "12" })).toMatchObject({
      q: "12",
      page: 1,
      pageSize: 20,
    });
    expect(hotelRoomListQuerySchema.parse({ q: "  1201  " }).q).toBe("1201");
    expect(hotelRoomListQuerySchema.safeParse({ q: "   " }).success).toBe(
      false,
    );
    expect(hotelRoutes.roomTypes(room.hotelId)).toBe(
      `/api/hotels/${room.hotelId}/room-types`,
    );
    expect(hotelRoutes.roomStatus(room.hotelId, room.id)).toBe(
      `/api/hotels/${room.hotelId}/rooms/${room.id}/status`,
    );
    expect(hotelRoutes.roomDelete(room.hotelId, room.id)).toBe(
      `/api/hotels/${room.hotelId}/rooms/${room.id}/delete`,
    );
  });

  it("keeps relationship candidate queries strict and relationship-specific", () => {
    expect(
      hotelCandidateQuerySchema.parse({
        relationshipType: "STAFF",
        assignmentType: "PRIMARY",
        startDate: "2026-07-24",
      }),
    ).toMatchObject({ page: 1, pageSize: 20 });
    expect(
      hotelCandidateQuerySchema.safeParse({
        relationshipType: "STAFF",
        startDate: "2026-07-24",
      }).success,
    ).toBe(false);
    expect(
      hotelCandidateQuerySchema.safeParse({
        relationshipType: "OWNER",
        assignmentType: "PRIMARY",
        startDate: "2026-07-24",
      }).success,
    ).toBe(false);
    expect(
      hotelCandidateQuerySchema.parse({ relationshipType: "OWNER" }),
    ).toMatchObject({ relationshipType: "OWNER", page: 1, pageSize: 20 });
    expect(
      hotelCandidateQuerySchema.safeParse({
        relationshipType: "OWNER",
        startDate: "2026-07-24",
      }).success,
    ).toBe(false);
    expect(
      hotelCandidateQuerySchema.safeParse({
        relationshipType: "HOUSEKEEPING",
        startDate: "2026-07-24",
        companyId: "10000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("exposes only minimal relationship display data with pagination", () => {
    const assignment = {
      id: "60000000-0000-4000-8000-000000000001",
      hotelId: "50000000-0000-4000-8000-000000000001",
      userId: "20000000-0000-4000-8000-000000000001",
      relationshipType: "STAFF" as const,
      assignmentType: "PRIMARY" as const,
      startDate: "2026-07-24",
      endDate: null,
      reason: "기본 배정",
      terminatedAt: null,
      terminationReason: null,
      version: 1,
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      assignee: {
        userId: "20000000-0000-4000-8000-000000000001",
        displayName: "김민수",
        userType: "INTERNAL_STAFF" as const,
      },
    };
    const { assignee, ...mutationAssignment } = assignment;
    expect(assignee.displayName).toBe("김민수");
    expect(
      hotelAssignmentListResponseSchema.parse({
        ok: true,
        data: { assignments: [assignment] },
        error: null,
      }).data.assignments[0]?.assignee.displayName,
    ).toBe("김민수");
    expect(
      hotelAssignmentMutationResponseSchema.parse({
        ok: true,
        data: { assignment: mutationAssignment },
        error: null,
      }).data.assignment.id,
    ).toBe(assignment.id);
    expect(
      hotelAssignmentMutationResponseSchema.safeParse({
        ok: true,
        data: { assignment },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      hotelOwnerRelationshipsResponseSchema.parse({
        ok: true,
        data: {
          owners: [
            { ...assignment, relationshipType: "OWNER", assignmentType: null },
          ],
        },
        error: null,
      }).data.owners,
    ).toHaveLength(1);
    expect(
      hotelEligibleCandidatesResponseSchema.parse({
        ok: true,
        data: {
          candidates: [assignment.assignee],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        error: null,
      }).data.candidates[0],
    ).not.toHaveProperty("email");
    expect(hotelRoutes.owner(assignment.hotelId)).toContain("/owner");
    expect(hotelRoutes.eligibleCandidates(assignment.hotelId)).toContain(
      "/eligible-candidates",
    );
  });

  it("defines Phase A relationship mutations without scheduled owner transfer", () => {
    expect(
      hotelActivationMutationResponseSchema.safeParse({
        ok: true,
        data: {},
        error: null,
      }).success,
    ).toBe(false);
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

  it("validates a configured review graph instead of hard-coding stages", () => {
    const definition = {
      name: "객실 점검 공통검토",
      applicationType: "ROOM_INSPECTION",
      scope: "COMPANY",
      hotelId: null,
      version: 0,
      startStageKey: "MANAGER_REVIEW",
      stages: [
        {
          key: "MANAGER_REVIEW",
          name: "관리자 검토",
          reviewerUserId: "20000000-0000-4000-8000-000000000001",
          delegate: null,
          due: { amount: 1, unit: "DAYS" },
          isFinal: false,
        },
        {
          key: "FINAL_REVIEW",
          name: "최종 검토",
          reviewerUserId: "20000000-0000-4000-8000-000000000002",
          delegate: null,
          due: null,
          isFinal: true,
        },
      ],
      transitions: [
        {
          fromStageKey: "MANAGER_REVIEW",
          event: "APPROVE",
          choiceValue: null,
          toStageKey: "FINAL_REVIEW",
        },
      ],
    } as const;
    expect(
      createProcessDefinitionRequestSchema.parse(definition).stages,
    ).toHaveLength(2);
    expect(
      createProcessDefinitionRequestSchema.safeParse({
        ...definition,
        transitions: [
          {
            fromStageKey: "FINAL_REVIEW",
            event: "APPROVE",
            choiceValue: null,
            toStageKey: "MANAGER_REVIEW",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      createProcessDefinitionRequestSchema.safeParse({
        ...definition,
        stages: definition.stages.map((stage) => ({
          ...stage,
          isFinal: false,
        })),
      }).success,
    ).toBe(false);
  });

  it("keeps checklist and routine revisions strict and monthly missing dates skipped", () => {
    const roomTypeId = "70000000-0000-4000-8000-000000000001";
    expect(
      createInspectionChecklistRevisionRequestSchema.parse({
        version: 0,
        reason: "최초 점검기준 등록",
        items: [
          {
            itemId: null,
            source: "HOTEL_COMMON",
            roomTypeId: null,
            excludedRoomTypeIds: [roomTypeId],
            name: "욕실 누수",
            description: "배수구와 세면대 확인",
            isRequired: true,
            displayOrder: 1,
            defaultSeverity: "MAJOR",
          },
          {
            itemId: null,
            source: "ROOM_TYPE_ADDED",
            roomTypeId,
            excludedRoomTypeIds: [],
            name: "테라스 난간",
            description: null,
            isRequired: true,
            displayOrder: 2,
            defaultSeverity: "CRITICAL",
          },
        ],
      }).items,
    ).toHaveLength(2);
    expect(
      createInspectionChecklistRevisionRequestSchema.safeParse({
        version: 0,
        reason: "잘못된 기준",
        items: [
          {
            itemId: null,
            source: "HOTEL_COMMON",
            roomTypeId,
            excludedRoomTypeIds: [],
            name: "잘못된 항목",
            description: null,
            isRequired: true,
            displayOrder: 1,
            defaultSeverity: "MINOR",
          },
        ],
      }).success,
    ).toBe(false);
    const routine = createInspectionRoutineRequestSchema.parse({
      name: "월간 객실점검",
      status: "ACTIVE",
      version: 0,
      mode: "FIXED",
      recurrence: { type: "MONTHLY", dayOfMonth: 31 },
      startDate: "2026-08-01",
      endDate: null,
      localDueTime: "15:00",
      rounds: [
        { order: 1, target: { type: "ROOM_TYPE", roomTypeIds: [roomTypeId] } },
      ],
    });
    expect(routine.recurrence).toEqual({ type: "MONTHLY", dayOfMonth: 31 });
    expect(
      createInspectionRoutineRequestSchema.safeParse({
        ...routine,
        recurrence: {
          type: "MONTHLY",
          dayOfMonth: 31,
          missingDatePolicy: "LAST_DAY",
        },
      }).success,
    ).toBe(false);
  });

  it("requires evidence only for abnormal results and locks submissions to versions", () => {
    const itemSnapshotId = "81000000-0000-4000-8000-000000000001";
    expect(
      saveInspectionItemResultRequestSchema.parse({
        itemSnapshotId,
        version: 0,
        result: "NORMAL",
        description: null,
        severity: null,
        fileVersionIds: [],
        changeReason: null,
      }).result,
    ).toBe("NORMAL");
    expect(
      saveInspectionItemResultRequestSchema.safeParse({
        itemSnapshotId,
        version: 0,
        result: "ABNORMAL",
        description: "누수가 확인됨",
        severity: "MAJOR",
        fileVersionIds: [],
        changeReason: null,
      }).success,
    ).toBe(false);
    expect(
      saveInspectionItemResultRequestSchema.parse({
        itemSnapshotId,
        version: 0,
        result: "ABNORMAL",
        description: "누수가 확인됨",
        severity: "MAJOR",
        fileVersionIds: ["82000000-0000-4000-8000-000000000001"],
        changeReason: null,
      }).fileVersionIds,
    ).toHaveLength(1);
    expect(
      saveInspectionItemResultRequestSchema.safeParse({
        itemSnapshotId,
        version: 1,
        result: "CAUTION",
        description: "경미한 변색",
        severity: null,
        fileVersionIds: [],
        changeReason: null,
      }).success,
    ).toBe(false);
    expect(
      submitInspectionRequestSchema.parse({
        version: 2,
        reason: "현장점검 완료",
      }),
    ).toEqual({ version: 2, reason: "현장점검 완료" });
  });

  it("accepts only minimal process reviewer candidate fields", () => {
    expect(
      processReviewerCandidatesResponseSchema.parse({
        ok: true,
        data: {
          candidates: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              displayName: "검토 담당자",
            },
          ],
        },
        error: null,
      }).data.candidates,
    ).toHaveLength(1);
    expect(
      processReviewerCandidatesResponseSchema.safeParse({
        ok: true,
        data: {
          candidates: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              displayName: "검토 담당자",
              email: "not-allowed@example.test",
            },
          ],
        },
        error: null,
      }).success,
    ).toBe(false);
  });

  it("requires a versioned canonical hotel process default snapshot", () => {
    expect(
      processDefaultResponseSchema.parse({
        ok: true,
        data: { default: null },
        error: null,
      }).data.default,
    ).toBeNull();
    expect(
      processDefaultResponseSchema.safeParse({
        ok: true,
        data: {
          default: {
            hotelId: "82000000-0000-4000-8000-000000000001",
            applicationType: "ROOM_INSPECTION",
            definition: {},
            updatedAt: "2026-08-02T00:00:00.000Z",
          },
        },
        error: null,
      }).success,
    ).toBe(false);
  });

  it("validates manual targets and process transition events", () => {
    expect(
      createManualInspectionRequestSchema.parse({
        processDefinitionId: "83000000-0000-4000-8000-000000000001",
        targets: [
          {
            roomId: "84000000-0000-4000-8000-000000000001",
            selectedItemIds: ["85000000-0000-4000-8000-000000000001"],
          },
        ],
      }).targets,
    ).toHaveLength(1);
    expect(
      transitionProcessExecutionRequestSchema.safeParse({
        version: 1,
        event: "SELECT",
        choiceValue: null,
        reason: "다음 담당 선택",
      }).success,
    ).toBe(false);
    expect(
      transitionProcessExecutionRequestSchema.parse({
        version: 1,
        event: "APPROVE",
        choiceValue: null,
        reason: "검토 완료",
      }).event,
    ).toBe("APPROVE");
  });

  it("exposes same-origin private upload routes without storage internals", () => {
    const uploadId = "86000000-0000-4000-8000-000000000001";
    expect(hotelFileRoutes.uploadBody(uploadId)).toBe(
      `/api/files/uploads/${uploadId}/body`,
    );
    expect(inspectionRoutes.createManual("hotel_1")).toBe(
      "/api/hotels/hotel_1/inspections/manual",
    );
    expect(processRoutes.definitions).toBe("/api/admin/process-definitions");
    expect(
      hotelFileUploadInitRequestSchema.parse({
        parent: {
          type: "INSPECTION_ITEM_EVIDENCE",
          inspectionId: "87000000-0000-4000-8000-000000000001",
          itemSnapshotId: "88000000-0000-4000-8000-000000000001",
        },
        fileName: "욕실 누수 사진.jpg",
        sizeBytes: 1234,
        mimeType: "image/jpeg",
      }).mimeType,
    ).toBe("image/jpeg");
    for (const fileName of [
      "payload.exe.jpg",
      "../photo.jpg",
      "photo．jpg",
      "photo\u00a0.jpg",
    ]) {
      expect(
        hotelFileUploadInitRequestSchema.safeParse({
          parent: {
            type: "INSPECTION_ITEM_EVIDENCE",
            inspectionId: "87000000-0000-4000-8000-000000000001",
            itemSnapshotId: "88000000-0000-4000-8000-000000000001",
          },
          fileName,
          sizeBytes: 1234,
          mimeType: "image/jpeg",
        }).success,
      ).toBe(false);
    }
    expect(
      hotelFileUploadCompleteRequestSchema.parse({
        etag: '"0123456789abcdef0123456789abcdef"',
      }),
    ).toEqual({ etag: '"0123456789abcdef0123456789abcdef"' });
    expect(
      hotelFileUploadStatusResponseSchema.safeParse({
        ok: true,
        data: {
          upload: {
            id: uploadId,
            status: "QUARANTINED",
            fileVersionId: uploadId,
          },
        },
        error: null,
      }).success,
    ).toBe(false);
  });
});
