import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OperationsPage from "./app/operations/page";
import OperationsBranchPage from "./app/operations/branches/[branchId]/page";

describe("operations branch portal", () => {
  it("renders the operations department portal with branch permission and report lanes", () => {
    const html = renderToStaticMarkup(<OperationsPage />);

    expect(html).toContain("운영사업부 포털");
    const source = readFileSync("app/operations/page.tsx", "utf8");
    expect(html).toContain("지점 권한");
    expect(html).toContain("보고 관리");
    expect(source).toContain("지점 생성 권한");
    expect(html).toContain("operations.portal.read");
    expect(source).toContain("branch.page.create");
    expect(html).toContain("매출보고");
    expect(html).toContain("운영이슈");
    expect(html).toContain("입금요청");
    expect(html).not.toContain("은행 API 자동확인 완료");
  });

  it("renders branch detail routes with report forms and access guard copy", async () => {
    const html = renderToStaticMarkup(await OperationsBranchPage({ params: Promise.resolve({ branchId: "gangnam" }) }));
    const source = readFileSync("app/operations/branches/[branchId]/page.tsx", "utf8");

    expect(html).toContain("강남지점 지점관리");
    expect(html).toContain("branch.access 권한");
    expect(source).toContain("branch.report.sales.write");
    expect(source).toContain("branch.report.issue.write");
    expect(source).toContain("branch.payment.request.write");
    expect(source).toContain("입금요청 제출");
    expect(source).toContain("은행 API 자동확인은 이번 1차 범위 밖입니다.");
  });

  it("keeps branch portal topbar search and department portal order scoped to source", () => {
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");

    expect(shellSource.indexOf('label: "운영사업부", href: "/operations"')).toBeLessThan(shellSource.indexOf('label: "일반(공통)업무", href: "/home"'));
    expect(shellSource.indexOf('label: "일반(공통)업무", href: "/home"')).toBeLessThan(shellSource.indexOf('label: "관리자 페이지", href: "/admin"'));
    expect(shellSource).toContain("지점관리포털");
    expect(shellSource).toContain("branchPortalSearch");
    expect(shellSource).toContain("filteredBranchPortalItems");
    expect(shellSource).toContain("/operations/branches/${branchId}");
  });
});
