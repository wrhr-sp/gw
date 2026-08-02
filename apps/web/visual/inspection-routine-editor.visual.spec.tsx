import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InspectionRoutineEditor } from "../components/inspections/inspection-routine-editor";

const hotelId = "50000000-0000-4000-8000-000000000001";
const checklistRevisionId = "87000000-0000-4000-8000-000000000001";
const definitionId = "85000000-0000-4000-8000-000000000001";
const routine = {
  id: "83000000-0000-4000-8000-000000000001",
  hotelId,
  name: "월말 객실점검",
  status: "ACTIVE" as const,
  version: 2,
  nextDueDate: "2026-08-31",
  materializedThroughDate: null,
  revision: {
    id: "84000000-0000-4000-8000-000000000001",
    version: 2,
    mode: "FIXED" as const,
    recurrence: { type: "MONTHLY" as const, dayOfMonth: 31 },
    startDate: "2026-08-01",
    endDate: null,
    localDueTime: "15:00",
    processDefinitionId: definitionId,
    processRevisionId: "86000000-0000-4000-8000-000000000001",
    checklistRevisionId,
    rounds: [
      {
        id: "88000000-0000-4000-8000-000000000001",
        order: 1,
        target: { type: "HOTEL" as const },
      },
    ],
  },
  createdAt: "2026-08-02T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
};

const mountEditor = (
  mount: Parameters<Parameters<typeof test>[1]>[0]["mount"],
) =>
  mount(
    <InspectionRoutineEditor
      checklistRevisionId={checklistRevisionId}
      definitions={[{ id: definitionId, name: "객실점검 검토" }]}
      hotelId={hotelId}
      initialRoutines={[routine]}
      rooms={[
        {
          id: "8a000000-0000-4000-8000-000000000001",
          roomNumber: "301",
          floorLabel: "3층",
          roomTypeId: "89000000-0000-4000-8000-000000000001",
          status: "ACTIVE",
        },
      ]}
      roomTypes={[
        {
          id: "89000000-0000-4000-8000-000000000001",
          hotelId: null,
          name: "스탠다드",
          scope: "COMPANY",
          displayOrder: 10,
          isActive: true,
          version: 1,
          createdAt: "2026-08-02T00:00:00.000Z",
          updatedAt: "2026-08-02T00:00:00.000Z",
        },
      ]}
    />,
  );

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 정기점검 루틴 설정 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);
  await expect(
    editor.getByRole("heading", { name: "정기점검 루틴" }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: /월말 객실점검/ }),
  ).toBeVisible();
  await expect(editor.getByLabel("루틴 이름")).toHaveValue("");
  await expect(editor.getByRole("button", { name: "루틴 생성" })).toHaveCSS(
    "min-height",
    "44px",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-labelledby="inspection-routine-editor-title"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("inspection-routine-editor-desktop.png", {
    fullPage: true,
  });
});

test("모바일 정기점검 순환회차 카드 흐름", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);
  await editor.getByRole("button", { name: /월말 객실점검/ }).click();
  await editor.getByLabel("회차 방식").selectOption("ROTATING");
  await editor.getByRole("button", { name: "회차 추가" }).click();
  await expect(editor.getByText("2회차")).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "루틴 수정 저장" }),
  ).toHaveCSS("min-height", "44px");
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-labelledby="inspection-routine-editor-title"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("inspection-routine-editor-mobile.png", {
    fullPage: true,
  });
});
