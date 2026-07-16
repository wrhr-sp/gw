import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, colorTokens, layoutTokens, radiusTokens } from "../src/index";

describe("approved hotel UI foundation", () => {
  it("uses the approved navy and teal semantic palette", () => {
    expect(colorTokens).toEqual({
      primary: "#193B57",
      accent: "#0E8A7A",
      background: "#F4F7FA",
      surface: "#FFFFFF",
      text: "#172033",
      muted: "#667085",
      border: "#DFE5EA",
    });
  });

  it("keeps the approved desktop and mobile dimensions", () => {
    expect(layoutTokens).toMatchObject({
      desktopTopbar: 64,
      desktopSidebar: 240,
      desktopSidebarCollapsed: 72,
      desktopDetailPanel: 480,
      desktopTableRow: 46,
      mobileTopbar: 56,
      mobileBottomNavigation: 64,
      mobilePrimaryAction: 52,
    });
  });

  it("keeps restrained radii instead of generic pill cards", () => {
    expect(radiusTokens).toEqual({ control: 8, card: 10, mobileCard: 12, overlay: 12, badge: 6 });
  });

  it("renders accessible shadcn-style button variants", () => {
    const primary = renderToStaticMarkup(<Button>호텔 등록</Button>);
    const danger = renderToStaticMarkup(<Button variant="danger">운영 중지</Button>);
    expect(primary).toContain("type=\"button\"");
    expect(primary).toContain("bg-primary");
    expect(primary).toContain("h-10");
    expect(danger).toContain("border-danger");
    expect(danger).toContain("text-danger");
  });
});
