import { describe, expect, it } from "vitest";
import { getAdminRouteGuardResult } from "./admin-preview-guard";

describe("phase35 route guard review checks", () => {
  it("treats tax/labor/branch management pages as sensitive workbench routes", () => {
    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/tax",
        host: "localhost:3000",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({ action: "redirect", location: "/forbidden" });

    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/labor",
        host: "localhost:3000",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({ action: "redirect", location: "/forbidden" });

    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/branch",
        host: "localhost:3000",
        sessionToken: "dev-session_EMPLOYEE",
      }),
    ).toEqual({ action: "redirect", location: "/forbidden" });

    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/tax",
        host: "localhost:3000",
        sessionToken: "dev-session_MANAGER",
      }),
    ).toEqual({ action: "allow" });

    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/labor",
        host: "localhost:3000",
        sessionToken: "dev-session_MANAGER",
      }),
    ).toEqual({ action: "redirect", location: "/forbidden" });

    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/labor",
        host: "localhost:3000",
        sessionToken: "dev-session_COMPANY_ADMIN",
      }),
    ).toEqual({ action: "allow" });

    expect(
      getAdminRouteGuardResult({
        pathname: "/work-items/branch",
        host: "localhost:3000",
        sessionToken: "dev-session_AUDITOR",
      }),
    ).toEqual({ action: "redirect", location: "/forbidden" });
  });
});
