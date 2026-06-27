import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MessengerPage from "./app/messenger/page";

describe("messenger preview page", () => {
  it("renders the board-like content title with conversation list and chat room columns plus a hidden new-message org popup", () => {
    const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");
    const html = renderToStaticMarkup(<MessengerPage />);

    expect(html).toContain("메신저");
    expect(html).toContain("대화목록");
    expect(html).toContain("채팅방");
    expect(html).toContain("새 메시지");
    expect(html).toContain("이름, 부서, 메시지 검색");
    expect(html).toContain("메시지 입력 preview");
    expect(html).toContain("새 메시지 대상 선택 팝업");
    expect(html).toContain("사람 검색");
    expect(html).toContain("조직도");
    expect(html).toContain("선택한 사람");
    expect(html).toContain("대화 시작");
    expect(html).toContain("첨부 메뉴 열기");
    expect(html).toContain("파일첨부");
    expect(html).toContain("사진보내기");
    expect(html).toContain("이모티콘 선택");
    expect(html).toContain("메시지 보내기");
    expect(html).not.toContain("이번 preview 범위");
    expect(html).not.toContain("WebSocket 실시간 채팅");
    expect(html).not.toContain("운영 DB 실데이터 저장");

    expect(globalCss).toContain(".messenger-shell");
    expect(globalCss).toContain("grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);");
    expect(globalCss).toContain(".messenger-recipient-backdrop[hidden]");
    expect(globalCss).toContain(".messenger-recipient-backdrop .messenger-recipient-panel");
    expect(globalCss).toContain(".messenger-thread[aria-current=\"page\"]");
    expect(globalCss).toContain(".messenger-message--mine");
    expect(globalCss).toContain("grid-template-columns: max-content minmax(0, 1fr) max-content max-content;");
    expect(globalCss).toContain(".messenger-composer-icon-button");
    expect(globalCss).toContain(".messenger-send-button svg");
    expect(globalCss).toContain(".messenger-attachment-menu[hidden]");
  });
});
