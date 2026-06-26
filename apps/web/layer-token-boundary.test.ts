import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PC layer, modal, popover, and toast design tokens", () => {
  it("keeps the chosen B layer tokens and routes topbar layers through them", () => {
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(globalCss).toContain("--z-topbar: 20;");
    expect(globalCss).toContain("--z-bottom-nav: 30;");
    expect(globalCss).toContain("--z-sidebar: 35;");
    expect(globalCss).toContain("--z-popover: 40;");
    expect(globalCss).toContain("--z-tooltip: 60;");
    expect(globalCss).toContain("--z-desktop-topbar: 70;");
    expect(globalCss).toContain("--z-modal: 80;");
    expect(globalCss).toContain("--z-modal-priority: 90;");
    expect(globalCss).toContain("--z-toast: 95;");
    expect(globalCss).toContain("--z-refresh-overlay: 9999;");
    expect(globalCss).toContain("--layer-overlay-bg: rgba(15, 23, 42, 0.32);");
    expect(globalCss).toContain("--layer-backdrop-blur: blur(12px);");
    expect(globalCss).toContain("--layer-surface-blur: blur(12px) saturate(1.12);");
    expect(globalCss).toContain("--layer-radius-modal: 18px;");
    expect(globalCss).toContain("--layer-radius-popover: 16px;");
    expect(globalCss).toContain("--layer-padding-modal: 20px;");
    expect(globalCss).toContain("--layer-padding-popover: 16px;");
    expect(globalCss).toContain(".topbar-modal-backdrop {");
    expect(globalCss).toContain("z-index: var(--z-modal);");
    expect(globalCss).toContain("background: var(--layer-overlay-bg);");
    expect(globalCss).toContain("backdrop-filter: var(--layer-backdrop-blur);");
    expect(globalCss).toContain(".topbar-modal {");
    expect(globalCss).toContain("border-radius: var(--layer-radius-modal);");
    expect(globalCss).toContain("padding: var(--layer-padding-modal);");
    expect(globalCss).toContain(".topbar-profile-popover {");
    expect(globalCss).toContain("z-index: var(--z-popover);");
    expect(globalCss).toContain("border-radius: var(--layer-radius-popover);");
    expect(globalCss).toContain("padding: var(--layer-padding-popover);");
    expect(globalCss).toContain(".permission-denied-toast {");
    expect(globalCss).toContain("top: var(--layer-toast-top);");
    expect(globalCss).toContain("--permission-denied-toast-width: min(var(--layer-toast-max-width), calc(100vw - 24px));");
    expect(globalCss).toContain("width: var(--permission-denied-toast-width);");
  });
});
