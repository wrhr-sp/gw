import { describe, expect, it } from "vitest";
import { getAdminPreviewRedirectPath } from "./admin-preview-guard";

describe("admin preview guard", () => {
  it("redirects anonymous admin routes to login", () => {
    expect(getAdminPreviewRedirectPath({ pathname: "/admin" })).toBe("/login");
    expect(getAdminPreviewRedirectPath({ pathname: "/admin/users" })).toBe("/login");
    expect(getAdminPreviewRedirectPath({ pathname: "/admin/policies" })).toBe("/login");
    expect(getAdminPreviewRedirectPath({ pathname: "/admin/audit-logs" })).toBe("/login");
  });

  it("allows admin routes for admin roles", () => {
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin",
        sessionToken: "dev-placeholder-session_COMPANY_ADMIN",
      }),
    ).toBeNull();
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin/users",
        sessionToken: "dev-placeholder-session_HR_ADMIN",
      }),
    ).toBeNull();
  });

  it("allows auditors only on audit log routes and blocks the rest", () => {
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin/audit-logs",
        sessionToken: "dev-placeholder-session_AUDITOR",
      }),
    ).toBeNull();
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin",
        sessionToken: "dev-placeholder-session_AUDITOR",
      }),
    ).toBe("/forbidden");
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin/users",
        sessionToken: "dev-placeholder-session_AUDITOR",
      }),
    ).toBe("/forbidden");
  });

  it("blocks logged-in non-admin users from admin routes", () => {
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin",
        sessionToken: "dev-placeholder-session_EMPLOYEE",
      }),
    ).toBe("/forbidden");
    expect(
      getAdminPreviewRedirectPath({
        pathname: "/admin/audit-logs",
        sessionToken: "dev-placeholder-session_MANAGER",
      }),
    ).toBe("/forbidden");
  });

  it("leaves non-admin routes alone", () => {
    expect(getAdminPreviewRedirectPath({ pathname: "/" })).toBeNull();
    expect(getAdminPreviewRedirectPath({ pathname: "/login" })).toBeNull();
    expect(getAdminPreviewRedirectPath({ pathname: "/dashboard" })).toBeNull();
    expect(getAdminPreviewRedirectPath({ pathname: "/administrator" })).toBeNull();
  });
});
