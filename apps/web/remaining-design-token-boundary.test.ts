import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("remaining balanced design tokens", () => {
  it("keeps form, data, empty-state, and mobile tokens on the existing-average B baseline", () => {
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(globalCss).toContain("--form-control-height: 40px;");
    expect(globalCss).toContain("--form-control-radius: var(--radius-md);");
    expect(globalCss).toContain("--form-control-padding: 12px 14px;");
    expect(globalCss).toContain("--form-textarea-min-height: 120px;");
    expect(globalCss).toContain("--form-grid-gap: var(--space-md);");
    expect(globalCss).toContain("--form-grid-min: 180px;");
    expect(globalCss).toContain("--state-disabled-opacity: 0.6;");
    expect(globalCss).toContain("--state-disabled-cursor: not-allowed;");
    expect(globalCss).toContain("--data-card-gap: 10px;");
    expect(globalCss).toContain("--status-badge-height: 22px;");
    expect(globalCss).toContain("--status-badge-min-width: 22px;");
    expect(globalCss).toContain("--status-badge-font-size: var(--font-size-badge-px);");
    expect(globalCss).toContain("--empty-state-gap: 10px;");
    expect(globalCss).toContain("--empty-state-action-gap: var(--space-xs);");
    expect(globalCss).toContain("--status-banner-padding: 14px var(--space-lg);");
    expect(globalCss).toContain("--status-banner-radius: var(--radius-lg);");
    expect(globalCss).toContain("--mobile-nav-height: 74px;");
    expect(globalCss).toContain("--mobile-nav-max-width: 640px;");
    expect(globalCss).toContain("--mobile-nav-collapsed-width: 56px;");
    expect(globalCss).toContain("--mobile-nav-toggle-width: 48px;");
    expect(globalCss).toContain("--mobile-nav-gap: 4px;");
    expect(globalCss).toContain("--mobile-touch-target: 48px;");

    expect(globalCss).toContain("padding: var(--status-banner-padding);");
    expect(globalCss).toContain("border-radius: var(--status-banner-radius);");
    expect(globalCss).toContain("gap: var(--data-card-gap);");
    expect(globalCss).toContain("min-height: var(--mobile-touch-target);");
    expect(globalCss).toContain("opacity: var(--state-disabled-opacity);");
    expect(globalCss).toContain("cursor: var(--state-disabled-cursor);");
    expect(globalCss).toContain("gap: var(--empty-state-action-gap);");
    expect(globalCss).toContain("font-size: var(--empty-state-copy-size);");
    expect(globalCss).toContain("gap: var(--empty-state-gap);");
    expect(globalCss).toContain("grid-template-columns: repeat(auto-fit, minmax(var(--form-grid-min), 1fr));");
    expect(globalCss).toContain("min-height: var(--form-control-height);");
    expect(globalCss).toContain("border-radius: var(--form-control-radius);");
    expect(globalCss).toContain("padding: var(--form-control-padding);");
    expect(globalCss).toContain("min-height: var(--form-textarea-min-height);");
    expect(globalCss).toContain("width: min(var(--mobile-nav-max-width), calc(100vw - 24px));");
    expect(globalCss).toContain("width: var(--mobile-nav-collapsed-width);");
    expect(globalCss).toContain("width: var(--mobile-nav-toggle-width);");
    expect(globalCss).toContain("gap: var(--mobile-nav-gap);");
    expect(globalCss).toContain("padding: var(--mobile-nav-padding) var(--mobile-nav-padding) var(--mobile-nav-padding) 0;");
    expect(globalCss).toContain("min-height: var(--mobile-nav-link-min-height);");
    expect(globalCss).toContain("min-height: var(--mobile-nav-pill-min-height);");
    expect(globalCss).toContain("min-width: var(--status-badge-min-width);");
    expect(globalCss).toContain("height: var(--status-badge-height);");
  });
});
