import { expect, test } from "@playwright/experimental-ct-react";
import AxeBuilder from "@axe-core/playwright";
import { HotelListStory } from "../playwright/stories/hotel-list.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 호텔 목록 표 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const list = await mount(<HotelListStory />);
  await page.evaluate(() => document.fonts.ready);
  const hotelList = list.getByLabel("호텔 목록");
  await expect(hotelList.locator("table")).toBeVisible();
  await expect(hotelList.locator("ul")).toBeHidden();
  await expect(list.getByRole("button", { name: "조회" })).toHaveCSS("min-height", "44px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("hotel-list-desktop.png");
});

test("노트북 호텔 목록 표 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const list = await mount(<HotelListStory />);
  await page.evaluate(() => document.fonts.ready);
  await expect(list.getByLabel("호텔 목록").locator("table")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("hotel-list-laptop.png", { fullPage: true });
});

test("모바일 호텔 목록 카드 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const list = await mount(<HotelListStory />);
  await page.evaluate(() => document.fonts.ready);
  const hotelList = list.getByLabel("호텔 목록");
  await expect(hotelList.locator("table")).toBeHidden();
  const cards = hotelList.locator("ul");
  await expect(cards).toBeVisible();
  await expect(cards.getByRole("link", { name: /위아히어 강남호텔/ })).toHaveCSS("min-height", "44px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("hotel-list-mobile.png", { fullPage: true });
});
