import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "./middleware";

function createRequest(pathname: string, host: string) {
  return new NextRequest(`http://127.0.0.1:58111${pathname}`, {
    headers: {
      host,
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
});
