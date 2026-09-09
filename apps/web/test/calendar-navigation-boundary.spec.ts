import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("server-safe Calendar navigation", () => {
  it("keeps the helper in a directive-free dependency-free module", () => {
    const source = readFileSync(new URL("../lib/calendar-navigation.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/use client|use server|^import\s/m);
    expect(source).toContain("export function calendarNavigationHref");
  });
});
