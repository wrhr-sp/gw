import AxeBuilder from "@axe-core/playwright";
import {
  inspectionReviewResponseSchema,
} from "@werehere/contracts";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InspectionReviewWorkspace } from "../components/inspections/inspection-review-workspace";
import { AppShell } from "../components/shell/app-shell";

const hotelId = "50000000-0000-4000-8000-000000000001";
const inspectionId = "91000000-0000-4000-8000-000000000001";
const review = {
  inspection: {
    id: inspectionId,
    hotelId,
    source: "ROUTINE" as const,
    businessDate: "2026-08-03",
    dueAt: "2026-08-03T14:59:59.999Z",
    status: "IN_REVIEW" as const,
    version: 2,
    process: {
      executionId: "92000000-0000-4000-8000-000000000001",
      definitionId: "93000000-0000-4000-8000-000000000001",
      revisionId: "94000000-0000-4000-8000-000000000001",
      currentStageKey: "MANAGER_REVIEW",
      currentStageName: "관리자 검토",
      state: "IN_REVIEW" as const,
      version: 2,
    },
    rooms: [
      {
        id: "52000000-0000-4000-8000-000000000001",
        roomNumber: "703",
        floorLabel: "7층",
        roomTypeName: "스탠다드 더블",
      },
    ],
    items: [
      {
        id: "95000000-0000-4000-8000-000000000001",
        roomId: "52000000-0000-4000-8000-000000000001",
        itemId: "96000000-0000-4000-8000-000000000001",
        name: "욕실 누수",
        description: "배수 상태와 누수 여부를 확인합니다.",
        isRequired: true,
        displayOrder: 10,
        defaultSeverity: "MAJOR" as const,
        result: {
          version: 1,
          result: "ABNORMAL" as const,
          description: "세면대 하부 배관에서 누수가 확인됨",
          severity: "MAJOR" as const,
          fileVersionIds: ["99000000-0000-4000-8000-000000000001"],
        },
      },
      {
        id: "95000000-0000-4000-8000-000000000002",
        roomId: "52000000-0000-4000-8000-000000000001",
        itemId: "96000000-0000-4000-8000-000000000002",
        name: "출입문 잠금",
        description: "잠금장치 작동을 확인합니다.",
        isRequired: true,
        displayOrder: 20,
        defaultSeverity: "CRITICAL" as const,
        result: {
          version: 1,
          result: "NORMAL" as const,
          description: null,
          severity: null,
          fileVersionIds: [],
        },
      },
    ],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T01:00:00.000Z",
  },
  provenance: {
    submittedBy: {
      id: "21000000-0000-4000-8000-000000000001",
      displayName: "이수행",
    },
    submittedAt: "2026-08-03T00:30:00.000Z",
    lastResultChangedBy: {
      id: "21000000-0000-4000-8000-000000000001",
      displayName: "이수행",
    },
    lastResultChangedAt: "2026-08-03T00:31:00.000Z",
  },
  review: {
    executionId: "92000000-0000-4000-8000-000000000001",
    version: 2,
    currentStage: { key: "MANAGER_REVIEW", name: "관리자 검토" },
    reviewer: {
      id: "20000000-0000-4000-8000-000000000001",
      displayName: "김관리",
    },
    delegate: null,
    dueAt: "2026-08-03T04:00:00.000Z",
    overdue: false,
    actions: [
      {
        event: "APPROVE" as const,
        choiceValue: null,
        label: "최종 검토로 보내기",
        toStageKey: "FINAL_REVIEW",
        toStageName: "최종 검토",
        completesProcess: false,
      },
      {
        event: "REJECT" as const,
        choiceValue: null,
        label: "반려 · 하우스키핑 재검토",
        toStageKey: "HOUSEKEEPING_RECHECK",
        toStageName: "하우스키핑 재검토",
        completesProcess: false,
      },
    ],
    history: [
      {
        id: "98000000-0000-4000-8000-000000000001",
        previousState: "PENDING_INPUT" as const,
        nextState: "IN_REVIEW" as const,
        previousStageName: null,
        nextStageName: "관리자 검토",
        event: "SUBMIT" as const,
        reason: "현장 점검 제출",
        actor: {
          id: "21000000-0000-4000-8000-000000000001",
          displayName: "이수행",
        },
        occurredAt: "2026-08-03T00:30:00.000Z",
      },
    ],
  },
  evidence: [
    {
      id: "99000000-0000-4000-8000-000000000001",
      itemSnapshotId: "95000000-0000-4000-8000-000000000001",
      displayName: "욕실-누수.jpg",
      mimeType: "image/jpeg" as const,
      sizeBytes: 1024,
    },
  ],
};

const summary = {
  id: inspectionId,
  hotelId,
  source: "ROUTINE" as const,
  businessDate: "2026-08-03",
  dueAt: "2026-08-03T14:59:59.999Z",
  targetSummary: "703호",
  itemCount: 2,
  abnormalCount: 1,
  cautionCount: 0,
  process: {
    executionId: review.review.executionId,
    version: 2,
    currentStageName: "관리자 검토",
    reviewer: review.review.reviewer,
    delegate: null,
    dueAt: review.review.dueAt,
    overdue: false,
  },
};

const mountWorkspace = (
  mount: Parameters<Parameters<typeof test>[1]>[0]["mount"],
) =>
  mount(
    <InspectionReviewWorkspace
      hotelId={hotelId}
      initialPagination={{
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      }}
      initialReviews={[summary]}
      initialSelectedReview={review}
    />,
  );

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/files/*/view", async (route) => {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQtA4HAAEcAKwm1M7RAAAAAElFTkSuQmCC",
      "base64",
    );
    await route.fulfill({ body: bytes, contentType: "image/png", status: 200 });
  });
});

test("검토 visual fixture가 canonical 응답 계약을 만족한다", () => {
  const parsed = inspectionReviewResponseSchema.safeParse({
    data: { review },
    error: null,
    ok: true,
  });
  expect(parsed.success, parsed.error?.message).toBe(true);
  const longHistory = Array.from({ length: 501 }, (_, index) => ({
    ...review.review.history[0]!,
    id: `98000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  }));
  const longHistoryParsed = inspectionReviewResponseSchema.safeParse({
    data: {
      review: {
        ...review,
        review: { ...review.review, history: longHistory },
      },
    },
    error: null,
    ok: true,
  });
  expect(longHistoryParsed.success, longHistoryParsed.error?.message).toBe(true);
});

test("PC 점검 검토 Master–Detail 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const workspace = await mountWorkspace(mount);
  await page.evaluate(() => document.fonts.ready);
  await expect(
    workspace.getByRole("heading", { name: "점검 검토" }),
  ).toBeVisible();
  await expect(
    workspace.getByText("세면대 하부 배관에서 누수가 확인됨"),
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", { name: "최종 검토로 보내기" }),
  ).toHaveCSS("min-height", "44px");
  const guideButton = workspace
    .getByRole("button", { name: "점검 검토 도움말" })
    .first();
  await guideButton.click();
  await expect(page.getByRole("heading", { name: "점검 검토 도움말" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(guideButton).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="inspection-review-workspace"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("inspection-review-desktop.png");
});

test("transition 응답 유실 재시도는 동일 operation을 유지한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const keys: string[] = [];
  const bodies: string[] = [];
  await page.route("**/process/transition", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({
      body: JSON.stringify({
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          fieldErrors: [],
          message: "처리 결과를 확인하지 못했습니다.",
          retryable: true,
          retryAfterSeconds: null,
          traceId: "9f000000-0000-4000-8000-000000000001",
        },
        ok: false,
      }),
      contentType: "application/json",
      status: 503,
    });
  });
  const workspace = await mountWorkspace(mount);
  const action = workspace.getByRole("button", {
    name: "반려 · 하우스키핑 재검토",
    exact: true,
  });
  await action.scrollIntoViewIfNeeded();
  await workspace.getByLabel("처리 사유").fill("누수 원인 재점검 필요");
  await action.click();
  await expect(
    page.getByRole("heading", { name: "반려 · 하우스키핑 재검토" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(action).toBeFocused();

  await action.click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  const dialogAlert = page.getByRole("dialog").getByRole("alert");
  await expect(dialogAlert).toContainText(
    "처리 결과를 확인하지 못했습니다.",
  );
  await expect(dialogAlert).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(
    page.getByRole("heading", { name: "반려 · 하우스키핑 재검토" }),
  ).toBeVisible();
  await expect(workspace.getByLabel("처리 사유")).toHaveValue(
    "누수 원인 재점검 필요",
  );
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toBe(bodies[0]);
});

test("처리 사유는 2자 이상 500자 이하 DOM·ARIA 계약을 지킨다", async ({
  mount,
  page,
}) => {
  let requestCount = 0;
  await page.route("**/process/transition", async (route) => {
    requestCount += 1;
    await route.fulfill({
      body: JSON.stringify({
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          fieldErrors: [],
          message: "재시도해 주세요.",
          retryable: true,
          retryAfterSeconds: null,
          traceId: "9f000000-0000-4000-8000-000000000004",
        },
        ok: false,
      }),
      contentType: "application/json",
      status: 503,
    });
  });
  const workspace = await mountWorkspace(mount);
  const action = workspace.getByRole("button", {
    name: "반려 · 하우스키핑 재검토",
    exact: true,
  });
  const reason = workspace.getByLabel("처리 사유");
  await action.click();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("처리 사유를 입력");
  await reason.fill("가");
  await action.click();
  await expect(page.getByRole("alert")).toContainText("2자 이상");
  await expect(reason).toBeFocused();
  await reason.fill("  ");
  await action.click();
  await expect(reason).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requestCount).toBe(0);
  await reason.fill("확인");
  await action.click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect.poll(() => requestCount).toBe(1);
  await expect(reason).toHaveAttribute("maxlength", "500");
  await page.keyboard.press("Escape");
  await reason.fill("가".repeat(501));
  await expect(reason).toHaveValue("가".repeat(500));
  await action.click();
  await expect(
    page.getByRole("heading", { name: "반려 · 하우스키핑 재검토" }),
  ).toBeVisible();
  expect(requestCount).toBe(1);
});

test("VERSION_CONFLICT는 canonical version 재조회 후 새 operation으로 전환한다", async ({
  mount,
  page,
}) => {
  const keys: string[] = [];
  const versions: number[] = [];
  const currentReview = {
    ...review,
    review: { ...review.review, version: 3 },
  };
  const currentSummary = {
    ...summary,
    process: { ...summary.process, version: 3 },
  };
  await page.route("**/process/transition", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    versions.push(JSON.parse(route.request().postData() ?? "{}").version);
    if (keys.length === 1) {
      await route.fulfill({
        body: JSON.stringify({
          data: null,
          error: {
            code: "VERSION_CONFLICT",
            fieldErrors: [],
            message: "다른 사용자가 먼저 처리했습니다.",
            retryable: false,
            retryAfterSeconds: null,
            traceId: "9f000000-0000-4000-8000-000000000003",
          },
          ok: false,
        }),
        contentType: "application/json",
        status: 409,
      });
      return;
    }
    await route.fulfill({
      body: JSON.stringify({
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          fieldErrors: [],
          message: "재시도해 주세요.",
          retryable: true,
          retryAfterSeconds: null,
          traceId: "9f000000-0000-4000-8000-000000000004",
        },
        ok: false,
      }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews?page=1&pageSize=20`,
    async (route) =>
      route.fulfill({
        body: JSON.stringify({
          data: {
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            reviews: [currentSummary],
          },
          error: null,
          ok: true,
        }),
        contentType: "application/json",
        status: 200,
      }),
  );
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`,
    async (route) =>
      route.fulfill({
        body: JSON.stringify({
          data: { review: currentReview },
          error: null,
          ok: true,
        }),
        contentType: "application/json",
        status: 200,
      }),
  );
  const workspace = await mountWorkspace(mount);
  const action = workspace.getByRole("button", {
    name: "반려 · 하우스키핑 재검토",
    exact: true,
  });
  await workspace.getByLabel("처리 사유").fill("최신 상태 재검토");
  await action.click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect(workspace.getByRole("status")).toContainText(
    "최신 상태를 확인한 뒤 다시 처리",
  );
  await expect(workspace.getByLabel("처리 사유")).toHaveValue(
    "최신 상태 재검토",
  );
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(versions).toEqual([2, 3]);
  expect(keys[1]).not.toBe(keys[0]);
});

test("transition 뒤 stale 200 목록은 성공 확정 없이 같은 operation을 유지한다", async ({
  mount,
  page,
}) => {
  const keys: string[] = [];
  const transitionedReview = {
    ...review,
    review: { ...review.review, version: 3 },
  };
  await page.route("**/process/transition", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    await route.fulfill({
      body: JSON.stringify({
        data: { review: transitionedReview },
        error: null,
        ok: true,
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews?page=1&pageSize=20`,
    async (route) =>
      route.fulfill({
        body: JSON.stringify({
          data: {
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            reviews: [summary],
          },
          error: null,
          ok: true,
        }),
        contentType: "application/json",
        status: 200,
      }),
  );
  const workspace = await mountWorkspace(mount);
  const action = workspace.getByRole("button", {
    name: "반려 · 하우스키핑 재검토",
    exact: true,
  });
  await workspace.getByLabel("처리 사유").fill("stale 목록 확인");
  await action.click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect(workspace.getByRole("status")).toContainText(
    "최신 목록이 일치하지 않습니다",
  );
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
});

test("두 번째 검토 페이지를 canonical 상세과 함께 불러온다", async ({
  mount,
  page,
}) => {
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews?page=2&pageSize=20`,
    async (route) =>
      route.fulfill({
        body: JSON.stringify({
          data: {
            pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
            reviews: [summary],
          },
          error: null,
          ok: true,
        }),
        contentType: "application/json",
        status: 200,
      }),
  );
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`,
    async (route) =>
    route.fulfill({
      body: JSON.stringify({ data: { review }, error: null, ok: true }),
      contentType: "application/json",
      status: 200,
    }),
  );
  const workspace = await mount(
    <InspectionReviewWorkspace
      hotelId={hotelId}
      initialPagination={{ page: 1, pageSize: 20, total: 21, totalPages: 2 }}
      initialReviews={[summary]}
      initialSelectedReview={review}
    />,
  );
  await workspace.getByRole("button", { name: "다음" }).click();
  await expect(workspace.getByText("2 / 2")).toBeVisible();
  await expect(workspace.getByRole("status")).toContainText(
    "2페이지 검토 목록을 불러왔습니다.",
  );
  await expect(workspace.getByRole("button", { name: "이전" })).toBeEnabled();
});

test("이관 성공으로 trigger가 제거되면 목록 heading으로 focus를 복구한다", async ({ mount, page }) => {
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`,
    async (route) =>
      route.fulfill({
        body: JSON.stringify({
          data: null,
          error: {
            code: "RESOURCE_NOT_FOUND",
            fieldErrors: [],
            message: "담당 검토가 아닙니다.",
            retryable: false,
            retryAfterSeconds: null,
            traceId: "9f000000-0000-4000-8000-000000000009",
          },
          ok: false,
        }),
        contentType: "application/json",
        status: 404,
      }),
  );
  await page.route("**/process/transition", async (route) =>
    route.fulfill({
      body: JSON.stringify({ data: { review }, error: null, ok: true }),
      contentType: "application/json",
      status: 200,
    }),
  );
  await page.route(
    `**/api/hotels/${hotelId}/inspection-reviews?page=1&pageSize=20`,
    async (route) =>
      route.fulfill({
        body: JSON.stringify({
          data: {
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
            reviews: [],
          },
          error: null,
          ok: true,
        }),
        contentType: "application/json",
        status: 200,
      }),
  );
  const workspace = await mountWorkspace(mount);
  const action = workspace.getByRole("button", {
    name: "최종 검토로 보내기",
  });
  await workspace.getByLabel("처리 사유").fill("최종 검토 담당자에게 전달");
  await action.click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  const listHeading = workspace.getByRole("heading", { name: "검토 대기" });
  await expect(workspace.getByRole("status")).toContainText(
    "다음 담당자에게 전달되었습니다.",
  );
  await expect(listHeading).toBeFocused();
});

test("transition 뒤 다른 페이지로 재정렬된 담당 건을 전체 목록에서 확인한다", async ({ mount, page }) => {
  const transitionedReview = { ...review, review: { ...review.review, version: 3 } };
  const transitionedSummary = { ...summary, process: { ...summary.process, version: 3 } };
  const unrelated = Array.from({ length: 20 }, (_, index) => ({
    ...summary,
    id: `91000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
    targetSummary: `${index + 100}호`,
  }));
  let pageTwoReads = 0;
  await page.route("**/process/transition", async (route) => route.fulfill({
    body: JSON.stringify({ data: { review: transitionedReview }, error: null, ok: true }),
    contentType: "application/json", status: 200,
  }));
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews?page=1&pageSize=20`, async (route) =>
    route.fulfill({ body: JSON.stringify({ data: {
      pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 }, reviews: unrelated,
    }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews?page=2&pageSize=20`, async (route) => {
    pageTwoReads += 1;
    await route.fulfill({ body: JSON.stringify({ data: {
      pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 }, reviews: [transitionedSummary],
    }, error: null, ok: true }), contentType: "application/json", status: 200 });
  });
  const workspace = await mountWorkspace(mount);
  await workspace.getByLabel("처리 사유").fill("다른 페이지 담당 유지 확인");
  await workspace.getByRole("button", { name: "최종 검토로 보내기" }).click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect(workspace.getByRole("status")).toContainText("최신 상태를 다시 확인");
  expect(pageTwoReads).toBe(1);
  await expect(workspace.getByText("2 / 2")).toBeVisible();
});

test("늦은 상세 응답이 최신 페이지 상세를 덮어쓰지 않는다", async ({ mount, page }) => {
  const otherId = "91000000-0000-4000-8000-000000000002";
  const otherSummary = { ...summary, id: otherId, targetSummary: "801호" };
  const otherReview = { ...review, inspection: { ...review.inspection, id: otherId,
    rooms: [{ ...review.inspection.rooms[0]!, id: otherId, roomNumber: "801" }] } };
  let releaseDetail!: () => void;
  const delayed = new Promise<void>((resolve) => { releaseDetail = resolve; });
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`, async (route) => {
    await delayed;
    await route.fulfill({ body: JSON.stringify({ data: { review }, error: null, ok: true }), contentType: "application/json", status: 200 });
  });
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews/${otherId}`, async (route) =>
    route.fulfill({ body: JSON.stringify({ data: { review: otherReview }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews?page=2&pageSize=20`, async (route) =>
    route.fulfill({ body: JSON.stringify({ data: {
      pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 }, reviews: [otherSummary],
    }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  const workspace = await mount(
    <InspectionReviewWorkspace hotelId={hotelId}
      initialPagination={{ page: 1, pageSize: 20, total: 21, totalPages: 2 }}
      initialReviews={[summary]} initialSelectedReview={review} />,
  );
  await workspace.getByRole("button", { name: /703호/ }).click();
  await workspace.getByRole("button", { name: "다음" }).click();
  await expect(workspace.getByRole("heading", { name: "801호" })).toBeVisible();
  releaseDetail();
  await expect(workspace.getByRole("heading", { name: "801호" })).toBeVisible();
  await expect(workspace.getByText("2 / 2")).toBeVisible();
});

test("페이지 사이 재정렬 중 canonical detail이 남아 있으면 transition 성공을 확정하지 않는다", async ({ mount, page }) => {
  const keys: string[] = [];
  const transitioned = { ...review, review: { ...review.review, version: 3 } };
  const unrelated = { ...summary, id: "91000000-0000-4000-8000-000000000099", targetSummary: "999호" };
  await page.route("**/process/transition", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    await route.fulfill({ body: JSON.stringify({ data: { review: transitioned }, error: null, ok: true }), contentType: "application/json", status: 200 });
  });
  for (const pageNumber of [1, 2])
    await page.route(`**/api/hotels/${hotelId}/inspection-reviews?page=${pageNumber}&pageSize=20`, async (route) =>
      route.fulfill({ body: JSON.stringify({ data: { pagination: { page: pageNumber, pageSize: 20, total: 21, totalPages: 2 }, reviews: [unrelated] }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`, async (route) =>
    route.fulfill({ body: JSON.stringify({ data: { review: transitioned }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  const workspace = await mountWorkspace(mount);
  await workspace.getByLabel("처리 사유").fill("재정렬 수렴 확인");
  await workspace.getByRole("button", { name: "최종 검토로 보내기" }).click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("목록이 갱신되는 중");
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
});

test("VERSION_CONFLICT 재정렬 중 detail이 남으면 기존 선택을 제거하지 않는다", async ({ mount, page }) => {
  await page.route("**/process/transition", async (route) => route.fulfill({
    body: JSON.stringify({ data: null, error: { code: "VERSION_CONFLICT", fieldErrors: [], message: "충돌", retryable: false, retryAfterSeconds: null, traceId: "9f000000-0000-4000-8000-000000000008" }, ok: false }), contentType: "application/json", status: 409,
  }));
  const unrelated = { ...summary, id: "91000000-0000-4000-8000-000000000099", targetSummary: "999호" };
  for (const pageNumber of [1, 2])
    await page.route(`**/api/hotels/${hotelId}/inspection-reviews?page=${pageNumber}&pageSize=20`, async (route) =>
      route.fulfill({ body: JSON.stringify({ data: { pagination: { page: pageNumber, pageSize: 20, total: 21, totalPages: 2 }, reviews: [unrelated] }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`, async (route) =>
    route.fulfill({ body: JSON.stringify({ data: { review }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  const workspace = await mountWorkspace(mount);
  await workspace.getByLabel("처리 사유").fill("갈등 재정렬 확인");
  await workspace.getByRole("button", { name: "최종 검토로 보내기" }).click();
  await page.getByRole("button", { name: "처리 확정" }).click();
  await expect(workspace.getByRole("status")).toContainText("최신 검토 상태를 불러오지 못했습니다");
  await expect(workspace.getByRole("heading", { name: "703호" })).toBeVisible();
  await expect(workspace.getByLabel("처리 사유")).toHaveValue("갈등 재정렬 확인");
});

test("늦은 페이지 응답이 더 최신 explicit detail 선택을 덮어쓰지 않는다", async ({ mount, page }) => {
  let releasePage!: () => void;
  const delayed = new Promise<void>((resolve) => { releasePage = resolve; });
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews?page=2&pageSize=20`, async (route) => {
    await delayed;
    await route.fulfill({ body: JSON.stringify({ data: { pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 }, reviews: [summary] }, error: null, ok: true }), contentType: "application/json", status: 200 });
  });
  await page.route(`**/api/hotels/${hotelId}/inspection-reviews/${inspectionId}`, async (route) =>
    route.fulfill({ body: JSON.stringify({ data: { review }, error: null, ok: true }), contentType: "application/json", status: 200 }));
  const workspace = await mount(<InspectionReviewWorkspace hotelId={hotelId}
    initialPagination={{ page: 1, pageSize: 20, total: 21, totalPages: 2 }} initialReviews={[summary]} initialSelectedReview={review} />);
  await workspace.getByRole("button", { name: "다음" }).click();
  await workspace.getByRole("button", { name: /703호/ }).click();
  releasePage();
  await expect(workspace.getByText("1 / 2")).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "703호" })).toBeVisible();
});

test("실제 AppShell에서 단일 main과 safe-area 하단 경계를 지킨다", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: 'nav[aria-label="모바일 호텔 운영 메뉴"] { height: 88px !important; padding-bottom: 24px !important; }' });
  await mount(
    <div style={{ "--inspection-safe-area-inset-bottom": "24px" } as never}>
      <AppShell currentPath={`/hotels/${hotelId}/inspections/reviews`} hotelName="서울 호텔"
        navigation={[{ href: `/hotels/${hotelId}`, icon: <span>H</span>, label: "호텔" }]}
        userDisplayName="김검토">
        <InspectionReviewWorkspace hotelId={hotelId}
          initialPagination={{ page: 1, pageSize: 20, total: 1, totalPages: 1 }}
          initialReviews={[summary]} initialSelectedReview={review} />
      </AppShell>
    </div>,
  );
  await expect(page.locator("main")).toHaveCount(1);
  const quick = page.getByRole("complementary", { name: "빠른 검토 처리" });
  const navigation = page.getByRole("navigation", { name: "모바일 호텔 운영 메뉴" });
  await expect(quick).toHaveCSS("bottom", "104px");
  await expect.poll(async () => {
    const quickBox = await quick.boundingBox();
    const navigationBox = await navigation.boundingBox();
    return Boolean(quickBox && navigationBox && quickBox.y + quickBox.height <= navigationBox.y);
  }).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("모바일 점검 검토 행동 우선 카드 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const workspace = await mountWorkspace(mount);
  await page.evaluate(() => document.fonts.ready);
  const quickPanel = workspace.getByRole("complementary", {
    name: "빠른 검토 처리",
  });
  await expect(quickPanel).toHaveCSS("position", "fixed");
  await expect(quickPanel).toHaveCSS("bottom", "80px");
  await expect
    .poll(async () => (await quickPanel.boundingBox())?.y ?? 0)
    .toBeGreaterThan(680);
  const quickAction = workspace.getByRole("button", {
    name: "빠른 처리: 반려 · 하우스키핑 재검토",
  });
  await expect(quickAction).toBeInViewport();
  await expect(quickAction).toHaveCSS("min-height", "44px");
  await workspace.getByLabel("처리 사유").fill("모바일 재점검 요청");
  await quickAction.click();
  await expect(
    page.getByRole("heading", { name: "반려 · 하우스키핑 재검토" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(quickAction).toBeFocused();
  const action = workspace.getByRole("button", {
    name: "반려 · 하우스키핑 재검토",
    exact: true,
  });
  await action.scrollIntoViewIfNeeded();
  await expect(action).toHaveCSS("min-height", "44px");
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="inspection-review-workspace"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("inspection-review-mobile.png");
});
