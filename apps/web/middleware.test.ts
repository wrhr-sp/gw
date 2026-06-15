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

  it("blocks anonymous management routes and allows designated roles on ordinary hosts", () => {
    const anonymousResponse = middleware(createRequest("/management", "gw-web.preview-account.workers.dev"));
    expect(anonymousResponse.status).toBe(307);
    expect(getLocationPath(anonymousResponse)).toBe("/login");

    const employeeResponse = middleware(
      createRequest("/work-items/legal", "gw-web.preview-account.workers.dev", "dev-placeholder-session_EMPLOYEE"),
    );
    expect(employeeResponse.status).toBe(307);
    expect(getLocationPath(employeeResponse)).toBe("/forbidden");

    const managerResponse = middleware(
      createRequest("/management", "gw-web.preview-account.workers.dev", "dev-placeholder-session_MANAGER"),
    );
    expect(managerResponse.headers.get("location")).toBeNull();
  });
});
