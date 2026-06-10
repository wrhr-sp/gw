import { describe, expect, it } from "vitest";
import {
  appRoutes,
  attendanceActionResponseSchema,
  attendanceCorrectionRequestSchema,
  attendanceListRecordsResponseSchema,
  authLoginRequestSchema,
  authLoginResponseSchema,
  createInviteRequestSchema,
  errorResponseSchema,
  leaveActionRequestSchema,
  leaveActionResponseSchema,
  leaveBalanceListResponseSchema,
  leaveRequestCreateRequestSchema,
  leaveRequestListResponseSchema,
  leaveTypeListResponseSchema,
  listCompaniesResponseSchema,
  listPermissionsResponseSchema,
  permissionCodeSchema,
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
