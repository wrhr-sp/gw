import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ForbiddenPage from "./app/forbidden/page";
import { buildSectionPage } from "./app/section-page";

describe("feature page content spacing baseline", () => {
  it("keeps desktop feature pages on the shared PageShell spacing model", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");

    expect(globalCss).toContain("--desktop-sidebar-collapsed-width: 86px");
    expect(globalCss).toContain("--desktop-content-padding-inline: clamp(6px, 0.72vw, 12px)");
    expect(globalCss).toContain(".page-shell,");
    expect(globalCss).toContain("width: 100%");
    expect(globalCss).toContain("max-width: none");
    expect(globalCss).toContain("padding-inline: var(--desktop-content-padding-inline)");
    expect(globalCss).toContain("width: calc(100% - var(--desktop-content-padding-inline) - var(--desktop-content-padding-inline))");
    expect(globalCss).toContain(".page-shell__content {");
    expect(globalCss).toContain("gap: 0;");
    expect(globalCss).toContain("background: var(--surface);");
    expect(globalCss).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(globalCss).toContain(".app-shell__body > .page-shell {");
    expect(globalCss).toContain("flex: 1 1 auto;");
    expect(globalCss).toContain("padding-bottom: var(--desktop-content-padding-inline);");
    expect(globalCss).not.toContain("padding-bottom: 28px;");
    expect(globalCss).toContain("overflow: hidden;");
    expect(globalCss).toContain("overflow-y: auto;");
    expect(globalCss).toContain(".page-shell__content:hover");
    expect(globalCss).toContain(".page-shell__content > .surface-card {");
    expect(globalCss).toContain(".page-shell__content > .surface-card + .surface-card {");
    expect(globalCss).toContain(".page-shell__content .grid-auto,");
    expect(globalCss).toContain(".page-shell__content .info-card,");
    expect(globalCss).not.toContain(".page-shell__content .grid-auto > * + *");
    expect(globalCss).toContain(".board-workspace__list,");
    expect(globalCss).toContain("border-left: 1px solid var(--line);");
    expect(globalCss).toContain(".page-shell__headline h1,");
    expect(globalCss).toContain(".surface-card__header h2,");
    expect(globalCss).toContain(".board-section-title h2,");
    expect(globalCss).toContain(".board-detail-preview h2 {");
    expect(globalCss).toContain("font-size: var(--font-size-feature-title);");
    expect(globalCss).toContain("font-weight: var(--font-weight-feature-title);");
    expect(globalCss).toContain("letter-spacing: var(--letter-spacing-feature-title);");
    expect(globalCss).toContain(".page-shell__content .pill {");
    expect(globalCss).toContain("display: none;");
    expect(globalCss).toContain("padding-inline: 14px;");
  });

  it("removes ad-hoc centered feature page shells from fallback routes", () => {
    const SectionPage = buildSectionPage("테스트 섹션", "테스트 설명");
    const forbiddenHtml = renderToStaticMarkup(<ForbiddenPage />);
    const sectionHtml = renderToStaticMarkup(<SectionPage />);

    expect(forbiddenHtml).toContain('class="page-shell"');
    expect(sectionHtml).toContain('class="page-shell"');
    expect(sectionHtml).not.toContain('class="page-shell__title-link"');
    expect(forbiddenHtml).not.toContain("max-width:720px");
    expect(sectionHtml).not.toContain("max-width:860px");
    expect(forbiddenHtml).not.toContain("padding:48px 24px");
    expect(sectionHtml).not.toContain("padding:48px 24px");
  });
});
