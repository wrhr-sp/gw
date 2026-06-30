import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("feature content area common tokens", () => {
  it("routes feature sublists, child markers, write buttons, dividers, settings icon, and count badges through common tokens", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
    const mailClient = readFileSync(new URL("./app/mail/mail-client.tsx", import.meta.url), "utf8");

    expect(globalCss).toContain("--feature-page-sublist-font-family: var(--font-family-sans);");
    expect(globalCss).toContain("--feature-page-sublist-font-size: inherit;");
    expect(globalCss).toContain("--feature-page-sublist-font-weight: var(--board-tree-child-weight);");
    expect(globalCss).toContain("--feature-page-sublist-grid-columns: auto minmax(0, 1fr) auto;");
    expect(globalCss).toContain("--feature-page-sublist-section-gap: var(--board-tree-section-gap);");
    expect(globalCss).toContain("--feature-page-sublist-item-gap: var(--board-tree-item-gap);");
    expect(globalCss).toContain("--feature-page-sublist-column-gap: var(--board-tree-link-gap);");
    expect(globalCss).toContain("--feature-page-sublist-padding-block: var(--board-tree-link-padding-block);");
    expect(globalCss).toContain("--feature-page-sublist-marker-content: \"ㄴ\";");
    expect(globalCss).toContain("--feature-page-sublist-marker-color: var(--board-tree-link-branch-color);");
    expect(globalCss).toContain("--feature-page-sublist-marker-gap: var(--feature-page-sublist-column-gap);");
    expect(globalCss).toContain("--feature-page-list-section-gap: var(--feature-page-sublist-section-gap);");
    expect(globalCss).toContain("--feature-page-list-item-gap: var(--feature-page-sublist-item-gap);");
    expect(globalCss).toContain("--feature-page-list-item-inner-gap: var(--feature-page-sublist-column-gap);");
    expect(globalCss).toContain("--feature-page-list-item-padding-block: var(--feature-page-sublist-padding-block);");
    expect(globalCss).toContain("--feature-page-write-button-min-height: var(--board-write-button-min-height);");
    expect(globalCss).toContain("--feature-page-write-button-font-weight: var(--board-write-button-font-weight);");
    expect(globalCss).toContain("--feature-page-write-button-font-variation-settings: var(--board-write-button-font-variation-settings);");
    expect(globalCss).toContain("--feature-page-list-parent-divider: var(--board-tree-section-department-border-top);");
    expect(globalCss).toContain("--feature-page-title-settings-button-size: 28px;");
    expect(globalCss).toContain("--feature-page-title-settings-button-icon-size: 16px;");
    expect(globalCss).toContain("--feature-page-count-badge-bg: var(--primary-soft);");
    expect(globalCss).toContain("--feature-page-count-badge-color: var(--primary-hover);");
    expect(globalCss).toContain("--feature-page-count-badge-font-size: var(--feature-page-sublist-font-size);");

    expect(globalCss).toContain("font-size: var(--feature-page-sublist-font-size);");
    expect(globalCss).toContain("font-family: var(--feature-page-sublist-font-family);");
    expect(globalCss).toContain("font-weight: var(--feature-page-sublist-font-weight);");
    expect(globalCss).toContain(".board-tree-link,\n.mail-folder-list__item--child {");
    expect(globalCss).toContain("grid-template-columns: var(--feature-page-sublist-grid-columns);");
    expect(globalCss).toContain("content: var(--feature-page-sublist-marker-content);");
    expect(globalCss).toContain(".feature-workspace__tab-list {");
    expect(globalCss).toContain("gap: var(--feature-page-sublist-item-gap);");
    expect(globalCss).toContain("gap: var(--feature-page-sublist-section-gap);");
    expect(globalCss).toContain("gap: var(--feature-page-sublist-column-gap);");
    expect(globalCss).toContain("padding: var(--feature-page-sublist-padding-block) 0;");
    expect(globalCss).toContain("border: var(--feature-page-write-button-border);");
    expect(globalCss).toContain("border-top: var(--feature-page-list-parent-divider);");
    expect(globalCss).toContain("width: var(--feature-page-title-settings-button-size);");
    expect(globalCss).toContain("font-size: var(--feature-page-title-settings-button-icon-size);");
    expect(globalCss).toContain("background: var(--feature-page-count-badge-bg);");

    expect(mailClient).toContain('<span aria-hidden="true">⚙</span>');
    expect(mailClient).not.toContain("`ㄴ${folder.label}`");
  });
});
