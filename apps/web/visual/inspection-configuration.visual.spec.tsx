import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InspectionConfigurationPanel } from "../components/inspections/inspection-configuration-panel";

const hotelId = "50000000-0000-4000-8000-000000000001";
const actorId = "2f000000-0000-4000-8000-000000000001";
const facilityTypeId = "53000000-0000-4000-8000-000000000001";
const roomItemId = "d8200000-0000-4000-8000-000000000000";
const itemId = "d8200000-0000-4000-8000-000000000001";
const endpoint = `**/api/hotels/${hotelId}/inspection-checklist/v2`;

const roomItem = () => ({
  itemId: roomItemId,
  targetType: "ROOM" as const,
  source: "HOTEL_COMMON" as const,
  roomTypeId: null,
  excludedRoomTypeIds: [],
  name: "객실 공통 상태",
  description: null,
  isRequired: true,
  displayOrder: 5,
  defaultSeverity: "OBSERVATION" as const,
});

const item = (overrides: Record<string, unknown> = {}) => ({
  itemId,
  targetType: "FACILITY" as const,
  source: "TARGET_TYPE_ADDED" as const,
  facilityTypeId,
  excludedFacilityTypeIds: [],
  name: "소화기 압력",
  description: null,
  isRequired: true,
  displayOrder: 10,
  defaultSeverity: "MAJOR" as const,
  ...overrides,
});

const checklist = (version: number, reason: string, items = [roomItem(), item()]) => ({
  id: "d8100000-0000-4000-8000-000000000001",
  hotelId,
  version,
  reason,
  items,
  createdBy: actorId,
  createdAt: "2026-08-05T00:00:00.000Z",
});

const success = (value: ReturnType<typeof checklist>) => ({
  ok: true,
  data: { checklist: value },
  error: null,
});

const conflict = {
  ok: false,
  data: null,
  error: {
    code: "VERSION_CONFLICT",
    message: "다른 변경이 먼저 저장되었습니다.",
    fieldErrors: [],
    retryable: false,
    retryAfterSeconds: null,
    traceId: "9f000000-0000-4000-8000-000000000001",
  },
};

const panelElement = (
  initialChecklist: ReturnType<typeof checklist> | null = checklist(1, "초기 사유"),
) =>
  (
    <InspectionConfigurationPanel
      facilities={[]}
      facilityTypes={[
        {
          hotelId,
          id: facilityTypeId,
          name: "소방설비",
          status: "ACTIVE",
          version: 1,
          createdAt: "2026-08-02T00:00:00.000Z",
          updatedAt: "2026-08-02T00:00:00.000Z",
        },
      ]}
      hotelId={hotelId}
      initialChecklist={initialChecklist}
      processDefinitions={[]}
      roomTypes={[]}
    />
  );

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("malformed 2xx 뒤 같은 body와 idempotency key로 재시도한다", async ({
  mount,
  page,
}) => {
  const keys: string[] = [];
  const bodies: string[] = [];
  let putCount = 0;
  const saved = checklist(2, "응답 유실 저장");
  await page.route(endpoint, async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      putCount += 1;
      keys.push(request.headers()["idempotency-key"] ?? "");
      bodies.push(request.postData() ?? "");
      if (putCount === 1) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{" });
        return;
      }
      await route.fulfill({ status: 200, json: success(saved) });
      return;
    }
    await route.fulfill({ status: 200, json: success(saved) });
  });
  const panel = await mount(panelElement());
  await panel.getByLabel("변경사유").fill("응답 유실 저장");
  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toContainText("저장하지 못했습니다");
  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toContainText("저장하고 다시 확인했습니다");
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe("");
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toBe(bodies[0]);
});

test("충돌 재조회 실패와 성공 모두 입력을 보존하고 최신 version으로 다시 저장한다", async ({
  mount,
  page,
}) => {
  const putKeys: string[] = [];
  const putBodies: Array<{ version: number; reason: string }> = [];
  let putCount = 0;
  let getCount = 0;
  const canonical = checklist(2, "다른 사용자 사유");
  const saved = checklist(3, "내 편집 사유");
  await page.route(endpoint, async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      putCount += 1;
      putKeys.push(request.headers()["idempotency-key"] ?? "");
      putBodies.push(JSON.parse(request.postData() ?? "{}"));
      if (putCount <= 2) {
        await route.fulfill({ status: 409, json: conflict });
        return;
      }
      await route.fulfill({ status: 200, json: success(saved) });
      return;
    }
    getCount += 1;
    if (getCount === 1) {
      await route.fulfill({ status: 503, body: "" });
      return;
    }
    await route.fulfill({ status: 200, json: success(getCount === 2 ? canonical : saved) });
  });
  const panel = await mount(panelElement());
  await panel.getByLabel("변경사유").fill("내 편집 사유");

  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toContainText("최신 변경을 불러오지 못했습니다");
  await expect(panel.getByLabel("변경사유")).toHaveValue("내 편집 사유");

  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toContainText("입력은 보존했습니다");
  await expect(panel.getByLabel("변경사유")).toHaveValue("내 편집 사유");
  expect(putKeys[1]).toBe(putKeys[0]);

  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toContainText("저장하고 다시 확인했습니다");
  expect(putKeys[2]).not.toBe(putKeys[1]);
  expect(putBodies[2]).toMatchObject({ version: 2, reason: "내 편집 사유" });
});

test("receipt가 기존 항목 ID를 서로 바꾸면 저장 성공으로 인정하지 않는다", async ({
  mount,
  page,
}) => {
  const secondId = "d8200000-0000-4000-8000-000000000002";
  const original = checklist(1, "초기 사유", [
    roomItem(),
    item(),
    item({ itemId: secondId, name: "감지기 상태", displayOrder: 20 }),
  ]);
  const swapped = checklist(2, "ID 검증", [
    roomItem(),
    item({ itemId: secondId }),
    item({ itemId, name: "감지기 상태", displayOrder: 20 }),
  ]);
  await page.route(endpoint, async (route) => {
    await route.fulfill({ status: 200, json: success(swapped) });
  });
  const panel = await mount(panelElement(original));
  await panel.getByLabel("변경사유").fill("ID 검증");
  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toContainText("저장 결과를 다시 확인하지 못했습니다");
  await expect(panel.locator('p[role="status"]')).not.toContainText("저장하고 다시 확인했습니다");
});

test("items root 오류는 focus 가능한 오류 summary로 이동한다", async ({ mount }) => {
  const panel = await mount(panelElement(null));
  await panel.getByRole("button", { name: "시설물유형 추가" }).click();
  await panel.getByLabel(/^항목 이름 /u).fill("시설물만 존재");
  await panel.getByLabel("변경사유").fill("빈 항목 검증");
  await panel.getByRole("button", { name: "체크리스트 저장" }).click();
  await expect(panel.locator('p[role="status"]')).toBeFocused();
  await expect(panel.locator('p[role="status"]')).not.toHaveText("");
});
