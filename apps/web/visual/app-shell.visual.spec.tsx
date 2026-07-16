import { expect, test } from "@playwright/experimental-ct-react";
import { AppShellStory } from "../playwright/stories/app-shell.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC AppShell 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shell = await mount(<AppShellStory />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  await expect(shell.getByRole("complementary")).toHaveCSS("width", "240px");
  await expect(shell.getByRole("banner")).toHaveCSS("height", "64px");
  await expect(shell.getByRole("main")).toHaveCSS("padding-left", "24px");
  await expect(shell.getByRole("navigation", { name: "모바일 호텔 운영 메뉴" })).toBeHidden();
  await expect(page).toHaveScreenshot("app-shell-desktop.png");
});

test("노트북 AppShell 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const shell = await mount(<AppShellStory />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  await expect(shell.getByRole("complementary")).toHaveCSS("width", "72px");
  await expect(shell.getByRole("banner").locator("..")).toHaveCSS("padding-left", "72px");
  await expect(shell.getByRole("navigation", { name: "호텔 운영 주 메뉴" })).toBeVisible();
  await expect(shell.getByRole("navigation", { name: "모바일 호텔 운영 메뉴" })).toBeHidden();
  await expect(page).toHaveScreenshot("app-shell-laptop.png");
});

test("모바일 AppShell 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shell = await mount(<AppShellStory />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  const mobileNavigation = shell.getByRole("navigation", { name: "모바일 호텔 운영 메뉴" });
  await expect(shell.getByRole("banner")).toHaveCSS("height", "56px");
  await expect(mobileNavigation).toHaveCSS("height", "64px");
  await expect(mobileNavigation.getByRole("link", { name: "홈" })).toHaveCSS("min-height", "44px");
  await expect(shell.getByRole("complementary")).toBeHidden();
  await expect(page).toHaveScreenshot("app-shell-mobile.png");
});

test("AppShell은 키보드 사용자에게 본문 바로가기를 먼저 제공한다", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shell = await mount(<AppShellStory />);
  await page.keyboard.press("Tab");
  await expect(shell.getByRole("link", { name: "본문 바로가기" })).toBeFocused();
});
