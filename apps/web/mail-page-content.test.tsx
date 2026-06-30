import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MailPage from "./app/mail/page";

describe("mail page content", () => {
  it("renders the default mail folder tree and scoped mail list settings", () => {
    const html = renderToStaticMarkup(<MailPage />);

    expect(html).toContain("메일");
    expect(html).toContain('aria-label="메일 목록 편집"');
    expect(html).not.toContain(">설정</button>");
    expect(html).toContain('aria-label="메일함 목록"');
    expect(html).toContain("즐겨찾기");
    expect(html).toContain("메일함");
    expect(html).toContain("받은 메일함");
    expect(html).toContain("보낸메일함");
    expect(html).toContain("임시보관함");
    expect(html).toContain("예약메일함");
    expect(html).toContain("스팸메일함");
    expect(html).toContain("휴지통");
    expect(html).not.toContain("ㄴ받은 메일함");
    expect(html).toContain("외부메일함");
  });

  it("uses the board write button token for the mail compose button", () => {
    const html = renderToStaticMarkup(<MailPage />);
    const source = readFileSync("app/mail/mail-client.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(html).toContain('class="board-write-button mail-write-button"');
    expect(html).toContain("메일쓰기");
    expect(source).toContain('className="board-write-button mail-write-button"');
    expect(globalCss).toContain(".board-write-button,");
    expect(globalCss).toContain("background: var(--feature-page-write-button-background)");
    expect(globalCss).toContain("--feature-page-write-button-background: var(--board-write-button-background);");
    expect(globalCss).toContain(".mail-write-button");
  });
});
