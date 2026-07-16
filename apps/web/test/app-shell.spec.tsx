import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "../components/shell/app-shell";

describe("hotel operations app shell", () => {
  it("renders desktop and mobile navigation from explicit authorized items", () => {
    const html = renderToStaticMarkup(
      <AppShell
        currentPath="/hotels"
        hotelName="서울호텔"
        navigation={[
          { href: "/hotel-operations", label: "운영 홈" },
          { href: "/hotels", label: "호텔" },
        ]}
        userDisplayName="관리자"
      >
        <main>업무 내용</main>
      </AppShell>,
    );
    expect(html).toContain("서울호텔");
    expect(html).toContain("관리자");
    expect(html).toContain("aria-label=\"호텔 운영 주 메뉴\"");
    expect(html).toContain("aria-label=\"모바일 호텔 운영 메뉴\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain("업무 내용");
  });
});
