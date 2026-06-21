import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ForbiddenPage from "./app/forbidden/page";
import { buildSectionPage } from "./app/section-page";

describe("feature page content spacing baseline", () => {
  it("keeps desktop feature pages on the shared PageShell spacing model", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");

    expect(globalCss).toContain("--desktop-sidebar-collapsed-width: 116px");
    expect(globalCss).toContain("--desktop-content-padding-inline: clamp(9px, 1vw, 16px)");
    expect(globalCss).toContain(".page-shell,");
    expect(globalCss).toContain("width: 100%");
    expect(globalCss).toContain("max-width: none");
    expect(globalCss).toContain("padding-inline: var(--desktop-content-padding-inline)");
    expect(globalCss).toContain("width: calc(100% - var(--desktop-content-padding-inline) - var(--desktop-content-padding-inline))");
    expect(globalCss).toContain(".page-shell__content {");
    expect(globalCss).toContain("gap: 0;");
    expect(globalCss).toContain("background: var(--surface);");
    expect(globalCss).toContain(".page-shell__content > .surface-card {");
    expect(globalCss).toContain(".page-shell__content > .surface-card + .surface-card {");
  });

  it("removes ad-hoc centered feature page shells from fallback routes", () => {
    const SectionPage = buildSectionPage("테스트 섹션", "테스트 설명");
    const forbiddenHtml = renderToStaticMarkup(<ForbiddenPage />);
    const sectionHtml = renderToStaticMarkup(<SectionPage />);

    expect(forbiddenHtml).toContain('class="page-shell"');
    expect(sectionHtml).toContain('class="page-shell"');
    expect(forbiddenHtml).not.toContain("max-width:720px");
    expect(sectionHtml).not.toContain("max-width:860px");
    expect(forbiddenHtml).not.toContain("padding:48px 24px");
    expect(sectionHtml).not.toContain("padding:48px 24px");
  });
});
