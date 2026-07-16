import { expect, test } from "@playwright/experimental-ct-react";
import AxeBuilder from "@axe-core/playwright";
import { HotelCreateStory } from "../playwright/stories/hotel-create.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 호텔 등록 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const form = await mount(<HotelCreateStory />);
  await page.evaluate(() => document.fonts.ready);
  await expect(form.getByRole("heading", { name: "호텔 등록", level: 1 })).toBeVisible();
  await expect(form.getByLabel("상세주소 (선택)")).toHaveAttribute("aria-required", "false");
  await expect(form.getByRole("button", { name: "호텔 등록" })).toHaveCSS("min-height", "40px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("hotel-create-desktop.png", { fullPage: true });
});

test("노트북 호텔 등록 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const form = await mount(<HotelCreateStory />);
  await page.evaluate(() => document.fonts.ready);
  await expect(form.getByRole("heading", { name: "호텔 등록", level: 1 })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("hotel-create-laptop.png", { fullPage: true });
});

test("모바일 호텔 등록과 필수값 오류 연결", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const form = await mount(<HotelCreateStory />);
  const submit = form.getByRole("button", { name: "호텔 등록" });
  await expect(submit).toHaveCSS("min-height", "52px");
  await submit.click();
  const hotelCode = form.getByLabel("호텔코드");
  await expect(hotelCode).toHaveAttribute("aria-invalid", "true");
  await expect(hotelCode).toHaveAttribute("aria-describedby", "hotel-branchCode-error");
  await expect(form.locator("#hotel-branchCode-error")).toHaveText("호텔코드를 입력해 주세요.");
  await expect(form.getByText("계약 시작일을 선택해 주세요.")).toBeVisible();
  await expect(hotelCode).toBeFocused();
  await hotelCode.evaluate((element) => (element as HTMLInputElement).blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("hotel-create-mobile-errors.png", { fullPage: true });
});

test("서버 필드 오류는 첫 입력란으로 포커스를 이동", async ({ mount, page }) => {
  await page.route("**/api/hotels", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 409,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          fieldErrors: [{ field: "branchCode", message: "이미 사용 중인 호텔코드입니다." }],
          message: "이미 사용 중인 호텔코드입니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "50000000-0000-4000-8000-000000000001",
        },
      }),
    });
  });
  const form = await mount(<HotelCreateStory />);
  await form.getByLabel("호텔코드").fill("HOTEL-GN");
  await form.getByLabel("호텔명").fill("위아히어 강남호텔");
  await form.getByLabel("도로명주소").fill("서울특별시 강남구 테헤란로 1");
  await form.getByLabel("대표연락처").fill("02-1234-5678");
  await form.getByLabel("계약 시작일").fill("2026-01-01");
  await form.getByLabel("계약 종료일").fill("2026-12-31");
  await form.getByRole("button", { name: "호텔 등록" }).click();
  await expect(form.getByLabel("호텔코드")).toBeFocused();
  await expect(form.locator("#hotel-branchCode-error")).toHaveText("이미 사용 중인 호텔코드입니다.");
});

test("작성 중 취소는 폐기 확인 후 ESC로 폼에 복귀", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const form = await mount(<HotelCreateStory />);
  await form.getByLabel("호텔코드").fill("HOTEL-GN");
  const cancel = form.getByRole("button", { name: "취소" });
  await cancel.click();
  const dialog = form.getByRole("dialog", { name: "작성 중인 내용을 취소할까요?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(cancel).toBeFocused();
});
