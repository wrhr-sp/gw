import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("groupware typography baseline", () => {
  it("self-hosts Pretendard and routes all app text through typography tokens", () => {
    const globalCss = readFileSync("app/globals.css", "utf8");
    const tinymceContentCss = readFileSync("public/tinymce/skins/content/default/content.min.css", "utf8");

    expect(existsSync("public/fonts/pretendard/PretendardVariable.woff2")).toBe(true);
    expect(existsSync("public/fonts/pretendard/LICENSE.txt")).toBe(true);
    expect(globalCss).toContain('font-family: "Pretendard Variable";');
    expect(globalCss).toContain('src: url("/fonts/pretendard/PretendardVariable.woff2") format("woff2-variations");');
    expect(globalCss).toContain('--font-family-sans: "Pretendard Variable", Pretendard');
    expect(globalCss).toContain("font-family: var(--font-family-sans);");
    expect(globalCss).toContain("--font-size-2xs: 0.65rem;");
    expect(globalCss).toContain("--font-size-xs: 0.72rem;");
    expect(globalCss).toContain("--font-size-sm: 0.8rem;");
    expect(globalCss).toContain("--font-size-md: 0.88rem;");
    expect(globalCss).toContain("--font-size-body: 1rem;");
    expect(globalCss).toContain("--font-size-lg: 1.15rem;");
    expect(globalCss).toContain("--font-size-page-title: 1.22rem;");
    expect(globalCss).toContain("--font-size-content-title: 1.15rem;");
    expect(globalCss).toContain("--font-size-feature-title: var(--font-size-page-title);");
    expect(globalCss).toContain("--font-size-xl: 1.42rem;");
    expect(globalCss).toContain("--font-weight-regular: 400;");
    expect(globalCss).toContain("--font-weight-medium: 500;");
    expect(globalCss).toContain("--font-weight-semibold: 600;");
    expect(globalCss).toContain("--font-weight-bold: 700;");
    expect(globalCss).toContain("--font-weight-heavy: 800;");
    expect(globalCss).toContain("--font-weight-black: 850;");
    expect(globalCss).toContain("--font-weight-page-title: var(--font-weight-bold);");
    expect(globalCss).toContain("--font-weight-content-title: var(--font-weight-bold);");
    expect(globalCss).toContain("--font-weight-feature-title: var(--font-weight-page-title);");
    expect(globalCss).toContain("--letter-spacing-feature-title: -0.04em;");
    expect(globalCss).toContain("--line-height-tight: 1;");
    expect(globalCss).toContain("--line-height-compact: 1.15;");
    expect(globalCss).toContain("--line-height-snug: 1.35;");
    expect(globalCss).toContain("--line-height-default: 1.45;");
    expect(globalCss).toContain("--line-height-readable: 1.55;");
    expect(globalCss).toContain("--line-height-comfortable: 1.65;");
    expect(globalCss).not.toContain("font-family: system-ui, sans-serif;");
    expect(globalCss).not.toContain("'Segoe UI',Roboto");
    expect(tinymceContentCss).toContain("Pretendard Variable");
    expect(tinymceContentCss).toContain("/fonts/pretendard/PretendardVariable.woff2");
  });
});
