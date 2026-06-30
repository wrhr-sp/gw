import React from "react";
import { readFileSync } from "fs";
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
    expect(html).toContain("attendance.read 권한이 없으면 버튼 대신 차단 안내만 확인합니다.");
    expect(html).toContain("feature-workspace__row-actions");
    const source = readFileSync(new URL("./app/attendance/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("처리 완료 보기");
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
    expect(html).toContain("leave.request 권한 기준으로 신청 CTA를 노출합니다.");
    const source = readFileSync(new URL("./app/leave/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("신청 취소");
    expect(source).toContain("최근 처리 보기");
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
    expect(html).toContain("approval.act 권한과 결재선 순서가 맞을 때만 처리 버튼을 노출합니다.");
    expect(html).toContain("의견 남기기");
    const source = readFileSync(new URL("./app/approvals/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("조직도 확인");
    expect(html).not.toContain("Phase");
    expect(html).not.toContain("/api/approvals");
  });
});
