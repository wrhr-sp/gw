import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InspectionRoutineEditor } from "../components/inspections/inspection-routine-editor";

const hotelId = "50000000-0000-4000-8000-000000000001";
const checklistRevisionId = "87000000-0000-4000-8000-000000000001";
const definitionId = "85000000-0000-4000-8000-000000000001";
const facilityTypeId = "8b000000-0000-4000-8000-000000000001";
const facilityId = "8c000000-0000-4000-8000-000000000001";
const routine = {
  id: "83000000-0000-4000-8000-000000000001",
  hotelId,
  name: "월말 시설물점검",
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
        target: {
          type: "FACILITY_TYPES" as const,
          facilityTypeIds: [facilityTypeId],
        },
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
      facilities={[
        {
          id: facilityId,
          hotelId,
          name: "보일러 1호기",
          status: "ACTIVE",
          version: 1,
          createdAt: "2026-08-02T00:00:00.000Z",
          updatedAt: "2026-08-02T00:00:00.000Z",
          facilityType: {
            id: facilityTypeId,
            name: "보일러",
            status: "ACTIVE",
          },
          location: {
            type: "COMMON_AREA",
            commonAreaId: "8d000000-0000-4000-8000-000000000001",
            name: "지하 1층 기계실",
          },
        },
      ]}
      facilityTypes={[
        {
          id: facilityTypeId,
          hotelId,
          name: "보일러",
          status: "ACTIVE",
          version: 1,
          createdAt: "2026-08-02T00:00:00.000Z",
          updatedAt: "2026-08-02T00:00:00.000Z",
        },
      ]}
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

test("응답유실 뒤 입력을 바꾸면 새 idempotency key로 저장한다", async ({
  mount,
  page,
}) => {
  const keys: string[] = [];
  const bodies: unknown[] = [];
  await page.route(`**/inspection-routines/v2/${routine.id}`, async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, body: "{}" });
  });
  const editor = await mountEditor(mount);
  await editor.getByRole("button", { name: /월말 시설물점검/ }).click();
  await editor.getByRole("button", { name: "루틴 수정 저장" }).click();
  await expect(editor.getByText("정기점검 루틴을 저장하지 못했습니다.")).toBeVisible();
  await editor.getByLabel("루틴 이름").fill("월말 시설물점검 변경");
  await editor.getByRole("button", { name: "루틴 수정 저장" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBeTruthy();
  expect(keys[1]).not.toBe(keys[0]);
  expect(bodies[1]).not.toEqual(bodies[0]);
});

test("시설물유형 정기점검을 v2로 저장하고 응답유실 시 같은 key로 재시도한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const keys: string[] = [];
  const bodies: unknown[] = [];
  let attempts = 0;
  await page.route(`**/inspection-routines/v2/${routine.id}`, async (route) => {
    attempts += 1;
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    bodies.push(route.request().postDataJSON());
    if (attempts === 1) {
      await route.fulfill({
        contentType: "application/json",
        status: 503,
        body: JSON.stringify({
          ok: false,
          data: null,
          error: {
            code: "INTERNAL_ERROR",
            message: "저장 응답 유실",
            retryable: true,
            fieldErrors: [],
          },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { routine },
        error: null,
      }),
    });
  });
  await page.route("**/inspection-routines/v2", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { routines: [routine] },
        error: null,
      }),
    });
  });
  const editor = await mountEditor(mount);
  await editor.getByRole("button", { name: /월말 시설물점검/ }).click();
  await expect(editor.getByLabel("대상 유형")).toHaveValue("FACILITY_TYPES");
  await expect(editor.getByRole("checkbox", { name: "보일러" })).toBeChecked();
  await editor.getByRole("button", { name: "루틴 수정 저장" }).click();
  await expect(editor.getByText("정기점검 루틴을 저장하지 못했습니다.")).toBeVisible();
  await editor.getByRole("button", { name: "루틴 수정 저장" }).click();
  await expect(
    editor.getByText("정기점검 루틴을 저장하고 다시 확인했습니다."),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[1]).toMatchObject({
    version: 2,
    rounds: [
      {
        order: 1,
        target: { type: "FACILITY_TYPES", facilityTypeIds: [facilityTypeId] },
      },
    ],
  });
});

test("PC 정기점검 루틴 설정 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const editor = await mountEditor(mount);
  await page.evaluate(() => document.fonts.ready);
  await expect(
    editor.getByRole("heading", { name: "정기점검 루틴" }),
  ).toBeVisible();
  await expect(
    editor.getByText("저장된 체크리스트 기준을 고정해 점검 일정을 만듭니다."),
  ).toBeVisible();
  await expect(editor.getByText(checklistRevisionId, { exact: false })).toHaveCount(0);
  await expect(
    editor.getByRole("button", { name: /월말 시설물점검/ }),
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
  await editor.getByRole("button", { name: /월말 시설물점검/ }).click();
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
