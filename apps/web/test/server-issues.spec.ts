import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  new URL("../app/hotels/[hotelId]/issues/page.tsx", import.meta.url),
  "utf8",
);
const loader = readFileSync(
  new URL("../lib/server-issues.ts", import.meta.url),
  "utf8",
);

describe("operational issue notification target selection", () => {
  it("passes an approved issueId query into the server loader", () => {
    expect(page).toContain("searchParams");
    expect(page).toContain("(await searchParams).issueId");
    expect(page).toContain("fetchOperationalIssues(hotelId, requestedIssueId)");
  });

  it("fetches an accessible requested issue directly even outside the first list page", () => {
    expect(loader).not.toContain(
      "issues.find((issue) => issue.id === selectedIssueId)",
    );
    expect(loader).toContain("selectedIssueId ?? issues[0]?.id");
    expect(loader).toContain('"RESOURCE_NOT_FOUND" as const');
    expect(loader).toContain(
      "operationalIssueRoutes.detail(hotelId, issueToSelectId)",
    );
  });
});
