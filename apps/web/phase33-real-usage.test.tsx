import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AttendancePage from "./app/attendance/page";
import LeavePage from "./app/leave/page";
import ApprovalsPage from "./app/approvals/page";

describe("Phase 33 attendance/leave/approvals real-usage pages", () => {
  it("renders attendance page with day flow, actor lanes, and four-axis guardrails", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("오늘 바로 따라갈 순서");
    expect(html).toContain("1. 출근 등록");
    expect(html).toContain("직원 / 승인자 / 운영자 레인 분리");
    expect(html).toContain("일반 직원: 오늘 상태 확인, 허용 방식 확인, 본인 기록 정정 요청");
    expect(html).toContain("차단 이유 4축");
    expect(html).toContain("권한 부족");
    expect(html).toContain("정책 미허용");
    expect(html).toContain("회사 scope 차단");
    expect(html).toContain("placeholder 제한");
    expect(html).toContain("/api/attendance/records");
    expect(html).toContain("/api/attendance/corrections");
  });

  it("renders leave page with requester/approver split and self-approval guard copy", () => {
    const html = renderToStaticMarkup(<LeavePage />);

    expect(html).toContain("신청자 happy path");
    expect(html).toContain("승인자 lane / self-approval 차단");
    expect(html).toContain("승인 권한자만 승인 대기열을 보고 approve/reject 문맥을 확인합니다.");
    expect(html).toContain("자기 휴가 자기승인");
    expect(html).toContain("차단 이유 4축");
    expect(html).toContain("/api/leave/requests");
    expect(html).toContain("/api/leave/balances");
    expect(html.indexOf("신청자 happy path")).toBeLessThan(html.indexOf("승인자 lane / self-approval 차단"));
  });

  it("renders approvals page with draft-to-review stepper and separated guardrails", () => {
    const html = renderToStaticMarkup(<ApprovalsPage />);

    expect(html).toContain("기안 → 승인/반려 → 보완 요청 흐름");
    expect(html).toContain("기안자 lane");
    expect(html).toContain("승인자 lane");
    expect(html).toContain("기안 작성 stepper");
    expect(html).toContain("1. 결재 양식 선택 (/api/approvals/forms)");
    expect(html).toContain("차단 이유 4축");
    expect(html).toContain("self-approval 금지");
    expect(html).toContain("회사 scope / unknown id 차단");
    expect(html).toContain("/api/approvals/documents");
    expect(html).toContain("/api/approvals/inbox");
  });
});
