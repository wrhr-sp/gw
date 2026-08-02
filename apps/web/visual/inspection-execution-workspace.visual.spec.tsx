import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InspectionExecutionWorkspace } from "../components/inspections/inspection-execution-workspace";

const hotelId = "50000000-0000-4000-8000-000000000001";
const roomId = "52000000-0000-4000-8000-000000000001";
const inspection = {
  id: "91000000-0000-4000-8000-000000000001",
  hotelId,
  source: "ROUTINE" as const,
  businessDate: "2026-08-03",
  dueAt: "2026-08-03T14:59:59.999Z",
  status: "PENDING_INPUT" as const,
  version: 1,
  process: {
    executionId: "92000000-0000-4000-8000-000000000001",
    definitionId: "93000000-0000-4000-8000-000000000001",
    revisionId: "94000000-0000-4000-8000-000000000001",
    currentStageKey: null,
    currentStageName: null,
    state: "PENDING_INPUT" as const,
    version: 1,
  },
  rooms: [
    {
      id: roomId,
      roomNumber: "703",
      floorLabel: "7층",
      roomTypeName: "스탠다드 더블",
    },
  ],
  items: [
    {
      id: "95000000-0000-4000-8000-000000000001",
      roomId,
      itemId: "96000000-0000-4000-8000-000000000001",
      name: "욕실 청결",
      description: "배수 상태와 누수 여부를 확인합니다.",
      isRequired: true,
      displayOrder: 10,
      defaultSeverity: "MAJOR" as const,
      result: {
        id: "97000000-0000-4000-8000-000000000001",
        version: 1,
        result: "NORMAL" as const,
        description: null,
        severity: null,
        fileVersionIds: [],
        recordedBy: "20000000-0000-4000-8000-000000000001",
        recordedAt: "2026-08-03T01:00:00.000Z",
      },
    },
    {
      id: "95000000-0000-4000-8000-000000000002",
      roomId,
      itemId: "96000000-0000-4000-8000-000000000002",
      name: "출입문 잠금",
      description: "잠금장치가 정상적으로 작동하는지 확인합니다.",
      isRequired: true,
      displayOrder: 20,
      defaultSeverity: "CRITICAL" as const,
      result: null,
    },
    {
      id: "95000000-0000-4000-8000-000000000003",
      roomId,
      itemId: "96000000-0000-4000-8000-000000000003",
      name: "침구 상태",
      description: null,
      isRequired: true,
      displayOrder: 30,
      defaultSeverity: "MINOR" as const,
      result: null,
    },
  ],
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T01:00:00.000Z",
};
const { items: _items, ...summary } = inspection;
void _items;
const secondSummary = {
  ...summary,
  id: "91000000-0000-4000-8000-000000000002",
  source: "MANUAL" as const,
  businessDate: "2026-08-02",
  process: {
    ...summary.process,
    executionId: "92000000-0000-4000-8000-000000000002",
  },
  rooms: [
    {
      ...summary.rooms[0]!,
      id: "52000000-0000-4000-8000-000000000002",
      roomNumber: "704",
    },
  ],
};

const mountWorkspace = (
  mount: Parameters<Parameters<typeof test>[1]>[0]["mount"],
) =>
  mount(
    <InspectionExecutionWorkspace
      checklistItems={inspection.items.map((item) => ({
        id: item.itemId,
        name: item.name,
      }))}
      hotelId={hotelId}
      initialInspections={[summary, secondSummary]}
      initialSelectedInspection={inspection}
      rooms={[
        {
          floorLabel: "7층",
          id: roomId,
          roomNumber: "703",
          status: "ACTIVE",
        },
      ]}
    />,
  );

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 점검 수행 다중편집 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const workspace = await mountWorkspace(mount);
  await page.evaluate(() => document.fonts.ready);
  await workspace.getByRole("button", { name: /출입문 잠금/ }).click();
  await workspace.getByRole("button", { name: "이상" }).click();
  await workspace.getByLabel("설명").fill("잠금장치가 끝까지 잠기지 않음");
  await expect(workspace.getByLabel("심각도")).toHaveValue("CRITICAL");
  await expect(
    workspace.getByRole("button", { name: /변경사항 저장 \(1\)/ }),
  ).toHaveCSS("min-height", "44px");
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("inspection-execution-desktop.png", {
    fullPage: true,
  });
});

test("네트워크 실패 시 입력과 동일 저장 operation을 유지한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const keys: string[] = [];
  const bodies: string[] = [];
  await page.route("**/items/*/result", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: "네트워크 저장 실패",
          retryable: true,
          fieldErrors: [],
        },
      }),
    });
  });
  const workspace = await mountWorkspace(mount);
  await workspace.getByLabel("점검항목 이동").selectOption("1");
  await workspace.getByRole("button", { name: "주의" }).click();
  await workspace.getByLabel("설명").fill("잠금 손잡이가 다소 뻑뻑함");
  await workspace.getByRole("button", { name: "저장하고 다음" }).click();
  await expect(workspace.getByLabel("설명")).toHaveValue(
    "잠금 손잡이가 다소 뻑뻑함",
  );
  await expect(workspace.getByRole("status")).toContainText(
    "요청을 처리하지 못했습니다",
  );
  await workspace.getByRole("button", { name: "저장하고 다음" }).click();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toBe(bodies[0]);
});

test("stale 저장 응답은 입력과 동일 operation을 유지한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const keys: string[] = [];
  await page.route("**/items/*/result", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    const staleInspection = {
      ...inspection,
      items: inspection.items.map((item) => ({
        ...item,
        result:
          item.id === "95000000-0000-4000-8000-000000000002"
            ? {
                version: 2,
                result: "ABNORMAL" as const,
                description: "다른 사용자의 결과",
                severity: "CRITICAL" as const,
                fileVersionIds: [],
              }
            : item.result
              ? {
                  version: item.result.version,
                  result: item.result.result,
                  description: item.result.description,
                  severity: item.result.severity,
                  fileVersionIds: item.result.fileVersionIds,
                }
              : null,
      })),
    };
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ok: true,
        data: { inspection: staleInspection },
        error: null,
      }),
    });
  });
  const workspace = await mountWorkspace(mount);
  await workspace.getByLabel("점검항목 이동").selectOption("1");
  await workspace.getByRole("button", { name: "주의" }).click();
  await workspace.getByLabel("설명").fill("내가 확인한 잠금 문제");
  await workspace.getByRole("button", { name: "저장하고 다음" }).click();
  await expect(workspace.getByRole("status")).toContainText(
    "저장 응답이 요청값과 달라",
  );
  await expect(workspace.getByLabel("설명")).toHaveValue(
    "내가 확인한 잠금 문제",
  );
  await workspace.getByRole("button", { name: "저장하고 다음" }).click();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

test("commit 여부가 불확정한 수시점검 생성은 같은 key로 재시도한다", async ({
  mount,
  page,
}) => {
  const keys: string[] = [];
  const bodies: string[] = [];
  await page.route("**/inspections/manual", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: "생성 응답 유실",
          retryable: true,
          fieldErrors: [],
        },
      }),
    });
  });
  const workspace = await mountWorkspace(mount);
  await workspace.getByRole("button", { name: "수시점검 시작" }).click();
  await workspace.getByLabel("객실").selectOption(roomId);
  await workspace.getByRole("checkbox", { name: "욕실 청결" }).check();
  await workspace.getByRole("button", { name: "점검 생성" }).click();
  await expect(workspace.getByRole("status")).toContainText(
    "요청을 처리하지 못했습니다",
  );
  await expect(workspace.getByLabel("객실")).toHaveValue(roomId);
  await workspace.getByRole("button", { name: "점검 생성" }).click();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toBe(bodies[0]);
});

test("모바일 점검 수행 한 항목 집중 흐름", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const workspace = await mountWorkspace(mount);
  await page.evaluate(() => document.fonts.ready);
  await workspace.getByLabel("점검항목 이동").selectOption("1");
  await workspace.getByRole("button", { name: "주의" }).click();
  await workspace.getByLabel("설명").fill("잠금 손잡이가 다소 뻑뻑함");
  await expect(workspace.locator("select#mobile-inspection")).toHaveValue(
    inspection.id,
  );
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  await expect(
    workspace.getByRole("button", { name: "저장하고 다음" }),
  ).toHaveCSS("min-height", "44px");
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("inspection-execution-mobile.png", {
    fullPage: true,
  });
});
