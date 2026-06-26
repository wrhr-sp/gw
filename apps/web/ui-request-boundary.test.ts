import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("requested UI boundary fixes", () => {
  const boardsSource = readFileSync("app/boards/page.tsx", "utf8");
  const pageShellSource = readFileSync("app/_components/page-shell.tsx", "utf8");
  const globalCss = readFileSync("app/globals.css", "utf8");

  it("keeps board navigation clean and unread badges round/red", () => {
    expect(boardsSource).not.toContain("board-tree-link__prefix");
    expect(boardsSource).toContain("board-tree-link__branch");
    expect(boardsSource).toContain("ㄴ");
    expect(boardsSource).not.toContain("새 글 없음");
    expect(boardsSource).not.toContain("새 글 ${board.unread}");
    expect(boardsSource).toContain("board-unread-badge");
    expect(globalCss).toContain(".board-tree-section--department");
    expect(globalCss).not.toContain(".board-tree-link + .board-tree-link");
    expect(globalCss).toContain(".board-unread-badge");
    expect(globalCss).toContain("background: var(--danger)");
    expect(globalCss).toContain("border-radius: var(--radius-pill)");
    expect(globalCss).toContain(".board-write-button:hover");
    expect(globalCss).toContain("--board-write-button-background: #fff;");
    expect(globalCss).toContain("background: var(--board-write-button-background)");
  });

  it("lets feature page titles return to the initial screen", () => {
    expect(pageShellSource).toContain("page-shell__title-link");
    expect(pageShellSource).toContain('backHref = "/home"');
    expect(globalCss).toContain(".page-shell__title-link");
  });
});
