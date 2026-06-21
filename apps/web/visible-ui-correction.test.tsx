import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BoardsPage from "./app/boards/page";
import PayrollPage from "./app/payroll/page";
import {
  SensitiveContentPinGate,
  resolveSensitiveContentUnlock,
  validateSensitivePagePin,
} from "./app/_components/sensitive-content-pin-gate";

describe("visible board and secondary-password corrections", () => {
  it("renders /boards with separate board and post lanes plus a visible write CTA", () => {
    const html = renderToStaticMarkup(<BoardsPage />);

    expect(html).toContain("게시판 목록");
    expect(html).toContain("게시글 목록");
    expect(html).toContain("자유 게시판 글쓰기");
    expect(html).toContain("게시판 목록과 게시글 목록을 좌우 2영역으로 나눠");
    expect(html).not.toContain("게시판별 책임 한눈에 보기");
    expect(html).not.toContain("미확인 n건");
  });

  it("keeps /payroll sensitive panels out of the DOM until the content-area PIN gate unlocks", () => {
    const html = renderToStaticMarkup(<PayrollPage />);

    expect(html).toContain("민감 정보 확인");
    expect(html).toContain("2차 비밀번호");
    expect(html).toContain("콘텐츠 열기");
    expect(html).toContain("미리보기에서는 2468 입력 시 콘텐츠 영역이 열립니다.");
    expect(html).not.toContain("실사용 급여 패널");
    expect(html).not.toContain("급여 프로필 skeleton");
    expect(html).not.toContain("본사 급여 담당");
  });

  it("keeps children hidden for an invalid PIN and marks them renderable only after a valid PIN submit", () => {
    const lockedHtml = renderToStaticMarkup(
      <SensitiveContentPinGate title="민감 정보 확인" description="설명">
        <div>민감 패널</div>
      </SensitiveContentPinGate>,
    );

    expect(lockedHtml).not.toContain("민감 패널");
    expect(validateSensitivePagePin("12")).toBe("2차 비밀번호 4자리를 입력해 주세요.");
    expect(validateSensitivePagePin("1111")).toBe("미리보기용 2차 비밀번호와 일치하지 않습니다.");

    const failedUnlock = resolveSensitiveContentUnlock("1111");
    expect(failedUnlock).toEqual({
      error: "미리보기용 2차 비밀번호와 일치하지 않습니다.",
      isUnlocked: false,
      shouldRenderChildren: false,
    });

    const successfulUnlock = resolveSensitiveContentUnlock("2468");
    expect(successfulUnlock).toEqual({
      error: null,
      isUnlocked: true,
      shouldRenderChildren: true,
    });
  });
});
