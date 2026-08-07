import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { CalendarWorkspaceStory } from "../playwright/stories/calendar-workspace.story";

test("PC 업무 달력은 월간·주간과 점검·보수 일정을 가로 넘침 없이 제공한다", async ({ mount, page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<CalendarWorkspaceStory />);
  await expect(component.getByRole("heading", { name: "업무 달력" })).toBeVisible();
  await expect(component.getByRole("button", { name: "월간" })).toBeVisible();
  await expect(component.getByRole("button", { name: "주간" })).toBeVisible();
  await expect(component.getByText("점검 마감").first()).toBeVisible();
  await expect(component.getByText("배관 점검").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("section[aria-labelledby=calendar-title]").analyze()).violations).toEqual([]);
});

test("390px 방문일정 등록은 실제 선택정보·Escape·focus 복귀를 제공한다", async ({ mount, page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.route("**/api/calendar/capabilities", async (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: { canViewAllHotels: false, hotels: [{ id: "50000000-0000-4000-8000-000000000001", name: "서울호텔", canCreateVisit: true }] }, error: null }),
  }));
  await page.route("**/api/hotels/*/calendar/visit-options", async (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: { repairs: [{ id: "a1000000-0000-4000-8000-000000000001", targetName: "703호", priorityName: "긴급" }], internalPerformers: [{ userId: "2f000000-0000-4000-8000-000000000001", displayName: "김현장" }] }, error: null }),
  }));
  let releasePost = () => {};
  let markPostStarted = () => {};
  const idempotencyKeys: string[] = [];
  const postGate = new Promise<void>((resolve) => { releasePost = resolve; });
  const postStarted = new Promise<void>((resolve) => { markPostStarted = resolve; });
  await page.route("**/api/hotels/*/repair-visits", async (route) => {
    idempotencyKeys.push(route.request().headers()["idempotency-key"] ?? "");
    markPostStarted();
    await postGate;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, data: null, error: { code: "INTERNAL_ERROR" } }) });
  });
  const component = await mount(<CalendarWorkspaceStory />);
  const trigger = component.getByRole("button", { name: "방문일정 등록" });
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "보수 방문일정 등록" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("보수 건")).toBeVisible();
  await expect(dialog.getByLabel("내부 수행자")).toBeVisible();
  const close = dialog.getByRole("button", { name: "닫기" });
  const save = dialog.getByRole("button", { name: "방문일정 저장" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect((await new AxeBuilder({ page }).include("[role=dialog]").analyze()).violations).toEqual([]);
  await dialog.getByLabel("보수 건").selectOption("a1000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("일정명").fill("저장 중 닫기 방지 검증");
  await dialog.getByLabel("시작시각").fill("2026-08-07T19:30");
  await dialog.getByLabel("종료시각").fill("2026-08-07T20:30");
  await dialog.getByLabel("내부 수행자").selectOption("2f000000-0000-4000-8000-000000000001");
  await save.click();
  await postStarted;
  await expect(close).toBeDisabled();
  releasePost();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(close).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("보수 건").selectOption("a1000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("일정명").fill("다른 불확정 방문일정");
  await dialog.getByLabel("시작시각").fill("2026-08-07T19:30");
  await dialog.getByLabel("종료시각").fill("2026-08-07T20:30");
  await dialog.getByLabel("내부 수행자").selectOption("2f000000-0000-4000-8000-000000000001");
  await dialog.getByRole("button", { name: "방문일정 저장" }).click();
  await expect.poll(() => idempotencyKeys.length).toBe(2);
  expect(idempotencyKeys[0]).not.toBe("");
  expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("보수 건").selectOption("a1000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("일정명").fill("저장 중 닫기 방지 검증");
  await dialog.getByLabel("시작시각").fill("2026-08-07T19:30");
  await dialog.getByLabel("종료시각").fill("2026-08-07T20:30");
  await dialog.getByLabel("내부 수행자").selectOption("2f000000-0000-4000-8000-000000000001");
  await dialog.getByRole("button", { name: "방문일정 저장" }).click();
  await expect.poll(() => idempotencyKeys.length).toBe(3);
  expect(idempotencyKeys[2]).toBe(idempotencyKeys[0]);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("390px 모바일은 축소 달력 대신 선택 날짜 현장업무 카드를 표시한다", async ({ mount, page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<CalendarWorkspaceStory />);
  await expect(component.getByRole("heading", { name: "업무 달력" })).toBeVisible();
  await expect(component.getByRole("button", { name: /점검 마감/ })).toBeVisible();
  await expect(component.getByRole("button", { name: /배관 점검/ })).toBeVisible();
  await expect(component.getByText("Google 미연결")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("section[aria-labelledby=calendar-title]").analyze()).violations).toEqual([]);
});
