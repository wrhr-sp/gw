import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import { knowledgeEntryResponseSchema } from "@werehere/contracts";
import React from "react";
import { HotelShellKnowledgeStory } from "../playwright/stories/hotel-shell-knowledge.story";
import { knowledgeStoryEntry } from "../playwright/stories/knowledge-workspace.fixture";
import { KnowledgeWorkspaceStory } from "../playwright/stories/knowledge-workspace.story";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});


test("PC 지식뱅크는 목록·안전순서·private 첨부와 접근성을 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  const component = await mount(<KnowledgeWorkspaceStory />);
  await expect(
    component.getByRole("heading", { name: "운영 지식뱅크", exact: true }),
  ).toBeVisible();
  await expect(component.getByText("먼저 확인할 사항")).toBeVisible();
  await expect(component.getByText("하지 말아야 할 대응")).toBeVisible();
  await expect(
    component.getByRole("heading", { name: "private 현장 사진 1개" }),
  ).toBeVisible();
  await expect(component.getByRole("link", { name: /필터 상태.png/u })).toHaveAttribute(
    "href",
    /\/api\/knowledge\/.+\/files\/.+\/view$/u,
  );
  const listBox = await component.getByRole("complementary").boundingBox();
  const detailBox = await component.getByRole("article").boundingBox();
  expect(listBox && detailBox && listBox.x < detailBox.x).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-knowledge-workspace]")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("390px 지식뱅크는 단일열 행동과 키보드 접근성을 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<KnowledgeWorkspaceStory />);
  const listBox = await component.getByRole("complementary").boundingBox();
  const detailBox = await component.getByRole("article").boundingBox();
  expect(listBox && detailBox && listBox.y < detailBox.y).toBe(true);
  const upload = component.getByRole("button", { name: "사진 업로드·검역" });
  await upload.scrollIntoViewIfNeeded();
  const uploadBox = await upload.boundingBox();
  expect(uploadBox?.height).toBeGreaterThanOrEqual(44);
  await component.getByLabel("현장 사진 선택").focus();
  await expect(component.getByLabel("현장 사진 선택")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-knowledge-workspace]")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("고위험 지식 작성은 server-approved 지정 검토자를 요구한다", async ({
  mount,
  page,
}) => {
  const candidateId = "99999999-9999-4999-8999-999999999999";
  await page.route("**/api/knowledge/reviewer-candidates?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          candidates: [{ displayName: "안전 지정 검토자", userId: candidateId }],
        },
        error: null,
        ok: true,
      },
    }),
  );
  const component = await mount(<KnowledgeWorkspaceStory />);
  await component.getByRole("button", { name: "지식 작성" }).click();
  await page.locator('select[name="riskClassification"]').selectOption("SAFETY");
  await expect(
    page.locator('select[name="designatedReviewerUserId"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "안전 지정 검토자" }),
  ).toHaveAttribute("value", candidateId);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[role=dialog]")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("private 첨부는 검역 완료 후에만 versioned 지식에 연결된다", async ({ mount, page }) => {
  const uploadId = "99999999-9999-4999-8999-999999999999";
  const fileVersionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const calls: string[] = [];
  const linkedResponse = knowledgeEntryResponseSchema.parse({
    data: { entry: {
      ...knowledgeStoryEntry,
      attachments: [...knowledgeStoryEntry.attachments, {
        displayName: "검역완료.png",
        fileVersionId,
        mimeType: "image/png",
        sizeBytes: 4,
        viewHref: `/api/knowledge/${knowledgeStoryEntry.id}/files/${fileVersionId}/view`,
      }],
      version: knowledgeStoryEntry.version + 1,
    } },
    error: null,
    ok: true,
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push(`${request.method()} ${path}`);
    if (path.endsWith("/upload-init")) {
      await route.fulfill({ contentType: "application/json", json: {
        data: {
          expiresInSeconds: 300,
          requiredHeaders: { "Content-Type": "image/png", "If-None-Match": "*" },
          upload: { id: uploadId, status: "PENDING_UPLOAD" },
          uploadUrl: `/api/files/uploads/${uploadId}/body`,
        }, error: null, ok: true,
      } });
      return;
    }
    if (path.endsWith("/body")) {
      await route.fulfill({ body: "", headers: { ETag: '"0123456789abcdef0123456789abcdef"' }, status: 201 });
      return;
    }
    if (path.endsWith("/complete")) {
      await route.fulfill({ contentType: "application/json", json: {
        data: { upload: { id: uploadId, status: "QUARANTINED" } }, error: null, ok: true,
      } });
      return;
    }
    if (path.endsWith(`/uploads/${uploadId}/status`)) {
      await route.fulfill({ contentType: "application/json", json: {
        data: { upload: { fileVersionId, id: uploadId, status: "READY_UNLINKED" } },
        error: null, ok: true,
      } });
      return;
    }
    if (path.endsWith("/attachments") && request.method() === "PUT") {
      await route.fulfill({ contentType: "application/json", json: linkedResponse });
      return;
    }
    await route.abort();
  });
  const component = await mount(<KnowledgeWorkspaceStory />);
  await component.getByLabel("현장 사진 선택").setInputFiles({
    buffer: Buffer.from([137, 80, 78, 71]), mimeType: "image/png", name: "검역완료.png",
  });
  await component.getByRole("button", { name: "사진 업로드·검역" }).click();
  await expect(
    component.getByText(
      "private 첨부 연결은 완료됐습니다. 최신 목록은 다음 조회에서 다시 확인해 주세요.",
    ),
  ).toBeVisible();
  await expect(component.getByRole("link", { name: /검역완료.png/u })).toHaveAttribute(
    "href", `/api/knowledge/${knowledgeStoryEntry.id}/files/${fileVersionId}/view`,
  );
  expect(calls.slice(0, 5)).toEqual([
    `POST /api/knowledge/${knowledgeStoryEntry.id}/files/upload-init`,
    `PUT /api/files/uploads/${uploadId}/body`,
    `POST /api/files/uploads/${uploadId}/complete`,
    `GET /api/knowledge/${knowledgeStoryEntry.id}/files/uploads/${uploadId}/status`,
    `PUT /api/knowledge/${knowledgeStoryEntry.id}/attachments`,
  ]);
  expect(calls[5]).toBe("GET /api/knowledge");
  expect(await component.locator('a[href^="http"]').count()).toBe(0);
});

test("private 첨부 응답 유실 재시도는 logical idempotency identity를 보존한다", async ({
  mount,
  page,
}) => {
  const uploadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const fileVersionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const initKeys: string[] = [];
  const completeKeys: string[] = [];
  const linkBodies: string[] = [];
  const linkKeys: string[] = [];
  let initAttempts = 0;
  let completeAttempts = 0;
  let linkAttempts = 0;
  let bodyPuts = 0;
  const linkedResponse = knowledgeEntryResponseSchema.parse({
    data: {
      entry: {
        ...knowledgeStoryEntry,
        attachments: [
          ...knowledgeStoryEntry.attachments,
          {
            displayName: "응답유실.png",
            fileVersionId,
            mimeType: "image/png",
            sizeBytes: 4,
            viewHref: `/api/knowledge/${knowledgeStoryEntry.id}/files/${fileVersionId}/view`,
          },
        ],
        version: knowledgeStoryEntry.version + 1,
      },
    },
    error: null,
    ok: true,
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/upload-init")) {
      initKeys.push((await request.headerValue("idempotency-key")) ?? "");
      initAttempts += 1;
      if (initAttempts === 1) {
        await route.abort("connectionfailed");
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            expiresInSeconds: 300,
            requiredHeaders: {
              "Content-Type": "image/png",
              "If-None-Match": "*",
            },
            upload: { id: uploadId, status: "PENDING_UPLOAD" },
            uploadUrl: `/api/files/uploads/${uploadId}/body`,
          },
          error: null,
          ok: true,
        },
      });
      return;
    }
    if (path.endsWith("/body")) {
      bodyPuts += 1;
      await route.fulfill({
        body: "",
        headers: { ETag: '"0123456789abcdef0123456789abcdef"' },
        status: 201,
      });
      return;
    }
    if (path.endsWith("/complete")) {
      completeKeys.push((await request.headerValue("idempotency-key")) ?? "");
      completeAttempts += 1;
      if (completeAttempts === 1) {
        await route.abort("connectionfailed");
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: { upload: { id: uploadId, status: "QUARANTINED" } },
          error: null,
          ok: true,
        },
      });
      return;
    }
    if (path.endsWith(`/uploads/${uploadId}/status`)) {
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            upload: { fileVersionId, id: uploadId, status: "READY_UNLINKED" },
          },
          error: null,
          ok: true,
        },
      });
      return;
    }
    if (path.endsWith("/attachments") && request.method() === "PUT") {
      linkKeys.push((await request.headerValue("idempotency-key")) ?? "");
      linkBodies.push(request.postData() ?? "");
      linkAttempts += 1;
      if (linkAttempts === 1) {
        await route.fulfill({ status: 503 });
        return;
      }
      await route.fulfill({ contentType: "application/json", json: linkedResponse });
      return;
    }
    await route.abort();
  });
  const component = await mount(<KnowledgeWorkspaceStory />);
  const upload = component.getByRole("button", { name: "사진 업로드·검역" });
  await component.getByLabel("현장 사진 선택").setInputFiles({
    buffer: Buffer.from([137, 80, 78, 71]),
    mimeType: "image/png",
    name: "응답유실.png",
  });
  await upload.click();
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(component.getByRole("link", { name: /응답유실.png/u })).toBeVisible();
  expect(initKeys).toHaveLength(2);
  expect(initKeys[0]).toBeTruthy();
  expect(new Set(initKeys).size).toBe(1);
  expect(completeKeys).toHaveLength(3);
  expect(completeKeys[0]).toBeTruthy();
  expect(new Set(completeKeys).size).toBe(1);
  expect(linkKeys).toHaveLength(2);
  expect(linkKeys[0]).toBeTruthy();
  expect(new Set(linkKeys).size).toBe(1);
  expect(new Set(linkBodies).size).toBe(1);
  expect(bodyPuts).toBe(1);
});

for (const [canRead, expectedCount] of [[true, 1], [false, 0]] as const) {
  test(`HotelShell 지식 메뉴는 canRead=${String(canRead)}와 일치한다`, async ({
    mount,
    page,
  }) => {
    await page.route("**/api/knowledge/capabilities", (route) =>
      route.fulfill({ contentType: "application/json", json: {
        data: {
          canArchive: false,
          canCreate: false,
          canPublish: false,
          canRead,
          canReview: false,
          company: {
            canArchive: false,
            canCreate: false,
            canHighRiskPublish: false,
            canPublish: false,
            canRead,
            canReview: false,
          },
          hotels: [],
        },
        error: null,
        ok: true,
      } }),
    );
    const capabilityRequest = page.waitForRequest("**/api/knowledge/capabilities");
    const shell = await mount(<HotelShellKnowledgeStory />);
    await capabilityRequest;
    await expect(shell.getByRole("link", { name: "운영 지식" })).toHaveCount(
      expectedCount,
    );
  });
}
