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

test("PC Works형 검토 프로세스 설정 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);

  await expect(
    editor.getByRole("heading", { name: "검토 프로세스 설정", level: 3 }),
  ).toBeVisible();
  await expect(editor.getByRole("region", { name: "업무 처리 흐름" })).toContainText(
    "START",
  );
  await expect(editor.getByText("단계 키")).toHaveCount(0);
  await expect(editor.getByText("출발단계")).toHaveCount(0);
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

test("모바일 Works형 업무상태 추가와 접근성", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);

  await editor.getByRole("button", { name: "단계 추가" }).click();
  await expect(editor.getByRole("region", { name: "업무 처리 흐름" })).toContainText(
    "검토 2",
  );
  await expect(editor.getByText("단계 키")).toHaveCount(0);
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

test("Works형 단계 추가는 내부 key와 순차 transition을 자동 생성한다", async ({
  mount,
  page,
}) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/admin/process-definitions", async (route) => {
    if (route.request().method() === "POST")
      submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      body: JSON.stringify({
        ok: false,
        data: null,
        error: { code: "SERVICE_UNAVAILABLE", message: "테스트 차단" },
      }),
      contentType: "application/json",
      status: 503,
    });
  });
  const editor = await mountEditor(mount);
  await editor.getByRole("button", { name: "단계 추가" }).click();
  await editor.getByRole("button", { name: "프로세스 생성" }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toMatchObject({
    startStageKey: "REVIEW",
    stages: [
      { key: "REVIEW", name: "검토", isFinal: false },
      { key: "REVIEW_2", name: "검토 2", isFinal: false },
      { key: "COMPLETED", name: "완료", isFinal: true },
    ],
    transitions: [
      {
        fromStageKey: "REVIEW",
        event: "APPROVE",
        toStageKey: "REVIEW_2",
      },
      {
        fromStageKey: "REVIEW_2",
        event: "APPROVE",
        toStageKey: "COMPLETED",
      },
    ],
  });
});
