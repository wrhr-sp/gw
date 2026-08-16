import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { InquiryWorkspaceStory } from "../playwright/stories/inquiry-workspace.story";

test("PC 소유주 문의는 대화·private 첨부 action과 접근성을 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<InquiryWorkspaceStory />);
  await expect(
    component.getByRole("heading", { name: "호텔 소유주 문의" }),
  ).toBeVisible();
  await expect(
    component.getByRole("navigation", { name: "문의 목록" }),
  ).toBeVisible();
  await expect(
    component.getByRole("list", { name: "문의 대화" }),
  ).toBeVisible();
  const attachment = component.getByRole("link", { name: "7월-정산근거.png" });
  await expect(attachment).toBeVisible();
  expect((await attachment.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-inquiry-workspace]")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("390px 소유주 문의 등록은 현장 행동 카드·label·44px target을 지킨다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<InquiryWorkspaceStory />);
  const create = component.getByRole("button", { name: "새 문의" });
  await expect(create).toHaveAttribute("aria-expanded", "false");
  expect((await create.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await create.click();
  await expect(create).toHaveAttribute("aria-expanded", "true");
  await expect(component.locator("#owner-inquiry-create-form")).toBeVisible();
  await expect(component.getByLabel("문의유형")).toBeVisible();
  await expect(component.getByLabel("제목")).toBeVisible();
  await expect(component.getByLabel("문의내용")).toBeVisible();
  await expect(
    component.getByRole("button", { name: "문의 접수" }),
  ).toBeVisible();
  const submit = component.getByRole("button", { name: "문의 접수" });
  await submit.focus();
  await page.keyboard.press("Enter");
  const title = component.getByLabel("제목"),
    body = component.getByLabel("문의내용");
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAttribute("aria-describedby", "inquiry-create-title-error");
  await expect(component.locator("#inquiry-create-title-error")).toBeVisible();
  await title.fill("정산 문의");
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(body).toBeFocused();
  await expect(body).toHaveAttribute("aria-invalid", "true");
  await expect(body).toHaveAttribute("aria-describedby", "inquiry-create-body-error");
  await body.fill("정산자료를 확인해 주세요.");
  await expect(component.locator("#inquiry-create-title-error")).toHaveCount(0);
  await expect(component.locator("#inquiry-create-body-error")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-inquiry-workspace]")
        .analyze()
    ).violations,
  ).toEqual([]);
});
