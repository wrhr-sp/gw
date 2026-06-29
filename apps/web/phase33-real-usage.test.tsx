import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AttendancePage from "./app/attendance/page";
import LeavePage from "./app/leave/page";
import ApprovalsPage from "./app/approvals/page";

describe("attendance/leave/approvals feature workspace pages", () => {
  it("renders attendance as a board-like two-column work surface", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("오늘 근태");
    expect(html).toContain("내 기록");
    expect(html).toContain("정정 요청");
    expect(html).toContain("관리 확인");
    expect(html).toContain("퇴근 등록");
    expect(html).toContain("오전 출근");
    expect(html).not.toContain("Phase");
    expect(html).not.toContain("happy path");
    expect(html).not.toContain("placeholder");
    expect(html).not.toContain("/api/attendance");
  });

  it("renders leave as an employee request and approval work surface", () => {
    const html = renderToStaticMarkup(<LeavePage />);

    expect(html).toContain("잔여 휴가");
    expect(html).toContain("휴가 신청");
    expect(html).toContain("내 신청");
    expect(html).toContain("승인 대기");
    expect(html).toContain("휴가 신청");
    expect(html).toContain("승인");
    expect(html.indexOf("잔여 휴가")).toBeLessThan(html.indexOf("휴가 신청"));
    expect(html).not.toContain("happy path");
    expect(html).not.toContain("/api/leave");
  });

  it("renders approvals with inbox, draft, approval-line, and document-state lanes", () => {
    const html = renderToStaticMarkup(<ApprovalsPage />);

    expect(html).toContain("전자결재");
    expect(html).toContain("내 결재함");
    expect(html).toContain("기안 작성");
    expect(html).toContain("결재선");
    expect(html).toContain("문서 상태");
    expect(html).toContain("승인");
    expect(html).toContain("반려");
    expect(html).toContain("보완 요청");
    expect(html).not.toContain("Phase");
    expect(html).not.toContain("/api/approvals");
  });
});
