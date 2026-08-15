import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };
const typecheckConfig = JSON.parse(
  readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"),
) as { compilerOptions?: { paths?: Record<string, string[]> } };
const runtimeConfig = JSON.parse(
  readFileSync(new URL("../tsconfig.runtime.json", import.meta.url), "utf8"),
) as { compilerOptions?: { paths?: Record<string, string[]> }; extends?: string };

describe("scanner runtime startup", () => {
  it("keeps Sharp's type workaround out of the tsx runtime resolver", () => {
    expect(typecheckConfig.compilerOptions?.paths?.sharp).toEqual([
      "node_modules/sharp/lib/index.d.ts",
    ]);
    expect(runtimeConfig).toEqual({
      extends: "./tsconfig.json",
      compilerOptions: { paths: {} },
    });
    expect(packageJson.scripts?.["scan:preview"]).toBe(
      "tsx --tsconfig tsconfig.runtime.json src/batch-cli.ts",
    );
  });
});
