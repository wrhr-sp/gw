import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("requested UI boundary fixes", () => {
  const boardsSource = readFileSync("app/boards/page.tsx", "utf8");
  const pageShellSource = readFileSync("app/_components/page-shell.tsx", "utf8");
  const globalCss = readFileSync("app/globals.css", "utf8");

  it("keeps board navigation clean and unread badges round/red", () => {
    expect(boardsSource).not.toContain("board-tree-link__prefix");
    expect(boardsSource).not.toContain("ㄴ");
    expect(boardsSource).toContain("board-unread-badge");
    expect(globalCss).toContain(".board-unread-badge");
    expect(globalCss).toContain("background: #ef4444");
    expect(globalCss).toContain("border-radius: 999px");
    expect(globalCss).toContain(".board-write-button:hover");
    expect(globalCss).toContain("background: #fff");
  });

  it("lets feature page titles return to the initial screen", () => {
    expect(pageShellSource).toContain("page-shell__title-link");
    expect(pageShellSource).toContain('backHref = "/home"');
    expect(globalCss).toContain(".page-shell__title-link");
  });
});
