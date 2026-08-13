import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { IssueWorkspaceStory } from "../playwright/stories/issue-workspace.story";

test("PC 운영이슈 화면은 목록·상세·현장 action과 접근성을 제공한다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<IssueWorkspaceStory />);
  await expect(
    component.getByRole("heading", { name: "운영이슈" }),
  ).toBeVisible();
  await expect(component.getByText("로비 소음 신고").first()).toBeVisible();
  await expect(
    component.getByRole("region", { name: "운영이슈 상세" }),
  ).toBeVisible();
  await expect(
    component.getByRole("button", { name: "조치 완료" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include("[data-issue-workspace]").analyze())
      .violations,
  ).toEqual([]);
});

test("390px 모바일 운영이슈 등록은 label·keyboard·focus 복원을 지킨다", async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const component = await mount(<IssueWorkspaceStory />);
  const trigger = component.getByRole("button", { name: "이슈 등록" });
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "운영이슈 등록" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("제목")).toBeVisible();
  await expect(dialog.getByLabel("등급")).toBeVisible();
  await expect(dialog.getByLabel("현장 내용")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include("[role=dialog]").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
