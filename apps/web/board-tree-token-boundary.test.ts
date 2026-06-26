import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("board tree compact token baseline", () => {
  it("keeps the left board tree spacing, weights, and unread badge on dedicated tokens", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");

    expect(globalCss).toContain("--board-tree-section-gap: 8px;");
    expect(globalCss).toContain("--board-tree-item-gap: 3px;");
    expect(globalCss).toContain("--board-tree-link-padding-block: 3px;");
    expect(globalCss).toContain("--board-tree-parent-font-size: calc(var(--font-size-page-title) - 1px);");
    expect(globalCss).toContain("--board-tree-parent-weight: var(--font-weight-bold);");
    expect(globalCss).toContain("--board-tree-child-weight: var(--font-weight-semibold);");
    expect(globalCss).toContain("--board-tree-unread-badge-height: 18px;");
    expect(globalCss).toContain("--board-tree-unread-badge-min-width: 18px;");
    expect(globalCss).toContain("--board-tree-unread-badge-padding-inline: 5px;");
    expect(globalCss).toContain("--board-tree-unread-badge-font-size: 10px;");
    expect(globalCss).toContain("--board-tree-unread-badge-font-weight: var(--font-weight-medium);");

    expect(globalCss).toContain("gap: var(--board-tree-section-gap);");
    expect(globalCss).toContain("gap: var(--board-tree-item-gap);");
    expect(globalCss).toContain("padding: var(--board-tree-link-padding-block) 0;");
    expect(globalCss).toContain("font-size: var(--board-tree-parent-font-size);");
    expect(globalCss).toContain("font-weight: var(--board-tree-parent-weight);");
    expect(globalCss).toContain("font-weight: var(--board-tree-child-weight);");
    expect(globalCss).toContain("min-width: var(--board-tree-unread-badge-min-width);");
    expect(globalCss).toContain("height: var(--board-tree-unread-badge-height);");
    expect(globalCss).toContain("font-size: var(--board-tree-unread-badge-font-size);");
    expect(globalCss).toContain("font-weight: var(--board-tree-unread-badge-font-weight);");
    expect(globalCss).toContain("padding: 0 var(--board-tree-unread-badge-padding-inline);");
  });
});
