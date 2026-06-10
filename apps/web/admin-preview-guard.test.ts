import { describe, expect, it } from "vitest";
import { getAdminPreviewRedirectPath } from "./admin-preview-guard";

describe("admin preview guard", () => {
  it("redirects anonymous admin routes to login", () => {
    expect(getAdminPreviewRedirectPath("/admin")).toBe("/login");
    expect(getAdminPreviewRedirectPath("/admin/users")).toBe("/login");
    expect(getAdminPreviewRedirectPath("/admin/policies")).toBe("/login");
    expect(getAdminPreviewRedirectPath("/admin/audit-logs")).toBe("/login");
  });

  it("leaves non-admin routes alone", () => {
    expect(getAdminPreviewRedirectPath("/")).toBeNull();
    expect(getAdminPreviewRedirectPath("/login")).toBeNull();
    expect(getAdminPreviewRedirectPath("/dashboard")).toBeNull();
    expect(getAdminPreviewRedirectPath("/administrator")).toBeNull();
  });
});
