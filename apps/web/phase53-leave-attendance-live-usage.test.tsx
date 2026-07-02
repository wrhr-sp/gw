import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LeaveRequest } from "@gw/shared";

import {
  AttendanceLiveSection,
  LeaveLiveSection,
  canShowLeaveApprovalActions,
  pickLeaveApprovalRequest,
} from "./app/_components/real-usage-panels";

describe("Phase 53 leave/attendance live usage panel guardrails", () => {
  it("keeps attendance actions aligned to the effective employee method instead of exposing PC checkout", () => {
    const html = renderToStaticMarkup(<AttendanceLiveSection />);

    expect(html).toContain("직원 실행 레인");
    expect(html).toContain("태그 기준 출근 → 상태 확인 → 퇴근");
    expect(html).toContain("태그 출근 등록");
    expect(html).toContain("태그 퇴근 등록");
    expect(html).not.toContain("PC 퇴근");
    expect(html).toContain("attendance.read 권한이 없으면 버튼 대신 차단 안내만 확인합니다.");
    expect(html).toContain("승인자 / 운영자 분리");
  });

  it("keeps leave approval actions hidden on the initial employee-facing render", () => {
    const html = renderToStaticMarkup(<LeaveLiveSection />);

    expect(html).toContain("신청자 실행 레인");
    expect(html).toContain("잔여 확인 → 신청 → 내 상태 확인");
    expect(html).toContain("승인 버튼은 승인 권한자에게만 노출");
    expect(html).toContain("로그인 후 팀장/인사 승인자 세션으로 다시 열면 승인 대기 레인을 확인할 수 있습니다.");
    expect(html).not.toContain("팀 요청 승인");
    expect(html).not.toContain("팀 요청 반려");
  });

  it("selects only pending requests owned by another employee for approval actions", () => {
    const session = {
      session: { id: "s1", status: "active", expiresAt: "2099-01-01T00:00:00.000Z" },
      user: {
        id: "user_manager",
        companyId: "company_demo",
        employeeId: "employee_manager",
        email: "manager@example.com",
        fullName: "운영 매니저",
        roleCodes: ["MANAGER"],
        permissions: ["leave.approve", "leave.request"],
      },
    };

    const requests: LeaveRequest[] = [
      {
        id: "self_pending",
        companyId: "company_demo",
        employeeId: "employee_manager",
        leaveTypeId: "leave_type_annual",
        status: "pending_approval",
        approvalStatus: "pending",
        startDate: "2026-06-20",
        endDate: "2026-06-20",
        unit: "day",
        days: 1,
        reason: "self",
        requestedBy: "user_manager",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
      {
        id: "team_pending",
        companyId: "company_demo",
        employeeId: "employee_staff",
        leaveTypeId: "leave_type_annual",
        status: "pending_approval",
        approvalStatus: "pending",
        startDate: "2026-06-21",
        endDate: "2026-06-21",
        unit: "day",
        days: 1,
        reason: "team",
        requestedBy: "user_staff",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ];

    expect(pickLeaveApprovalRequest(session, requests)?.id).toBe("team_pending");
    expect(canShowLeaveApprovalActions(session, pickLeaveApprovalRequest(session, requests))).toBe(true);
    expect(
      canShowLeaveApprovalActions(
        {
          ...session,
          user: {
            ...session.user,
            permissions: ["leave.request"],
          },
        },
        pickLeaveApprovalRequest(session, requests),
      ),
    ).toBe(false);
  });
});
