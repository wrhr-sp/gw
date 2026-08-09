import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import { calendarConnectionStatusResponseSchema } from "@werehere/contracts";
import React from "react";
import {
  CalendarConnectionStory,
  CalendarWorkspaceStory,
} from "../playwright/stories/calendar-workspace.story";

const connectionStatus = calendarConnectionStatusResponseSchema.parse({
  ok: true,
  data: {
    connectionId: "50000000-0000-4000-8000-000000000099",
    connectionStatus: "CONNECTED",
    credentialStatus: "ACTIVE",
    version: 2,
    candidateId: null,
    candidateRowVersion: null,
    hotels: [
      {
        hotelId: "50000000-0000-4000-8000-000000000001",
        hotelName: "서울호텔",
        hotelLinkId: "51000000-0000-4000-8000-000000000001",
        generation: 1,
        linkStatus: "ACTIVE",
        version: 3,
        projectionStatus: "SYNCED",
        lastFailureCode: null,
      },
      {
        hotelId: "50000000-0000-4000-8000-000000000002",
        hotelName: "부산호텔",
        hotelLinkId: "51000000-0000-4000-8000-000000000002",
        generation: 1,
        linkStatus: "ACTIVE",
        version: 4,
        projectionStatus: "ACTION_REQUIRED",
        lastFailureCode: "PROVIDER_RETRY_EXHAUSTED",
      },
    ],
    failures: [
      {
        failureId: "53000000-0000-4000-8000-000000000001",
        version: 1,
        hotelId: "50000000-0000-4000-8000-000000000002",
        eventLinkId: "54000000-0000-4000-8000-000000000001",
        failureCode: "PROVIDER_RETRY_EXHAUSTED",
        occurredAt: "2026-08-08T00:00:00.000Z",
      },
    ],
  },
  error: null,
});

test("Google Calendar 관리자 화면은 PC·390px에서 상태·행동과 Axe를 충족한다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/admin/calendar-connections", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(connectionStatus),
    }),
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ height: 900, width });
    const component = await mount(<CalendarConnectionStory />);
    await expect(
      component.getByRole("heading", { name: "Google Calendar 연결" }),
    ).toBeVisible();
    await expect(component.getByText("서울호텔")).toBeVisible();
    await expect(
      component.getByRole("button", { name: "이 실패 다시 시도" }),
    ).toBeVisible();
    const retryBox = await component
      .getByRole("button", { name: "이 실패 다시 시도" })
      .boundingBox();
    expect(retryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(retryBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    const guide = component.getByRole("button", {
      name: "Google Calendar 연결 도움말",
    });
    const guideBox = await guide.boundingBox();
    expect(guideBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(guideBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    await guide.focus();
    await expect(guide).toBeFocused();
    await guide.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Google Calendar 연결 도움말" }),
    ).toBeVisible();
    const guideClose = page.getByRole("button", {
      name: "Google Calendar 연결 도움말 닫기",
    });
    const closeBox = await guideClose.boundingBox();
    expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const screenshot = await page.screenshot();
    expect(screenshot.readUInt32BE(16)).toBe(width);
    expect(screenshot.readUInt32BE(20)).toBe(900);
    if (width === 390) {
      await page.getByTestId("feature-guide-overlay").click({
        position: { x: 4, y: 4 },
      });
    } else {
      await guideClose.click();
    }
    await expect(guide).toBeFocused();
    await guide.press("Space");
    await expect(guideClose).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(guide).toBeFocused();
    await expect(component.getByLabel("변경 사유")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include("section[aria-labelledby=calendar-connection-title]")
          .analyze()
      ).violations,
    ).toEqual([]);
    await component.unmount();
  }
});

test("Google Calendar 변경 사유는 trim 기준 1·2·500·501자 경계를 action 전에 검증한다", async ({
  mount,
  page,
}) => {
  const postedReasons: string[] = [];
  await page.route("**/api/admin/calendar-connections**", async (route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      postedReasons.push(body.reason);
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(connectionStatus),
    });
  });
  const component = await mount(
    <CalendarConnectionStory initialData={connectionStatus.data} />,
  );
  const reasonField = component.getByLabel("변경 사유");
  const disconnect = component.getByRole("button", { name: "연결 해제" });
  await expect(reasonField).toHaveAttribute("maxlength", "500");

  await reasonField.fill("가");
  await disconnect.click();
  await expect(
    component.getByText("두 글자 이상 입력해 주세요."),
  ).toBeVisible();
  expect(postedReasons).toEqual([]);

  await reasonField.fill("가나");
  await disconnect.click();
  await expect.poll(() => postedReasons).toEqual(["가나"]);
  await expect(disconnect).toBeEnabled();

  await reasonField.fill("가".repeat(500));
  await disconnect.click();
  await expect.poll(() => postedReasons).toEqual(["가나", "가".repeat(500)]);
  await expect(disconnect).toBeEnabled();

  await reasonField.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, "가".repeat(501));
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await disconnect.click();
  await expect(
    component.getByText("500자 이내로 입력해 주세요."),
  ).toBeVisible();
  expect(postedReasons).toEqual(["가나", "가".repeat(500)]);
});

test("candidate stale conflict는 exact fence를 전송하고 canonical status로 수렴한다", async ({
  mount,
  page,
}) => {
  const candidate = calendarConnectionStatusResponseSchema.parse({
    ...connectionStatus,
    data: {
      ...connectionStatus.data,
      credentialStatus: "ACCESS_VERIFIED",
      candidateId: "52000000-0000-4000-8000-000000000001",
      candidateRowVersion: 7,
    },
  });
  const canonical = calendarConnectionStatusResponseSchema.parse({
    ...connectionStatus,
    data: {
      ...connectionStatus.data,
      credentialStatus: "ACTIVE",
      candidateId: null,
      candidateRowVersion: null,
      version: 3,
    },
  });
  let postedBody: unknown;
  let statusCalls = 0;
  await page.route(
    "**/api/admin/calendar-connections/50000000-0000-4000-8000-000000000099/credential-candidates/52000000-0000-4000-8000-000000000001/promote",
    async (route) => {
      postedBody = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({
          ok: false,
          data: null,
          error: {
            code: "CALENDAR_CONNECTION_VERSION_CONFLICT",
            message: "최신 연결 상태를 다시 확인해 주세요.",
            fieldErrors: [],
            retryable: false,
            retryAfterSeconds: null,
            traceId: "53000000-0000-4000-8000-000000000001",
          },
        }),
      });
    },
  );
  await page.route("**/api/admin/calendar-connections", async (route) => {
    statusCalls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(canonical),
    });
  });
  const component = await mount(
    <CalendarConnectionStory initialData={candidate.data} />,
  );
  await component.getByLabel("변경 사유").fill("검증 후보 사용");
  await component.getByRole("button", { name: "후보 사용" }).click();
  await expect.poll(() => statusCalls).toBe(1);
  expect(postedBody).toEqual({
    expectedVersion: 2,
    expectedCandidateRowVersion: 7,
    reason: "검증 후보 사용",
  });
  await expect(
    component.getByRole("button", { name: "후보 사용" }),
  ).toHaveCount(0);
});

test("Google Calendar 관리자 화면은 저속 조회와 안전 오류를 알린다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/admin/calendar-connections", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: JSON.stringify({
        ok: false,
        data: null,
        error: { message: "연결 상태를 확인할 수 없습니다." },
      }),
    });
  });
  const component = await mount(<CalendarConnectionStory />);
  await expect(
    component.getByText("연결 상태를 확인하고 있습니다."),
  ).toBeVisible();
  await expect(component.getByRole("alert")).toContainText(
    "Google Calendar 오류 응답을 안전하게 확인하지 못했습니다.",
    { timeout: 15_000 },
  );
});

test("Google Calendar 변경 후 mutation payload가 아닌 canonical GET을 재조회한다", async ({
  mount,
  page,
}) => {
  let getCount = 0;
  let postCount = 0;
  let current = connectionStatus;
  await page.route("**/api/admin/calendar-connections**", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      const body = JSON.parse(route.request().postData() ?? "{}");
      expect(new URL(route.request().url()).pathname).toBe(
        "/api/admin/calendar-connections/hotels/50000000-0000-4000-8000-000000000002/failures/53000000-0000-4000-8000-000000000001/retry",
      );
      expect(body).toEqual({
        expectedVersion: 1,
        reason: "관리자 재시도",
      });
      current = {
        ...connectionStatus,
        data: {
          ...connectionStatus.data,
          hotels: connectionStatus.data.hotels.map((hotel) =>
            hotel.hotelName === "부산호텔"
              ? {
                  ...hotel,
                  version: 5,
                  projectionStatus: "PENDING",
                  lastFailureCode: null,
                }
              : hotel,
          ),
          failures: [],
        },
      };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(current),
      });
      return;
    }
    getCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(current),
    });
  });
  const component = await mount(<CalendarConnectionStory />);
  await expect(
    component.getByRole("heading", { name: "부산호텔" }),
  ).toBeVisible();
  await component.getByLabel("변경 사유").fill("관리자 재시도");
  await component.getByRole("button", { name: "이 실패 다시 시도" }).click();
  await expect(component.getByText(/반영 중/)).toBeVisible();
  await expect(component.getByRole("status")).toContainText("최신 상태");
  expect(postCount).toBe(1);
  expect(getCount).toBeGreaterThanOrEqual(2);
});

test("늦게 완료된 이전 GET은 mutation 뒤 canonical 상태를 덮어쓰지 않는다", async ({
  mount,
  page,
}) => {
  const canonical = calendarConnectionStatusResponseSchema.parse({
    ...connectionStatus,
    data: {
      ...connectionStatus.data,
      hotels: connectionStatus.data.hotels.map((hotel) =>
        hotel.hotelName === "부산호텔"
          ? {
              ...hotel,
              version: 5,
              projectionStatus: "PENDING",
              lastFailureCode: null,
            }
          : hotel,
      ),
      failures: [],
    },
  });
  let getCount = 0;
  let releaseOld: (() => void) | undefined;
  const oldGate = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  await page.route("**/api/admin/calendar-connections**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(canonical),
      });
      return;
    }
    getCount += 1;
    if (getCount === 1) {
      await oldGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(connectionStatus),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(canonical),
    });
  });
  const component = await mount(
    <CalendarConnectionStory initialData={connectionStatus.data} />,
  );
  await component.getByRole("button", { name: "새로고침" }).click();
  await expect.poll(() => getCount).toBe(1);
  await component.getByLabel("변경 사유").fill("지연 조회 경쟁 검증");
  await component.getByRole("button", { name: "이 실패 다시 시도" }).click();
  await expect.poll(() => getCount).toBe(2);
  await expect(component.getByText(/반영 중/)).toBeVisible();
  releaseOld?.();
  await page.waitForTimeout(100);
  await expect(component.getByText(/반영 중/)).toBeVisible();
});

test("Google Calendar malformed 2xx command receipt를 성공으로 처리하지 않는다", async ({
  mount,
  page,
}) => {
  await page.route("**/api/admin/calendar-connections**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        route.request().method() === "POST"
          ? {
              ok: true,
              data: { projectionStatus: "ACTION_REQUIRED", version: 4 },
              error: null,
            }
          : connectionStatus,
      ),
    });
  });
  const component = await mount(<CalendarConnectionStory />);
  await component.getByLabel("변경 사유").fill("관리자 재시도");
  await component.getByRole("button", { name: "이 실패 다시 시도" }).click();
  await expect(component.getByRole("alert")).toBeVisible();
  await expect(component.getByRole("status")).not.toContainText("최신 상태");
});

test("PC 업무 달력은 월간·주간과 점검·보수 일정을 가로 넘침 없이 제공한다", async ({
  mount,
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-07T03:00:00.000Z"));
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<CalendarWorkspaceStory />);
  await expect(
    component.getByRole("heading", { name: "업무 달력" }),
  ).toBeVisible();
  await expect(component.getByRole("button", { name: "월간" })).toBeVisible();
  await expect(component.getByRole("button", { name: "주간" })).toBeVisible();
  await expect(component.getByText("점검 마감").first()).toBeVisible();
  await expect(
    component.getByRole("button", { name: /배관 점검/u }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("section[aria-labelledby=calendar-title]")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("390px 방문일정 등록은 실제 선택정보·Escape·focus 복귀를 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.route("**/api/calendar/capabilities", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          canViewAllHotels: false,
          hotels: [
            {
              id: "50000000-0000-4000-8000-000000000001",
              name: "서울호텔",
              canCreateVisit: true,
            },
          ],
        },
        error: null,
      }),
    }),
  );
  await page.route("**/api/hotels/*/calendar/visit-options", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          repairs: [
            {
              id: "a1000000-0000-4000-8000-000000000001",
              targetName: "703호",
              priorityName: "긴급",
            },
          ],
          internalPerformers: [
            {
              userId: "2f000000-0000-4000-8000-000000000001",
              displayName: "김현장",
            },
          ],
        },
        error: null,
      }),
    }),
  );
  let releasePost = () => {};
  let markPostStarted = () => {};
  const idempotencyKeys: string[] = [];
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  const postStarted = new Promise<void>((resolve) => {
    markPostStarted = resolve;
  });
  await page.route("**/api/hotels/*/repair-visits", async (route) => {
    idempotencyKeys.push(route.request().headers()["idempotency-key"] ?? "");
    markPostStarted();
    await postGate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        data: null,
        error: { code: "INTERNAL_ERROR" },
      }),
    });
  });
  const component = await mount(<CalendarWorkspaceStory />);
  const trigger = component.getByRole("button", { name: "방문일정 등록" });
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "보수 방문일정 등록" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("보수 건")).toBeVisible();
  await expect(dialog.getByLabel("내부 수행자")).toBeVisible();
  const close = dialog.getByRole("button", { name: "닫기" });
  const save = dialog.getByRole("button", { name: "방문일정 저장" });
  for (const action of [close, save]) {
    const box = await action.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include("[role=dialog]").analyze())
      .violations,
  ).toEqual([]);
  await dialog
    .getByLabel("보수 건")
    .selectOption("a1000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("일정명").fill("저장 중 닫기 방지 검증");
  await dialog.getByLabel("시작시각").fill("2026-08-07T19:30");
  await dialog.getByLabel("종료시각").fill("2026-08-07T20:30");
  await dialog
    .getByLabel("내부 수행자")
    .selectOption("2f000000-0000-4000-8000-000000000001");
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
  await dialog
    .getByLabel("보수 건")
    .selectOption("a1000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("일정명").fill("다른 불확정 방문일정");
  await dialog.getByLabel("시작시각").fill("2026-08-07T19:30");
  await dialog.getByLabel("종료시각").fill("2026-08-07T20:30");
  await dialog
    .getByLabel("내부 수행자")
    .selectOption("2f000000-0000-4000-8000-000000000001");
  await dialog.getByRole("button", { name: "방문일정 저장" }).click();
  await expect.poll(() => idempotencyKeys.length).toBe(2);
  expect(idempotencyKeys[0]).not.toBe("");
  expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("보수 건")
    .selectOption("a1000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("일정명").fill("저장 중 닫기 방지 검증");
  await dialog.getByLabel("시작시각").fill("2026-08-07T19:30");
  await dialog.getByLabel("종료시각").fill("2026-08-07T20:30");
  await dialog
    .getByLabel("내부 수행자")
    .selectOption("2f000000-0000-4000-8000-000000000001");
  await dialog.getByRole("button", { name: "방문일정 저장" }).click();
  await expect.poll(() => idempotencyKeys.length).toBe(3);
  expect(idempotencyKeys[2]).toBe(idempotencyKeys[0]);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("390px 모바일은 축소 달력 대신 선택 날짜 현장업무 카드를 표시한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<CalendarWorkspaceStory />);
  await expect(
    component.getByRole("heading", { name: "업무 달력" }),
  ).toBeVisible();
  await expect(
    component.getByRole("button", { name: /점검 마감/ }),
  ).toBeVisible();
  await expect(
    component.getByRole("button", { name: /배관 점검/ }),
  ).toBeVisible();
  await expect(component.getByText("Google 미연결")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("section[aria-labelledby=calendar-title]")
        .analyze()
    ).violations,
  ).toEqual([]);
});
