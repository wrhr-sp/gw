import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const providerSource = readFileSync(
  new URL("../components/app-providers.tsx", import.meta.url),
  "utf8",
);

describe("Web application providers", () => {
  it("provides one stable TanStack Query client to every application route", () => {
    expect(layoutSource).toContain("<AppProviders>{children}</AppProviders>");
    expect(providerSource).toContain('"use client"');
    expect(providerSource).toContain("QueryClientProvider");
    expect(providerSource).toContain("React.useState(");
    expect(providerSource).toContain("new QueryClient(");
    expect(providerSource).toContain("queries: { retry: false }");
    expect(providerSource).toContain("mutations: { retry: false }");
  });
});
