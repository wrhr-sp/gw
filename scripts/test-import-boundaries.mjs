import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cwd = resolve(import.meta.dirname, "..");

function lintSource(file, source) {
  return spawnSync(
    "pnpm",
    ["exec", "eslint", "--stdin", "--stdin-filename", file],
    { cwd, encoding: "utf8", input: source },
  );
}

const forbiddenCases = [
  {
    file: "packages/contracts/src/__boundary_probe__.ts",
    source: 'import "../../db/src/index.ts";',
  },
  {
    file: "packages/ui/src/__boundary_probe__.ts",
    source: 'import "../../contracts/src/index.ts";',
  },
  {
    file: "apps/web/app/__boundary_probe__.ts",
    source: 'import "../../api/src/app.ts";',
  },
  {
    file: "apps/api/src/__boundary_probe__.ts",
    source: 'import "../../../packages/ui/src/index.ts";',
  },
];

for (const testCase of forbiddenCases) {
  const result = lintSource(testCase.file, testCase.source);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status === 0 || !output.includes("no-restricted-imports")) {
    throw new Error(`import boundary did not reject ${testCase.file}`);
  }
}

const allowedCases = [
  {
    file: "apps/api/src/__boundary_probe__.ts",
    source: 'import "@werehere/db";',
  },
  {
    file: "apps/web/app/__boundary_probe__.ts",
    source: 'import "@werehere/ui";',
  },
];

for (const testCase of allowedCases) {
  const result = lintSource(testCase.file, testCase.source);
  if (result.status !== 0) throw new Error(`import boundary rejected allowed import in ${testCase.file}`);
}
