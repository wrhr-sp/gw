import { describe, expect, it } from "vitest";
import {
  getAdminNavigationAccess,
  getAdminRouteKind,
  getAdminScopeForRoleCode,
  getViewerAccessForRoleCode,
  hasAdminRouteAccess,
} from "../src/admin-access";
import {
  adminAuditLogListResponseSchema,
  adminPoliciesListResponseSchema,
  adminPolicyBoardUpdateRequestSchema,
  attendanceRegistrationPolicySchema,
  adminPolicyDocumentUpdateRequestSchema,
  adminPolicyUpdateResponseSchema,
  adminUsersListResponseSchema,
  appRoutes,
  approvalActionRequestSchema,
  approvalActionResponseSchema,
  approvalCandidateListResponseSchema,
  approvalDocumentCreateRequestSchema,
  approvalDocumentDetailResponseSchema,
  approvalDocumentListResponseSchema,
  approvalFormCreateRequestSchema,
  approvalFormListResponseSchema,
  approvalInboxResponseSchema,
  approvalLineCreateRequestSchema,
  approvalLineListResponseSchema,
  attendanceActionRequestSchema,
  attendanceActionResponseSchema,
  attendanceCorrectionRequestSchema,
  attendanceListRecordsResponseSchema,
  attendanceRegistrationMethodSchema,
  authLoginRequestSchema,
  authLoginResponseSchema,
  boardCommentCreateRequestSchema,
  boardCommentCreateResponseSchema,
  boardCreateRequestSchema,
  boardPostCreateRequestSchema,
  boardPostDetailResponseSchema,
  boardPostListResponseSchema,
  boardResponseSchema,
  boardsListResponseSchema,
  createInviteRequestSchema,
  documentFileListResponseSchema,
  documentFileMetadataCreateRequestSchema,
  documentFileMetadataCreateResponseSchema,
  documentSpaceCreateRequestSchema,
  documentSpaceListResponseSchema,
  errorResponseSchema,
  leaveActionRequestSchema,
  leaveActionResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateRequestSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  listCompaniesResponseSchema,
  listDepartmentsResponseSchema,
  listEmployeesResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  noticeListResponseSchema,
  permissionCodeSchema,
  readReceiptCreateRequestSchema,
  readReceiptCreateResponseSchema,
  sessionUserSchema,
} from "../src/contracts";
import {
  describeNativeMobileRouteAccess,
  getNativeMobilePrimaryRoute,
  getNativeMobileUiStateGuidance,
  hasNativeMobileApprovalLaneAccess,
  isNativeMobilePrimaryWebRoute,
  nativeMobileCoreWorkflow,
  nativeMobilePwaNativeDifferences,
  nativeMobileApprovalGates,
  nativeMobileBaseUrlPolicy,
  nativeMobileCriticalApiRoutes,
  nativeMobileInternalPilotLanes,
  nativeMobileInternalPilotSmokeChecklist,
  nativeMobileMonorepoPlan,
  nativeMobilePermissionHints,
  nativeMobilePrimaryRouteMappings,
  nativeMobileRouteMappingIndex,
  nativeMobileSessionBridgePolicy,
  nativeMobileStoreSubmissionChecklist,
} from "../src/mobile-contracts";

const sampleOperationalBridge = {
  currentState: "운영 정책/권한/감사 기준을 일반 업무 화면과 API 결과에 같은 뜻으로 연결하는 1차 bridge 입니다.",
  sourceLabel: "/admin/policies · /admin/users · /admin/audit-logs",
  auditTrailHint: "운영 예외와 차단 이유는 감사 preview 에 남기되 raw 감사 원문은 관리자 전용으로 유지합니다.",
  placeholderNote: "실제 저장, 실데이터 변경, 외부 연동 없이 preview/dev-safe skeleton 범위에서만 연결합니다.",
  blockedReasons: [
    {
      category: "permission",
      source: "/dashboard",
      title: "권한 부족",
      description: "관리자·감사 권한이 없는 사용자는 일반 업무 흐름만 보게 하고 관리자 CTA 를 숨깁니다.",
    },
  ],
} as const;

describe("shared contracts", () => {
  it("defines Phase 3 attendance/leave route metadata", () => {
    expect(appRoutes.health).toBe("/api/health");
    expect(appRoutes.auth.login).toBe("/api/auth/login");
    expect(appRoutes.auth.logout).toBe("/api/auth/logout");
    expect(appRoutes.me).toBe("/api/me");
    expect(appRoutes.org.companies).toBe("/api/companies");
    expect(appRoutes.org.employees).toBe("/api/employees");
    expect(appRoutes.org.departments).toBe("/api/departments");
    expect(appRoutes.org.roles).toBe("/api/roles");
    expect(appRoutes.org.permissions).toBe("/api/permissions");
    expect(appRoutes.admin.invites).toBe("/api/admin/invites");
    expect(appRoutes.admin.users).toBe("/api/admin/users");
    expect(appRoutes.admin.policies).toBe("/api/admin/policies");
    expect(appRoutes.admin.policyDocuments).toBe("/api/admin/policies/documents");
    expect(appRoutes.admin.policyBoards).toBe("/api/admin/policies/boards");
    expect(appRoutes.admin.auditLogs).toBe("/api/admin/audit-logs");
    expect(appRoutes.attendance.checkIn).toBe("/api/attendance/check-in");
    expect(appRoutes.attendance.checkOut).toBe("/api/attendance/check-out");
    expect(appRoutes.attendance.records).toBe("/api/attendance/records");
    expect(appRoutes.attendance.corrections).toBe("/api/attendance/corrections");
    expect(appRoutes.leave.types).toBe("/api/leave/types");
    expect(appRoutes.leave.balances).toBe("/api/leave/balances");
    expect(appRoutes.leave.requests).toBe("/api/leave/requests");
    expect(appRoutes.leave.approve("leave_request_demo")).toBe("/api/leave/requests/leave_request_demo/approve");
    expect(appRoutes.leave.reject("leave_request_demo")).toBe("/api/leave/requests/leave_request_demo/reject");
    expect(appRoutes.approvals.forms).toBe("/api/approvals/forms");
    expect(appRoutes.approvals.lines).toBe("/api/approvals/lines");
    expect(appRoutes.approvals.documents).toBe("/api/approvals/documents");
    expect(appRoutes.approvals.detail("approval_document_demo")).toBe("/api/approvals/documents/approval_document_demo");
    expect(appRoutes.approvals.inbox).toBe("/api/approvals/inbox");
    expect(appRoutes.approvals.approve("approval_document_demo")).toBe("/api/approvals/documents/approval_document_demo/approve");
    expect(appRoutes.approvals.reject("approval_document_demo")).toBe("/api/approvals/documents/approval_document_demo/reject");
    expect(appRoutes.approvals.referenceCandidates).toBe("/api/approvals/references/candidates");
    expect(appRoutes.approvals.agreementCandidates).toBe("/api/approvals/agreements/candidates");
    expect(appRoutes.boards.notices).toBe("/api/notices");
    expect(appRoutes.boards.boards).toBe("/api/boards");
    expect(appRoutes.boards.posts("board_general")).toBe("/api/boards/board_general/posts");
    expect(appRoutes.boards.postDetail("post_demo")).toBe("/api/posts/post_demo");
    expect(appRoutes.boards.comments("post_demo")).toBe("/api/posts/post_demo/comments");
    expect(appRoutes.documents.spaces).toBe("/api/documents/spaces");
    expect(appRoutes.documents.files).toBe("/api/documents/files");
    expect(appRoutes.documents.fileMetadata).toBe("/api/documents/files/metadata");
    expect(appRoutes.documents.uploadInit).toBe("/api/documents/files/upload-init");
    expect(appRoutes.documents.uploadComplete("document_file_demo")).toBe(
      "/api/documents/files/document_file_demo/upload-complete",
    );
    expect(appRoutes.documents.downloadInit("document_file_demo")).toBe(
      "/api/documents/files/document_file_demo/download-init",
    );
    expect(appRoutes.documents.deleteFile("document_file_demo")).toBe("/api/documents/files/document_file_demo");
    expect(appRoutes.readReceipts).toBe("/api/read-receipts");
  });

  it("defines Phase 17 native mobile transition contracts and gates", () => {
    expect(nativeMobileMonorepoPlan.appWorkspace).toBe("apps/mobile");
    expect(nativeMobileMonorepoPlan.sharedWorkspace).toBe("packages/shared");
    expect(nativeMobilePrimaryRouteMappings.map((item) => item.id)).toEqual([
      "login",
      "dashboard",
      "attendance",
      "leave",
      "approvals",
      "collaboration",
      "me",
    ]);
    expect(nativeMobileRouteMappingIndex["/dashboard"].nativeSegment).toBe("(tabs)/dashboard");
    expect(nativeMobileRouteMappingIndex["/boards"].label).toBe("공지/문서");
    expect(nativeMobileRouteMappingIndex["/documents"].nativeSegment).toBe("(tabs)/collaboration");
    expect(nativeMobileRouteMappingIndex["/documents"].webRoute).toBe("/boards");
    expect(isNativeMobilePrimaryWebRoute("/leave")).toBe(true);
    expect(isNativeMobilePrimaryWebRoute("/documents")).toBe(true);
    expect(isNativeMobilePrimaryWebRoute("/admin")).toBe(false);
    expect(nativeMobileBaseUrlPolicy.production.source).toBe("approved-origin-only");
    expect(nativeMobileSessionBridgePolicy.storage).toBe("secure-storage-bridge");
    expect(nativeMobileSessionBridgePolicy.disallowedStorage).toContain("web-cookie-copy");
    expect(nativeMobilePermissionHints.approvals).toContain("approval.document.approve");
    expect(nativeMobileCriticalApiRoutes).toContain(appRoutes.approvals.inbox);
    expect(nativeMobileApprovalGates).toContain("유료 빌드와 외부 테스터 배포");
  });

  it("defines Phase 18 workflow/state guidance with explicit non-admin guardrails", () => {
    expect(nativeMobileCoreWorkflow.map((step) => step.screenId)).toEqual([
      "login",
      "dashboard",
      "attendance",
      "leave",
      "approvals",
      "collaboration",
      "me",
    ]);
    expect(getNativeMobilePrimaryRoute("approvals")?.apiRoutes).toContain(appRoutes.approvals.documents);
    expect(getNativeMobilePrimaryRoute("approvals")?.access.policy).toBe("authenticated");
    expect(describeNativeMobileRouteAccess("approvals", ["MANAGER"]).hasActionAccess).toBe(true);
    expect(getNativeMobileUiStateGuidance("offline").blockedActions).toContain("출퇴근 등록");
    expect(getNativeMobileUiStateGuidance("forbidden").blockedActions).toContain("관리자 정책 변경 화면 직접 노출");
    expect(nativeMobilePwaNativeDifferences.native[1]).toContain("runtime base URL resolver");
  });

  it("defines Phase 19 internal pilot lanes and smoke/store checklists", () => {
    expect(nativeMobileInternalPilotLanes.map((lane) => lane.id)).toEqual([
      "document-and-local-verification",
      "android-internal-pilot-prep",
      "ios-internal-pilot-prep",
    ]);
    expect(nativeMobileInternalPilotLanes[0].approvalRequired).toBe(false);
    expect(nativeMobileInternalPilotLanes[1].approvalRequired).toBe(true);
    expect(nativeMobileInternalPilotSmokeChecklist.map((item) => item.id)).toEqual([
      "install-guide",
      "login",
      "dashboard",
      "attendance",
      "leave",
      "approvals",
      "collaboration",
      "me",
    ]);
    expect(nativeMobileInternalPilotSmokeChecklist.find((item) => item.id === "me")?.verify).toContain(
      "session clear 안내가 보여야 함",
    );
    expect(nativeMobileStoreSubmissionChecklist.android).toContain("Google Play Console 권한과 담당자 확인");
    expect(nativeMobileStoreSubmissionChecklist.ios).toContain("Apple Developer 팀 권한과 담당자 확인");
  });

  it("splits approvals inbox read access from approval CTA access for employee and manager roles", () => {
    const employeeAccess = describeNativeMobileRouteAccess("approvals", ["EMPLOYEE"]);
    const managerAccess = describeNativeMobileRouteAccess("approvals", ["MANAGER"]);

    expect(employeeAccess.hasRouteAccess).toBe(true);
    expect(employeeAccess.hasActionAccess).toBe(false);
    expect(managerAccess.hasRouteAccess).toBe(true);
    expect(managerAccess.hasActionAccess).toBe(true);
    expect(hasNativeMobileApprovalLaneAccess(["EMPLOYEE"])).toBe(false);
    expect(hasNativeMobileApprovalLaneAccess(["MANAGER"])).toBe(true);
  });

  it("parses login/session and org list payloads", () => {
    const request = authLoginRequestSchema.parse({
      email: "admin@example.com",
      password: "placeholder-password",
    });

    expect(request.email).toBe("admin@example.com");

    const sessionUser = sessionUserSchema.parse({
      id: "user_admin",
      companyId: "company_demo",
      employeeId: "employee_admin",
      email: "admin@example.com",
      fullName: "관리자 테스트",
      roleCodes: ["COMPANY_ADMIN", "AUDITOR"],
      permissions: ["company.read", "employee.read", "invite.manage", "attendance.manage", "leave.approve"],
    });

    expect(
      authLoginResponseSchema.parse({
        ok: true,
        data: {
          session: {
            id: "session_demo",
            status: "authenticated",
            expiresAt: "2099-01-01T00:00:00.000Z",
            placeholder: true,
          },
          user: sessionUser,
          nextStep: "Connect real auth provider after approval.",
        },
        error: null,
      }).data.user.roleCodes,
    ).toContain("COMPANY_ADMIN");

    expect(
      listCompaniesResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "company_demo",
              code: "demo",
              name: "데모 주식회사",
              status: "active",
            },
          ],
        },
        error: null,
      }).data.items,
    ).toHaveLength(1);

    expect(
      listPermissionsResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              code: "invite.manage",
              description: "관리자 초대와 권한 부여를 관리한다.",
            },
          ],
        },
        error: null,
      }).data.items[0].code,
    ).toBe("invite.manage");
  });

  it("maps admin scopes, route kinds, and access decisions from the same shared access matrix", () => {
    expect(getAdminScopeForRoleCode("SUPER_ADMIN")).toBe("global");
    expect(getAdminScopeForRoleCode("HR_ADMIN")).toBe("company");
    expect(getAdminScopeForRoleCode("AUDITOR")).toBe("audit");

    expect(getAdminRouteKind("/admin")).toBe("admin_console");
    expect(getAdminRouteKind("/admin/users")).toBe("admin_console");
    expect(getAdminRouteKind("/admin/audit-logs")).toBe("admin_audit");
    expect(getAdminRouteKind("/dashboard")).toBeNull();

    const hrViewer = getViewerAccessForRoleCode("HR_ADMIN");
    const auditorViewer = getViewerAccessForRoleCode("AUDITOR");

    expect(hasAdminRouteAccess("/admin", hrViewer)).toBe(true);
    expect(hasAdminRouteAccess("/admin/audit-logs", hrViewer)).toBe(false);
    expect(hasAdminRouteAccess("/admin/audit-logs", auditorViewer)).toBe(true);
    expect(getAdminNavigationAccess(hrViewer)).toEqual({
      canAccessAdminConsole: true,
      canAccessAdminAudit: false,
    });
  });

  it("parses org directory placeholder payloads with summaries, filters, and notices", () => {
    expect(
      listEmployeesResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "employee_manager",
              companyId: "company_demo",
              departmentId: "department_ops",
              email: "manager@example.com",
              fullName: "운영 매니저",
              employmentStatus: "active",
            },
          ],
          summaries: [
            {
              employeeId: "employee_manager",
              departmentName: "운영팀",
              roleSummary: "MANAGER · 팀 운영",
              statusLabel: "재직",
              statusTone: "positive",
              primaryNote: "운영팀 소속 · 일반 조회용 요약",
            },
          ],
          filters: {
            departmentId: "department_ops",
            employmentStatus: "active",
            roleCode: "MANAGER",
          },
          filterOptions: {
            departments: [
              { id: "department_ops", name: "운영팀" },
              { id: "department_hr", name: "인사팀" },
            ],
            employmentStatuses: ["active", "on_leave", "offboarded"],
            roleCodes: ["MANAGER", "EMPLOYEE"],
          },
          notices: ["개인정보 상세 편집과 권한 저장은 이번 범위가 아닙니다."],
          placeholder: true,
        },
        error: null,
      }).data.summaries[0]?.roleSummary,
    ).toContain("MANAGER");

    expect(
      listDepartmentsResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "department_ops",
              companyId: "company_demo",
              parentDepartmentId: "department_exec",
              code: "OPS",
              name: "운영팀",
              status: "active",
            },
          ],
          summary: {
            title: "부서 구조 overview",
            description: "상위/하위 부서 구조를 읽기 전용으로 요약합니다.",
            count: 1,
          },
          notices: ["조직 개편 저장은 관리자 승인 범위입니다."],
          placeholder: true,
        },
        error: null,
      }).data.summary.count,
    ).toBe(1);

    expect(
      listRolesResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              code: "MANAGER",
              name: "MANAGER",
              scope: "company",
              permissions: ["company.read", "employee.read", "department.read", "role.read"],
            },
          ],
          summary: {
            title: "역할/직책 overview",
            description: "운영 변경 없이 역할 설명만 먼저 보여 줍니다.",
            count: 1,
          },
          notices: ["권한 직접 수정은 /admin/users 또는 /admin/policies 범위입니다."],
          placeholder: true,
        },
        error: null,
      }).data.summary.title,
    ).toContain("역할");
  });

  it("allows general directory payloads to omit blocked role filters while keeping valid filter options", () => {
    const payload = listEmployeesResponseSchema.parse({
      ok: true,
      data: {
        items: [
          {
            id: "employee_employee",
            companyId: "company_demo",
            departmentId: "department_ops",
            email: "employee@example.com",
            fullName: "일반 구성원",
            employmentStatus: "active",
          },
        ],
        summaries: [
          {
            employeeId: "employee_employee",
            departmentName: "운영팀",
            roleSummary: "EMPLOYEE · 일반 구성원",
            statusLabel: "재직",
            statusTone: "positive",
            primaryNote: "운영팀 소속 · 일반 조회용 요약",
          },
        ],
        filters: {
          departmentId: "department_ops",
        },
        filterOptions: {
          departments: [{ id: "department_ops", name: "운영팀" }],
          employmentStatuses: ["active", "on_leave", "offboarded"],
          roleCodes: ["MANAGER", "EMPLOYEE"],
        },
        notices: ["운영 사용자/권한 검토는 /admin/users 에서 분리해 다룹니다."],
        placeholder: true,
      },
      error: null,
    });

    expect(payload.data.filters.roleCode).toBeUndefined();
    expect(payload.data.filterOptions.roleCodes).not.toContain("COMPANY_ADMIN");
  });

  it("parses attendance and leave placeholder payloads", () => {
    expect(permissionCodeSchema.parse("attendance.read")).toBe("attendance.read");
    expect(permissionCodeSchema.parse("attendance.manage")).toBe("attendance.manage");
    expect(permissionCodeSchema.parse("leave.request")).toBe("leave.request");
    expect(permissionCodeSchema.parse("leave.approve")).toBe("leave.approve");

    expect(
      attendanceActionResponseSchema.parse({
        ok: true,
        data: {
          record: {
            id: "attendance_record_today",
            companyId: "company_demo",
            employeeId: "employee_admin",
            status: "checked_in",
            workDate: "2026-06-10",
            checkInAt: "2026-06-10T09:00:00.000Z",
            checkOutAt: null,
            source: "web",
            note: "placeholder check-in",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
          },
          policyContext: sampleOperationalBridge,
          audit: {
            candidate: true,
            action: "attendance.check_in",
          },
          placeholder: true,
        },
        error: null,
      }).data.audit.action,
    ).toBe("attendance.check_in");

    expect(
      attendanceListRecordsResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "attendance_record_today",
              companyId: "company_demo",
              employeeId: "employee_admin",
              status: "checked_out",
              workDate: "2026-06-10",
              checkInAt: "2026-06-10T09:00:00.000Z",
              checkOutAt: "2026-06-10T18:00:00.000Z",
              source: "web",
              note: "placeholder day",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T18:00:00.000Z",
            },
          ],
          filters: {
            employeeId: "employee_admin",
            workDateFrom: "2026-06-01",
            workDateTo: "2026-06-30",
          },
          policyContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0].status,
    ).toBe("checked_out");

    expect(
      attendanceCorrectionRequestSchema.parse({
        attendanceRecordId: "attendance_record_today",
        reason: "퇴근 시간이 누락되었습니다.",
        requestedCheckInAt: "2026-06-10T09:00:00.000Z",
        requestedCheckOutAt: "2026-06-10T18:10:00.000Z",
        note: "문 앞 QR 체크아웃 누락",
      }).attendanceRecordId,
    ).toBe("attendance_record_today");

    expect(
      leaveTypeListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "leave_type_annual",
              companyId: "company_demo",
              code: "annual",
              name: "연차",
              unit: "day",
              status: "active",
              placeholder: true,
            },
          ],
          policyContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0].code,
    ).toBe("annual");

    expect(
      leaveBalanceListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "leave_balance_annual",
              companyId: "company_demo",
              employeeId: "employee_employee",
              leaveTypeId: "leave_type_annual",
              asOfDate: "2026-06-10",
              openingDays: 15,
              usedDays: 3,
              reservedDays: 1,
              remainingDays: 11,
              placeholder: true,
            },
          ],
          policyContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0].remainingDays,
    ).toBe(11);

    expect(
      leaveRequestCreateRequestSchema.parse({
        leaveTypeId: "leave_type_annual",
        startDate: "2026-06-20",
        endDate: "2026-06-20",
        unit: "day",
        days: 1,
        reason: "가족 행사",
      }).leaveTypeId,
    ).toBe("leave_type_annual");

    expect(
      leaveRequestListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "leave_request_demo",
              companyId: "company_demo",
              employeeId: "employee_employee",
              leaveTypeId: "leave_type_annual",
              status: "pending_approval",
              approvalStatus: "pending",
              startDate: "2026-06-20",
              endDate: "2026-06-20",
              unit: "day",
              days: 1,
              reason: "대체 인력 배치 확인 완료",
              requestedBy: "user_employee",
              reviewedBy: null,
              reviewedAt: null,
              createdAt: "2026-06-10T09:30:00.000Z",
              updatedAt: "2026-06-10T09:30:00.000Z",
            },
          ],
          policyContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0].approvalStatus,
    ).toBe("pending");

    expect(
      leaveActionRequestSchema.parse({
        reason: "대체 인력 배치 확인 완료",
      }).reason,
    ).toBe("대체 인력 배치 확인 완료");

    expect(
      leaveActionResponseSchema.parse({
        ok: true,
        data: {
          request: {
            id: "leave_request_demo",
            companyId: "company_demo",
            employeeId: "employee_employee",
            leaveTypeId: "leave_type_annual",
            status: "approved",
            approvalStatus: "approved",
            startDate: "2026-06-20",
            endDate: "2026-06-20",
            unit: "day",
            days: 1,
            reason: "담당자 검토 완료",
            requestedBy: "user_employee",
            reviewedBy: "user_manager",
            reviewedAt: "2026-06-10T10:00:00.000Z",
            createdAt: "2026-06-10T09:30:00.000Z",
            updatedAt: "2026-06-10T10:00:00.000Z",
          },
          policyContext: sampleOperationalBridge,
          audit: {
            candidate: true,
            action: "leave.request.approve",
          },
          placeholder: true,
        },
        error: null,
      }).data.audit.action,
    ).toBe("leave.request.approve");
  });

  it("parses Phase 4 approvals placeholder contracts", () => {
    expect(permissionCodeSchema.parse("approval.form.manage")).toBe("approval.form.manage");
    expect(permissionCodeSchema.parse("approval.line.manage")).toBe("approval.line.manage");
    expect(permissionCodeSchema.parse("approval.document.read")).toBe("approval.document.read");
    expect(permissionCodeSchema.parse("approval.document.write")).toBe("approval.document.write");
    expect(permissionCodeSchema.parse("approval.document.approve")).toBe("approval.document.approve");

    expect(
      approvalFormCreateRequestSchema.parse({
        title: "연차 신청서",
        category: "leave",
        fieldSummary: "연차 사유와 기간 입력 placeholder",
      }).title,
    ).toBe("연차 신청서");

    expect(
      approvalFormListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "approval_form_leave",
              companyId: "company_demo",
              code: "leave_request",
              title: "연차 신청서",
              category: "leave",
              fieldSummary: "연차 사유와 기간 입력 placeholder",
              status: "active",
              placeholder: true,
              createdBy: "user_company_admin",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].code,
    ).toBe("leave_request");

    expect(
      approvalLineCreateRequestSchema.parse({
        title: "기본 팀장 결재선",
        description: "팀장 승인 1단계 placeholder",
        steps: [
          {
            stepOrder: 1,
            approverEmployeeId: "employee_manager",
            stepType: "approve",
          },
        ],
      }).steps[0]?.stepType,
    ).toBe("approve");

    expect(
      approvalLineListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "approval_line_team_manager",
              companyId: "company_demo",
              title: "기본 팀장 결재선",
              description: "팀장 승인 1단계 placeholder",
              status: "active",
              placeholder: true,
              createdBy: "user_hr_admin",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              steps: [
                {
                  id: "approval_step_team_manager",
                  documentId: null,
                  lineId: "approval_line_team_manager",
                  stepOrder: 1,
                  approverEmployeeId: "employee_manager",
                  stepType: "approve",
                  decisionStatus: "pending",
                  decidedAt: null,
                  decisionComment: null,
                },
              ],
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].steps[0]?.approverEmployeeId,
    ).toBe("employee_manager");

    expect(
      approvalDocumentCreateRequestSchema.parse({
        formId: "approval_form_leave",
        title: "6월 연차 신청",
        summary: "6월 20일 연차 사용 placeholder",
        lineId: "approval_line_team_manager",
        referenceEmployeeIds: ["employee_staff"],
        agreementEmployeeIds: ["employee_admin"],
      }).lineId,
    ).toBe("approval_line_team_manager");

    expect(
      approvalDocumentListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "approval_document_demo",
              companyId: "company_demo",
              formId: "approval_form_leave",
              lineId: "approval_line_team_manager",
              drafterEmployeeId: "employee_employee",
              title: "6월 연차 신청",
              summary: "6월 20일 연차 사용 placeholder",
              documentNumber: "APR-2026-0001",
              status: "pending_approval",
              submittedAt: "2026-06-10T09:00:00.000Z",
              completedAt: null,
              createdBy: "user_employee",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          operationalContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0].documentNumber,
    ).toBe("APR-2026-0001");

    expect(
      approvalDocumentDetailResponseSchema.parse({
        ok: true,
        data: {
          document: {
            id: "approval_document_demo",
            companyId: "company_demo",
            formId: "approval_form_leave",
            lineId: "approval_line_team_manager",
            drafterEmployeeId: "employee_employee",
            title: "6월 연차 신청",
            summary: "6월 20일 연차 사용 placeholder",
            documentNumber: "APR-2026-0001",
            status: "pending_approval",
            submittedAt: "2026-06-10T09:00:00.000Z",
            completedAt: null,
            createdBy: "user_employee",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
            placeholder: true,
          },
          steps: [
            {
              id: "approval_step_document_manager",
              documentId: "approval_document_demo",
              lineId: "approval_line_team_manager",
              stepOrder: 1,
              approverEmployeeId: "employee_manager",
              stepType: "approve",
              decisionStatus: "pending",
              decidedAt: null,
              decisionComment: null,
            },
          ],
          references: [
            {
              id: "approval_reference_staff",
              documentId: "approval_document_demo",
              employeeId: "employee_staff",
              referenceType: "reference",
              readAt: null,
            },
          ],
          operationalContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.steps[0]?.stepOrder,
    ).toBe(1);

    expect(
      approvalInboxResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "approval_document_team_pending",
              companyId: "company_demo",
              formId: "approval_form_expense",
              lineId: "approval_line_team_manager",
              drafterEmployeeId: "employee_employee",
              title: "운영 장비 구매 승인",
              summary: "키보드 교체 placeholder",
              documentNumber: "APR-2026-0002",
              status: "pending_approval",
              submittedAt: "2026-06-10T09:00:00.000Z",
              completedAt: null,
              createdBy: "user_employee",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          operationalContext: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0].title,
    ).toBe("운영 장비 구매 승인");

    expect(
      approvalCandidateListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              employeeId: "employee_staff",
              companyId: "company_demo",
              fullName: "인사 담당자",
              departmentId: "department_hr",
              type: "agreement",
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].type,
    ).toBe("agreement");

    expect(
      approvalActionRequestSchema.parse({
        reason: "담당자 검토 완료",
      }).reason,
    ).toBe("담당자 검토 완료");

    expect(
      approvalActionResponseSchema.parse({
        ok: true,
        data: {
          document: {
            id: "approval_document_team_pending",
            companyId: "company_demo",
            formId: "approval_form_expense",
            lineId: "approval_line_team_manager",
            drafterEmployeeId: "employee_employee",
            title: "운영 장비 구매 승인",
            summary: "키보드 교체 placeholder",
            documentNumber: "APR-2026-0002",
            status: "approved",
            submittedAt: "2026-06-10T09:00:00.000Z",
            completedAt: "2026-06-10T10:00:00.000Z",
            createdBy: "user_employee",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T10:00:00.000Z",
            placeholder: true,
          },
          operationalContext: sampleOperationalBridge,
          audit: {
            candidate: true,
            action: "approval.document.approve",
          },
          placeholder: true,
        },
        error: null,
      }).data.audit.action,
    ).toBe("approval.document.approve");
  });

  it("parses Phase 5 boards/documents placeholder contracts", () => {
    expect(permissionCodeSchema.parse("board.notice.read")).toBe("board.notice.read");
    expect(permissionCodeSchema.parse("board.manage")).toBe("board.manage");
    expect(permissionCodeSchema.parse("board.post.write")).toBe("board.post.write");
    expect(permissionCodeSchema.parse("board.comment.write")).toBe("board.comment.write");
    expect(permissionCodeSchema.parse("document.space.read")).toBe("document.space.read");
    expect(permissionCodeSchema.parse("document.space.manage")).toBe("document.space.manage");
    expect(permissionCodeSchema.parse("document.file.read")).toBe("document.file.read");
    expect(permissionCodeSchema.parse("document.file.write")).toBe("document.file.write");

    expect(
      boardCreateRequestSchema.parse({
        boardType: "general",
        name: "자유 게시판",
        slug: "general",
        visibility: "company",
        isNoticeOnly: false,
      }).slug,
    ).toBe("general");

    expect(
      noticeListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "board_notice",
              companyId: "company_demo",
              boardType: "notice",
              name: "전사 공지",
              slug: "notices",
              visibility: "company",
              isNoticeOnly: true,
              status: "active",
              createdBy: "user_company_admin",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].boardType,
    ).toBe("notice");

    expect(
      boardsListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "board_general",
              companyId: "company_demo",
              boardType: "general",
              name: "자유 게시판",
              slug: "general",
              visibility: "company",
              isNoticeOnly: false,
              status: "active",
              createdBy: "user_company_admin",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].name,
    ).toBe("자유 게시판");

    expect(
      boardResponseSchema.parse({
        ok: true,
        data: {
          board: {
            id: "board_general",
            companyId: "company_demo",
            boardType: "general",
            name: "자유 게시판",
            slug: "general",
            visibility: "company",
            isNoticeOnly: false,
            status: "active",
            createdBy: "user_company_admin",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
            placeholder: true,
          },
          audit: {
            candidate: true,
            action: "board.create",
          },
          placeholder: true,
        },
        error: null,
      }).data.audit.action,
    ).toBe("board.create");

    expect(
      boardPostCreateRequestSchema.parse({
        title: "점심 메뉴 추천",
        bodyPreview: "오늘 뭐 드실래요?",
        isNotice: false,
      }).title,
    ).toBe("점심 메뉴 추천");

    expect(
      boardPostListResponseSchema.parse({
        ok: true,
        data: {
          board: {
            id: "board_general",
            companyId: "company_demo",
            boardType: "general",
            name: "자유 게시판",
            slug: "general",
            visibility: "company",
            isNoticeOnly: false,
            status: "active",
            createdBy: "user_company_admin",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
            placeholder: true,
          },
          items: [
            {
              id: "board_post_demo",
              companyId: "company_demo",
              boardId: "board_general",
              authorEmployeeId: "employee_employee",
              title: "점심 메뉴 추천",
              bodyPreview: "오늘 뭐 드실래요?",
              isNotice: false,
              publishedAt: "2026-06-10T09:00:00.000Z",
              pinnedUntil: null,
              status: "published",
              createdBy: "user_employee",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].boardId,
    ).toBe("board_general");

    expect(
      boardPostDetailResponseSchema.parse({
        ok: true,
        data: {
          board: {
            id: "board_general",
            companyId: "company_demo",
            boardType: "general",
            name: "자유 게시판",
            slug: "general",
            visibility: "company",
            isNoticeOnly: false,
            status: "active",
            createdBy: "user_company_admin",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
            placeholder: true,
          },
          post: {
            id: "board_post_demo",
            companyId: "company_demo",
            boardId: "board_general",
            authorEmployeeId: "employee_employee",
            title: "점심 메뉴 추천",
            bodyPreview: "오늘 뭐 드실래요?",
            isNotice: false,
            publishedAt: "2026-06-10T09:00:00.000Z",
            pinnedUntil: null,
            status: "published",
            createdBy: "user_employee",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
            placeholder: true,
          },
          placeholder: true,
        },
        error: null,
      }).data.post.title,
    ).toBe("점심 메뉴 추천");

    expect(
      boardCommentCreateRequestSchema.parse({
        body: "오늘은 비빔밥이요.",
        parentCommentId: null,
      }).body,
    ).toBe("오늘은 비빔밥이요.");

    expect(
      boardCommentCreateResponseSchema.parse({
        ok: true,
        data: {
          comment: {
            id: "board_comment_demo",
            companyId: "company_demo",
            postId: "board_post_demo",
            authorEmployeeId: "employee_employee",
            parentCommentId: null,
            body: "오늘은 비빔밥이요.",
            deletedAt: null,
            status: "active",
            createdBy: "user_employee",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
            placeholder: true,
          },
          audit: {
            candidate: true,
            action: "board.comment.create",
          },
          placeholder: true,
        },
        error: null,
      }).data.comment.postId,
    ).toBe("board_post_demo");

    expect(
      documentSpaceCreateRequestSchema.parse({
        name: "팀 문서함",
        slug: "team-docs",
        visibility: "department",
        isPublicWithinCompany: false,
      }).slug,
    ).toBe("team-docs");

    expect(
      documentSpaceListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "document_space_public",
              companyId: "company_demo",
              name: "전사 문서함",
              slug: "company-docs",
              visibility: "company",
              ownerEmployeeId: "employee_admin",
              isPublicWithinCompany: true,
              status: "active",
              createdBy: "user_company_admin",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].visibility,
    ).toBe("company");

    expect(
      documentFileListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "document_file_demo",
              companyId: "company_demo",
              spaceId: "document_space_public",
              ownerEmployeeId: "employee_admin",
              versionId: "document_version_demo",
              fileName: "근태 운영 안내.pdf",
              contentType: "application/pdf",
              fileSize: 128000,
              versionLabel: "v0.1",
              isPublicWithinCompany: true,
              storageProvider: "mock",
              storageStatus: "ready",
              checksumSha256: null,
              status: "active",
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
              placeholder: true,
            },
          ],
          placeholder: true,
        },
        error: null,
      }).data.items[0].fileName,
    ).toBe("근태 운영 안내.pdf");

    expect(
      documentFileMetadataCreateRequestSchema.parse({
        spaceId: "document_space_public",
        fileName: "board-outline.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 64000,
        versionLabel: "draft-1",
        isPublicWithinCompany: false,
      }).versionLabel,
    ).toBe("draft-1");

    const metadataResponse = documentFileMetadataCreateResponseSchema.parse({
      ok: true,
      data: {
        file: {
          id: "document_file_new",
          companyId: "company_demo",
          spaceId: "document_space_public",
          ownerEmployeeId: "employee_admin",
          versionId: "document_version_new",
          fileName: "board-outline.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileSize: 64000,
          versionLabel: "draft-1",
          isPublicWithinCompany: false,
          storageProvider: "mock",
          storageStatus: "pending",
          checksumSha256: null,
          status: "active",
          createdAt: "2026-06-10T09:00:00.000Z",
          updatedAt: "2026-06-10T09:00:00.000Z",
          placeholder: true,
        },
        audit: {
          candidate: true,
          action: "document.file.metadata.create",
        },
        placeholder: true,
      },
      error: null,
    });
    expect(metadataResponse.data.file.versionLabel).toBe("draft-1");
    expect("storageKey" in metadataResponse.data.file).toBe(false);

    expect(
      readReceiptCreateRequestSchema.parse({
        targetType: "post",
        targetId: "board_post_demo",
      }).targetId,
    ).toBe("board_post_demo");

    expect(
      readReceiptCreateResponseSchema.parse({
        ok: true,
        data: {
          receipt: {
            id: "read_receipt_demo",
            companyId: "company_demo",
            targetType: "post",
            targetId: "board_post_demo",
            employeeId: "employee_employee",
            readAt: "2026-06-10T09:00:00.000Z",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T09:00:00.000Z",
          },
          audit: {
            candidate: true,
            action: "read_receipt.create",
          },
          placeholder: true,
        },
        error: null,
      }).data.receipt.targetType,
    ).toBe("post");
  });

  it("parses invite requests and common auth errors", () => {
    expect(
      createInviteRequestSchema.parse({
        companyId: "company_demo",
        email: "new.user@example.com",
        roleCode: "MANAGER",
        departmentId: "department_ops",
      }).roleCode,
    ).toBe("MANAGER");

    expect(
      errorResponseSchema.parse({
        ok: false,
        data: null,
        error: {
          code: "AUTH_REQUIRED",
          message: "로그인이 필요합니다.",
          details: {
            route: "/api/me",
          },
        },
      }).error.code,
    ).toBe("AUTH_REQUIRED");
  });

  it("parses Phase 9 admin users, policy update, and audit log contracts", () => {
    expect(
      adminUsersListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              userId: "user_company_admin",
              employeeId: "employee_admin",
              companyId: "company_demo",
              fullName: "관리자 테스트",
              email: "admin@example.com",
              departmentName: "경영지원",
              roleCodes: ["COMPANY_ADMIN"],
              permissions: ["permission.read", "invite.manage"],
              employmentStatus: "active",
              adminScope: "company",
              employeeLinkStatus: "linked",
              highRiskPermissions: ["invite.manage"],
              statusChangePreview: {
                currentStatus: "active",
                nextStatus: "offboarded",
                reasonRequired: true,
              },
              roleChangePreview: {
                currentRoleCodes: ["COMPANY_ADMIN"],
                nextRoleCodes: ["AUDITOR"],
                auditCandidate: true,
              },
              placeholder: true,
            },
          ],
          linkedScreens: [
            {
              category: "permission",
              source: "/dashboard",
              title: "대시보드 관리자 CTA",
              description: "권한 있는 사용자에게만 /admin 또는 /admin/audit-logs 바로가기를 노출합니다.",
            },
          ],
          audit: {
            candidate: true,
            action: "admin.user.list.viewed",
          },
          placeholder: true,
        },
        error: null,
      }).data.items[0]?.adminScope,
    ).toBe("company");

    expect(
      adminPolicyDocumentUpdateRequestSchema.parse({
        companyId: "company_demo",
        visibility: "company",
        maxFileSizeBytes: 10485760,
        allowedFileExtensions: ["pdf", "docx"],
        retentionDays: 365,
        reason: "보안 정책 점검",
      }).visibility,
    ).toBe("company");

    expect(
      adminPolicyUpdateResponseSchema.parse({
        ok: true,
        data: {
          policy: {
            category: "document",
            companyId: "company_demo",
            summary: "문서 보관 정책 placeholder",
            lastReviewedAt: "2026-06-10T09:00:00.000Z",
            placeholders: ["R2 metadata only"],
            capability: "document.space.manage",
            reasonRequired: true,
            diffPreview: {
              before: "visibility=team",
              after: "visibility=company",
            },
          },
          audit: {
            candidate: true,
            action: "admin.policy.document.updated",
          },
          maskedFields: ["storageKey", "bucket 이름", "signed URL 전문"],
          requiresReview: true,
          placeholder: true,
        },
        error: null,
      }).data.maskedFields,
    ).toContain("storageKey");

    expect(
      adminAuditLogListResponseSchema.parse({
        ok: true,
        data: {
          items: [
            {
              id: "audit_admin_policy_document_1",
              companyId: "company_demo",
              actorUserId: "user_company_admin",
              actorEmployeeId: "employee_admin",
              action: "admin.policy.document.updated",
              targetType: "document_policy",
              targetId: "policy_documents_default",
              createdAt: "2026-06-10T09:00:00.000Z",
              metadata: {
                category: "policy",
                reason: "보안 정책 점검",
                before: "visibility=team",
                after: "visibility=company",
                maskedFields: ["storage reference", "download link"],
                companyBoundary: { enforced: true },
                source: "api-admin",
                storageRef: {
                  fileId: "file_demo",
                  spaceId: "space_public",
                  versionId: "version_1",
                  storageStatus: "linked",
                },
                sensitiveMasked: true,
              },
            },
          ],
          filters: {
            actionPrefix: "admin.policy",
          },
          filterOptions: {
            actorUserIds: ["user_company_admin"],
            actions: ["admin.policy.document.updated"],
            targetTypes: ["document_policy"],
            categories: ["policy"],
          },
          detailPreview: {
            actorLabel: "관리자 테스트",
            targetLabel: "문서 정책 기본값",
            reasonRequired: true,
          },
          operationalTrail: sampleOperationalBridge,
          placeholder: true,
        },
        error: null,
      }).data.items[0]?.metadata.sensitiveMasked,
    ).toBe(true);
  });

  it("separates attendance registration policy from attendance record source", () => {
    expect(attendanceRegistrationMethodSchema.parse("mobile")).toBe("mobile");
    expect(attendanceRegistrationMethodSchema.parse("pc")).toBe("pc");
    expect(attendanceRegistrationMethodSchema.parse("tag")).toBe("tag");
    expect(() => attendanceRegistrationMethodSchema.parse("web")).toThrow();

    const attendanceActionRequest = attendanceActionRequestSchema.parse({
      attendanceRegistrationMethod: "mobile",
    });
    expect(attendanceActionRequest.attendanceRegistrationMethod).toBe("mobile");

    expect(() =>
      attendanceActionRequestSchema.parse({
        attendanceRegistrationMethod: "rfid",
      }),
    ).toThrow();

    const policiesPayload = adminPoliciesListResponseSchema.parse({
      ok: true,
      data: {
        items: [
          {
            category: "attendance",
            companyId: "company_demo",
            summary: "출퇴근 허용 방식 정책 placeholder",
            lastReviewedAt: "2026-06-10T09:00:00.000Z",
            placeholders: ["태그 단말은 skeleton 안내만 제공"],
            capability: "attendance.manage",
            reasonRequired: true,
            diffPreview: {
              before: "mobile, pc",
              after: "mobile, tag",
            },
            attendanceRegistrationPolicy: {
              allowedAttendanceRegistrationMethods: ["mobile", "pc"],
              candidateAllowedAttendanceRegistrationMethods: ["mobile", "tag"],
              tagDeviceStatus: "skeleton_only",
            },
          },
        ],
        bridgeSummary: sampleOperationalBridge,
        audit: {
          candidate: true,
          action: "admin.policy.list.viewed",
        },
        placeholder: true,
      },
      error: null,
    });

    expect(policiesPayload.data.items[0]?.attendanceRegistrationPolicy?.allowedAttendanceRegistrationMethods).toEqual(["mobile", "pc"]);
  });

  it("accepts all supported tag device status values in attendance policy payload", () => {
    const statuses = ["not_configured", "skeleton_only", "ready_for_device"] as const;

    for (const status of statuses) {
      const request = attendanceRegistrationPolicySchema.safeParse({
        allowedAttendanceRegistrationMethods: ["mobile"],
        candidateAllowedAttendanceRegistrationMethods: ["mobile"],
        tagDeviceStatus: status,
      });

      expect(request.success, status).toBe(true);
    }
  });

  it("accepts the five approved attendance registration policy combinations in the contract", () => {
    const cases = [
      {
        allowedAttendanceRegistrationMethods: ["mobile"],
        candidateAllowedAttendanceRegistrationMethods: ["mobile"],
        tagDeviceStatus: "skeleton_only",
      },
      {
        allowedAttendanceRegistrationMethods: ["pc"],
        candidateAllowedAttendanceRegistrationMethods: ["pc"],
        tagDeviceStatus: "skeleton_only",
      },
      {
        allowedAttendanceRegistrationMethods: ["tag"],
        candidateAllowedAttendanceRegistrationMethods: ["tag"],
        tagDeviceStatus: "skeleton_only",
      },
      {
        allowedAttendanceRegistrationMethods: ["mobile", "pc"],
        candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc"],
        tagDeviceStatus: "skeleton_only",
      },
      {
        allowedAttendanceRegistrationMethods: ["mobile", "pc", "tag"],
        candidateAllowedAttendanceRegistrationMethods: ["mobile", "pc", "tag"],
        tagDeviceStatus: "skeleton_only",
      },
    ] as const;

    for (const policy of cases) {
      expect(attendanceRegistrationPolicySchema.parse(policy)).toEqual(policy);
    }
  });

  it("requires at least one allowed attendance registration method in attendance policy payload", () => {
    const request = attendanceRegistrationPolicySchema.safeParse({
      allowedAttendanceRegistrationMethods: [],
      candidateAllowedAttendanceRegistrationMethods: ["mobile"],
      tagDeviceStatus: "skeleton_only",
    });

    expect(request.success).toBe(false);
  });

  it("rejects attendance registration policy fields from board policy update payload", () => {
    const request = adminPolicyBoardUpdateRequestSchema.safeParse({
      companyId: "company_demo",
      visibility: "company",
      allowAnonymousComments: false,
      requireReadReceipt: true,
      retentionDays: 90,
      reason: "공지 운영 정책 점검",
      attendanceRegistrationPolicy: {
        allowedAttendanceRegistrationMethods: ["mobile"],
        candidateAllowedAttendanceRegistrationMethods: ["mobile", "tag"],
        tagDeviceStatus: "skeleton_only",
      },
    });

    expect(request.success).toBe(false);
  });
});
