import { expect, test } from "@playwright/experimental-ct-react";
import AxeBuilder from "@axe-core/playwright";
import { RelationshipManagementPanel } from "../components/hotels/relationship-management-panel";
import { RoomManagementPanel } from "../components/hotels/room-management-panel";
import { HotelDetailStory } from "../playwright/stories/hotel-detail.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const errorResponse = (
  code: "VALIDATION_ERROR" | "VERSION_CONFLICT",
  message: string,
  fieldErrors: Array<{ field: string; message: string }> = [],
) => ({
  ok: false,
  data: null,
  error: {
    code,
    message,
    retryable: false,
    retryAfterSeconds: null,
    traceId: "55000000-0000-4000-8000-000000000098",
    fieldErrors,
  },
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} 호텔 상세 기본정보 기준 화면`, async ({
    mount,
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const detail = await mount(<HotelDetailStory />);
    await page.evaluate(() => document.fonts.ready);
    await expect(
      detail.getByRole("heading", { name: "위아히어 강남호텔", level: 1 }),
    ).toBeVisible();
    await expect(
      detail.getByText("서울특별시 강남구 테헤란로 1"),
    ).toBeVisible();
    await expect(
      detail.getByRole("heading", { name: "관계 및 운영 준비" }),
    ).toBeVisible();
    await expect(
      detail.getByRole("heading", { name: "객실관리" }),
    ).toBeVisible();
    const roomSurface =
      viewport.name === "mobile"
        ? detail.locator("article")
        : detail.locator("#hotel-room-management table");
    if (viewport.name === "mobile") {
      await expect(
        roomSurface.getByRole("heading", { name: "101" }),
      ).toBeVisible();
      await expect(
        roomSurface.getByRole("heading", { name: "1201" }),
      ).toBeVisible();
    } else {
      await expect(roomSurface.getByText("101", { exact: true })).toBeVisible();
      await expect(
        roomSurface.getByText("1201", { exact: true }),
      ).toBeVisible();
    }
    await expect(detail.getByText("김현장")).toBeVisible();
    await expect(detail.getByText("이소유")).toBeVisible();
    await expect(detail.getByRole("link", { name: "호텔 목록" })).toHaveCSS(
      "min-height",
      "44px",
    );
    await expect(detail.getByRole("button", { name: "배정 추가" })).toHaveCSS(
      "min-height",
      "44px",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page).toHaveScreenshot(`hotel-detail-${viewport.name}.png`, {
      fullPage: viewport.name === "mobile",
    });
    if (viewport.name === "mobile") {
      await detail.locator("#hotel-room-management").evaluate((element) => {
        element.scrollIntoView({ block: "start" });
      });
      await expect(page).toHaveScreenshot("hotel-detail-mobile-viewport.png");
    }
  });
}

test("객실 등록 dialog는 focus·Escape 복귀·open-state Axe를 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = await mount(<HotelDetailStory />);
  const trigger = detail.getByRole("button", { name: "객실 등록" });
  await expect(trigger).toHaveCSS("min-height", "44px");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "객실 정보" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "객실 관리 대화상자 닫기" }),
  ).toHaveCSS("min-height", "44px");
  await expect(dialog.getByLabel("객실번호")).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("객실 등록은 계약 payload와 idempotency key를 보내고 목록을 재조회한다", async ({
  mount,
  page,
}) => {
  const hotelId = "50000000-0000-4000-8000-000000000001";
  const createdRoom = {
    id: "55000000-0000-4000-8000-000000000003",
    hotelId,
    roomNumber: "202",
    floorLabel: "2층",
    floorSortKey: 2,
    roomType: {
      id: "54000000-0000-4000-8000-000000000001",
      name: "스탠다드 더블",
      scope: "COMPANY",
    },
    status: "ACTIVE",
    internalNote: "린넨 교체 확인",
    ownerVisibleNote: "조용한 객실",
    plannedResumeDate: null,
    version: 1,
    createdAt: "2026-07-25T02:00:00.000Z",
    updatedAt: "2026-07-25T02:00:00.000Z",
  };
  let submitted: unknown;
  let idempotencyKey = "";
  await page.route(`**/api/hotels/${hotelId}/rooms*`, async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      idempotencyKey = route.request().headers()["idempotency-key"] ?? "";
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, data: { room: createdRoom }, error: null },
        status: 201,
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        data: {
          capabilities: { canManage: true, canManageTypes: true },
          rooms: [createdRoom],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        error: null,
      },
      status: 200,
    });
  });
  const detail = await mount(<HotelDetailStory />);
  const trigger = detail.getByRole("button", { name: "객실 등록" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "객실 정보" });
  await dialog.getByLabel("객실번호").fill("202");
  await dialog
    .getByLabel("객실유형")
    .selectOption("54000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("층 표시").fill("2층");
  await dialog.getByLabel("층 정렬순서").fill("2");
  await dialog.getByLabel("소유주 공개 메모").fill("조용한 객실");
  await dialog.getByLabel("내부 메모").fill("린넨 교체 확인");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(detail.getByText("202", { exact: true }).first()).toBeVisible();
  expect(submitted).toMatchObject({
    floorLabel: "2층",
    floorSortKey: 2,
    internalNote: "린넨 교체 확인",
    ownerVisibleNote: "조용한 객실",
    roomNumber: "202",
    roomTypeId: "54000000-0000-4000-8000-000000000001",
  });
  expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
});

test("객실 version conflict는 입력을 보존하고 최신 version으로 재시도한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const hotelId = "50000000-0000-4000-8000-000000000001";
  const roomId = "55000000-0000-4000-8000-000000000001";
  const roomType = {
    id: "54000000-0000-4000-8000-000000000001",
    hotelId: null,
    name: "스탠다드 더블",
    scope: "COMPANY" as const,
    displayOrder: 10,
    isActive: true,
    version: 2,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T03:00:00.000Z",
  };
  const latestRoom = {
    id: roomId,
    hotelId,
    roomNumber: "101",
    floorLabel: "1층",
    floorSortKey: 1,
    roomType: {
      id: roomType.id,
      name: roomType.name,
      scope: roomType.scope,
    },
    status: "ACTIVE" as const,
    internalNote: "최신 내부 메모",
    ownerVisibleNote: "다른 사용자의 메모",
    plannedResumeDate: null,
    version: 3,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T03:00:00.000Z",
  };
  const submittedVersions: number[] = [];
  await page.route(`**/api/hotels/${hotelId}/room-types`, (route) =>
    route.fulfill({
      contentType: "application/json",
      json: { ok: true, data: { roomTypes: [roomType] }, error: null },
    }),
  );
  await page.route(`**/api/hotels/${hotelId}/rooms?*`, (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        data: {
          capabilities: { canManage: true, canManageTypes: true },
          rooms: [latestRoom],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
        error: null,
      },
    }),
  );
  await page.route(`**/api/hotels/${hotelId}/rooms/${roomId}`, (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        contentType: "application/json",
        json: { ok: true, data: { room: latestRoom }, error: null },
      });
    const body = route.request().postDataJSON() as { version: number };
    submittedVersions.push(body.version);
    if (submittedVersions.length === 1)
      return route.fulfill({
        contentType: "application/json",
        status: 409,
        json: {
          ok: false,
          data: null,
          error: {
            code: "VERSION_CONFLICT",
            message: "다른 사용자가 먼저 수정했습니다.",
            retryable: false,
            retryAfterSeconds: null,
            traceId: "55000000-0000-4000-8000-000000000099",
            fieldErrors: [],
          },
        },
      });
    return route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        data: {
          room: {
            ...latestRoom,
            ownerVisibleNote: "사용자 입력 보존",
            version: 4,
          },
        },
        error: null,
      },
    });
  });

  const detail = await mount(<HotelDetailStory />);
  const roomCard = detail.locator("article").filter({ hasText: "101" });
  const trigger = roomCard.getByRole("button", { name: "수정" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "객실 정보" });
  const note = dialog.getByLabel("소유주 공개 메모");
  await note.fill("사용자 입력 보존");
  await dialog.getByRole("button", { name: "저장" }).click();
  const conflict = dialog.locator('[role="alert"][tabindex="-1"]');
  await expect(conflict).toBeFocused();
  await expect(conflict).toContainText("최신 객실 정보를 불러왔습니다");
  await expect(note).toHaveValue("사용자 입력 보존");
  expect(submittedVersions).toEqual([1]);
  await expect(page).toHaveScreenshot(
    "hotel-room-dialog-version-conflict-mobile.png",
  );
  const save = dialog.getByRole("button", { name: "저장" });
  const finalField = dialog.getByLabel("내부 메모");
  const mobileNavigation = detail.locator(
    'nav[aria-label="모바일 호텔 운영 메뉴"]',
  );
  await finalField.scrollIntoViewIfNeeded();
  const [saveBox, finalFieldBox, navigationBox] = await Promise.all([
    save.boundingBox(),
    finalField.boundingBox(),
    mobileNavigation.boundingBox(),
  ]);
  expect(finalFieldBox).not.toBeNull();
  expect(saveBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(
    (finalFieldBox?.y ?? 0) + (finalFieldBox?.height ?? 0),
  ).toBeLessThanOrEqual(saveBox?.y ?? 0);
  expect((saveBox?.y ?? 0) + (saveBox?.height ?? 0)).toBeLessThanOrEqual(
    navigationBox?.y ?? 0,
  );
  await save.click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(submittedVersions).toEqual([1, 3]);
});

test("객실·상태·유형 version conflict 최신 조회 실패는 입력과 retry 안내를 보존한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const hotelId = "50000000-0000-4000-8000-000000000001";
  const roomId = "55000000-0000-4000-8000-000000000001";
  const typeId = "54000000-0000-4000-8000-000000000001";
  let roomLatestReady = false;
  let typeLatestReady = false;
  const latestRoom = {
    id: roomId,
    hotelId,
    roomNumber: "101",
    floorLabel: "1층",
    floorSortKey: 1,
    roomType: { id: typeId, name: "스탠다드 더블", scope: "COMPANY" },
    status: "ACTIVE",
    internalNote: "엘리베이터 소음 점검",
    ownerVisibleNote: "엘리베이터 인접",
    plannedResumeDate: null,
    version: 3,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T03:00:00.000Z",
  };
  const latestType = {
    id: typeId,
    hotelId: null,
    name: "스탠다드 더블",
    scope: "COMPANY",
    displayOrder: 10,
    isActive: true,
    version: 3,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T03:00:00.000Z",
  };
  await page.route(`**/api/hotels/${hotelId}/rooms/${roomId}`, (route) => {
    if (route.request().method() === "GET")
      return roomLatestReady
        ? route.fulfill({
            json: { ok: true, data: { room: latestRoom }, error: null },
          })
        : route.fulfill({
            status: 503,
            json: errorResponse("VALIDATION_ERROR", "조회 실패"),
          });
    return route.fulfill({
      status: 409,
      json: errorResponse(
        "VERSION_CONFLICT",
        "다른 사용자가 먼저 수정했습니다.",
      ),
    });
  });
  await page.route(`**/api/hotels/${hotelId}/rooms/${roomId}/status`, (route) =>
    route.fulfill({
      status: 409,
      json: errorResponse(
        "VERSION_CONFLICT",
        "다른 사용자가 먼저 수정했습니다.",
      ),
    }),
  );
  await page.route(`**/api/hotels/${hotelId}/room-types/${typeId}`, (route) =>
    route.fulfill({
      status: 409,
      json: errorResponse(
        "VERSION_CONFLICT",
        "다른 사용자가 먼저 수정했습니다.",
      ),
    }),
  );
  await page.route(`**/api/hotels/${hotelId}/room-types`, (route) =>
    typeLatestReady
      ? route.fulfill({
          json: {
            ok: true,
            data: { roomTypes: [latestType] },
            error: null,
          },
        })
      : route.fulfill({
          status: 503,
          json: errorResponse("VALIDATION_ERROR", "조회 실패"),
        }),
  );

  const detail = await mount(<HotelDetailStory />);
  const roomCard = detail.locator("article").filter({ hasText: "101" });

  await roomCard.getByRole("button", { name: "수정" }).click();
  let dialog = page.getByRole("dialog", { name: "객실 정보" });
  const note = dialog.getByLabel("소유주 공개 메모");
  await note.fill("객실 입력 보존");
  await dialog.getByRole("button", { name: "저장" }).click();
  let alert = dialog.locator('[role="alert"][tabindex="-1"]');
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("다시 불러오지 못했습니다");
  await expect(alert).toContainText("최신정보를 다시 불러와 주세요");
  await expect(dialog.getByRole("button", { name: "저장" })).toBeDisabled();
  await expect(
    alert.getByRole("button", { name: "최신정보 다시 불러오기" }),
  ).toBeVisible();
  await expect(note).toHaveValue("객실 입력 보존");
  roomLatestReady = true;
  typeLatestReady = true;
  await alert.getByRole("button", { name: "최신정보 다시 불러오기" }).click();
  await expect(alert).toHaveCount(0);
  await expect(note).toHaveValue("객실 입력 보존");
  await expect(dialog.getByRole("button", { name: "저장" })).toBeEnabled();
  await dialog.getByRole("button", { name: "객실 관리 대화상자 닫기" }).click();

  roomLatestReady = false;
  await roomCard.getByRole("button", { name: "상태변경" }).click();
  dialog = page.getByRole("dialog", { name: "객실 운영상태" });
  const reason = dialog.getByLabel("변경 사유");
  await reason.fill("상태 입력 보존");
  await dialog.getByRole("button", { name: "상태 저장" }).click();
  alert = dialog.locator('[role="alert"][tabindex="-1"]');
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("다시 불러오지 못했습니다");
  await expect(reason).toHaveValue("상태 입력 보존");
  await expect(
    dialog.getByRole("button", { name: "상태 저장" }),
  ).toBeDisabled();
  roomLatestReady = true;
  await alert.getByRole("button", { name: "최신정보 다시 불러오기" }).click();
  await expect(alert).toHaveCount(0);
  await expect(reason).toHaveValue("상태 입력 보존");
  await expect(dialog.getByRole("button", { name: "상태 저장" })).toBeEnabled();
  await dialog.getByRole("button", { name: "객실 관리 대화상자 닫기" }).click();

  typeLatestReady = false;
  await detail
    .getByRole("button", { name: /스탠다드 더블 · 회사공통 · 사용/u })
    .click();
  dialog = page.getByRole("dialog", { name: "객실유형" });
  const typeName = dialog.getByLabel("유형명");
  await typeName.fill("유형 입력 보존");
  await dialog.getByRole("button", { name: "유형 저장" }).click();
  alert = dialog.locator('[role="alert"][tabindex="-1"]');
  await expect(alert).toBeFocused();
  await expect(alert).toContainText(
    "최신 객실유형 정보를 다시 불러오지 못했습니다",
  );
  await expect(typeName).toHaveValue("유형 입력 보존");
  await expect(
    dialog.getByRole("button", { name: "유형 저장" }),
  ).toBeDisabled();
  typeLatestReady = true;
  await alert.getByRole("button", { name: "최신정보 다시 불러오기" }).click();
  await expect(alert).toHaveCount(0);
  await expect(typeName).toHaveValue("유형 입력 보존");
  await expect(dialog.getByRole("button", { name: "유형 저장" })).toBeEnabled();
});

test("객실·상태·유형 field error는 target ARIA와 focus를 연결하고 해당 field 수정 시 해제한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const hotelId = "50000000-0000-4000-8000-000000000001";
  const roomId = "55000000-0000-4000-8000-000000000001";
  await page.route(`**/api/hotels/${hotelId}/rooms/${roomId}`, (route) =>
    route.fulfill({
      status: 400,
      json: errorResponse("VALIDATION_ERROR", "입력값을 확인해 주세요.", [
        { field: "ownerVisibleNote", message: "공개 메모를 확인해 주세요." },
      ]),
    }),
  );
  await page.route(`**/api/hotels/${hotelId}/rooms/${roomId}/status`, (route) =>
    route.fulfill({
      status: 400,
      json: errorResponse("VALIDATION_ERROR", "입력값을 확인해 주세요.", [
        { field: "reason", message: "변경 사유를 확인해 주세요." },
      ]),
    }),
  );
  await page.route(
    `**/api/hotels/${hotelId}/room-types/54000000-0000-4000-8000-000000000001`,
    (route) =>
      route.fulfill({
        status: 400,
        json: errorResponse("VALIDATION_ERROR", "입력값을 확인해 주세요.", [
          { field: "name", message: "유형명을 확인해 주세요." },
        ]),
      }),
  );
  const detail = await mount(<HotelDetailStory />);
  const roomCard = detail.locator("article").filter({ hasText: "101" });
  await roomCard.getByRole("button", { name: "수정" }).click();
  const dialog = page.getByRole("dialog", { name: "객실 정보" });
  const note = dialog.getByLabel("소유주 공개 메모");
  const sibling = dialog.getByLabel("내부 메모");
  await note.fill("서버 검증 대상");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(note).toBeFocused();
  await expect(note).toHaveAttribute("aria-invalid", "true");
  await expect(note).toHaveAttribute(
    "aria-describedby",
    "room-editor-error-ownerVisibleNote-0",
  );
  await expect(
    dialog.locator("#room-editor-error-ownerVisibleNote-0"),
  ).toHaveText("공개 메모를 확인해 주세요.");
  await expect(sibling).toHaveAttribute("aria-invalid", "false");
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await note.fill("수정한 공개 메모");
  await expect(note).toHaveAttribute("aria-invalid", "false");
  await expect(note).not.toHaveAttribute(
    "aria-describedby",
    "room-editor-error-ownerVisibleNote-0",
  );
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "객실 관리 대화상자 닫기" }).click();

  await roomCard.getByRole("button", { name: "상태변경" }).click();
  let nextDialog = page.getByRole("dialog", { name: "객실 운영상태" });
  const reason = nextDialog.getByLabel("변경 사유");
  await reason.fill("상태 서버 검증 대상");
  await nextDialog.getByRole("button", { name: "상태 저장" }).click();
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute(
    "aria-describedby",
    "status-editor-error-reason-0",
  );
  await expect(nextDialog.locator("#status-editor-error-reason-0")).toHaveText(
    "변경 사유를 확인해 주세요.",
  );
  await reason.fill("수정한 변경 사유");
  await expect(reason).toHaveAttribute("aria-invalid", "false");
  await expect(nextDialog.getByRole("alert")).toHaveCount(0);
  await nextDialog
    .getByRole("button", { name: "객실 관리 대화상자 닫기" })
    .click();

  await detail
    .getByRole("button", { name: /스탠다드 더블 · 회사공통 · 사용/u })
    .click();
  nextDialog = page.getByRole("dialog", { name: "객실유형" });
  const typeName = nextDialog.getByLabel("유형명");
  await typeName.fill("유형 서버 검증 대상");
  await nextDialog.getByRole("button", { name: "유형 저장" }).click();
  await expect(typeName).toBeFocused();
  await expect(typeName).toHaveAttribute("aria-invalid", "true");
  await expect(typeName).toHaveAttribute(
    "aria-describedby",
    "type-editor-error-name-0",
  );
  await expect(nextDialog.locator("#type-editor-error-name-0")).toHaveText(
    "유형명을 확인해 주세요.",
  );
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await typeName.fill("수정한 유형명");
  await expect(typeName).toHaveAttribute("aria-invalid", "false");
  await expect(nextDialog.getByRole("alert")).toHaveCount(0);
});

test("SSR 객실 초기 오류는 자동 재조회 성공 후 사라진다", async ({
  mount,
  page,
}) => {
  const hotelId = "50000000-0000-4000-8000-000000000001";
  let releaseRooms: (() => void) | undefined;
  const roomsGate = new Promise<void>((resolve) => {
    releaseRooms = resolve;
  });
  await page.route(`**/api/hotels/${hotelId}/rooms?*`, async (route) => {
    await roomsGate;
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        data: {
          capabilities: { canManage: false, canManageTypes: false },
          rooms: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        },
        error: null,
      },
    });
  });
  await page.route(`**/api/hotels/${hotelId}/room-types`, (route) =>
    route.fulfill({
      contentType: "application/json",
      json: { ok: true, data: { roomTypes: [] }, error: null },
    }),
  );
  const panel = await mount(
    <RoomManagementPanel
      hotelId={hotelId}
      initialFailure={{
        code: "INTERNAL_ERROR",
        message: "초기 로드 실패",
        status: 503,
      }}
    />,
  );
  const alert = panel
    .getByRole("alert", { name: "" })
    .filter({ hasText: "객실 정보를 불러오지 못했습니다" });
  await expect(alert).toBeVisible();
  releaseRooms?.();
  await expect(alert).toHaveCount(0);
  await expect(panel.getByText("등록된 객실이 없습니다")).toBeVisible();
});

test("객실 검색과 페이지 이동은 서버 query로 101번째 객실까지 도달한다", async ({
  mount,
  page,
}) => {
  const hotelId = "50000000-0000-4000-8000-000000000001";
  const requests: string[] = [];
  await page.route(`**/api/hotels/${hotelId}/rooms?*`, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const currentPage = Number(url.searchParams.get("page") ?? "1");
    await route.fulfill({
      contentType: "application/json",
      json: {
        ok: true,
        data: {
          capabilities: { canManage: true, canManageTypes: false },
          rooms:
            currentPage === 6
              ? [
                  {
                    createdAt: "2026-07-25T00:00:00.000Z",
                    floorLabel: "10층",
                    floorSortKey: 10,
                    hotelId,
                    id: "51000000-0000-4000-8000-000000000101",
                    internalNote: null,
                    ownerVisibleNote: null,
                    plannedResumeDate: null,
                    roomNumber: "101번째 객실",
                    roomType: {
                      id: "54000000-0000-4000-8000-000000000001",
                      name: "스탠다드",
                      scope: "COMPANY",
                    },
                    status: "ACTIVE",
                    updatedAt: "2026-07-25T00:00:00.000Z",
                    version: 1,
                  },
                ]
              : [],
          pagination: {
            page: currentPage,
            pageSize: 20,
            total: 101,
            totalPages: 6,
          },
        },
        error: null,
      },
    });
  });
  await page.route(`**/api/hotels/${hotelId}/room-types`, (route) =>
    route.fulfill({
      contentType: "application/json",
      json: { ok: true, data: { roomTypes: [] }, error: null },
    }),
  );
  const panel = await mount(
    <RoomManagementPanel
      hotelId={hotelId}
      initialData={{
        capabilities: { canManage: true, canManageTypes: false },
        pagination: { page: 1, pageSize: 20, total: 101, totalPages: 6 },
        rooms: [],
        roomTypes: [],
      }}
    />,
  );
  await expect(panel.getByText("현재 1 / 6 페이지")).toBeVisible();
  expect(requests).toEqual([]);
  await panel.getByLabel("객실 검색").fill(" 101 ");
  await expect
    .poll(() => requests.some((query) => query.includes("q=101")))
    .toBe(true);
  for (const expectedPage of [2, 3, 4, 5, 6]) {
    await panel.getByRole("button", { name: "다음 페이지" }).click();
    await expect(
      panel.getByText(`현재 ${expectedPage} / 6 페이지`),
    ).toBeVisible();
  }
  await expect(panel.getByRole("cell", { name: "101번째 객실" })).toBeVisible();
  expect(requests.at(-1)).toContain("page=6");
  expect(requests.at(-1)).toContain("pageSize=20");
  expect(requests.at(-1)).toContain("q=101");
});

test("객실 dialog trigger가 제거되면 객실관리 제목으로 focus를 복원한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = await mount(<HotelDetailStory />);
  const trigger = detail
    .locator("article")
    .filter({ hasText: "101" })
    .getByRole("button", { name: "수정" });
  const triggerHandle = await trigger.elementHandle();
  if (!triggerHandle) throw new Error("객실 수정 trigger를 찾지 못했습니다.");
  await trigger.click();
  await triggerHandle.evaluate((element) => element.remove());
  await page
    .getByRole("dialog", { name: "객실 정보" })
    .getByRole("button", { name: "객실 관리 대화상자 닫기" })
    .click();
  await expect(detail.getByRole("heading", { name: "객실관리" })).toBeFocused();
});

test("모바일 객실 pagination과 세 editor는 44px·하단 navigation 경계를 지킨다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = await mount(<HotelDetailStory />);
  const navigation = detail.locator('nav[aria-label="모바일 호텔 운영 메뉴"]');
  await expect(detail.getByRole("button", { name: "이전 페이지" })).toHaveCSS(
    "min-height",
    "44px",
  );
  await expect(detail.getByRole("button", { name: "다음 페이지" })).toHaveCSS(
    "min-height",
    "44px",
  );

  const assertDialogAboveNavigation = async (dialogName: string) => {
    const dialog = page.getByRole("dialog", { name: dialogName });
    const [dialogBox, navigationBox] = await Promise.all([
      dialog.boundingBox(),
      navigation.boundingBox(),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(
      navigationBox?.y ?? 0,
    );
    await dialog
      .getByRole("button", { name: "객실 관리 대화상자 닫기" })
      .click();
  };

  const firstRoom = detail.locator("article").filter({ hasText: "101" });
  await firstRoom.getByRole("button", { name: "수정" }).click();
  await assertDialogAboveNavigation("객실 정보");
  await firstRoom.getByRole("button", { name: "상태변경" }).click();
  await assertDialogAboveNavigation("객실 운영상태");
  await detail
    .getByRole("button", { name: /스탠다드 더블 · 회사공통 · 사용/u })
    .click();
  await assertDialogAboveNavigation("객실유형");
});

test("객실유형 수정의 빈 정렬순서는 한국어 field 오류와 ARIA를 제공한다", async ({
  mount,
  page,
}) => {
  const detail = await mount(<HotelDetailStory />);
  await detail
    .getByRole("button", { name: /스탠다드 더블 · 회사공통 · 사용/u })
    .click();
  const dialog = page.getByRole("dialog", { name: "객실유형" });
  const displayOrder = dialog.getByLabel("정렬순서");
  await displayOrder.fill("");
  await dialog.getByRole("button", { name: "유형 저장" }).click();
  await expect(displayOrder).toHaveAttribute("aria-invalid", "true");
  await expect(
    dialog.getByText("정렬순서를 숫자로 입력해 주세요."),
  ).toBeVisible();
  await expect(displayOrder).toHaveAttribute(
    "aria-describedby",
    /type-editor-error-displayOrder-0/u,
  );
  await expect(dialog).not.toContainText(/Invalid|expected number/iu);
});

test("관계관리 dialog는 후보 표시이름·키보드·최근로그인 안내를 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const detail = await mount(<HotelDetailStory />);
  const assignmentTrigger = detail.getByRole("button", { name: "배정 추가" });
  await assignmentTrigger.click();
  const assignmentDialog = detail.getByRole("dialog", { name: "배정 추가" });
  await expect(assignmentDialog).toBeVisible();
  await expect(
    assignmentDialog.getByRole("option", { name: "최지원" }),
  ).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(assignmentDialog).not.toBeVisible();
  await expect(assignmentTrigger).toBeFocused();

  await detail.getByRole("button", { name: "소유주 교체" }).click();
  const ownerDialog = detail.getByRole("dialog", { name: "소유주 즉시 교체" });
  await expect(ownerDialog.getByText(/최근 5분 이내 로그인/)).toBeVisible();
  await expect(
    ownerDialog.getByRole("option", {
      name: "한소유후보 장기표시이름 접근성검증",
    }),
  ).toBeAttached();
  expect(
    (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
  ).toEqual([]);
});

test("배정 날짜를 먼저 설정한 뒤 선택한 후보와 날짜를 POST한다", async ({
  mount,
  page,
}) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/hotels/*/assignments", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      contentType: "application/json",
      status: 409,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "VERSION_CONFLICT",
          message: "다른 사용자가 먼저 수정했습니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000008",
          fieldErrors: [],
        },
      }),
    });
  });
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "배정 추가" }).click();
  const dialog = detail.getByRole("dialog", { name: "배정 추가" });
  await dialog.getByLabel("관계유형").selectOption("HOUSEKEEPING");
  await dialog.getByLabel("시작일", { exact: true }).fill("2026-07-24");
  await dialog.getByLabel("후보 이름 검색").fill("정객실");
  const candidate = dialog.getByLabel("배정 후보");
  await expect(
    candidate.getByRole("option", { name: "정객실" }),
  ).toBeAttached();
  await candidate.selectOption({ label: "정객실" });
  await dialog.getByLabel("배정 사유").fill("Preview 관계 재배정 검증");
  await dialog.getByRole("button", { name: "배정 저장" }).click();
  await expect
    .poll(() => requestBody)
    .toMatchObject({
      relationshipType: "HOUSEKEEPING",
      startDate: "2026-07-24",
      userId: "20000000-0000-4000-8000-000000000014",
    });
});

test("배정 version conflict는 dialog 오류 focus와 입력 보존을 제공한다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/assignments", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({
      contentType: "application/json",
      status: 409,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "VERSION_CONFLICT",
          message: "다른 사용자가 먼저 수정했습니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000007",
          fieldErrors: [],
        },
      }),
    });
  });
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "배정 추가" }).click();
  const dialog = detail.getByRole("dialog", { name: "배정 추가" });
  await dialog.getByLabel("배정 후보").selectOption({ label: "최지원" });
  await dialog.getByLabel("배정 사유").fill("현장 운영 지원");
  await dialog.getByRole("button", { name: "배정 저장" }).click();
  const errorSummary = dialog
    .locator('div[role="alert"][tabindex="-1"]')
    .first();
  await expect(errorSummary).toBeFocused();
  await expect(dialog.getByLabel("배정 사유")).toHaveValue("현장 운영 지원");
  await expect(
    dialog.getByRole("button", { name: "배정 저장" }),
  ).toBeDisabled();
});

test("배정 계약 validation은 첫 오류 field로 focus를 이동한다", async ({
  mount,
}) => {
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "배정 추가" }).click();
  const dialog = detail.getByRole("dialog", { name: "배정 추가" });
  await dialog.getByLabel("배정 후보").selectOption({ label: "최지원" });
  const reason = dialog.getByLabel("배정 사유");
  await reason.fill("가");
  await dialog.getByRole("button", { name: "배정 저장" }).click();
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toContainText(
    "사유를 2자 이상 입력해 주세요",
  );
});

test("긴급 종료 성공 후 제거된 trigger 대신 관계관리 제목으로 focus를 이동한다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/assignments/*/end", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          assignment: {
            id: "52000000-0000-4000-8000-000000000001",
            hotelId: "50000000-0000-4000-8000-000000000001",
            userId: "20000000-0000-4000-8000-000000000010",
            relationshipType: "STAFF",
            assignmentType: "PRIMARY",
            startDate: "2026-07-01",
            endDate: "2026-07-24",
            reason: "강남호텔 주배정",
            terminatedAt: "2026-07-24T13:00:00.000Z",
            terminationReason: "현장 안전 사고 대응",
            version: 2,
            createdAt: "2026-07-24T00:00:00.000Z",
            updatedAt: "2026-07-24T13:00:00.000Z",
          },
        },
        error: null,
      }),
    }),
  );
  await page.route("**/api/hotels/*/assignments", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          assignments: [
            {
              id: "52000000-0000-4000-8000-000000000002",
              hotelId: "50000000-0000-4000-8000-000000000001",
              userId: "20000000-0000-4000-8000-000000000011",
              relationshipType: "HOUSEKEEPING",
              assignmentType: null,
              startDate: "2026-07-05",
              endDate: null,
              reason: "객실정비 연결",
              terminatedAt: null,
              terminationReason: null,
              version: 1,
              createdAt: "2026-07-24T00:00:00.000Z",
              updatedAt: "2026-07-24T00:00:00.000Z",
              assignee: {
                userId: "20000000-0000-4000-8000-000000000011",
                displayName: "박하우스키핑",
                userType: "HOUSEKEEPING",
              },
            },
          ],
        },
        error: null,
      }),
    }),
  );
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "긴급 종료" }).first().click();
  const dialog = detail.getByRole("alertdialog", {
    name: "관계를 긴급 종료하시겠습니까?",
  });
  await dialog.getByLabel("긴급 종료 사유").fill("현장 안전 사고 대응");
  await dialog.getByRole("button", { name: "긴급 종료 확인" }).click();
  const heading = detail.getByRole("heading", { name: "관계 및 운영 준비" });
  await expect(dialog).not.toBeVisible();
  await expect(detail.getByRole("button", { name: "긴급 종료" })).toHaveCount(
    1,
  );
  await expect(heading).toBeFocused();
});

test("긴급 종료는 안전 focus·영향 설명·실패 입력 보존을 제공한다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/assignments/*/end", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "FORBIDDEN",
          message: "긴급 종료 권한이 없습니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000006",
          fieldErrors: [],
        },
      }),
    }),
  );
  const detail = await mount(<HotelDetailStory />);
  const trigger = detail.getByRole("button", { name: "긴급 종료" }).first();
  await trigger.click();
  const dialog = detail.getByRole("alertdialog", {
    name: "관계를 긴급 종료하시겠습니까?",
  });
  await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
  await expect(dialog).toContainText("위아히어 강남호텔");
  await expect(dialog).toContainText(
    "호텔 접근과 활성 세션이 회수될 수 있으며",
  );
  await expect(dialog).toContainText(
    "진행 중인 업무는 자동 재배정되지 않습니다",
  );
  expect(
    (await new AxeBuilder({ page }).include("dialog[open]").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  const reason = dialog.getByLabel("긴급 종료 사유");
  await reason.fill("현장 안전 사고 대응");
  await dialog.getByRole("button", { name: "긴급 종료 확인" }).click();
  const errorSummary = dialog.getByRole("alert");
  await expect(errorSummary).toBeFocused();
  await expect(reason).toHaveValue("현장 안전 사고 대응");
});

test("운영활성화는 서버 missing list를 표시하며 idempotency key를 보낸다", async ({
  mount,
  page,
}) => {
  let idempotencyKey = "";
  await page.route("**/api/hotels/*/activate", async (route) => {
    idempotencyKey = route.request().headers()["idempotency-key"] ?? "";
    await route.fulfill({
      contentType: "application/json",
      status: 409,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "HOTEL_ACTIVATION_READINESS_REQUIRED",
          message: "호텔 운영활성화 준비항목을 완료해 주세요.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000001",
          fieldErrors: [
            { field: "ROOM", message: "필수 준비항목이 완료되지 않았습니다." },
            {
              field: "CONTACT",
              message: "필수 준비항목이 완료되지 않았습니다.",
            },
          ],
        },
      }),
    });
  });
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "준비상태 확인" }).click();
  await expect(detail.getByRole("alert")).toContainText(
    "호텔 운영활성화 준비항목을 완료해 주세요",
  );
  await expect(detail.getByText("객실 미완료")).toBeVisible();
  await expect(detail.getByText("문의처와 문의 라우팅 미완료")).toBeVisible();
  expect(idempotencyKey).not.toBe("");
});

test("activation malformed 2xx는 성공으로 처리하지 않는다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/activate", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({}),
    }),
  );
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "준비상태 확인" }).click();
  await expect(detail.getByRole("alert")).toContainText(
    "서버 응답을 확인할 수 없습니다",
  );
  await expect(detail.getByText("준비 완료")).toHaveCount(0);
});

test("소유주 교체는 owner row가 아닌 hotel profile version을 전송한다", async ({
  mount,
  page,
}) => {
  let submittedVersion: unknown;
  await page.route("**/api/hotels/*/owner-transfer", async (route) => {
    submittedVersion = (route.request().postDataJSON() as { version?: unknown })
      .version;
    await route.fulfill({
      contentType: "application/json",
      status: 409,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "VERSION_CONFLICT",
          message: "다른 사용자가 먼저 수정했습니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000002",
          fieldErrors: [],
        },
      }),
    });
  });
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "소유주 교체" }).click();
  const ownerDialog = detail.getByRole("dialog", { name: "소유주 즉시 교체" });
  await ownerDialog
    .getByLabel("새 소유주")
    .selectOption({ label: "한소유후보 장기표시이름 접근성검증" });
  await ownerDialog.getByLabel("교체 사유").fill("운영권 이전");
  await ownerDialog.getByRole("button", { name: "즉시 교체" }).click();
  const conflict = ownerDialog.locator('div[role="alert"][tabindex="-1"]');
  await expect(conflict).toContainText("최신 정보를 불러왔으니");
  await expect(conflict).toBeFocused();
  await expect(ownerDialog.getByLabel("교체 사유")).toHaveValue("운영권 이전");
  await expect(
    ownerDialog.getByRole("button", { name: "즉시 교체" }),
  ).toBeDisabled();
  expect(submittedVersion).toBe(1);
});

test("최근로그인 실패는 owner 입력을 보존하고 dialog 오류로 focus를 이동한다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/eligible-candidates?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          candidates: [
            {
              userId: "20000000-0000-4000-8000-000000000015",
              displayName: "한소유후보 장기표시이름 접근성검증",
              userType: "HOTEL_OWNER",
            },
          ],
          pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        },
        error: null,
      }),
    }),
  );
  await page.route("**/api/hotels/*/owner-transfer", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 401,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "REAUTHENTICATION_REQUIRED",
          message: "최근 로그인이 필요합니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000005",
          fieldErrors: [],
        },
      }),
    }),
  );
  const detail = await mount(<HotelDetailStory />);
  await detail.getByRole("button", { name: "소유주 교체" }).click();
  const ownerDialog = detail.getByRole("dialog", { name: "소유주 즉시 교체" });
  const candidate = ownerDialog.getByLabel("새 소유주");
  const reason = ownerDialog.getByLabel("교체 사유");
  await candidate.selectOption({ label: "한소유후보 장기표시이름 접근성검증" });
  await ownerDialog.getByLabel("후보 이름 검색").fill("한소유");
  await expect(candidate).toHaveValue("");
  await expect(candidate).toBeDisabled();
  await expect(candidate).toBeEnabled();
  await candidate.selectOption({ label: "한소유후보 장기표시이름 접근성검증" });
  await reason.fill("운영권 이전");
  await ownerDialog.getByRole("button", { name: "즉시 교체" }).click();
  const errorSummary = ownerDialog.getByRole("alert");
  await expect(errorSummary).toContainText("최근 5분 이내 로그인");
  await expect(errorSummary).toBeFocused();
  await expect(candidate).toHaveValue("20000000-0000-4000-8000-000000000015");
  await expect(reason).toHaveValue("운영권 이전");
});

test("소유주 read 권한이 없어도 배정관리 영역은 독립적으로 유지된다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/assignments", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { assignments: [] },
        error: null,
      }),
    }),
  );
  await page.route("**/api/hotels/*/owner", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "FORBIDDEN",
          message: "권한이 없습니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000003",
          fieldErrors: [],
        },
      }),
    }),
  );
  const panel = await mount(
    <RelationshipManagementPanel
      hotelId="50000000-0000-4000-8000-000000000001"
      hotelVersion={1}
    />,
  );
  await expect(panel.getByRole("button", { name: "배정 추가" })).toBeVisible();
  await expect(panel.getByText("활성 배정이 없습니다.")).toBeVisible();
  await expect(
    panel.getByText(/소유주 관계를 표시할 수 없습니다/),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "소유주 교체" })).toHaveCount(
    0,
  );
});

test("모바일 fixed navigation이 관계관리 최종 action을 가리지 않는다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = await mount(<HotelDetailStory />);
  const action = detail.getByRole("button", { name: "준비상태 확인" });
  const mobileNavigation = detail.getByRole("navigation", {
    name: "모바일 호텔 운영 메뉴",
  });
  await action.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  const [actionBox, navigationBox] = await Promise.all([
    action.boundingBox(),
    mobileNavigation.boundingBox(),
  ]);
  expect(actionBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect((actionBox?.y ?? 0) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(
    navigationBox?.y ?? 0,
  );
});

test("배정 후보 selector는 모든 API page를 이동할 수 있다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/hotels/*/assignments", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { assignments: [] },
        error: null,
      }),
    }),
  );
  await page.route("**/api/hotels/*/owner", (route) =>
    route.fulfill({
      contentType: "application/json",
      status: 403,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: {
          code: "FORBIDDEN",
          message: "권한이 없습니다.",
          retryable: false,
          retryAfterSeconds: null,
          traceId: "55000000-0000-4000-8000-000000000004",
          fieldErrors: [],
        },
      }),
    }),
  );
  await page.route("**/api/hotels/*/eligible-candidates?*", (route) => {
    const requestedPage = Number(
      new URL(route.request().url()).searchParams.get("page"),
    );
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          candidates: [
            {
              userId:
                requestedPage === 1
                  ? "20000000-0000-4000-8000-000000000021"
                  : "20000000-0000-4000-8000-000000000022",
              displayName:
                requestedPage === 1 ? "첫 페이지 후보" : "두 번째 페이지 후보",
              userType: "INTERNAL_STAFF",
            },
          ],
          pagination: {
            page: requestedPage,
            pageSize: 100,
            total: 101,
            totalPages: 2,
          },
        },
        error: null,
      }),
    });
  });
  const panel = await mount(
    <RelationshipManagementPanel
      hotelId="50000000-0000-4000-8000-000000000001"
      hotelVersion={1}
    />,
  );
  await panel.getByRole("button", { name: "배정 추가" }).click();
  const assignmentDialog = panel.getByRole("dialog", { name: "배정 추가" });
  const candidate = panel.getByLabel("배정 후보");
  await expect(
    panel.getByRole("option", { name: "첫 페이지 후보" }),
  ).toBeAttached();
  await candidate.selectOption({ label: "첫 페이지 후보" });
  await assignmentDialog.getByLabel("후보 이름 검색").fill("새 검색");
  await expect(candidate).toHaveValue("");
  await expect(candidate).toBeDisabled();
  await expect(candidate).toBeEnabled();
  await expect(panel.getByText("후보 1 / 2 페이지")).toBeVisible();
  await panel.getByRole("button", { name: "다음 후보" }).click();
  await expect(
    panel.getByRole("option", { name: "두 번째 페이지 후보" }),
  ).toBeAttached();
  await expect(panel.getByText("후보 2 / 2 페이지")).toBeVisible();
  await panel.getByRole("button", { name: "이전 후보" }).click();
  await expect(
    panel.getByRole("option", { name: "첫 페이지 후보" }),
  ).toBeAttached();
});
