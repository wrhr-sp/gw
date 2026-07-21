import { expect, test } from "@playwright/experimental-ct-react";
import AxeBuilder from "@axe-core/playwright";
import { AccountCreateStory, AccountDetailStory } from "../playwright/stories/account-administration.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("PC 사용자 생성 기준 화면", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const view = await mount(<AccountCreateStory />);
  await page.evaluate(() => document.fonts.ready);
  await expect(view.getByRole("heading", { name: "사용자 생성", level: 1 })).toBeVisible();
  await expect(view.getByRole("button", { name: "사용자 생성" })).toHaveCSS("min-height", "44px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("account-create-desktop.png", { fullPage: true });
});

test("PC 하우스키핑 복수 호텔 선택", async ({ mount, page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const view = await mount(<AccountCreateStory />);
  await view.getByLabel("사용자유형").selectOption("HOUSEKEEPING");
  const gangnam = view.getByLabel("위아히어 강남호텔");
  const busan = view.getByLabel("위아히어 부산호텔");
  await gangnam.check();
  await busan.check();
  await expect(gangnam).toBeChecked();
  await expect(busan).toBeChecked();
  await expect(view.getByLabel("호텔", { exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("account-create-housekeeping-desktop.png", { fullPage: true });
});

test("하우스키핑 생성 POST는 두 호텔 배열만 전송", async ({ mount, page }) => {
  const accountId = "21000000-0000-4000-8000-000000000099";
  const accountResponse = {
    ok: true,
    data: { account: {
      id: accountId,
      displayName: "김하우스",
      loginName: "housekeeper-99",
      email: "housekeeper-99@example.invalid",
      userType: "HOUSEKEEPING",
      status: "PENDING_SETUP",
      hotelId: null,
      hotels: [
        { id: "50000000-0000-4000-8000-000000000001", name: "위아히어 강남호텔", code: "GANGNAM-01" },
        { id: "50000000-0000-4000-8000-000000000002", name: "위아히어 부산호텔", code: "BUSAN-01" },
      ],
      version: 1,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    } },
    error: null,
  };
  let posted: Record<string, unknown> | null = null;
  await page.route(`**/api/admin/users/${accountId}`, async (route) => route.fulfill({ json: accountResponse }));
  await page.route("**/api/admin/users", async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: accountResponse, status: 201 });
  });
  const view = await mount(<AccountCreateStory />);
  await view.getByLabel("표시이름").fill("김하우스");
  await view.getByLabel("로그인 아이디").fill("housekeeper-99");
  await view.getByLabel("이메일").fill("housekeeper-99@example.invalid");
  await view.getByLabel("사용자유형").selectOption("HOUSEKEEPING");
  await view.getByLabel("위아히어 강남호텔").check();
  await view.getByLabel("위아히어 부산호텔").check();
  await view.getByLabel("배정 시작일").fill("2026-07-19");
  await view.getByLabel("임시 비밀번호").fill("Strong-Preview-123!");
  await view.getByLabel("생성 사유").fill("복수 호텔 배정 검증");
  await view.getByRole("button", { name: "사용자 생성" }).click();
  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({
    userType: "HOUSEKEEPING",
    hotelIds: [
      "50000000-0000-4000-8000-000000000001",
      "50000000-0000-4000-8000-000000000002",
    ],
  });
  expect(posted).not.toHaveProperty("hotelId");
  await expect(view.getByTestId("router-push-path")).toHaveText(`/admin/users/${accountId}`);
});

test("생성 POST와 GET 재조회 material 필드가 다르면 상세 이동을 차단", async ({ mount, page }) => {
  const accountId = "21000000-0000-4000-8000-000000000099";
  const createdAccount = {
    id: accountId,
    displayName: "김하우스",
    loginName: "housekeeper-99",
    email: "housekeeper-99@example.invalid",
    userType: "HOUSEKEEPING",
    status: "PENDING_SETUP",
    hotelId: null,
    hotels: [
      { id: "50000000-0000-4000-8000-000000000001", name: "위아히어 강남호텔", code: "GANGNAM-01" },
      { id: "50000000-0000-4000-8000-000000000002", name: "위아히어 부산호텔", code: "BUSAN-01" },
    ],
    version: 1,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
  let readBackCount = 0;
  await page.route("**/api/admin/users", async (route) => route.fulfill({
    json: { ok: true, data: { account: createdAccount }, error: null },
    status: 201,
  }));
  await page.route(`**/api/admin/users/${accountId}`, async (route) => {
    readBackCount += 1;
    await route.fulfill({ json: {
      ok: true,
      data: { account: {
        ...createdAccount,
        id: "21000000-0000-4000-8000-000000000098",
        displayName: "다른 사용자",
        loginName: "different-user",
        email: "different@example.invalid",
        userType: "INTERNAL_STAFF",
        status: "ACTIVE",
        hotelId: "50000000-0000-4000-8000-000000000003",
        hotels: [],
        version: 2,
      } },
      error: null,
    } });
  });
  const view = await mount(<AccountCreateStory />);
  await view.getByLabel("표시이름").fill("김하우스");
  await view.getByLabel("로그인 아이디").fill("housekeeper-99");
  await view.getByLabel("이메일").fill("housekeeper-99@example.invalid");
  await view.getByLabel("사용자유형").selectOption("HOUSEKEEPING");
  await view.getByLabel("위아히어 강남호텔").check();
  await view.getByLabel("위아히어 부산호텔").check();
  await view.getByLabel("배정 시작일").fill("2026-07-19");
  await view.getByLabel("임시 비밀번호").fill("Strong-Preview-123!");
  await view.getByLabel("생성 사유").fill("재조회 불일치 검증");
  await view.getByRole("button", { name: "사용자 생성" }).click();
  await expect.poll(() => readBackCount).toBe(1);
  await expect(view.getByRole("alert")).toContainText("재조회 결과가 일치하지 않습니다.");
  await expect(view.getByTestId("router-push-path")).toHaveText("");
  await expect(view.getByRole("heading", { name: "사용자 생성", level: 1 })).toBeVisible();
});

test("모바일 하우스키핑 복수 호텔 선택", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const view = await mount(<AccountCreateStory />);
  await view.getByLabel("사용자유형").selectOption("HOUSEKEEPING");
  for (const name of ["위아히어 강남호텔", "위아히어 부산호텔"]) {
    const checkbox = view.getByLabel(name);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    const label = checkbox.locator("xpath=ancestor::label");
    expect((await label.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const submit = view.getByRole("button", { name: "사용자 생성" });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const submitBox = await submit.boundingBox();
  const bottomNavigationBox = await page.getByRole("navigation", { name: "모바일 호텔 운영 메뉴" }).boundingBox();
  expect((submitBox?.y ?? 0) + (submitBox?.height ?? 0)).toBeLessThanOrEqual(bottomNavigationBox?.y ?? 0);
  await expect(page).toHaveScreenshot("account-create-housekeeping-mobile.png", { fullPage: true });
  await expect(page).toHaveScreenshot("account-create-housekeeping-mobile-viewport.png");
});

test("모바일 사용자 생성과 작성내용 폐기 확인", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const view = await mount(<AccountCreateStory />);
  await view.getByLabel("표시이름").fill("김하우스");
  await view.getByRole("button", { name: "취소" }).click();
  const cancelDialog = view.getByRole("alertdialog", { name: "작성 중인 내용을 폐기하시겠습니까?" });
  const continueWriting = view.getByRole("button", { name: "계속 작성" });
  await expect(cancelDialog).toBeVisible();
  await expect(continueWriting).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(cancelDialog).not.toBeVisible();
  await expect(view.getByRole("button", { name: "취소" })).toBeFocused();
  await expect(view.getByLabel("표시이름")).toHaveValue("김하우스");
  await view.getByRole("button", { name: "취소" }).click();
  const skipLinkBox = await page.getByText("본문 바로가기").boundingBox();
  expect((skipLinkBox?.y ?? 0) + (skipLinkBox?.height ?? 0)).toBeLessThanOrEqual(0);
  await expect(continueWriting).toHaveCSS("min-height", "44px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("account-create-mobile.png", { fullPage: true });
  await expect(page).toHaveScreenshot("account-create-dialog-mobile-viewport.png");
});

test("모바일 사용자 상세 호텔 라벨과 중지 확인", async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const view = await mount(<AccountDetailStory />);
  await expect(view.getByText("위아히어 강남호텔 (GANGNAM-01)")).toBeVisible();
  await expect(view.getByText("위아히어 부산호텔 (BUSAN-01)")).toBeVisible();
  await expect(view.getByText("50000000-0000-4000-8000-000000000001")).toHaveCount(0);
  await view.getByLabel("중지 사유").fill("퇴사 처리");
  const suspend = view.getByRole("button", { name: "계정 중지" });
  await expect(suspend).toHaveCSS("min-height", "44px");
  await suspend.click();
  const suspendDialog = view.getByRole("alertdialog", { name: "이 계정을 중지하시겠습니까?" });
  await expect(suspendDialog).toBeVisible();
  await expect(view.getByRole("button", { name: "취소" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(suspendDialog).not.toBeVisible();
  await expect(suspend).toBeFocused();
  await suspend.click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot("account-detail-mobile.png", { fullPage: true });
  await expect(page).toHaveScreenshot("account-detail-dialog-mobile-viewport.png");
});
