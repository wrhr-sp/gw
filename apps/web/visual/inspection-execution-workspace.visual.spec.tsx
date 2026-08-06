import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InspectionExecutionWorkspace } from "../components/inspections/inspection-execution-workspace";
import { AppShell } from "../components/shell/app-shell";

const hotelId = "50000000-0000-4000-8000-000000000001";
const roomTypeId = "51000000-0000-4000-8000-000000000001";
const roomId = "52000000-0000-4000-8000-000000000001";
const targetId = "53000000-0000-4000-8000-000000000001";
const facilityId = "54000000-0000-4000-8000-000000000001";
const facilityTypeId = "55000000-0000-4000-8000-000000000001";
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
  targets: [
    {
      id: targetId,
      type: "ROOM" as const,
      roomId,
      roomNumberSnapshot: "703",
      floorLabelSnapshot: "7층",
      roomTypeNameSnapshot: "스탠다드 더블",
    },
  ],
  items: [
    {
      id: "95000000-0000-4000-8000-000000000001",
      executionTargetId: targetId,
      targetType: "ROOM" as const,
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
      executionTargetId: targetId,
      targetType: "ROOM" as const,
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
      executionTargetId: targetId,
      targetType: "ROOM" as const,
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
  targets: [
    {
      ...summary.targets[0]!,
      id: "53000000-0000-4000-8000-000000000002",
      roomId: "52000000-0000-4000-8000-000000000002",
      roomNumberSnapshot: "704",
    },
  ],
};

const mountWorkspace = (
  mount: Parameters<Parameters<typeof test>[1]>[0]["mount"],
  withShell = false,
) => {
  const workspace = (
    <InspectionExecutionWorkspace
      checklistItems={[
        ...inspection.items.map((item) => ({
          excludedFacilityTypeIds: [] as string[],
          excludedRoomTypeIds: [] as string[],
          facilityTypeId: null,
          id: item.itemId,
          name: item.name,
          roomTypeId: null,
          source: "HOTEL_COMMON" as const,
          targetType: "ROOM" as const,
        })),
        {
          excludedFacilityTypeIds: [],
          excludedRoomTypeIds: [],
          facilityTypeId,
          id: "96000000-0000-4000-8000-000000000004",
          name: "압력 계기 확인",
          roomTypeId: null,
          source: "TARGET_TYPE_ADDED" as const,
          targetType: "FACILITY" as const,
        },
      ]}
      facilities={[
        {
          id: facilityId,
          locationName: "지하 1층 기계실",
          name: "보일러 1호기",
          status: "ACTIVE",
          typeId: facilityTypeId,
          typeName: "보일러",
        },
      ]}
      hotelId={hotelId}
      initialInspections={[summary, secondSummary]}
      initialSelectedInspection={inspection}
      rooms={[
        {
          floorLabel: "7층",
          id: roomId,
          roomNumber: "703",
          roomTypeId,
          status: "ACTIVE",
        },
      ]}
    />
  );
  return mount(
    withShell ? (
      <AppShell
        currentPath={`/hotels/${hotelId}/inspections`}
        hotelName="위아히어 서울"
        navigation={[
          {
            href: `/hotels/${hotelId}/inspections`,
            icon: <span aria-hidden="true">✓</span>,
            label: "점검",
          },
          {
            href: `/hotels/${hotelId}/facilities`,
            icon: <span aria-hidden="true">F</span>,
            label: "시설물",
          },
        ]}
        userDisplayName="현장 담당자"
      >
        {workspace}
      </AppShell>
    ) : workspace,
  );
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("390px 시설물 수시점검을 v2 payload로 생성하고 canonical 재조회한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const facilityInspection = {
    ...inspection,
    id: "91000000-0000-4000-8000-000000000010",
    source: "MANUAL" as const,
    targets: [
      {
        id: "53000000-0000-4000-8000-000000000010",
        type: "FACILITY" as const,
        facilityId,
        facilityNameSnapshot: "보일러 1호기",
        facilityTypeNameSnapshot: "보일러",
        facilityLocationNameSnapshot: "지하 1층 기계실",
      },
    ],
    items: [
      {
        ...inspection.items[0]!,
        id: "95000000-0000-4000-8000-000000000010",
        executionTargetId: "53000000-0000-4000-8000-000000000010",
        targetType: "FACILITY" as const,
        itemId: "96000000-0000-4000-8000-000000000004",
        name: "압력 계기 확인",
        result: null,
      },
    ],
  };
  let posted: unknown;
  let idempotencyKey = "";
  await page.route("**/inspections/v2/manual", async (route) => {
    posted = route.request().postDataJSON();
    idempotencyKey = route.request().headers()["idempotency-key"] ?? "";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { inspection: facilityInspection },
        error: null,
      }),
    });
  });
  await page.route(`**/inspections/v2/${facilityInspection.id}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { inspection: facilityInspection },
        error: null,
      }),
    });
  });
  await page.route("**/inspections/v2?page=*&pageSize=100&status=PENDING_INPUT", async (route) => {
    const { items: _facilityItems, ...facilitySummary } = facilityInspection;
    void _facilityItems;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          inspections: [facilitySummary, summary],
          pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
        },
        error: null,
      }),
    });
  });
  const workspace = await mountWorkspace(mount, true);
  await expect(
    page.getByRole("navigation", { name: "모바일 호텔 운영 메뉴" }),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "수시점검 시작" }).click();
  await workspace.getByLabel("점검 대상 유형").selectOption("FACILITY");
  await workspace.locator("#manual-target").selectOption(facilityId);
  await workspace.getByText("압력 계기 확인", { exact: true }).click();
  await expect(workspace.getByLabel("점검 대상 유형")).toHaveCSS(
    "min-height",
    "44px",
  );
  await workspace.getByRole("button", { name: "점검 생성" }).click();
  await expect(workspace.getByRole("status")).toContainText(
    "수시점검 생성과 서버 재조회를 완료했습니다",
  );
  expect(idempotencyKey).toBeTruthy();
  expect(posted).toEqual({
    processDefinitionId: null,
    targets: [
      {
        type: "FACILITY",
        facilityId,
        selectedItemIds: ["96000000-0000-4000-8000-000000000004"],
      },
    ],
  });
  await expect(
    workspace.getByText(
      "보일러 1호기 · 보일러 · 지하 1층 기계실 · 수시",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect(
    (await new AxeBuilder({ page }).include("[data-inspection-execution-workspace]").analyze()).violations,
  ).toEqual([]);
});

test("PC 점검 수행 다중편집 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const uploadId = "98000000-0000-4000-8000-000000000001";
  const fileVersionId = "99000000-0000-4000-8000-000000000001";
  await page.route("**/files/upload-init", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        ok: true,
        data: {
          upload: { id: uploadId, status: "PENDING_UPLOAD" },
          uploadUrl: `/api/files/uploads/${uploadId}/body`,
          expiresInSeconds: 300,
          requiredHeaders: {
            "Content-Type": "image/png",
            "If-None-Match": "*",
          },
        },
        error: null,
      }),
    });
  });
  await page.route(`**/files/uploads/${uploadId}/body`, async (route) => {
    await route.fulfill({
      headers: { etag: '"0123456789abcdef0123456789abcdef"' },
      status: 204,
    });
  });
  await page.route(`**/files/uploads/${uploadId}/complete`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { upload: { id: uploadId, status: "QUARANTINED" } },
        error: null,
      }),
    });
  });
  await page.route(`**/files/uploads/${uploadId}?hotelId=*`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          upload: { id: uploadId, status: "READY_UNLINKED", fileVersionId },
        },
        error: null,
      }),
    });
  });
  const workspace = await mountWorkspace(mount);
  await page.evaluate(() => document.fonts.ready);
  await workspace.getByRole("button", { name: /출입문 잠금/ }).click();
  await workspace.getByRole("button", { name: "이상" }).click();
  await workspace.getByLabel("설명").fill("잠금장치가 끝까지 잠기지 않음");
  const droppedPhoto = await page.evaluateHandle(() => {
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQtA4HAAEcAKwm1M7RAAAAAElFTkSuQmCC",
      ),
      (character) => character.charCodeAt(0),
    );
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], "잠금장치.png", { type: "image/png" }),
    );
    return transfer;
  });
  await workspace
    .getByLabel("사진 끌어놓기 영역")
    .dispatchEvent("drop", { dataTransfer: droppedPhoto });
  await expect(workspace.getByText("검역 통과", { exact: true })).toBeVisible();
  await expect(workspace.getByLabel("심각도")).toHaveValue("CRITICAL");
  await expect(
    workspace.getByRole("button", { name: /변경사항 저장 \(1\)/ }),
  ).toHaveCSS("min-height", "44px");
  expect(
    (await new AxeBuilder({ page }).include("[data-inspection-execution-workspace]").analyze()).violations,
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
  await expect(
    workspace.getByRole("heading", { name: "출입문 잠금" }),
  ).toBeFocused();
  await workspace.getByRole("button", { name: "저장하고 다음" }).click();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toBe(bodies[0]);
  await workspace.getByLabel("설명").fill("잠금 손잡이 교체 필요");
  await workspace.getByRole("button", { name: "저장하고 다음" }).click();
  expect(keys).toHaveLength(3);
  expect(keys[2]).toBeTruthy();
  expect(keys[2]).not.toBe(keys[0]);
  expect(bodies[2]).not.toBe(bodies[0]);
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
  await page.route("**/inspections/v2/manual", async (route) => {
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
  await workspace.getByRole("button", { name: "수시점검 닫기" }).click();
  await workspace.getByRole("button", { name: "수시점검 시작" }).click();
  await expect(workspace.getByLabel("객실")).toHaveValue(roomId);
  await workspace.getByRole("button", { name: "점검 생성" }).click();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toBe(bodies[0]);
  await workspace.getByRole("checkbox", { name: "욕실 청결" }).uncheck();
  await workspace.getByRole("checkbox", { name: "출입문 잠금" }).check();
  await workspace.getByRole("button", { name: "점검 생성" }).click();
  expect(keys).toHaveLength(3);
  expect(keys[2]).toBeTruthy();
  expect(keys[2]).not.toBe(keys[0]);
  expect(bodies[2]).not.toBe(bodies[0]);
});

test("제출 후 stale 목록은 modal 오류와 동일 operation 재시도로 확인한다", async ({
  mount,
  page,
}) => {
  const readyInspection = {
    ...inspection,
    items: inspection.items.map((item, index) => ({
      ...item,
      result: {
        description: item.result?.description ?? null,
        fileVersionIds: item.result?.fileVersionIds ?? [],
        result: item.result?.result ?? ("NORMAL" as const),
        severity: item.result?.severity ?? null,
        version: item.result?.version ?? 1,
      },
      displayOrder: (index + 1) * 10,
    })),
  };
  const submittedInspection = {
    ...readyInspection,
    status: "IN_REVIEW" as const,
    version: 2,
    process: {
      ...readyInspection.process,
      currentStageKey: "REVIEW",
      currentStageName: "검토",
      state: "IN_REVIEW" as const,
      version: 2,
    },
  };
  const submitKeys: string[] = [];
  const submitBodies: string[] = [];
  const attemptPages: number[][] = [];
  let listAttempt = -1;
  await page.route("**/submit", async (route) => {
    submitKeys.push(route.request().headers()["idempotency-key"] ?? "");
    submitBodies.push(route.request().postData() ?? "");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { inspection: submittedInspection },
        error: null,
      }),
    });
  });
  await page.route(`**/inspections/v2/${inspection.id}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { inspection: submittedInspection },
        error: null,
      }),
    });
  });
  await page.route("**/inspections/v2?page=*&pageSize=100&status=PENDING_INPUT", async (route) => {
    const requestedPage = Number(new URL(route.request().url()).searchParams.get("page"));
    if (requestedPage === 1) {
      listAttempt += 1;
      attemptPages.push([]);
    }
    attemptPages[listAttempt]?.push(requestedPage);
    const drift = ["page", "pageSize", "total", "totalPages"][listAttempt];
    const pagination = {
      page: drift === "page" && requestedPage === 2 ? 3 : requestedPage,
      pageSize: drift === "pageSize" && requestedPage === 2 ? 99 : 100,
      total: drift === "total" && requestedPage === 2 ? 200 : 201,
      totalPages: drift === "totalPages" && requestedPage === 2 ? 2 : 3,
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          inspections: listAttempt === 4 && requestedPage === 3 ? [secondSummary] : [],
          pagination,
        },
        error: null,
      }),
    });
  });
  const workspace = await mount(
    <InspectionExecutionWorkspace
      checklistItems={readyInspection.items.map((item) => ({
        excludedFacilityTypeIds: [],
        excludedRoomTypeIds: [],
        facilityTypeId: null,
        id: item.itemId,
        name: item.name,
        roomTypeId: null,
        source: "HOTEL_COMMON" as const,
        targetType: "ROOM" as const,
      }))}
      facilities={[]}
      hotelId={hotelId}
      initialInspections={[summary]}
      initialSelectedInspection={readyInspection}
      rooms={[]}
    />,
  );
  await workspace.getByRole("button", { name: "점검 제출" }).click();
  await expect(page.getByText("점검을 제출할까요?")).toBeVisible();
  const submitAlert = page.getByRole("alert");
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "제출 확정" }).click();
    await expect(submitAlert).toContainText("목록 페이지가 조회 중 변경되어");
    await expect(submitAlert).toBeFocused();
    expect(attemptPages.at(-1)).toEqual([1, 2]);
  }
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "제출 확정" }).click();
  await expect(
    workspace.getByRole("button", { name: "검토 중 · 수정 불가" }),
  ).toBeDisabled();
  await expect(workspace.getByRole("status")).toContainText("점검을 제출했습니다");
  expect(attemptPages.at(-1)).toEqual([1, 2, 3]);
  expect(submitKeys).toHaveLength(5);
  expect(submitKeys[0]).toBeTruthy();
  expect(new Set(submitKeys)).toEqual(new Set([submitKeys[0]]));
  expect(new Set(submitBodies)).toEqual(new Set([submitBodies[0]]));
});

test("응답유실 뒤 다른 점검의 동일 제출 body는 새 operation key를 사용한다", async ({
  mount,
  page,
}) => {
  const readyA = {
    ...inspection,
    items: inspection.items.map((item) => ({
      ...item,
      result: {
        description: null,
        fileVersionIds: [],
        result: "NORMAL" as const,
        severity: null,
        version: 1,
      },
    })),
  };
  const readyB = {
    ...readyA,
    id: secondSummary.id,
    businessDate: secondSummary.businessDate,
    process: secondSummary.process,
    targets: secondSummary.targets,
    items: readyA.items.map((item, index) => ({
      ...item,
      id: `95000000-0000-4000-8000-00000000001${index}`,
      executionTargetId: secondSummary.targets[0]!.id,
    })),
  };
  const submittedB = {
    ...readyB,
    status: "IN_REVIEW" as const,
    version: 2,
    process: {
      ...readyB.process,
      currentStageKey: "REVIEW",
      currentStageName: "검토",
      state: "IN_REVIEW" as const,
      version: 2,
    },
  };
  const keys: string[] = [];
  const bodies: string[] = [];
  const paths: string[] = [];
  await page.route("**/submit", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    bodies.push(route.request().postData() ?? "");
    paths.push(new URL(route.request().url()).pathname);
    if (paths.length === 1) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { inspection: submittedB }, error: null }),
    });
  });
  await page.route(`**/inspections/v2/${secondSummary.id}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { inspection: paths.length < 2 ? readyB : submittedB },
        error: null,
      }),
    });
  });
  await page.route("**/inspections/v2?page=*&pageSize=100&status=PENDING_INPUT", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { inspections: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 } },
        error: null,
      }),
    });
  });
  const workspace = await mount(
    <InspectionExecutionWorkspace
      checklistItems={[]}
      facilities={[]}
      hotelId={hotelId}
      initialInspections={[summary, secondSummary]}
      initialSelectedInspection={readyA}
      rooms={[]}
    />,
  );
  await workspace.getByRole("button", { name: "점검 제출" }).click();
  await page.getByRole("button", { name: "제출 확정" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await page.getByRole("button", { name: "취소" }).click();
  const secondInspectionButton = workspace.getByRole("button", { name: /704/ });
  await secondInspectionButton.click();
  await expect(secondInspectionButton).toHaveAttribute("aria-current", "true");
  await workspace.getByRole("button", { name: "점검 제출" }).click();
  await page.getByRole("button", { name: "제출 확정" }).click();
  await expect(workspace.getByRole("status")).toContainText("점검을 제출했습니다");
  expect(paths).toHaveLength(2);
  expect(paths[0]).not.toBe(paths[1]);
  expect(bodies[0]).toBe(bodies[1]);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBeTruthy();
  expect(keys[0]).not.toBe(keys[1]);
});

test("모바일 이상 결과에 촬영과 사진첩 진입을 분리한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const workspace = await mountWorkspace(mount);
  await workspace.getByRole("button", { name: "이상" }).click();
  await expect(workspace.getByText("사진 촬영", { exact: true })).toBeVisible();
  await expect(
    workspace.getByText("사진첩에서 선택", { exact: true }),
  ).toBeVisible();
  await expect(workspace.getByLabel("사진 끌어놓기 영역")).toBeVisible();
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
    (await new AxeBuilder({ page }).include("[data-inspection-execution-workspace]").analyze()).violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot("inspection-execution-mobile.png", {
    fullPage: true,
  });
});
