import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import { HotelLoginCard } from "../components/auth/hotel-login-card";
import { PasswordResetCard } from "../components/auth/password-reset-card";

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

test("PC 비밀번호 재설정 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const reset = await mount(<PasswordResetCard />);
  await page.evaluate(() => document.fonts.ready);
  await expect(reset.getByLabel("새 비밀번호", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(reset.getByLabel("새 비밀번호", { exact: true })).toHaveAttribute("minlength", "8");
  await expect(reset.getByText(/8자 이상.*영문.*숫자.*기호/u)).toBeVisible();
  await expect(reset.getByLabel("새 비밀번호 확인")).toHaveAttribute("autocomplete", "new-password");
  const action = reset.getByRole("button", { name: "비밀번호 변경" });
  await expect(action).toHaveCSS("height", "40px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("password-reset-desktop.png");
});

test("모바일 비밀번호 재설정 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reset = await mount(<PasswordResetCard />);
  await page.evaluate(() => document.fonts.ready);
  const action = reset.getByRole("button", { name: "비밀번호 변경" });
  await expect(action).toHaveCSS("height", "52px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("password-reset-mobile.png");
});

test("기존 reset cookie가 있어도 새 fragment를 URL 노출 없이 우선 교환한다", async ({ mount, page }) => {
  await page.evaluate(() => window.history.replaceState(null, "", "/#userID=subject-1&code=secret-code&orgID=org-1"));
  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/api/auth/password/exchange"));
  await page.route("**/api/auth/password/exchange", async (route) => {
    await route.fulfill({ status: 400 });
  });
  await mount(<PasswordResetCard mode="form" />);
  const request = await requestPromise;
  expect(request.method()).toBe("POST");
  expect(request.url()).toMatch(/\/api\/auth\/password\/exchange$/u);
  expect(request.url()).not.toContain("secret-code");
  expect(request.postData()).toBe("code=secret-code&orgID=org-1&userID=subject-1");
  await expect.poll(() => page.url()).not.toContain("secret-code");
});

test("기존 reset cookie와 malformed fragment는 서버 폐기 경로로 보낸다", async ({ mount, page }) => {
  await page.evaluate(() => window.history.replaceState(null, "", "/#unexpected=value"));
  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/api/auth/password/exchange"));
  await page.route("**/api/auth/password/exchange", async (route) => {
    await route.fulfill({ status: 400 });
  });
  await mount(<PasswordResetCard mode="form" />);
  const request = await requestPromise;
  expect(request.method()).toBe("POST");
  expect(request.headers()["content-type"]).toContain("application/x-www-form-urlencoded");
  expect(request.postData()).toBeNull();
  await expect.poll(() => page.url()).not.toContain("unexpected");
});

test("exchange network failure는 stale cookie form이 아닌 terminal 상태로 이동한다", async ({ mount, page }) => {
  await page.evaluate(() => window.history.replaceState(null, "", "/#userID=user-new&code=secret-code"));
  await page.route("**/api/auth/password/exchange", async (route) => {
    await route.abort("failed");
  });
  await mount(<PasswordResetCard mode="form" />);
  await expect.poll(() => page.url()).toContain("error=exchange-unavailable");
});

test("비밀번호 정책 오류는 provider 제출 전에 새 비밀번호 입력으로 포커스를 이동한다", async ({ mount, page }) => {
  const reset = await mount(<PasswordResetCard />);
  for (const invalidPassword of ["", "Abc123!", "Abcd12😀", "ABCD123!", "PasswordOnly", "Abcd123 ", "Abcd123한"]) {
    await reset.getByLabel("새 비밀번호", { exact: true }).fill(invalidPassword);
    await reset.getByLabel("새 비밀번호 확인").fill(invalidPassword);
    await reset.getByRole("button", { name: "비밀번호 변경" }).click();
    await expect(reset.getByRole("alert")).toContainText("8자 이상이며 영문 소문자, 숫자, 기호를 각각 포함해야 합니다.");
    await expect(reset.getByLabel("새 비밀번호", { exact: true })).toBeFocused();
    await expect(reset.getByLabel("새 비밀번호", { exact: true })).toHaveValue(invalidPassword);
  }
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/api/auth/password/set")))).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("비밀번호 불일치는 제출 전에 확인 필드와 연결한다", async ({ mount, page }) => {
  const reset = await mount(<PasswordResetCard mode="form" />);
  await reset.getByLabel("새 비밀번호", { exact: true }).fill("NewPassword-2026!");
  const confirmation = reset.getByLabel("새 비밀번호 확인");
  await confirmation.fill("DifferentPassword-2026!");
  await reset.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(reset.getByRole("alert")).toContainText("일치하지 않습니다");
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(confirmation).toHaveAttribute("aria-describedby", "password-reset-error");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("서버 비밀번호 정책 오류는 오류 요약으로 포커스를 이동한다", async ({ mount, page }) => {
  const reset = await mount(
    <PasswordResetCard
      errorCode="password-policy"
      errorMessage="비밀번호는 8자 이상이며 영문 소문자, 숫자, 기호를 각각 포함해야 합니다."
      mode="form"
    />,
  );
  const alert = reset.getByRole("alert");
  await expect(alert).toBeFocused();
  await expect(reset.getByLabel("새 비밀번호", { exact: true })).toHaveAttribute("aria-describedby", "password-policy-description password-reset-error");
  await reset.getByLabel("새 비밀번호", { exact: true }).fill("Abcd123!");
  await expect(alert).toHaveCount(0);
  await expect(reset.getByLabel("새 비밀번호", { exact: true })).not.toHaveAttribute("aria-invalid");
  await expect(reset.getByLabel("새 비밀번호", { exact: true })).toHaveAttribute("aria-describedby", "password-policy-description");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("모바일 만료 링크는 실행 불가능한 폼을 숨긴다", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reset = await mount(
    <PasswordResetCard
      errorCode="invalid-link"
      errorMessage="비밀번호 재설정 링크가 만료되었거나 올바르지 않습니다. 새 재설정 메일을 요청해 주세요."
      mode="invalid"
    />,
  );
  await expect(reset.getByRole("alert")).toBeVisible();
  await expect(reset.getByRole("alert")).toBeFocused();
  await expect(reset.getByRole("button", { name: "비밀번호 변경" })).toHaveCount(0);
  await expect(reset.getByRole("link", { name: "로그인 화면으로 돌아가기" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
