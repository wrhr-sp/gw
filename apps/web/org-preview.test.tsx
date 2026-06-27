import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OrgPage from "./app/org/page";

describe("org preview page", () => {
  it("renders preview-only org chart with department tree, member search, and detail panel", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
    const source = readFileSync(new URL("./app/org/page.tsx", import.meta.url), "utf8");
    const html = renderToStaticMarkup(<OrgPage />);

    expect(html).toContain("조직도");
    expect(html).toContain("부서 목록");
    expect(html).toContain("구성원 검색");
    expect(html).toContain("직원 상세");
    expect(html).toContain("preview sample");
    expect(html).toContain("운영 DB에 저장하지 않습니다");
    expect(html).toContain("운영 DB seed");
    expect(html).toContain("실데이터 변경");
    expect(html).toContain("실제 조직 API가 붙으면 화면 내부 preview 상수만 API 응답으로 바꾸면 됩니다.");

    expect(source).toContain("const orgPreviewDepartments");
    expect(source).toContain("preview 전용 샘플 데이터입니다");
    expect(source).not.toContain("appRoutes.org.departments");
    expect(source).not.toContain("OrgDirectoryLiveSection");

    expect(globalCss).toContain(".org-preview-shell");
    expect(globalCss).toContain("grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(260px, 320px);");
    expect(globalCss).toContain(".org-tree-item[aria-current=\"page\"]");
    expect(globalCss).toContain(".org-member-row[aria-current=\"page\"]");
    expect(globalCss).toContain(".org-detail-panel");
  });
});
