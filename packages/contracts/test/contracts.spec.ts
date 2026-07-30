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
  hotelRoomInternalDetailResponseSchema,
  hotelRoomInternalListResponseSchema,
  hotelRoomInternalSchema,
  hotelRoomListQuerySchema,
  hotelRoomOwnerDetailResponseSchema,
  hotelRoomOwnerSchema,
  hotelRoomStatusSchema,
  hotelFileAccessRequestSchema,
  hotelFileDownloadResponseSchema,
  hotelFileViewResponseSchema,
  hotelFileParentTypeSchema,
  hotelFileRoutes,
  hotelFileUploadBodyResponseSchema,
  hotelFileUploadCompleteRequestSchema,
  hotelFileUploadInitRequestSchema,
  hotelFileUploadInitResponseSchema,
  hotelFileUploadStateSchema,
  hotelFileUploadStatusResponseSchema,
  updateHotelRoomRequestSchema,
  updateHotelRoomTypeRequestSchema,
} from "../src/index";

describe("hotel platform contracts", () => {
  it("defines private fail-closed hotel file upload contracts", () => {
    expect(hotelFileParentTypeSchema.options).toEqual([
      "INSPECTION_RESULT",
      "DAILY_SALES",
      "OPERATIONAL_ISSUE",
      "OWNER_INQUIRY",
      "KNOWLEDGE_ARTICLE",
    ]);
    expect(hotelFileUploadStateSchema.options).toEqual([
      "PENDING_UPLOAD",
      "QUARANTINED",
      "SCANNING",
      "CLEAN_PENDING_PROMOTION",
      "READY_UNLINKED",
      "LINKED",
      "REJECTED",
      "SCAN_FAILED",
      "EXPIRED",
    ]);

    const init = hotelFileUploadInitRequestSchema.parse({
      hotelId: "50000000-0000-4000-8000-000000000001",
      parentType: "INSPECTION_RESULT",
      parentId: "51000000-0000-4000-8000-000000000001",
      fileName: "inspection-photo.jpg",
      sizeBytes: 1024,
      mimeType: "image/jpeg",
    });
    expect(init.fileName).toBe("inspection-photo.jpg");
    expect(
      hotelFileUploadInitRequestSchema.parse({
        ...init,
        fileName: "점검 사진(1).jpg",
      }).fileName,
    ).toBe("점검 사진(1).jpg");
    for (const fileName of [
      "../photo.jpg",
      "photo\\name.jpg",
      "photo\u0000.jpg",
      "photo\u0085.jpg",
      "photo\u200b.jpg",
      "photo\u202egpj.jpg",
      "payload.zip.jpg",
      "payload.py.jpg",
      "payload.vbs.jpg",
      "payload.pptm.jpg",
      "payload.txt.jpg",
      "payload.exe .jpg",
      "payload.exe\u00a0.jpg",
      "payload.exe\uff0ejpg.jpg",
      "payload.hta.jpg",
      "payload.cpl.jpg",
      "payload.lnk.jpg",
      "payload.url.jpg",
      "payload.reg.jpg",
      "payload.inf.jpg",
      "payload.scf.jpg",
      "payload。exe.jpg",
      "payload·exe.jpg",
      "payload💣.jpg",
    ]) {
      expect(
        hotelFileUploadInitRequestSchema.safeParse({ ...init, fileName }).success,
      ).toBe(false);
    }
    for (const sizeBytes of [0, -1, 1.5, 50_000_001]) {
      expect(
        hotelFileUploadInitRequestSchema.safeParse({
          ...init,
          parentType: "OWNER_INQUIRY",
          sizeBytes,
        }).success,
      ).toBe(false);
    }
    expect(
      hotelFileUploadInitRequestSchema.parse({
        ...init,
        fileName: "inspection-photo.heic",
        mimeType: "image/heic",
        sizeBytes: 20_000_000,
      }).mimeType,
    ).toBe("image/heic");
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        sizeBytes: 20_000_001,
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        parentType: "DAILY_SALES",
        fileName: "evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: 50_000_001,
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        fileName: "malware.exe",
        mimeType: "application/x-msdownload",
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        fileName: "renamed.pdf",
        mimeType: "image/jpeg",
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        fileName: "inspection.pdf",
        mimeType: "application/pdf",
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        parentType: "OWNER_INQUIRY",
        fileName: "message.txt",
        mimeType: "text/plain",
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        fileName: "malware.exe.jpg",
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadInitRequestSchema.safeParse({
        ...init,
        unexpectedObjectKey: "tenant/hotel/file",
      }).success,
    ).toBe(false);

    const upload = hotelFileUploadInitResponseSchema.parse({
      ok: true,
      data: {
        upload: {
          id: "52000000-0000-4000-8000-000000000001",
          state: "PENDING_UPLOAD",
          method: "PUT",
          uploadUrl: "https://upload.invalid/signed",
          requiredHeaders: {
            "Content-Type": "image/jpeg",
            "If-None-Match": "*",
          },
          expiresAt: "2026-07-29T01:05:00.000Z",
          expiresInSeconds: 300,
        },
      },
      error: null,
    }).data.upload;
    expect(upload.requiredHeaders["If-None-Match"]).toBe("*");
    expect(upload).not.toHaveProperty("objectKey");
    expect(
      hotelFileUploadInitResponseSchema.safeParse({
        ok: true,
        data: {
          upload: {
            ...upload,
            uploadUrl: "http://upload.invalid/signed",
          },
        },
        error: null,
      }).success,
    ).toBe(false);

    expect(
      hotelFileUploadCompleteRequestSchema.parse({
        etag: '"0123456789abcdef0123456789abcdef"',
      }).etag,
    ).toBe('"0123456789abcdef0123456789abcdef"');
    expect(
      hotelFileUploadCompleteRequestSchema.safeParse({
        etag: '"0123456789abcdef0123456789abcdef"',
        sizeBytes: 1024,
      }).success,
    ).toBe(false);
    expect(
      hotelFileUploadBodyResponseSchema.parse({
        ok: true,
        data: {
          upload: {
            id: "52000000-0000-4000-8000-000000000001",
            etag: '"0123456789abcdef0123456789abcdef"',
          },
        },
        error: null,
      }).data.upload.etag,
    ).toBe('"0123456789abcdef0123456789abcdef"');
    expect(
      hotelFileRoutes.uploadBody("52000000-0000-4000-8000-000000000001"),
    ).toBe(
      "/api/hotel-files/52000000-0000-4000-8000-000000000001/upload-body",
    );
    expect(
      hotelFileUploadStatusResponseSchema.safeParse({
        ok: true,
        data: {
          upload: {
            id: "52000000-0000-4000-8000-000000000001",
            state: "READY_UNLINKED",
            fileVersionId: null,
            failureCode: null,
            updatedAt: "2026-07-29T01:06:00.000Z",
          },
        },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      hotelFileAccessRequestSchema.parse({
        parentType: "INSPECTION_RESULT",
        parentId: "51000000-0000-4000-8000-000000000001",
      }).parentType,
    ).toBe("INSPECTION_RESULT");
    expect(hotelFileRoutes.view("53000000-0000-4000-8000-000000000001")).toBe(
      "/api/hotel-files/53000000-0000-4000-8000-000000000001/view",
    );
    expect(
      hotelFileRoutes.download("53000000-0000-4000-8000-000000000001"),
    ).toBe(
      "/api/hotel-files/53000000-0000-4000-8000-000000000001/download",
    );
    expect(() => hotelFileRoutes.view("..")).toThrow();
    expect(
      hotelFileRoutes.access("54000000-0000-4000-8000-000000000001"),
    ).toBe(
      "/api/hotel-files/access/54000000-0000-4000-8000-000000000001",
    );
    expect(
      hotelFileRoutes.access("54000000-0000-4000-8000-000000000001"),
    ).not.toContain("?");
    expect(
      hotelFileViewResponseSchema.safeParse({
        ok: true,
        data: {
          accessUrl: "https://files.invalid/signed",
          disposition: "VIEW",
          expiresAt: "2026-07-29T01:05:00.000Z",
          expiresInSeconds: 300,
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      hotelFileViewResponseSchema.safeParse({
        ok: true,
        data: {
          accessUrl: "https://files.invalid/signed",
          disposition: "VIEW",
          expiresAt: "2026-07-29T01:06:00.000Z",
          expiresInSeconds: 301,
        },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      hotelFileDownloadResponseSchema.safeParse({
        ok: true,
        data: {
          accessUrl: "https://files.invalid/signed",
          disposition: "VIEW",
          expiresAt: "2026-07-29T01:05:00.000Z",
          expiresInSeconds: 300,
        },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      hotelFileDownloadResponseSchema.safeParse({
        ok: true,
        data: {
          accessUrl: "https://files.invalid/signed",
          disposition: "DOWNLOAD",
          expiresAt: "2026-07-29T01:05:00.000Z",
          expiresInSeconds: 300,
        },
        error: null,
      }).success,
    ).toBe(true);
  });

  it("binds terminal file failure codes to their exact states", () => {
    const base = {
      id: "52000000-0000-4000-8000-000000000001",
      fileVersionId: null,
      updatedAt: "2026-07-29T01:06:00.000Z",
    };
    for (const [state, failureCode] of [
      ["REJECTED", "MALWARE_DETECTED"],
      ["SCAN_FAILED", "SCAN_ENGINE_UNAVAILABLE"],
      ["EXPIRED", "UPLOAD_EXPIRED"],
    ] as const) {
      expect(
        hotelFileUploadStatusResponseSchema.safeParse({
          ok: true,
          data: { upload: { ...base, state, failureCode } },
          error: null,
        }).success,
      ).toBe(true);
    }
    for (const [state, failureCode] of [
      ["REJECTED", "UPLOAD_EXPIRED"],
      ["EXPIRED", "MALWARE_DETECTED"],
      ["SCANNING", "SCAN_ENGINE_UNAVAILABLE"],
    ] as const) {
      expect(
        hotelFileUploadStatusResponseSchema.safeParse({
          ok: true,
          data: { upload: { ...base, state, failureCode } },
          error: null,
        }).success,
      ).toBe(false);
    }
    expect(
      hotelFileUploadStatusResponseSchema.safeParse({
        ok: true,
        data: {
          upload: {
            ...base,
            state: "READY_UNLINKED",
            fileVersionId: "53000000-0000-4000-8000-000000000001",
            failureCode: null,
          },
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      hotelFileUploadStatusResponseSchema.safeParse({
        ok: true,
        data: {
          upload: {
            ...base,
            state: "SCANNING",
            failureCode: null,
            objectKey: "opaque-but-internal",
          },
        },
        error: null,
      }).success,
    ).toBe(false);
  });

  it("keeps room inputs strict, versioned, and reasoned", () => {
    expect(hotelRoomStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
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
      updateHotelRoomRequestSchema.safeParse({
        version: 2,
        roomNumber: "1201",
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      changeHotelRoomStatusRequestSchema.safeParse({
        version: 1,
        status: "TEMP_SUSPENDED",
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      changeHotelRoomStatusRequestSchema.parse({
        version: 1,
        status: "OUT_OF_SERVICE",
        reason: "누수 보수",
        plannedResumeDate: "2026-08-01",
      }).status,
    ).toBe("OUT_OF_SERVICE");
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
      plannedResumeDate: null,
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
});
