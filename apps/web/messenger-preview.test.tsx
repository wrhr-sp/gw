import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MessengerPage from "./app/messenger/page";

describe("messenger preview page", () => {
  it("renders chat list, conversation, search, org selector, and safe preview boundaries", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
    const html = renderToStaticMarkup(<MessengerPage />);

    expect(html).toContain("메신저");
    expect(html).toContain("채팅목록");
    expect(html).toContain("새 메시지");
    expect(html).toContain("이름, 부서, 메시지 검색");
    expect(html).toContain("대화창");
    expect(html).toContain("메시지 입력 preview");
    expect(html).toContain("새 메시지 대상 선택 팝업");
    expect(html).toContain("사람 검색");
    expect(html).toContain("조직도 팝업");
    expect(html).toContain("선택한 사람");
    expect(html).toContain("대화 시작");
    expect(html).toContain("WebSocket 실시간 채팅");
    expect(html).toContain("운영 DB 실데이터 저장");

    expect(globalCss).toContain(".messenger-shell");
    expect(globalCss).toContain("grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) minmax(280px, 340px);");
    expect(globalCss).toContain(".messenger-recipient-panel");
    expect(globalCss).toContain(".messenger-thread[aria-current=\"page\"]");
    expect(globalCss).toContain(".messenger-message--mine");
  });
});
