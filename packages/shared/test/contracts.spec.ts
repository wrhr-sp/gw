import { describe, expect, it } from "vitest";
import {
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
  attendanceActionResponseSchema,
  attendanceCorrectionRequestSchema,
  attendanceListRecordsResponseSchema,
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
  listPermissionsResponseSchema,
  noticeListResponseSchema,
  permissionCodeSchema,
  readReceiptCreateRequestSchema,
  readReceiptCreateResponseSchema,
  sessionUserSchema,
} from "../src/contracts";

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
    expect(appRoutes.readReceipts).toBe("/api/read-receipts");
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
              employeeId: "employee_admin",
              leaveTypeId: "leave_type_annual",
              asOfDate: "2026-06-01",
              openingDays: 15,
              usedDays: 3,
              reservedDays: 1,
              remainingDays: 11,
              placeholder: true,
            },
          ],
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
              employeeId: "employee_admin",
              leaveTypeId: "leave_type_annual",
              status: "pending_approval",
              approvalStatus: "pending",
              startDate: "2026-06-20",
              endDate: "2026-06-20",
              unit: "day",
              days: 1,
              reason: "가족 행사",
              requestedBy: "user_employee",
              reviewedBy: null,
              reviewedAt: null,
              createdAt: "2026-06-10T09:00:00.000Z",
              updatedAt: "2026-06-10T09:00:00.000Z",
            },
          ],
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
            employeeId: "employee_admin",
            leaveTypeId: "leave_type_annual",
            status: "approved",
            approvalStatus: "approved",
            startDate: "2026-06-20",
            endDate: "2026-06-20",
            unit: "day",
            days: 1,
            reason: "가족 행사",
            requestedBy: "user_employee",
            reviewedBy: "user_manager",
            reviewedAt: "2026-06-10T10:00:00.000Z",
            createdAt: "2026-06-10T09:00:00.000Z",
            updatedAt: "2026-06-10T10:00:00.000Z",
          },
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
              fileName: "근태 운영 안내.pdf",
              contentType: "application/pdf",
              fileSize: 128000,
              versionLabel: "v0.1",
              isPublicWithinCompany: true,
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
          fileName: "board-outline.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileSize: 64000,
          versionLabel: "draft-1",
          isPublicWithinCompany: false,
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
});
