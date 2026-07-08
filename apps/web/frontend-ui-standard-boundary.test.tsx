import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ActionButtonGroup,
  AuditLogPanel,
  AttachmentPanel,
  ConfirmDialog,
  DataTable,
  DetailSection,
  EmptyState,
  FilterBar,
  FormSection,
  PageHeader,
  StatusBadge,
  SummaryCard,
  ApprovalLinePanel,
} from "./app/_components/ui-standard";
import { buttonRules, componentTokens, openSourceUiStack, standardMenuGroups, statusColorTokens } from "./design-system";

describe("werehere frontend UI standard", () => {
  it("keeps the top-level UI standard documented and linked from repo rules", async () => {
    const fs = await import("node:fs/promises");
    const [standard, agents, aiRules, backlog] = await Promise.all([
      fs.readFile("../../docs/ux/werehere-frontend-ui-standard.md", "utf8"),
      fs.readFile("../../AGENTS.md", "utf8"),
      fs.readFile("../../AI_RULES.md", "utf8"),
      fs.readFile("../../docs/ux/ui-ux-standardization-backlog.md", "utf8"),
    ]);

    expect(standard).toContain("최상위 UI 표준");
    expect(standard).toContain("shadcn-admin");
    expect(standard).toContain("shadcn/ui");
    expect(standard).toContain("Tailwind CSS");
    expect(standard).toContain("TanStack Query");
    expect(standard).toContain("React Hook Form");
    expect(standard).toContain("Tremor");
    expect(standard).toContain("프론트엔드에서는 ZITADEL API를 직접 호출하지 않는다");
    expect(agents).toContain("docs/ux/werehere-frontend-ui-standard.md");
    expect(aiRules).toContain("docs/ux/werehere-frontend-ui-standard.md");
    expect(backlog).toContain("계정관리 화면을 기준 샘플로 먼저 완성");
  });

  it("exposes required design-system baseline files and values", () => {
    expect(openSourceUiStack).toEqual([
      "shadcn-admin",
      "shadcn/ui",
      "Tailwind CSS",
      "TanStack Table",
      "TanStack Query",
      "React Hook Form",
      "Zod",
      "Tremor",
    ]);
    expect(componentTokens.filterBar.gridTemplateColumns).toContain("repeat(auto-fit");
    expect(buttonRules.primary.className).toContain("feature-workspace__action--primary");
    expect(statusColorTokens.success.className).toContain("status-badge--success");
    expect(standardMenuGroups[0].label).toBe("계정관리");
  });

  it("renders the required shared UI component names as reusable building blocks", () => {
    const html = renderToStaticMarkup(
      <>
        <PageHeader title="계정관리" eyebrow="관리자" />
        <FilterBar><label>검색<input readOnly /></label></FilterBar>
        <DataTable label="계정 목록"><table><tbody><tr><td>계정</td></tr></tbody></table></DataTable>
        <StatusBadge tone="success">재직</StatusBadge>
        <ConfirmDialog title="상태 변경 확인" actions={<button type="button">확인</button>}>상태를 변경합니다.</ConfirmDialog>
        <EmptyState title="조회 결과 없음" />
        <SummaryCard title="전체" value="0명" />
        <DetailSection title="계정 상세"><p>상세</p></DetailSection>
        <FormSection title="계정 생성"><input readOnly /></FormSection>
        <ActionButtonGroup><button type="button">저장</button></ActionButtonGroup>
        <AttachmentPanel><p>첨부</p></AttachmentPanel>
        <AuditLogPanel><p>로그</p></AuditLogPanel>
        <ApprovalLinePanel><p>결재선</p></ApprovalLinePanel>
      </>,
    );

    expect(html).toContain("ui-page-header");
    expect(html).toContain("ui-filter-bar");
    expect(html).toContain("ui-data-table");
    expect(html).toContain("status-badge--success");
    expect(html).toContain("ui-confirm-dialog");
    expect(html).toContain("ui-empty-state");
    expect(html).toContain("ui-summary-card");
    expect(html).toContain("ui-detail-section");
    expect(html).toContain("ui-form-section");
    expect(html).toContain("ui-action-button-group");
    expect(html).toContain("첨부파일");
    expect(html).toContain("감사로그");
    expect(html).toContain("결재선");
  });
});
