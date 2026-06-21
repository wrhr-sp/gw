import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MePage from "./app/me/page";

describe("Phase 59 help entry surfaces", () => {
  it("adds a user help entry section on the me page with a link back to the integrated UAT checklist", () => {
    const html = renderToStaticMarkup(<MePage />);

    expect(html).toContain("사용자 도움말 진입");
    expect(html).toContain("로그인 전 역할 선택 도움말");
    expect(html).toContain("전체 메뉴에서 다시 찾기");
    expect(html).toContain("내 정보에서 마무리 확인");
    expect(html).toContain("통합 UAT 체크 화면");
    expect(html).toContain('href="/uat"');
    expect(html).toContain("forbidden, offline, dev-safe");
  });
});
