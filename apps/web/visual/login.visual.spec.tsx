import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import { HotelLoginCard } from "../components/auth/hotel-login-card";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 로그인 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const login = await mount(<HotelLoginCard authRequest="visual-auth-request" csrf={"c".repeat(43)} />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  await expect(login.getByText("We’reHere")).toHaveCSS("color", "rgb(25, 59, 87)");
  await expect(login.getByLabel("아이디")).toHaveAttribute("autocomplete", "username");
  await expect(login.getByLabel("비밀번호")).toHaveAttribute("autocomplete", "current-password");
  const action = login.getByRole("button", { name: "로그인" });
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(action).toHaveCSS("height", "40px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("login-desktop.png");
});

test("모바일 로그인 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const login = await mount(<HotelLoginCard authRequest="visual-auth-request" csrf={"c".repeat(43)} />);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("16px Pretendard"))).toBe(true);
  const action = login.getByRole("button", { name: "로그인" });
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(action).toHaveCSS("height", "52px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("login-mobile.png");
});
