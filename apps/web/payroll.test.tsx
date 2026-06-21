import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MePage from "./app/me/page";
import PayrollMePage from "./app/payroll/me/page";
import PayrollPage from "./app/payroll/page";

describe("Phase 28A payroll web entrypoints", () => {
  it("renders the payroll hub behind a content-area PIN gate before revealing sensitive panels", () => {
    const html = renderToStaticMarkup(<PayrollPage />);

    expect(html).toContain("Phase 43 급여 내부관리 도입완성");
    expect(html).toContain("급여 내부관리");
    expect(html).toContain("`/management` 아래에서 급여 프로필, 기간 상태, self-only 명세서 preview 연결을 읽는 내부관리 화면입니다.");
    expect(html).toContain("민감 정보 확인");
    expect(html).toContain("2차 비밀번호");
    expect(html).toContain("콘텐츠 열기");
    expect(html).toContain('href="/management"');
    expect(html).toContain('href="/payroll"');
    expect(html).not.toContain("실사용 급여 패널");
    expect(html).not.toContain("급여 overview 실응답");
    expect(html).not.toContain("기간 상세 / 승인 게이트");
    expect(html).not.toContain("본사 급여 담당");
    expect(html).not.toContain("/api/payroll");
    expect(html).not.toContain("/api/payroll/periods/payroll_period_2026_05");
    expect(html).not.toContain("/api/payroll/me/payslip");
  });

  it("renders the employee payslip page as self-only preview without fake final-pay claims", () => {
    const html = renderToStaticMarkup(<PayrollMePage />);

    expect(html).toContain("내 급여명세서 초안");
    expect(html).toContain("self-only");
    expect(html).toContain("예상 실수령");
    expect(html).toContain("원천세 placeholder");
    expect(html).toContain("4대보험 placeholder");
    expect(html).toContain("실사용 명세서 패널");
    expect(html).toContain("내 급여명세서 실응답");
    expect(html).toContain("self-only / 정정 안내");
    expect(html).toContain('href="/me"');
    expect(html).toContain('href="/payroll/me"');
    expect(html).toContain("/api/payroll/me/payslip");
    expect(html).not.toContain("실지급 확정 완료");
    expect(html).not.toContain("외부 신고 완료");
  });

  it("links the me page back to the personal payroll preview", () => {
    const html = renderToStaticMarkup(<MePage />);

    expect(html).toContain("내 급여명세서 초안");
    expect(html).toContain('href="/payroll/me"');
  });
});
