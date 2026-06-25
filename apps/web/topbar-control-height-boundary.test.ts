import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PC topbar control height baseline", () => {
  it("matches portal switch buttons to the 32px settings button height on PC only", () => {
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(globalCss).toContain("--desktop-topbar-control-size: 32px;");
    expect(globalCss).toContain("--desktop-portal-switch-height: var(--desktop-topbar-control-size);");
    expect(globalCss).toContain("@media (min-width: 961px) {");
    expect(globalCss).toContain(".topbar-icon-link {");
    expect(globalCss).toContain("width: var(--desktop-topbar-control-size);");
    expect(globalCss).toContain("height: var(--desktop-topbar-control-size);");
    expect(globalCss).toContain(".portal-switch-link {");
    expect(globalCss).toContain("height: var(--desktop-portal-switch-height);");
    expect(globalCss).toContain("min-height: var(--desktop-portal-switch-height);");
    expect(globalCss).toContain("padding: 0 var(--space-md);");
  });
});
