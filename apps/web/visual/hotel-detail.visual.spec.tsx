import { expect, test } from "@playwright/experimental-ct-react";
import AxeBuilder from "@axe-core/playwright";
import { RelationshipManagementPanel } from "../components/hotels/relationship-management-panel";
import { HotelDetailStory } from "../playwright/stories/hotel-detail.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  });
}

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
