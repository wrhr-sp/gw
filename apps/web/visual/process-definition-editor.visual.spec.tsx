import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { ProcessDefinitionEditor } from "../components/inspections/process-definition-editor";

const hotelId = "50000000-0000-4000-8000-000000000001";
const reviewerCandidates = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    displayName: "객실 점검 검토자",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    displayName: "야간 대리 검토자",
  },
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const mountEditor = (
  mount: Parameters<Parameters<typeof test>[1]>[0]["mount"],
) =>
  mount(
    <ProcessDefinitionEditor
      definitions={[]}
      hotelId={hotelId}
      onDefinitionsChange={() => undefined}
      reviewerCandidates={reviewerCandidates}
    />,
  );

test("PC 호텔 프로세스 정의 편집 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);

  await expect(
    editor.getByRole("heading", { name: "호텔 프로세스 정의", level: 3 }),
  ).toBeVisible();
  await expect(editor.getByLabel("프로세스 이름")).toHaveValue("객실점검 검토");
  await expect(editor.getByLabel("주 검토자").first()).toHaveValue(
    reviewerCandidates[0]!.id,
  );
  await expect(editor.getByRole("button", { name: "프로세스 생성" })).toHaveCSS(
    "min-height",
    "44px",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-labelledby="process-editor-title"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("process-definition-editor-desktop.png", {
    fullPage: true,
  });
});

test("모바일 호텔 프로세스 단계 추가와 접근성", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);

  await editor.getByRole("button", { name: "단계 추가" }).click();
  await expect(editor.getByLabel("단계 키")).toHaveCount(3);
  await expect(editor.getByLabel("단계 키").nth(2)).toHaveValue("REVIEW_3");
  await expect(editor.getByRole("button", { name: "프로세스 생성" })).toHaveCSS(
    "min-height",
    "44px",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-labelledby="process-editor-title"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("process-definition-editor-mobile.png", {
    fullPage: true,
  });
});
