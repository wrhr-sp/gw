import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeStoredHotelUserType,
  toExpandCompatibleStoredUserType,
} from "../src/account-user-types";

const hotelsSource = readFileSync(new URL("../src/hotels.ts", import.meta.url), "utf8");

describe("account user type expand compatibility", () => {
  it.each([
    ["INTERNAL_STAFF", "INTERNAL_STAFF"],
    ["ROOM_OPERATIONS", "HOUSEKEEPING"],
    ["HOUSEKEEPING", "HOUSEKEEPING"],
    ["BRANCH_OWNER", "HOTEL_OWNER"],
    ["HOTEL_OWNER", "HOTEL_OWNER"],
  ] as const)("normalizes stored %s to API %s", (stored, expected) => {
    expect(normalizeStoredHotelUserType(stored)).toBe(expected);
  });

  it.each([
    ["INTERNAL_STAFF", "INTERNAL_STAFF"],
    ["HOUSEKEEPING", "ROOM_OPERATIONS"],
    ["HOTEL_OWNER", "BRANCH_OWNER"],
  ] as const)("keeps new writes readable by the previous Worker: %s -> %s", (userType, expected) => {
    expect(toExpandCompatibleStoredUserType(userType)).toBe(expected);
  });

  it("fails closed for an unknown stored user type", () => {
    expect(() => normalizeStoredHotelUserType("UNKNOWN")).toThrow("Unsupported stored hotel user type");
  });

  it("does not compare normalized principals directly with expand-compatible storage codes", () => {
    expect(hotelsSource).not.toMatch(/u\.user_type\s*=\s*\$\{actor\.userType\}/u);
    expect(hotelsSource).not.toMatch(/u\.user_type\s*=\s*\$\{input\.actor\.userType\}/u);
  });
});
