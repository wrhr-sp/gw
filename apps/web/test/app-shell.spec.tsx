import { renderToStaticMarkup } from "react-dom/server";
import { Building2, Home } from "lucide-react";
import { describe, expect, it } from "vitest";
import { AppShell } from "../components/shell/app-shell";

describe("hotel operations app shell", () => {
  it("renders desktop and mobile navigation from explicit authorized items", () => {
    const html = renderToStaticMarkup(
      <AppShell
        currentPath="/hotels"
        hotelName="서울호텔"
        navigation={[
          { href: "/hotel-operations", label: "운영 홈", icon: <Home aria-hidden="true" /> },
          { href: "/hotels", label: "호텔", icon: <Building2 aria-hidden="true" /> },
        ]}
        userDisplayName="관리자"
      >
        <div>업무 내용</div>
      </AppShell>,
    );
    expect(html).toContain("서울호텔");
    expect(html).toContain("관리자");
    expect(html).toContain("aria-label=\"호텔 운영 주 메뉴\"");
    expect(html).toContain("aria-label=\"모바일 호텔 운영 메뉴\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain("href=\"#main-content\"");
    expect(html).toContain("id=\"main-content\"");
    expect(html).toContain("업무 내용");
  });
});
