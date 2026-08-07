import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  new URL("../src/app.ts", import.meta.url),
  "utf8",
);
const r2Source = readFileSync(
  new URL("../src/files/r2.ts", import.meta.url),
  "utf8",
);

function uploadBodyRoute(): string {
  const start = appSource.indexOf(
    'hotelApp.put("/api/files/uploads/:uploadId/body"',
  );
  const end = appSource.indexOf(
    'hotelApp.post("/api/files/uploads/:uploadId/complete"',
  );
  if (start < 0 || end <= start) throw new Error("upload body route not found");
  return appSource.slice(start, end);
}

function uploadCompleteRoute(): string {
  const start = appSource.indexOf(
    'hotelApp.post("/api/files/uploads/:uploadId/complete"',
  );
  const end = appSource.indexOf('hotelApp.get("/api/files/uploads/:uploadId"');
  if (start < 0 || end <= start)
    throw new Error("upload complete route not found");
  return appSource.slice(start, end);
}

describe("hotel file upload route", () => {
  it("streams the same-origin request body without trusting query hotelId", () => {
    const route = uploadBodyRoute();
    expect(route).not.toContain('context.req.query("hotelId")');
    expect(route).not.toContain("context.req.arrayBuffer()");
    expect(route).toContain("context.req.raw.body");
    expect(route).toContain('context.req.header("content-length")');
    expect(route).toContain('context.req.header("sec-fetch-site")');
    expect(route).toContain('context.req.header("origin")');
    expect(route).toContain("context.env?.ZITADEL_REDIRECT_URI");
    expect(route).toContain("service.authorizeAndPut(");
  });

  it("completes from canonical upload scope without query hotelId", () => {
    const route = uploadCompleteRoute();
    expect(route).not.toContain('context.req.query("hotelId")');
    expect(route).toContain("service.complete(");
  });

  it("streams only the exact same-origin review evidence route and audits terminal state", () => {
    expect(appSource).toContain(
      '"/api/hotels/:hotelId/inspections/:inspectionId/files/:fileVersionId/view"',
    );
    expect(appSource).toContain(
      '"/api/hotels/:hotelId/repairs/:repairId/files/:fileVersionId/view"',
    );
    expect(appSource).toContain(
      'context.req.header("sec-fetch-site") !== "same-origin"',
    );
    expect(appSource).toContain('"Cache-Control": "private, no-store"');
    expect(appSource).toContain('"X-Content-Type-Options": "nosniff"');
    expect(appSource).toContain("service.view(");
    expect(r2Source).toContain("objectState.body.getReader()");
    expect(r2Source).toContain('"SUCCEEDED"');
    expect(r2Source).toContain('"FAILED"');
    expect(r2Source).toContain('finalize("ABORTED")');
    expect(r2Source).not.toContain("presigned");
  });
});
