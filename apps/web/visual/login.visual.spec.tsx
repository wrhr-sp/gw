import { expect, test } from "@playwright/experimental-ct-react";
import LoginPage from "../app/login/page";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 로그인 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const login = await mount(<LoginPage />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  await expect(login.getByText("We’reHere")).toHaveCSS("color", "rgb(25, 59, 87)");
  const action = login.getByRole("link", { name: "ZITADEL로 로그인" });
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(action).toHaveCSS("height", "40px");
  await expect(page).toHaveScreenshot("login-desktop.png");
});

test("모바일 로그인 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const login = await mount(<LoginPage />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  await expect(login.getByText("We’reHere")).toHaveCSS("color", "rgb(25, 59, 87)");
  const action = login.getByRole("link", { name: "ZITADEL로 로그인" });
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(action).toHaveCSS("height", "52px");
  await expect(page).toHaveScreenshot("login-mobile.png");
});
