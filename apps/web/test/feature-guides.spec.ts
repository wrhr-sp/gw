import { describe, expect, it } from "vitest";
import {
  accountFeatureGuideRoutes,
  accountFeatureGuides,
  hotelFeatureGuideRoutes,
  hotelFeatureGuides,
  type AccountFeatureGuideKey,
} from "../lib/feature-guides";

const expectedRoutes = [
  "/admin/users",
  "/admin/users/new",
  "/admin/users/[userId]",
] as const;

const forbiddenCopy =
  /mock|sample|placeholder|Phase|UAT|provider subject|trace id|outbox|ZITADEL/i;

describe("account feature-guide registry", () => {
  it("covers each approved account route with one stable guide", () => {
    expect(Object.keys(accountFeatureGuideRoutes).sort()).toEqual(
      [...expectedRoutes].sort(),
    );
    const keys = Object.values(accountFeatureGuideRoutes);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(accountFeatureGuides[key]).toBeDefined();
    }
  });

  it("keeps every guide complete, concise, and free of internal implementation copy", () => {
    for (const [key, guide] of Object.entries(accountFeatureGuides) as [
      AccountFeatureGuideKey,
      (typeof accountFeatureGuides)[AccountFeatureGuideKey],
    ][]) {
      expect(guide.featureKey).toBe(key);
      expect(guide.version).toMatch(/^1\./);
      expect(guide.title.trim()).not.toBe("");
      expect(guide.summary.trim()).not.toBe("");
      expect(guide.audience.length).toBeGreaterThan(0);
      expect(guide.steps.length).toBeGreaterThan(0);
      expect(guide.permissions.length).toBeGreaterThan(0);
      expect(guide.cautions.length).toBeGreaterThan(0);
      for (const item of [
        ...guide.audience,
        ...guide.steps,
        ...guide.permissions,
        ...guide.cautions,
      ]) {
        expect(item.trim()).not.toBe("");
      }
      expect(JSON.stringify(guide)).not.toMatch(forbiddenCopy);
    }
  });
});

describe("hotel feature-guide registry", () => {
  it("covers approved hotel routes with complete operational guidance", () => {
    expect(hotelFeatureGuideRoutes).toEqual({
      "/hotels/calendar": "hotel-calendar.workspace",
      "/hotels/[hotelId]": "hotel-management.detail",
      "/hotels/[hotelId]/calendar": "hotel-calendar.workspace",
      "/hotels/[hotelId]/inspections/reviews": "hotel-inspection.review",
      "/hotels/[hotelId]/repairs": "hotel-repair.lifecycle",
    });
    expect(hotelFeatureGuides["hotel-repair.lifecycle"].title).toBe("하자·보수");
    expect(hotelFeatureGuides["hotel-management.detail"].title).toBe(
      "호텔 상세",
    );
    expect(JSON.stringify(hotelFeatureGuides["hotel-management.detail"])).toContain(
      "객실",
    );
    expect(hotelFeatureGuides["hotel-inspection.review"].title).toBe(
      "점검 검토",
    );
    expect(JSON.stringify(hotelFeatureGuides["hotel-inspection.review"])).toContain(
      "점검",
    );
    for (const guide of Object.values(hotelFeatureGuides)) {
      expect(JSON.stringify(guide)).not.toMatch(forbiddenCopy);
      for (const item of [
        ...guide.audience,
        ...guide.steps,
        ...guide.permissions,
        ...guide.cautions,
      ])
        expect(item.trim()).not.toBe("");
    }
  });
});
