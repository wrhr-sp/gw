import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MePage from "./app/me/page";
import PayrollMePage from "./app/payroll/me/page";
import PayrollPage from "./app/payroll/page";

describe("payroll feature workspace entrypoints", () => {
  it("renders the payroll hub as a workspace without development copy", () => {
    const html = renderToStaticMarkup(<PayrollPage />);

    expect(html).toContain("feature-workspace");
    expect(html).toContain("급여 내부관리");
    expect(html).toContain("급여 현황");
    expect(html).toContain("급여 프로필");
    expect(html).toContain("마감/검토");
    expect(html).toContain("수당·공제");
    expect(html).toContain("정정 요청 보기");
    expect(html).not.toContain("Phase");
    expect(html).not.toContain("skeleton");
    expect(html).not.toContain("placeholder");
    expect(html).not.toContain("/api/payroll");
  });

  it("renders the employee payslip page as a self-only workspace without fake final-pay claims", () => {
    const html = renderToStaticMarkup(<PayrollMePage />);

    expect(html).toContain("내 급여명세서");
    expect(html).toContain("명세서 요약");
    expect(html).toContain("지급/공제");
    expect(html).toContain("정정 요청");
    expect(html).toContain("예상 실수령");
    expect(html).toContain("원천세");
    expect(html).toContain("4대보험");
    expect(html).not.toContain("preview");
    expect(html).not.toContain("placeholder");
    expect(html).not.toContain("실지급 확정 완료");
    expect(html).not.toContain("외부 신고 완료");
  });

  it("links the me page back to the personal payroll workspace", () => {
    const html = renderToStaticMarkup(<MePage />);

    expect(html).toContain("내 급여명세서");
    expect(html).toContain("/payroll/me");
  });
});
