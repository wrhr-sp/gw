import { expect, test } from "@playwright/experimental-ct-react";
import AxeBuilder from "@axe-core/playwright";
import { HotelDetailStory } from "../playwright/stories/hotel-detail.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} 호텔 상세 기본정보 기준 화면`, async ({ mount, page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const detail = await mount(<HotelDetailStory />);
    await page.evaluate(() => document.fonts.ready);
    await expect(detail.getByRole("heading", { name: "위아히어 강남호텔", level: 1 })).toBeVisible();
    await expect(detail.getByText("서울특별시 강남구 테헤란로 1")).toBeVisible();
    await expect(detail.getByRole("link", { name: "호텔 목록" })).toHaveCSS("min-height", "44px");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page).toHaveScreenshot(`hotel-detail-${viewport.name}.png`, { fullPage: viewport.name === "mobile" });
  });
}
