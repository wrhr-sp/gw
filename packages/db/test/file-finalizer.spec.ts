import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../src/file-finalizer.ts", import.meta.url),
  "utf8",
);

describe("file scanner agent repository authority", () => {
  it("uses only scanner-agent PostgreSQL wrappers for scan mutations", () => {
    expect(source).toContain("public.hotel_file_scanner_agent_command_v1");
    expect(source).toContain("public.hotel_file_scanner_agent_candidates_v1");
    expect(source).not.toContain("public.hotel_file_scan_command_v1(");
    expect(source).not.toContain("public.hotel_file_scan_candidates_v1(");
  });
});
