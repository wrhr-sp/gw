import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WorkItemsHrPage from "./app/work-items/hr/page";
import WorkItemsLaborPage from "./app/work-items/labor/page";
import WorkItemsLegalPage from "./app/work-items/legal/page";
import WorkItemsPage from "./app/work-items/page";
import {
  managementWorkItemCards,
  workItemGuardrails,
  workItemHubHighlights,
  workItemHubModuleCards,
  workItemModuleCards,
} from "./app/work-items/work-items-config";

describe("Phase 25 work-items skeleton boundaries", () => {
  it("keeps the shared hub focused on common work/document/access structure instead of pretending full operations", () => {
    const html = renderToStaticMarkup(<WorkItemsPage />);

    expect(html).toContain("공통 업무 허브");
    expect(html).toContain("모듈별 진입점");
    expect(html).toContain("/api/work-items, /api/work-items/:id");
    expect(html).toContain("/api/work-item-deadlines");
    expect(html).toContain("metadata-only");
    expect(html).toContain("실제 홈택스 신고·회계프로그램 연동·실세무 원문 업로드는 닫고, 제출 상태·반려 사유·전달 패키지 준비 metadata 만 먼저 보여 줍니다.");

    for (const item of workItemHubHighlights) {
      expect(html).toContain(item);
    }

    for (const card of workItemHubModuleCards) {
      expect(html).toContain(card.title);
      expect(html).toContain(card.href);
    }

    expect(html).not.toContain('href="/work-items/legal"');
  });

  it("renders module pages with role/access notes, linked API names, and no fake state-changing claims", () => {
    const html = renderToStaticMarkup(<WorkItemsHrPage />);

    expect(html).toContain("인사 업무");
    expect(html).toContain("실민감 인사 원문과 외부 캘린더 연동은 닫고");
    expect(html).toContain("/api/work-items?module=hr");
    expect(html).toContain("/api/work-items/:id/documents");
    expect(html).toContain("/api/work-items/:id/attachments");
    expect(html).toContain("이번 단계 meeting 유형");
    expect(html).toContain("누가 어디까지 보는가");
    expect(html).not.toContain("공통 업무 허브로");
    expect(html).not.toContain("저장 완료");
    expect(html).not.toContain("외부 전송");
  });

  it("renders the labor module page with restricted visibility copy and no fake legal/payroll completion claims", () => {
    const html = renderToStaticMarkup(<WorkItemsLaborPage />);

    expect(html).toContain("노무 업무");
    expect(html).toContain("이번 단계 labor 유형");
    expect(html).toContain("누가 어디까지 보는가");
    expect(html).toContain("restricted 건은 별도 capability 가 있어야 본다.");
    expect(html).toContain("실제 사고 신고 제출");
    expect(html).not.toContain("급여 반영 완료");
    expect(html).not.toContain("징계 확정 완료");
  });

  it("renders the legal module page with contract/renewal/dispute guardrails and visibility notes", () => {
    const html = renderToStaticMarkup(<WorkItemsLegalPage />);

    expect(html).toContain("법무 업무");
    expect(html).toContain("계약 검토 요청, 계약 갱신 예정, 분쟁/클레임/보험 후속을 공통 work item skeleton 안에서 metadata 중심으로 묶습니다.");
    expect(html).toContain("이번 단계 legal 유형");
    expect(html).toContain("계약 갱신 예정");
    expect(html).toContain("누가 어디까지 보는가");
    expect(html).toContain("실분쟁 자료 업로드 확대와 실제 제출 자동화");
    expect(html).toContain("/api/work-items?module=legal");
    expect(html).toContain("/api/work-item-deadlines");
    expect(html).not.toContain("실제 서명 완료");
    expect(html).not.toContain("외부 자문 발송 완료");
  });

  it("keeps guardrails explicit in config for shared and management module cards", () => {
    expect(workItemHubModuleCards.map((card) => card.slug)).toEqual(["hr", "tax", "labor", "branch"]);
    expect(managementWorkItemCards.map((card) => card.slug)).toEqual(["legal"]);
    expect(workItemModuleCards.map((card) => card.slug)).toEqual(["hr", "tax", "labor", "legal", "branch"]);
    expect(workItemGuardrails).toContain("민감 원문 첨부는 metadata-only 로 남기고 실제 파일 내용 노출은 하지 않습니다.");
    expect(workItemGuardrails).toContain("세무 신고, 외부 법무, 외부 저장소 발송 같은 운영 자동화는 이번 단계 범위가 아닙니다.");
    expect(workItemModuleCards.every((card) => card.apiRoutes.length >= 2)).toBe(true);
    expect(workItemModuleCards.every((card) => card.milestones.length >= 3)).toBe(true);
  });
});
