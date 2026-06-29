import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OrgPage from "./app/org/page";

describe("org feature workspace page", () => {
  it("renders organization chart with department, member, and access scope panels", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
    const source = readFileSync(new URL("./app/org/page.tsx", import.meta.url), "utf8");
    const html = renderToStaticMarkup(<OrgPage />);

    expect(html).toContain("조직도");
    expect(html).toContain("조직 트리");
    expect(html).toContain("부서 상세");
    expect(html).toContain("구성원");
    expect(html).toContain("접근 범위");
    expect(html).toContain("서울지점");
    expect(html).not.toContain("preview sample");
    expect(html).not.toContain("운영 DB seed");
    expect(html).not.toContain("실데이터 변경");

    expect(source).toContain("const orgConfig");
    expect(source).not.toContain("const orgPreviewDepartments");
    expect(source).not.toContain("appRoutes.org.departments");
    expect(source).not.toContain("OrgDirectoryLiveSection");

    expect(globalCss).toContain(".feature-workspace");
    expect(globalCss).toContain(".feature-workspace__panel");
  });
});
