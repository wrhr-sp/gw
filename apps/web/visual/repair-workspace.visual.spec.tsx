import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { RepairWorkspaceStory } from "../playwright/stories/repair-workspace.story";

const hotelId = "50000000-0000-4000-8000-000000000001";
const repairId = "a1000000-0000-4000-8000-000000000001";
const visitId = "b1000000-0000-4000-8000-000000000001";

test("PC 보수 업무 화면은 axe 위반과 가로 넘침 없이 주요 action을 제공한다", async ({ mount, page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<RepairWorkspaceStory />);
  await expect(component.getByRole("heading", { name: "하자·보수" })).toBeVisible();
  await expect(component.getByText("703호").first()).toBeVisible();
  await expect(component.getByRole("region", { name: "보수 상세" }).getByRole("button", { name: "등록" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("[data-repair-workspace]").analyze()).violations).toEqual([]);
});

for (const [operation, kind] of [
  ["create", "missing"],
  ["create", "extra"],
  ["update", "missing"],
  ["update", "extra"],
] as const) {
test(`${operation} malformed ${kind}-field 2xx는 성공·dialog close·refresh로 처리하지 않는다`, async ({ mount, page }) => {
  let followUpGetCount = 0;
  await page.route("**/api/hotels/**", async (route) => {
    if (route.request().method() === "GET") {
      followUpGetCount += 1;
      await route.abort();
      return;
    }
    const malformed = kind === "missing"
      ? { id: visitId, version: 1 }
      : { calendarProjectionStatus: "NOT_CONNECTED", endsAt: "2026-08-10T02:00:00.000Z", fileVersionIds: [], id: visitId, performer: { contactName: null, contactPhone: "010-0000-0000", contractorName: "승인된 보수업체", type: "EXTERNAL" }, repairCaseId: "a1000000-0000-4000-8000-000000000001", result: null, startsAt: "2026-08-10T01:00:00.000Z", status: "SCHEDULED", title: "배관 점검", unavailableReason: null, unexpected: true, version: 1 };
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({ ok: true, data: { visit: malformed }, error: null }),
    });
  });
  const component = await mount(<RepairWorkspaceStory withVisit={operation === "update"} />);
  if (operation === "create") await component.getByRole("region", { name: "보수 상세" }).getByRole("button", { name: "등록" }).click();
  else await component.getByRole("button", { name: "수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: operation === "create" ? "방문일정 등록" : "방문일정 수정" });
  await dialog.getByLabel("일정 제목").fill("배관 점검 보존");
  if (operation === "create") {
    await dialog.getByLabel("시작일시").fill("2026-08-10T10:00");
    await dialog.getByLabel("종료일시").fill("2026-08-10T11:00");
    await dialog.getByLabel("외부업체").check();
    await dialog.getByLabel("업체명").fill("승인된 보수업체");
    await dialog.getByLabel("연락처").fill("010-0000-0000");
  } else await dialog.getByLabel("수정 사유").fill("현장 일정 조정");
  await dialog.getByRole("button", { name: "방문일정 저장" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("방문일정 응답을 안전하게 확인하지 못했습니다.");
  await expect(dialog.getByLabel("일정 제목")).toHaveValue("배관 점검 보존");
  await expect(page.getByText(operation === "create" ? "방문일정을 등록했습니다." : "방문일정을 수정했습니다.")).toHaveCount(0);
  expect(followUpGetCount).toBe(0);
});
}

for (const command of ["cancel", "restore", "visitComplete", "submitReview", "approve", "reject", "repairComplete"] as const) {
  test(`${command} malformed 2xx는 성공·refresh·입력 초기화로 처리하지 않는다`, async ({ mount, page }) => {
    let followUpGetCount = 0;
    await page.route("**/api/hotels/**", async (route) => {
      if (route.request().method() === "GET") {
        followUpGetCount += 1;
        await route.fulfill({ body: JSON.stringify({ ok: false }), contentType: "application/json", status: 500 });
        return;
      }
      const visitCommand = command === "cancel" || command === "restore" || command === "visitComplete";
      const malformed = visitCommand ? { visit: { id: visitId } } : { repair: { id: "a1000000-0000-4000-8000-000000000001" } };
      await route.fulfill({ body: JSON.stringify({ ok: true, data: malformed, error: null }), contentType: "application/json", status: 200 });
    });
    const processState = command === "approve" || command === "reject" ? "IN_REVIEW" : command === "repairComplete" ? "COMPLETED" : "PENDING_INPUT";
    const hasVisit = command === "cancel" || command === "restore" || command === "visitComplete";
    const component = await mount(<RepairWorkspaceStory processState={processState} visitStatus={command === "restore" ? "CANCELLED" : "SCHEDULED"} withVisit={hasVisit} />);
    const label = { approve: "승인", cancel: "취소", reject: "반려", repairComplete: "보수 최종완료", restore: "복원", submitReview: "검토 요청", visitComplete: "방문완료" }[command];
    await component.getByRole("button", { exact: true, name: label }).click();
    if (command === "visitComplete") {
      const dialog = page.getByRole("dialog", { name: "방문완료 기록" });
      await dialog.getByLabel("작업 결과").fill("배관 보수 완료");
      await dialog.getByLabel("완료사진 미첨부 사유").fill("현장 장비 점검 중");
      await dialog.getByRole("button", { name: "방문완료 저장" }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("작업 결과")).toHaveValue("배관 보수 완료");
    }
    await expect(page.getByText("업무 상태 응답을 안전하게 확인하지 못했습니다.")).toBeVisible();
    await expect(page.getByText("서버에 변경사항을 저장했습니다.")).toHaveCount(0);
    expect(followUpGetCount).toBe(0);
  });
}

for (const command of ["cancel", "submitReview"] as const) {
  test(`${command} non-2xx는 성공·refresh로 처리하지 않는다`, async ({ mount, page }) => {
    let followUpGetCount = 0;
    await page.route("**/api/hotels/**", async (route) => {
      if (route.request().method() === "GET") followUpGetCount += 1;
      await route.fulfill({ body: JSON.stringify({ ok: false, data: null, error: { code: "INTERNAL_ERROR", message: "안전 실패" } }), contentType: "application/json", status: 500 });
    });
    const component = await mount(<RepairWorkspaceStory withVisit={command === "cancel"} />);
    await component.getByRole("button", { exact: true, name: command === "cancel" ? "취소" : "검토 요청" }).click();
    await expect(page.getByText("요청을 처리하지 못했습니다.")).toBeVisible();
    await expect(page.getByText("서버에 변경사항을 저장했습니다.")).toHaveCount(0);
    expect(followUpGetCount).toBe(0);
  });
}

test("방문완료 성공으로 trigger가 제거되면 보수 상세 heading으로 focus를 복구한다", async ({ mount, page }) => {
  const completedVisit = { calendarProjectionStatus: "NOT_CONNECTED", endsAt: "2026-08-10T02:00:00.000Z", fileVersionIds: [], id: visitId, performer: { contactName: null, contactPhone: "010-0000-0000", contractorName: "승인된 보수업체", type: "EXTERNAL" }, repairCaseId: repairId, result: "누수 배관 교체 완료", startsAt: "2026-08-10T01:00:00.000Z", status: "COMPLETED", title: "기존 배관 점검", unavailableReason: "작업구역 촬영 제한", version: 2 };
  const completedRepair = { calendarProjectionStatus: "NOT_CONNECTED", createdAt: "2026-08-06T12:00:00.000Z", followUpCount: 0, hotelId, id: repairId, predecessor: null, priority: { color: "RED", id: "a3000000-0000-4000-8000-000000000001", name: "긴급", sortOrder: 1, version: 1 }, process: { currentStageName: null, executionId: "a5000000-0000-4000-8000-000000000001", state: "PENDING_INPUT", version: 1 }, source: { description: "욕실 누수", fileVersionIds: [], type: "DIRECT", unavailableReason: "촬영 장비 고장" }, status: "OPEN", target: { facilityTypeName: null, id: "52000000-0000-4000-8000-000000000001", locationName: null, name: "703호", type: "ROOM" }, updatedAt: "2026-08-06T12:00:00.000Z", version: 1, visits: [completedVisit] };
  await page.route(`**/api/hotels/${hotelId}/repair-visits/${visitId}/complete`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { data: { visit: completedVisit }, error: null, ok: true }, status: 200 });
  });
  await page.route(`**/api/hotels/${hotelId}/repairs/${repairId}`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { data: { repair: completedRepair }, error: null, ok: true }, status: 200 });
  });
  const component = await mount(<RepairWorkspaceStory withVisit />);
  await component.getByRole("button", { name: "방문완료" }).click();
  const dialog = page.getByRole("dialog", { name: "방문완료 기록" });
  await dialog.getByLabel("작업 결과").fill("누수 배관 교체 완료");
  await dialog.getByLabel("완료사진 미첨부 사유").fill("작업구역 촬영 제한");
  await dialog.getByRole("button", { name: "방문완료 저장" }).click();
  await expect(dialog).toBeHidden();
  await expect(component.getByRole("button", { name: "방문완료" })).toHaveCount(0);
  await expect(component.getByRole("heading", { name: "703호" })).toBeFocused();
});

test("방문완료 dialog를 닫고 다른 방문을 열면 이전 입력을 재사용하지 않는다", async ({ mount, page }) => {
  const component = await mount(<RepairWorkspaceStory withSecondVisit withVisit />);
  const visits = component.locator("article");
  await visits.nth(0).getByRole("button", { name: "방문완료" }).click();
  const dialog = page.getByRole("dialog", { name: "방문완료 기록" });
  await dialog.getByLabel("작업 결과").fill("첫 방문 작업 결과");
  await dialog.getByLabel("완료사진 미첨부 사유").fill("첫 방문 장비 점검 중");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await visits.nth(1).getByRole("button", { name: "방문완료" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("작업 결과")).toHaveValue("");
  await expect(dialog.getByLabel("완료사진 미첨부 사유")).toHaveValue("");
});

test("390px 모바일에서 보수 등록 dialog는 keyboard·label·focus 복원을 지킨다", async ({ mount, page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<RepairWorkspaceStory />);
  const trigger = component.getByRole("button", { name: "보수 등록" }).first();
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "보수 등록" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("보수 대상")).toBeVisible();
  await expect(dialog.getByLabel("우선순위")).toBeVisible();
  await expect(dialog.getByLabel("하자 내용")).toBeVisible();
  await expect(dialog.getByLabel("사진 미첨부 사유")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("[role=dialog]").analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});