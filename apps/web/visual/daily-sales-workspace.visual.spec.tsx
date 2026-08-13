import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { DailySalesWorkspaceStory } from "../playwright/stories/daily-sales-workspace.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 일매출 장부는 날짜 장부·입력·합계와 접근성을 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<DailySalesWorkspaceStory />);
  await expect(
    component.getByRole("heading", { name: "일매출 장부" }),
  ).toBeVisible();
  await expect(
    component.getByRole("table", { name: "업무일 매출 항목" }),
  ).toBeVisible();
  await expect(
    component.getByRole("button", { name: "임시저장", exact: true }),
  ).toBeVisible();
  await expect(
    component.getByRole("button", { name: "확정", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-daily-sales-workspace]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("daily-sales-workspace-pc.png");
});

test("390px 일매출은 표 축소 없이 날짜 카드와 단일 입력 흐름을 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<DailySalesWorkspaceStory />);
  await expect(component.getByText("날짜별 매출 카드")).toBeVisible();
  await expect(
    component.getByRole("table", { name: "업무일 매출 항목" }),
  ).toBeHidden();
  const save = component.getByRole("button", { name: "임시저장", exact: true });
  await save.scrollIntoViewIfNeeded();
  const box = await save.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-daily-sales-workspace]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("daily-sales-workspace-mobile.png");
});
