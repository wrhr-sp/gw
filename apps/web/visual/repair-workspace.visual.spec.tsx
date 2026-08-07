import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/experimental-ct-react";
import React from "react";
import { RepairWorkspaceStory } from "../playwright/stories/repair-workspace.story";

test("PC 보수 업무 화면은 axe 위반과 가로 넘침 없이 주요 action을 제공한다", async ({ mount, page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const component = await mount(<RepairWorkspaceStory />);
  await expect(component.getByRole("heading", { name: "하자·보수" })).toBeVisible();
  await expect(component.getByText("703호").first()).toBeVisible();
  await expect(component.getByRole("region", { name: "보수 상세" }).getByRole("button", { name: "등록" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("[data-repair-workspace]").analyze()).violations).toEqual([]);
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