import { describe, expect, it } from "vitest";
import {
  accountRoutes,
  accountCapabilitiesResponseSchema,
  accountEligibleHotelsResponseSchema,
  calendarCapabilitiesResponseSchema,
  calendarEventSchema,
  calendarEventsQuerySchema,
  calendarEventsResponseSchema,
  calendarRoutes,
  calendarVisitOptionsResponseSchema,
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
  changeHotelFacilityReferenceStatusRequestSchema,
  createHotelCommonAreaRequestSchema,
  createHotelFacilityRequestSchema,
  createHotelFacilityTypeRequestSchema,
  deleteHotelFacilityReferenceRequestSchema,
  hotelFacilityListQuerySchema,
  hotelFacilityLocationSchema,
  hotelFacilityReferenceStatusSchema,
  hotelFacilityWorkspaceResponseSchema,
  createHotelRoomRequestSchema,
  createHotelRoomTypeRequestSchema,
  createInspectionChecklistRevisionRequestSchema,
  createInspectionChecklistRevisionV2RequestSchema,
  inspectionChecklistTargetTypeSchema,
  createInspectionRoutineRequestSchema,
  createInspectionRoutineV2RequestSchema,
  inspectionRoutineListResponseSchema,
  createManualInspectionRequestSchema,
  createManualInspectionV2RequestSchema,
  createProcessDefinitionRequestSchema,
  createRepairCaseRequestSchema,
  createRepairVisitRequestSchema,
  completeRepairVisitRequestSchema,
  completeRepairCaseRequestSchema,
  repairCaseReadSchema,
  repairCaseResponseSchema,
  repairPriorityListResponseSchema,
  repairRoutes,
  repairVisitResponseSchema,
  processDefaultResponseSchema,
  processReviewerCandidatesResponseSchema,
  deleteHotelRoomRequestSchema,
  hotelFileRoutes,
  hotelFileUploadCompleteRequestSchema,
  hotelFileUploadInitRequestSchema,
  hotelFileUploadStatusResponseSchema,
  inspectionExecutionListQuerySchema,
  inspectionExecutionV2Schema,
  inspectionReviewHistorySchema,
  inspectionReviewListQuerySchema,
  inspectionReviewListResponseSchema,
  inspectionReviewResponseSchema,
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
  createOperationalIssueRequestSchema,
  operationalIssueActionRequestSchema,
  operationalIssueAddEntryRequestSchema,
  operationalIssueAssigneeRequestSchema,
  operationalIssueCapabilitiesResponseSchema,
  operationalIssueInternalResponseSchema,
  operationalIssueListQuerySchema,
  operationalIssueOwnerResponseSchema,
  operationalIssueRoutes,
  operationalIssueSeveritySchema,
  operationalIssueStatusSchema,
  createDailySalesDraftRequestSchema,
  updateDailySalesDraftRequestSchema,
  confirmDailySalesRequestSchema,
  correctDailySalesRequestSchema,
  dailySalesInternalResponseSchema,
  dailySalesOwnerResponseSchema,
  dailySalesListResponseSchema,
  dailySalesCapabilitiesResponseSchema,
  dailySalesRoutes,
} from "../src/index";

describe("hotel platform contracts", () => {
  it("defines strict daily-sales money, lock, correction, owner, and route contracts", () => {
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const salesId = "da500000-0000-4000-8000-000000000001";
    const categoryId = "da510000-0000-4000-8000-000000000001";
    const paymentMethodId = "da520000-0000-4000-8000-000000000001";
    const evidenceId = "da530000-0000-4000-8000-000000000001";
    const line = { categoryId, paymentMethodId, grossAmount: 150000, discountAmount: 10000, refundAmount: 5000, refundReason: "고객 요청 당일 환불" };
    const draft = createDailySalesDraftRequestSchema.parse({ salesId, businessDate: "2026-08-13", memo: "주간 마감", lines: [line] });
    expect(draft.lines[0]).toMatchObject({ grossAmount: 150000, refundAmount: 5000 });
    expect(createDailySalesDraftRequestSchema.safeParse({ ...draft, lines: [{ ...line, grossAmount: 1.5 }] }).success).toBe(false);
    expect(createDailySalesDraftRequestSchema.safeParse({ ...draft, lines: [{ ...line, refundReason: null }] }).success).toBe(false);
    expect(updateDailySalesDraftRequestSchema.safeParse({ version: 1, memo: null, lines: [{ ...line, refundAmount: 0, refundReason: null }] }).success).toBe(true);
    expect(confirmDailySalesRequestSchema.safeParse({ version: 2, evidenceFileVersionIds: [] }).success).toBe(false);
    expect(confirmDailySalesRequestSchema.safeParse({ version: 2, evidenceFileVersionIds: [evidenceId] }).success).toBe(true);
    expect(correctDailySalesRequestSchema.safeParse({ version: 3, reason: "마감자료 정정", evidenceFileVersionIds: [], memo: null, lines: [line] }).success).toBe(false);
    expect(correctDailySalesRequestSchema.safeParse({ version: 3, reason: "마감자료 정정", evidenceFileVersionIds: [evidenceId], memo: null, lines: [line] }).success).toBe(true);

    const publicSales = { id: salesId, hotelId, businessDate: "2026-08-13", status: "LOCKED", version: 3, totals: { grossAmount: 150000, discountAmount: 10000, refundAmount: 5000, netAmount: 135000 }, lines: [line], evidence: [{ fileVersionId: evidenceId, displayName: "마감증빙.png" }], corrections: [], confirmedAt: "2026-08-13T12:00:00.000Z", updatedAt: "2026-08-13T12:00:00.000Z" };
    expect(dailySalesOwnerResponseSchema.safeParse({ ok: true, data: { sales: publicSales }, error: null }).success).toBe(true);
    expect(dailySalesOwnerResponseSchema.safeParse({ ok: true, data: { sales: { ...publicSales, internalMemo: "비공개", actorUserId: evidenceId } }, error: null }).success).toBe(false);
    expect(dailySalesInternalResponseSchema.safeParse({ ok: true, data: { sales: { ...publicSales, internalMemo: "주간 마감", createdBy: { userId: evidenceId, displayName: "운영 담당" } } }, error: null }).success).toBe(true);
    expect(dailySalesListResponseSchema.safeParse({ ok: true, data: { sales: [publicSales], pagination: { page: 1, pageSize: 20, total: 1 } }, error: null }).success).toBe(true);
    expect(dailySalesCapabilitiesResponseSchema.safeParse({ ok: true, data: { hotels: [{ hotelId, hotelName: "서울호텔", canRead: true, canManage: true, canConfirm: true, canCorrect: true, ownerView: false }] }, error: null }).success).toBe(true);
    expect(dailySalesRoutes.list(hotelId)).toBe(`/api/hotels/${hotelId}/daily-sales`);
    expect(dailySalesRoutes.detail(hotelId, salesId)).toBe(`/api/hotels/${hotelId}/daily-sales/${salesId}`);
    expect(dailySalesRoutes.confirm(hotelId, salesId)).toBe(`/api/hotels/${hotelId}/daily-sales/${salesId}/confirm`);
    expect(dailySalesRoutes.corrections(hotelId, salesId)).toBe(`/api/hotels/${hotelId}/daily-sales/${salesId}/corrections`);
  });
  it("keeps facility inspection execution additive, typed, and strict", () => {
    const roomId = "52000000-0000-4000-8000-000000000001";
    const facilityId = "55000000-0000-4000-8000-000000000001";
    const facilityTypeId = "53000000-0000-4000-8000-000000000001";
    const itemId = "56000000-0000-4000-8000-000000000001";

    expect(
      createManualInspectionV2RequestSchema
        .parse({
          processDefinitionId: null,
          targets: [
            { type: "ROOM", roomId, selectedItemIds: [itemId] },
            { type: "FACILITY", facilityId, selectedItemIds: [itemId] },
          ],
        })
        .targets.map((target) => target.type),
    ).toEqual(["ROOM", "FACILITY"]);
    expect(
      createManualInspectionV2RequestSchema.safeParse({
        processDefinitionId: null,
        targets: [
          { type: "FACILITY", facilityId, roomId, selectedItemIds: [itemId] },
        ],
      }).success,
    ).toBe(false);
    expect(
      createManualInspectionV2RequestSchema.safeParse({
        processDefinitionId: null,
        targets: [
          { type: "FACILITY", facilityId, selectedItemIds: [itemId] },
          { type: "FACILITY", facilityId, selectedItemIds: [itemId] },
        ],
      }).success,
    ).toBe(false);

    expect(
      createInspectionRoutineV2RequestSchema.parse({
        name: "시설물 월간점검",
        status: "ACTIVE",
        version: 0,
        mode: "FIXED",
        recurrence: { type: "MONTHLY", dayOfMonth: 1 },
        startDate: "2026-08-05",
        endDate: null,
        localDueTime: "15:00",
        processDefinitionId: null,
        rounds: [
          {
            order: 1,
            target: {
              type: "FACILITY_TYPES",
              facilityTypeIds: [facilityTypeId],
            },
          },
        ],
      }).rounds[0]?.target.type,
    ).toBe("FACILITY_TYPES");
    expect(
      createInspectionRoutineV2RequestSchema.safeParse({
        name: "잘못된 혼합",
        status: "ACTIVE",
        version: 0,
        mode: "FIXED",
        recurrence: { type: "DAILY" },
        startDate: "2026-08-05",
        endDate: null,
        localDueTime: "15:00",
        processDefinitionId: null,
        rounds: [
          {
            order: 1,
            target: {
              type: "FACILITIES",
              facilityIds: [facilityId],
              roomIds: [roomId],
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(inspectionRoutes.routinesV2(roomId)).toContain(
      "/inspection-routines/v2",
    );
    expect(inspectionRoutes.listV2(roomId)).toContain("/inspections/v2");
    expect(inspectionRoutes.createManualV2(roomId)).toContain(
      "/inspections/v2/manual",
    );
    expect(inspectionRoutes.detailV2(roomId, facilityId)).toContain(
      `/inspections/v2/${facilityId}`,
    );
    expect(
      inspectionExecutionV2Schema.safeParse({
        id: roomId,
        hotelId: roomId,
      }).success,
    ).toBe(false);
    expect(
      inspectionExecutionV2Schema.shape.items.element.shape.result
        .unwrap()
        .parse({
          id: itemId,
          result: "ABNORMAL",
          description: "누수가 확인됨",
          severity: "MAJOR",
          fileVersionIds: [],
          version: 1,
        }).id,
    ).toBe(itemId);
  });

  it("keeps facility master data typed, versioned, and lifecycle-safe", () => {
    expect(hotelFacilityReferenceStatusSchema.options).toEqual([
      "ACTIVE",
      "INACTIVE",
      "DELETED",
    ]);
    expect(
      createHotelCommonAreaRequestSchema.parse({ name: "  로비  " }),
    ).toEqual({ name: "로비" });
    expect(
      createHotelFacilityTypeRequestSchema.parse({ name: " 소방설비 " }),
    ).toEqual({ name: "소방설비" });
    const roomLocation = hotelFacilityLocationSchema.parse({
      type: "ROOM",
      roomId: "52000000-0000-4000-8000-000000000001",
    });
    expect(roomLocation).toEqual({
      type: "ROOM",
      roomId: "52000000-0000-4000-8000-000000000001",
    });
    expect(
      hotelFacilityLocationSchema.safeParse({
        type: "ROOM",
        roomId: "52000000-0000-4000-8000-000000000001",
        commonAreaId: "54000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
    expect(
      createHotelFacilityRequestSchema.parse({
        name: "  소화기  ",
        facilityTypeId: "53000000-0000-4000-8000-000000000001",
        location: roomLocation,
      }),
    ).toMatchObject({ name: "소화기", location: roomLocation });
    expect(
      changeHotelFacilityReferenceStatusRequestSchema.safeParse({
        status: "DELETED",
        reason: "삭제",
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      deleteHotelFacilityReferenceRequestSchema.parse({
        reason: "더 이상 사용하지 않음",
        version: 1,
      }),
    ).toMatchObject({ version: 1 });
    expect(hotelFacilityListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(
      hotelFacilityWorkspaceResponseSchema.safeParse({
        ok: true,
        data: {},
        error: null,
      }).success,
    ).toBe(false);
  });

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
      "FILE_STORAGE_UNAVAILABLE",
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
    expect(hotelRoutes.assignments("hotel_1")).toBe(
      "/api/hotels/hotel_1/assignments",
    );
    expect("staffAssignments" in hotelRoutes).toBe(false);
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
    expect(
      createInspectionRoutineRequestSchema.safeParse({
        ...routine,
        mode: "ROTATING",
        rounds: [
          { order: 1, target: { type: "HOTEL" } },
          { order: 3, target: { type: "HOTEL" } },
        ],
      }).success,
    ).toBe(false);
    expect(
      inspectionRoutineListResponseSchema.parse({
        ok: true,
        data: {
          routines: [
            {
              id: "83000000-0000-4000-8000-000000000001",
              hotelId: "50000000-0000-4000-8000-000000000001",
              name: routine.name,
              status: "ACTIVE",
              version: 1,
              nextDueDate: "2026-08-31",
              materializedThroughDate: null,
              revision: {
                id: "84000000-0000-4000-8000-000000000001",
                version: 1,
                mode: "FIXED",
                recurrence: routine.recurrence,
                startDate: routine.startDate,
                endDate: null,
                localDueTime: routine.localDueTime,
                processDefinitionId: "85000000-0000-4000-8000-000000000001",
                processRevisionId: "86000000-0000-4000-8000-000000000001",
                checklistRevisionId: "87000000-0000-4000-8000-000000000001",
                rounds: [
                  {
                    id: "88000000-0000-4000-8000-000000000001",
                    order: 1,
                    target: routine.rounds[0]!.target,
                  },
                ],
              },
              createdAt: "2026-08-02T00:00:00.000Z",
              updatedAt: "2026-08-02T00:00:00.000Z",
            },
          ],
        },
        error: null,
      }).data.routines,
    ).toHaveLength(1);
  });

  it("keeps the additive checklist v2 target union typed and cross-target safe", () => {
    const facilityTypeId = "53000000-0000-4000-8000-000000000001";
    const existingItemId = "d8200000-0000-4000-8000-000000000001";
    expect(inspectionChecklistTargetTypeSchema.options).toEqual([
      "ROOM",
      "FACILITY",
    ]);
    const parsed = createInspectionChecklistRevisionV2RequestSchema.parse({
      version: 1,
      reason: "시설물 점검기준 추가",
      items: [
        {
          itemId: existingItemId,
          targetType: "ROOM",
          source: "HOTEL_COMMON",
          roomTypeId: null,
          excludedRoomTypeIds: [],
          name: "객실 공통 확인",
          description: null,
          isRequired: true,
          displayOrder: 5,
          defaultSeverity: "OBSERVATION",
        },
        {
          itemId: null,
          targetType: "FACILITY",
          source: "HOTEL_COMMON",
          facilityTypeId: null,
          excludedFacilityTypeIds: [facilityTypeId],
          name: "외관 손상",
          description: null,
          isRequired: true,
          displayOrder: 10,
          defaultSeverity: "MAJOR",
        },
        {
          itemId: null,
          targetType: "FACILITY",
          source: "TARGET_TYPE_ADDED",
          facilityTypeId,
          excludedFacilityTypeIds: [],
          name: "소화기 압력",
          description: "압력계 정상범위를 확인합니다.",
          isRequired: true,
          displayOrder: 20,
          defaultSeverity: "CRITICAL",
        },
      ],
    });
    expect(parsed.items).toHaveLength(3);
    expect(parsed.items[0]?.itemId).toBe(existingItemId);
    expect(
      createInspectionChecklistRevisionV2RequestSchema.safeParse({
        version: 1,
        reason: "잘못된 교차대상",
        items: [
          {
            itemId: null,
            targetType: "FACILITY",
            source: "TARGET_TYPE_ADDED",
            roomTypeId: "70000000-0000-4000-8000-000000000001",
            facilityTypeId,
            excludedFacilityTypeIds: [],
            name: "잘못된 항목",
            description: null,
            isRequired: true,
            displayOrder: 10,
            defaultSeverity: "MAJOR",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("allows abnormal drafts without evidence and validates execution list filters", () => {
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
    ).toBe(true);
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
    expect(
      inspectionExecutionListQuerySchema.parse({
        page: "2",
        pageSize: "20",
        status: "PENDING_INPUT",
        source: "ROUTINE",
      }),
    ).toEqual({
      page: 2,
      pageSize: 20,
      source: "ROUTINE",
      status: "PENDING_INPUT",
    });
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

  it("accepts every persisted inspection execution history event", () => {
    for (const event of [
      "SUBMIT",
      "APPROVE",
      "REJECT",
      "SELECT",
      "CANCEL",
      "UNFINISHED_CLOSE",
    ]) {
      expect(
        inspectionReviewHistorySchema.safeParse({
          id: "92000000-0000-4000-8000-000000000001",
          previousState: "PENDING_INPUT",
          nextState: "IN_REVIEW",
          previousStageName: null,
          nextStageName: "하우스키핑 검토",
          event,
          reason: "상태 변경",
          actor: {
            id: "20000000-0000-4000-8000-000000000001",
            displayName: "김검토",
          },
          occurredAt: "2026-08-03T00:30:00.000Z",
        }).success,
      ).toBe(true);
    }
  });

  it("defines assigned inspection review routes and strict pagination", () => {
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const inspectionId = "91000000-0000-4000-8000-000000000001";
    const repairId = "a1000000-0000-4000-8000-000000000001";
    const fileVersionId = "99000000-0000-4000-8000-000000000001";
    expect(inspectionRoutes.reviews(hotelId)).toBe(
      `/api/hotels/${hotelId}/inspection-reviews`,
    );
    expect(inspectionRoutes.review(hotelId, inspectionId)).toBe(
      `/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`,
    );
    expect(hotelFileRoutes.view(hotelId, inspectionId, fileVersionId)).toBe(
      `/api/hotels/${hotelId}/inspections/${inspectionId}/files/${fileVersionId}/view`,
    );
    expect(hotelFileRoutes.repairView(hotelId, repairId, fileVersionId)).toBe(
      `/api/hotels/${hotelId}/repairs/${repairId}/files/${fileVersionId}/view`,
    );
    expect(
      inspectionReviewListQuerySchema.parse({ page: "2", pageSize: "20" }),
    ).toEqual({ page: 2, pageSize: 20 });
    expect(
      inspectionReviewListQuerySchema.safeParse({
        page: 1,
        pageSize: 20,
        status: "COMPLETED",
      }).success,
    ).toBe(false);
    expect(
      inspectionReviewListResponseSchema.safeParse({
        ok: true,
        data: {
          reviews: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      inspectionReviewResponseSchema.safeParse({
        ok: true,
        data: {},
        error: null,
      }).success,
    ).toBe(false);
    const transitionBase = {
      choiceValue: null,
      event: "APPROVE",
      version: 1,
    } as const;
    expect(
      transitionProcessExecutionRequestSchema.safeParse({
        ...transitionBase,
        reason: "가",
      }).success,
    ).toBe(false);
    expect(
      transitionProcessExecutionRequestSchema.safeParse({
        ...transitionBase,
        reason: "확인",
      }).success,
    ).toBe(true);
    expect(
      transitionProcessExecutionRequestSchema.safeParse({
        ...transitionBase,
        reason: "가".repeat(500),
      }).success,
    ).toBe(true);
    expect(
      transitionProcessExecutionRequestSchema.safeParse({
        ...transitionBase,
        reason: "가".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("defines strict repair case, visit, completion and follow-up contracts", () => {
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const repairId = "a1000000-0000-4000-8000-000000000001";
    const visitId = "a2000000-0000-4000-8000-000000000001";
    const roomId = "52000000-0000-4000-8000-000000000001";
    const priorityId = "a3000000-0000-4000-8000-000000000001";
    const fileVersionId = "a4000000-0000-4000-8000-000000000001";

    expect(
      createRepairCaseRequestSchema.parse({
        repairCaseId: repairId,
        source: {
          type: "DIRECT",
          description: "욕실 배관 누수",
          fileVersionIds: [fileVersionId],
          unavailableReason: null,
        },
        target: { type: "ROOM", roomId },
        priorityId,
        followUpOfRepairCaseId: null,
        followUpParentVersion: null,
      }).target,
    ).toEqual({ type: "ROOM", roomId });
    expect(
      createRepairCaseRequestSchema.safeParse({
        source: {
          type: "DIRECT",
          description: "욕실 배관 누수",
          fileVersionIds: [],
          unavailableReason: null,
        },
        target: { type: "ROOM", roomId, facilityId: roomId },
        priorityId,
        followUpOfRepairCaseId: null,
        followUpParentVersion: null,
      }).success,
    ).toBe(false);

    expect(
      createRepairVisitRequestSchema.parse({
        repairCaseId: repairId,
        title: "누수 현장 진단",
        startsAt: "2026-08-07T01:00:00.000Z",
        endsAt: "2026-08-07T02:00:00.000Z",
        performer: {
          type: "EXTERNAL",
          contractorName: "승인업체",
          contactName: null,
          contactPhone: "010-0000-0000",
        },
      }).performer.type,
    ).toBe("EXTERNAL");
    expect(
      createRepairVisitRequestSchema.safeParse({
        repairCaseId: repairId,
        title: "누수 현장 진단",
        startsAt: "2026-08-07T02:00:00.000Z",
        endsAt: "2026-08-07T01:00:00.000Z",
        performer: { type: "INTERNAL", userId: roomId, contractorName: "혼합" },
      }).success,
    ).toBe(false);

    expect(
      completeRepairVisitRequestSchema.safeParse({
        version: 1,
        result: "배관 교체",
        fileVersionIds: [],
        unavailableReason: null,
      }).success,
    ).toBe(false);
    expect(
      completeRepairCaseRequestSchema.parse({ version: 2, processVersion: 3 })
        .processVersion,
    ).toBe(3);
    expect(repairRoutes.detail(hotelId, repairId)).toBe(
      `/api/hotels/${hotelId}/repairs/${repairId}`,
    );
    expect(repairRoutes.priorities(hotelId)).toBe(
      `/api/hotels/${hotelId}/repair-priorities`,
    );
    expect(
      repairPriorityListResponseSchema.safeParse({
        ok: true,
        data: {
          priorities: [
            {
              id: priorityId,
              version: 1,
              name: "긴급",
              sortOrder: 1,
              color: "#dc2626",
              status: "ACTIVE",
            },
          ],
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(repairRoutes.followUps(hotelId, repairId)).toBe(
      `/api/hotels/${hotelId}/repairs/${repairId}/follow-ups`,
    );
    expect(repairRoutes.visitComplete(hotelId, visitId)).toBe(
      `/api/hotels/${hotelId}/repair-visits/${visitId}/complete`,
    );
    const legacyRepair = {
      calendarProjectionStatus: "NOT_CONNECTED",
      createdAt: "2026-08-06T12:00:00.000Z",
      followUpCount: 0,
      hotelId,
      id: repairId,
      predecessor: null,
      priority: {
        color: "RED",
        id: priorityId,
        name: "긴급",
        sortOrder: 1,
        version: 1,
      },
      process: {
        currentStageName: null,
        executionId: "a5000000-0000-4000-8000-000000000001",
        state: "PENDING_INPUT",
        version: 1,
      },
      source: {
        description: "욕실 배관 누수",
        fileVersionIds: [fileVersionId],
        type: "DIRECT",
        unavailableReason: null,
      },
      status: "OPEN",
      target: {
        facilityTypeName: null,
        id: roomId,
        locationName: "2층",
        name: "201호",
        type: "ROOM",
      },
      updatedAt: "2026-08-06T12:00:00.000Z",
      version: 1,
      visits: [],
    };
    const canonicalRepair = repairCaseReadSchema.parse(legacyRepair);
    expect(canonicalRepair).not.toHaveProperty("calendarProjectionStatus");
    expect(
      repairCaseResponseSchema.safeParse({
        ok: true,
        data: { repair: {} },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      repairVisitResponseSchema.safeParse({
        ok: true,
        data: { visit: {} },
        error: null,
      }).success,
    ).toBe(false);
  });

  it("defines a bounded, strict Calendar display contract without provider identifiers", () => {
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const inspectionId = "60000000-0000-4000-8000-000000000001";
    const visitId = "a2000000-0000-4000-8000-000000000001";
    const inspection = {
      businessDate: "2026-08-07",
      detailHref: `/hotels/${hotelId}/inspections`,
      endsAt: null,
      hotelId,
      hotelName: "서울호텔",
      id: inspectionId,
      startsAt: "2026-08-07T09:00:00.000Z",
      status: "PENDING_INPUT" as const,
      targetSummary: "객실 2곳",
      title: "점검 마감",
      type: "INSPECTION" as const,
    };
    const repairVisit = {
      cancellationReason: null,
      canUpdate: true,
      detailHref: `/hotels/${hotelId}/repairs`,
      endsAt: "2026-08-07T11:00:00.000Z",
      hotelId,
      hotelName: "서울호텔",
      id: visitId,
      priority: { color: "#dc2626", name: "긴급" },
      startsAt: "2026-08-07T10:00:00.000Z",
      status: "SCHEDULED" as const,
      targetSummary: "703호",
      title: "배관 점검",
      type: "REPAIR_VISIT" as const,
    };
    expect(calendarEventSchema.safeParse(inspection).success).toBe(true);
    expect(calendarEventSchema.safeParse(repairVisit).success).toBe(true);
    expect(
      calendarEventSchema.safeParse({
        ...repairVisit,
        providerEventId: "forbidden",
      }).success,
    ).toBe(false);

    expect(
      calendarEventsQuerySchema.parse({ from: "2026-08-01", to: "2026-09-12" })
        .pageSize,
    ).toBe(200);
    expect(
      calendarEventsQuerySchema.safeParse({
        from: "2026-08-01",
        to: "2026-09-13",
      }).success,
    ).toBe(false);
    expect(
      calendarEventsQuerySchema.safeParse({
        from: "2026-08-01",
        to: "2026-08-01",
      }).success,
    ).toBe(false);

    expect(calendarRoutes.hotel(hotelId)).toBe(
      `/api/hotels/${hotelId}/calendar`,
    );
    expect(calendarRoutes.hotelVisitOptions(hotelId)).toBe(
      `/api/hotels/${hotelId}/calendar/visit-options`,
    );
    expect(calendarRoutes.all).toBe("/api/calendar");
    expect(calendarRoutes.capabilities).toBe("/api/calendar/capabilities");

    expect(
      calendarEventsResponseSchema.safeParse({
        ok: true,
        data: {
          capabilities: { canCreateVisit: true, canViewAllHotels: false },
          events: [inspection, repairVisit],
          hotels: [{ id: hotelId, name: "서울호텔" }],
          pagination: { nextCursor: null },
          range: {
            from: "2026-08-01",
            timeZone: "Asia/Seoul",
            to: "2026-09-12",
          },
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      calendarCapabilitiesResponseSchema.safeParse({
        ok: true,
        data: {
          canViewAllHotels: false,
          hotels: [{ canCreateVisit: true, id: hotelId, name: "서울호텔" }],
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      calendarVisitOptionsResponseSchema.safeParse({
        ok: true,
        data: {
          internalPerformers: [
            {
              displayName: "김담당",
              userId: "20000000-0000-4000-8000-000000000001",
            },
          ],
          repairs: [
            {
              id: "a1000000-0000-4000-8000-000000000001",
              priorityName: "긴급",
              targetName: "703호",
            },
          ],
        },
        error: null,
      }).success,
    ).toBe(true);
  });

  it("keeps operational issues strict, versioned, and owner-safe", () => {
    const hotelId = "50000000-0000-4000-8000-000000000001";
    const issueId = "b1000000-0000-4000-8000-000000000001";
    const assigneeId = "20000000-0000-4000-8000-000000000001";
    const createdAt = "2026-08-12T12:00:00.000Z";
    const publicIssue = {
      assignee: { displayName: "현장 담당" },
      createdAt,
      description: "로비에 반복적인 소음 신고가 접수됐습니다.",
      hotelId,
      id: issueId,
      isOverdue: false,
      publicComments: [],
      resumeDueAt: null,
      severity: "MAJOR",
      status: "IN_PROGRESS",
      title: "로비 소음 신고",
      updatedAt: createdAt,
      version: 3,
    } as const;

    expect(operationalIssueSeveritySchema.options).toEqual([
      "OBSERVATION",
      "MINOR",
      "MAJOR",
      "EMERGENCY",
    ]);
    expect(operationalIssueStatusSchema.options).toEqual([
      "RECEIVED",
      "ASSIGNED",
      "IN_PROGRESS",
      "ON_HOLD",
      "ACTION_COMPLETED",
      "CLOSED",
      "CANCELLED",
    ]);
    expect(
      createOperationalIssueRequestSchema.parse({
        description: publicIssue.description,
        issueId,
        severity: publicIssue.severity,
        title: publicIssue.title,
      }),
    ).toMatchObject({ issueId, severity: "MAJOR" });
    expect(
      operationalIssueAssigneeRequestSchema.safeParse({
        assigneeUserId: assigneeId,
        reason: "현장 담당 지정",
        version: 1,
      }).success,
    ).toBe(true);
    expect(
      operationalIssueActionRequestSchema.safeParse({
        action: "HOLD",
        reason: "부품 입고 대기",
        resumeDueAt: "2026-08-20T00:00:00.000Z",
        version: 3,
      }).success,
    ).toBe(true);
    expect(
      operationalIssueAddEntryRequestSchema.safeParse({
        body: "현장 소음을 확인하고 안내했습니다.",
        version: 3,
      }).success,
    ).toBe(true);
    expect(
      operationalIssueListQuerySchema.parse({ severity: "MAJOR" }).pageSize,
    ).toBe(20);
    expect(
      operationalIssueOwnerResponseSchema.safeParse({
        ok: true,
        data: { issue: publicIssue },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      operationalIssueOwnerResponseSchema.safeParse({
        ok: true,
        data: { issue: { ...publicIssue, internalNotes: [] } },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      operationalIssueInternalResponseSchema.safeParse({
        ok: true,
        data: {
          issue: {
            ...publicIssue,
            assignee: { ...publicIssue.assignee, userId: assigneeId },
            internalNotes: [],
            statusHistory: [],
            workLogs: [],
          },
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(operationalIssueRoutes.capabilities).toBe(
      "/api/issues/capabilities",
    );
    expect(
      operationalIssueCapabilitiesResponseSchema.safeParse({
        ok: true,
        data: {
          hotels: [
            {
              canComment: true,
              canCreate: false,
              canManage: false,
              canRead: true,
              canWork: false,
              hotelId,
              hotelName: "서울호텔",
            },
          ],
        },
        error: null,
      }).success,
    ).toBe(true);
    expect(
      operationalIssueCapabilitiesResponseSchema.safeParse({
        ok: true,
        data: {
          hotels: [
            {
              actorUserId: assigneeId,
              canComment: true,
              canCreate: false,
              canManage: false,
              canRead: true,
              canWork: false,
              hotelId,
              hotelName: "서울호텔",
            },
          ],
        },
        error: null,
      }).success,
    ).toBe(false);
    expect(operationalIssueRoutes.list(hotelId)).toBe(
      `/api/hotels/${hotelId}/issues`,
    );
    expect(operationalIssueRoutes.assign(hotelId, issueId)).toBe(
      `/api/hotels/${hotelId}/issues/${issueId}/assign`,
    );
  });
});
