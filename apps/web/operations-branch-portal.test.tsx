import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OperationsPage from "./app/operations/page";
import OperationsBranchPage from "./app/operations/branches/[branchId]/page";
import CEOPage from "./app/CEO/page";
import StrategicPlanningPage from "./app/Strategic Planning/page";
import PlaceOfBusinessPage from "./app/Place of business/page";
import PlaceOfBusinessBranchPage from "./app/Place of business/[branchId]/page";

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

  it("renders department and place-of-business route pages", async () => {
    const ceoHtml = renderToStaticMarkup(<CEOPage />);
    const strategyHtml = renderToStaticMarkup(<StrategicPlanningPage />);
    const placeHtml = renderToStaticMarkup(<PlaceOfBusinessPage />);
    const seoulHtml = renderToStaticMarkup(await PlaceOfBusinessBranchPage({ params: Promise.resolve({ branchId: "seoul" }) }));

    expect(ceoHtml).toContain("대표이사실 / CEO");
    expect(ceoHtml).toContain("대표이사실 업무포털");
    expect(ceoHtml).toContain('href="/boards?department=ceo"');
    expect(ceoHtml).not.toContain("처리 대기");
    expect(strategyHtml).toContain("전략기획실 / Strategic Planning");
    expect(strategyHtml).toContain("전략기획실 업무포털");
    expect(strategyHtml).toContain('href="/boards?department=strategy"');
    expect(strategyHtml).not.toContain("처리 대기");
    expect(placeHtml).toContain("지점관리포털 / Place of business");
    expect(placeHtml).toContain('/Place of business/seoul');
    expect(seoulHtml).toContain("서울지점 지점관리");
  });

  it("keeps direct branch portal link and department portal order scoped to source", () => {
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");

    expect(shellSource).toContain('id: "operations", label: "운영사업부", englishLabel: "Operations Management", href: "/Operations Management"');
    expect(shellSource).not.toContain('id: "common", label: COMMON_WORK_LABEL, englishLabel: "Common Work", href: "/home"');
    expect(shellSource).not.toContain('label: "관리자 페이지", englishLabel: "Admin", href: "/admin"');
    expect(shellSource).toContain('href: "/CEO"');
    expect(shellSource).toContain('href: "/Strategic Planning"');
    expect(shellSource).toContain('const branchPortalHomeHref = "/Place of business";');
    expect(shellSource).toContain("지점관리포털");
    expect(shellSource).not.toContain("branchPortalSearch");
    expect(shellSource).toContain("getCurrentLocationLabel");
    expect(shellSource).toContain("서울지점");
    expect(shellSource).not.toContain("filteredBranchPortalItems");
    expect(shellSource).toContain('href={branchPortalHomeHref}');
    expect(shellSource).toContain('aria-label={`${branchPortalLabel} 새 탭에서 보기`}');
    expect(shellSource).toContain('data-route={department.href}');
    expect(shellSource).toContain('data-access-kind={accessKind}');
  });
});
