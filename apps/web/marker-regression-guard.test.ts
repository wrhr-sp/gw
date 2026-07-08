import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = join(process.cwd(), "../..");
const sourceRoots = [
  "apps/api/src",
  "apps/web/app",
  "packages/shared/src",
  "apps/mobile/src",
];

const blockedMarkers = ["preview", "placeholder", "sample", "mock", "dev-safe", "skeleton"];
const sourceFileExtensions = new Set([".ts", ".tsx"]);

function getExtension(pathname: string) {
  const match = pathname.match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const pathname = join(root, entry);
    const stats = statSync(pathname);
    if (stats.isDirectory()) {
      return collectSourceFiles(pathname);
    }
    return stats.isFile() && sourceFileExtensions.has(getExtension(pathname)) ? [pathname] : [];
  });
}

function isAllowedFrameworkFallback(relativePath: string, line: string) {
  return relativePath === "apps/web/app/management-support/hr/page.tsx" && line.includes("<Suspense fallback=");
}

function isAllowedDeploymentPreviewUrl(relativePath: string, line: string) {
  return relativePath === "apps/web/app/uat/uat-package-config.ts" && line.includes("gw-web-preview.wereheresp.workers.dev");
}

describe("marker regression guard", () => {
  it("keeps production source free of residue markers", () => {
    const violations: string[] = [];

    for (const sourceRoot of sourceRoots) {
      for (const sourceFile of collectSourceFiles(join(repoRoot, sourceRoot))) {
        const relativePath = relative(repoRoot, sourceFile).replace(/\\/g, "/");
        const lines = readFileSync(sourceFile, "utf8").split("\n");

        lines.forEach((line, index) => {
          blockedMarkers.forEach((marker) => {
            if (line.includes(marker) && !isAllowedDeploymentPreviewUrl(relativePath, line)) {
              violations.push(`${relativePath}:${index + 1} contains ${marker}`);
            }
          });

          if (line.includes("fallback") && !isAllowedFrameworkFallback(relativePath, line)) {
            violations.push(`${relativePath}:${index + 1} contains fallback`);
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
