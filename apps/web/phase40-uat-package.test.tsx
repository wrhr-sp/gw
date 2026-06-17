import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import UatPage from "./app/uat/page";

describe("Phase 40 internal adoption rehearsal package", () => {
  it("renders access info, role scenarios, issue template, facilitator guide, and approval gates in one page", () => {
    const html = renderToStaticMarkup(<UatPage />);

    expect(html).toContain("내부 도입 리허설 / UAT 패키지");
    expect(html).toContain("https://gw-web.wereheresp.workers.dev");
    expect(html).toContain("admin / 1234");
    expect(html).toContain("역할별 시나리오 카드");
    expect(html).toContain("일반 직원");
    expect(html).toContain("승인자 / 팀장");
    expect(html).toContain("경영업무 담당자");
    expect(html).toContain("운영자 / 감사");
    expect(html).toContain("이슈 분류 기준");
    expect(html).toContain("blocker");
    expect(html).toContain("approval-needed");
    expect(html).toContain("이슈 기록 템플릿");
    expect(html).toContain("진행자용 설명 순서");
    expect(html).toContain("참가자용 빠른 시작");
    expect(html).toContain("/documents → /notifications → /me");
    expect(html).toContain("/work-items/branch → /payroll → /payroll/me → /work-items/tax → /work-items/labor → /work-items/legal → /admin/audit-logs");
    expect(html).toContain("Phase 45 최종 검증 / 릴리즈 묶음");
    expect(html).toContain("live 직접 클릭 근거와 local preview/build/release gate 근거를 섞지 않고 분리해서 기록한다.");
    expect(html).toContain("최종 보고 체크리스트");
    expect(html).toContain("release gate 성공, focused test/web build, rollback 확인 포인트");
    expect(html).toContain("실제 급여 지급, 은행 이체, 실세액 확정");
    expect(html.indexOf("접속 정보")).toBeLessThan(html.indexOf("역할별 시나리오 카드"));
    expect(html.indexOf("역할별 시나리오 카드")).toBeLessThan(html.indexOf("이슈 분류 기준"));
    expect(html.indexOf("이슈 분류 기준")).toBeLessThan(html.indexOf("진행자용 설명 순서"));
  });
});
