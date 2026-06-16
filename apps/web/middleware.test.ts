import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";

function createRequest(pathname: string, host: string, sessionToken?: string) {
  return new NextRequest(`http://127.0.0.1:58111${pathname}`, {
    headers: {
      host,
      ...(sessionToken ? { cookie: `gw_session=${sessionToken}` } : {}),
    },
  });
}

function getLocationPath(response: Response) {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location!).pathname;
}

describe("middleware host boundary", () => {
  it("uses the Host header instead of the internal listen host for admin-host root redirects", () => {
    const response = middleware(createRequest("/", "gw-admin.preview-account.workers.dev"));

    expect(response.status).toBe(307);
    expect(getLocationPath(response)).toBe("/admin");
  });

  it("keeps general routes on the admin host inside the /admin boundary", () => {
    const response = middleware(createRequest("/employees", "gw-admin.preview-account.workers.dev"));

    expect(response.status).toBe(307);
    expect(getLocationPath(response)).toBe("/admin");
  });

  it("passes admin-host /admin requests through the host boundary and onto auth handling", () => {
    const response = middleware(createRequest("/admin", "gw-admin.preview-account.workers.dev"));

    expect(response.status).toBe(307);
    expect(getLocationPath(response)).toBe("/login");
  });

  it("blocks anonymous management, dashboard, and work-item routes while allowing designated roles on ordinary hosts", () => {
    const anonymousManagementResponse = middleware(createRequest("/management", "gw-web.preview-account.workers.dev"));
    expect(anonymousManagementResponse.status).toBe(307);
    expect(getLocationPath(anonymousManagementResponse)).toBe("/login");

    const anonymousDashboardResponse = middleware(createRequest("/dashboard", "gw-web.preview-account.workers.dev"));
    expect(anonymousDashboardResponse.status).toBe(307);
    expect(getLocationPath(anonymousDashboardResponse)).toBe("/login");

    const anonymousWorkItemsResponse = middleware(createRequest("/work-items", "gw-web.preview-account.workers.dev"));
    expect(anonymousWorkItemsResponse.status).toBe(307);
    expect(getLocationPath(anonymousWorkItemsResponse)).toBe("/login");

    const anonymousUatResponse = middleware(createRequest("/uat", "gw-web.preview-account.workers.dev"));
    expect(anonymousUatResponse.status).toBe(307);
    expect(getLocationPath(anonymousUatResponse)).toBe("/login");

    const employeeDashboardResponse = middleware(createRequest("/dashboard", "gw-web.preview-account.workers.dev", "dev-placeholder-session_EMPLOYEE"));
    expect(employeeDashboardResponse.headers.get("location")).toBeNull();

    const employeeResponse = middleware(
      createRequest("/work-items/legal", "gw-web.preview-account.workers.dev", "dev-placeholder-session_EMPLOYEE"),
    );
    expect(employeeResponse.status).toBe(307);
    expect(getLocationPath(employeeResponse)).toBe("/forbidden");

    const employeeBranchResponse = middleware(
      createRequest("/work-items/branch", "gw-web.preview-account.workers.dev", "dev-placeholder-session_EMPLOYEE"),
    );
    expect(employeeBranchResponse.status).toBe(307);
    expect(getLocationPath(employeeBranchResponse)).toBe("/forbidden");

    const managerResponse = middleware(
      createRequest("/management", "gw-web.preview-account.workers.dev", "dev-placeholder-session_MANAGER"),
    );
    expect(managerResponse.headers.get("location")).toBeNull();
  });
});
