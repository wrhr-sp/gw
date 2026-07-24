import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const workflow = readFileSync(
  join(repoRoot, ".github/workflows/preview-release.yml"),
  "utf8",
);
const fixedSnapshotDirectory = "/tmp/werehere-hyperdrive-retarget";

function workflowRun(name: string) {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) throw new Error(`Workflow step is missing: ${name}`);
  const next = workflow.indexOf("\n      - name: ", start + marker.length);
  const step = workflow.slice(start, next < 0 ? workflow.length : next);
  const runStart = step.indexOf("        run: |\n");
  if (runStart < 0) throw new Error(`Workflow run block is missing: ${name}`);
  return step
    .slice(runStart + "        run: |\n".length)
    .split("\n")
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
}

function runPreHyperdriveCompatibility(options: {
  approved: boolean;
  attested: boolean;
  classification: "DB_DEPENDENCY_UNAVAILABLE" | "SCHEMA_NOT_READY";
  status: 10 | 11;
}) {
  const directory = mkdtempSync(join(tmpdir(), "preview-pre-hyperdrive-"));
  const binDirectory = join(directory, "bin");
  const outputFile = join(directory, "github-output.txt");
  mkdirSync(binDirectory);
  writeFileSync(outputFile, "");
  writeFileSync(
    join(binDirectory, "node"),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$MOCK_READINESS_CLASSIFICATION"\nexit "$MOCK_READINESS_STATUS"\n`,
    { mode: 0o755 },
  );
  const result = spawnSync(
    "bash",
    [
      "-c",
      workflowRun("Verify previous Workers remain compatible after expand"),
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
        GITHUB_OUTPUT: outputFile,
        PREVIEW_CONTRACT_COMPATIBLE_EXPAND: String(options.attested),
        PREVIEW_HYPERDRIVE_RETARGET_APPROVED: String(options.approved),
        MOCK_READINESS_CLASSIFICATION: options.classification,
        MOCK_READINESS_STATUS: String(options.status),
        WEB_PREVIEW_URL: "https://preview.invalid",
      },
    },
  );
  const githubOutput = readFileSync(outputFile, "utf8");
  rmSync(directory, { recursive: true, force: true });
  return { result, githubOutput };
}

type Origin = {
  host: string;
  port: number;
  database: string;
  user: string;
  scheme: string;
};

type Config = {
  id: string;
  name: string;
  origin: Origin;
  caching: { disabled: true };
};

const canonicalApi: Origin = {
  host: "canonical-api.invalid",
  port: 5432,
  database: "gw",
  user: "api_runtime",
  scheme: "postgresql",
};
const canonicalReconciler: Origin = {
  host: "canonical-reconciler.invalid",
  port: 5432,
  database: "gw",
  user: "reconciler_runtime",
  scheme: "postgresql",
};
const staleOrigin: Origin = {
  host: "stale.invalid",
  port: 5432,
  database: "gw_old",
  user: "old_runtime",
  scheme: "postgresql",
};
const legacyOrigin: Origin = {
  host: "legacy.invalid",
  port: 5432,
  database: "legacy",
  user: "legacy_runtime",
  scheme: "postgresql",
};
const existingApiId = "11111111111111111111111111111111";
const existingReconcilerId = "22222222222222222222222222222222";
const legacyId = "33333333333333333333333333333333";

function config(id: string, name: string, origin: Origin): Config {
  return { id, name, origin, caching: { disabled: true } };
}

function runHyperdriveStep(options: {
  apiOrigin: Origin;
  reconcilerOrigin: Origin;
  approved: boolean;
  required: boolean;
  legacySchemaRecoveryAttested?: boolean;
  legacySchemaRecovery?: boolean;
  legacyConfigOrigin?: Origin;
  failUpdateId?: string;
  failCreateName?: string;
  apiPresent?: boolean;
  reconcilerPresent?: boolean;
  workersExist?: boolean;
  reconcilerWorkerExists?: boolean;
  apiBindingId?: string;
  reconcilerBindingId?: string;
}) {
  const directory = mkdtempSync(join(tmpdir(), "preview-hyperdrive-shell-"));
  const binDirectory = join(directory, "bin");
  mkdirSync(binDirectory);
  const stateFile = join(directory, "state.json");
  const callsFile = join(directory, "calls.txt");
  const outputFile = join(directory, "github-output.txt");
  const apiUrlFile = join(directory, "api-url");
  const reconcilerUrlFile = join(directory, "reconciler-url");
  const apiUrl = `postgresql://${canonicalApi.user}:fixture-password@${canonicalApi.host}:${canonicalApi.port}/${canonicalApi.database}`;
  const reconcilerUrl = `postgresql://${canonicalReconciler.user}:fixture-password@${canonicalReconciler.host}:${canonicalReconciler.port}/${canonicalReconciler.database}`;
  const initialState = [
    config(
      legacyId,
      "werehere-hotel-preview",
      options.legacyConfigOrigin ?? legacyOrigin,
    ),
  ];
  if (options.apiPresent !== false) {
    initialState.push(
      config(existingApiId, "werehere-hotel-api-preview", options.apiOrigin),
    );
  }
  if (options.reconcilerPresent !== false) {
    initialState.push(
      config(
        existingReconcilerId,
        "werehere-hotel-reconciler-preview",
        options.reconcilerOrigin,
      ),
    );
  }
  writeFileSync(stateFile, JSON.stringify(initialState));
  writeFileSync(callsFile, "");
  writeFileSync(outputFile, "");
  writeFileSync(apiUrlFile, apiUrl);
  writeFileSync(reconcilerUrlFile, reconcilerUrl);
  writeFileSync(
    join(binDirectory, "jq"),
    `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const args = process.argv.slice(2);
const variables = {};
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--arg") {
    variables[args[index + 1]] = args[index + 2];
    index += 2;
  } else if (args[index].startsWith("-")) {
    continue;
  } else {
    positional.push(args[index]);
  }
}
const query = positional[0];
const input = JSON.parse(readFileSync(positional[1], "utf8"));
if (query.includes(".id") && !query.includes(".result")) {
  if (typeof input.id !== "string" || input.id.length === 0) process.exit(1);
  process.stdout.write(input.id + "\\n");
  process.exit(0);
}
const literalLegacyName = query.includes('werehere-hotel-preview')
  ? 'werehere-hotel-preview'
  : undefined;
const selectedEntries = input.result.filter((entry) =>
  (!variables.id || entry.id === variables.id) &&
  (!variables.name || entry.name === variables.name) &&
  (!literalLegacyName || entry.name === literalLegacyName)
);
if (query.includes("| length")) {
  process.stdout.write(String(selectedEntries.length));
  process.exit(0);
}
if (selectedEntries.length !== 1) process.exit(1);
const selected = selectedEntries[0];
const output = query.includes("{id, name, origin, caching}")
  ? { id: selected.id, name: selected.name, origin: selected.origin, caching: selected.caching }
  : selected;
process.stdout.write(JSON.stringify(output, null, 2) + "\\n");
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(binDirectory, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
node - "$MOCK_HYPERDRIVE_STATE" <<'NODE'
const { readFileSync } = require("node:fs");
const result = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(JSON.stringify({
  success: true,
  result,
  result_info: {
    page: 1,
    per_page: 100,
    count: result.length,
    total_count: result.length,
    total_pages: 1,
  },
}));
NODE
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(binDirectory, "pnpm"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$MOCK_HYPERDRIVE_CALLS"
operation=""
id_or_name=""
while [[ "$#" -gt 0 ]]; do
  value="$1"
  shift
  if [[ "$value" == "update" || "$value" == "create" ]]; then
    operation="$value"
    id_or_name="$1"
    break
  fi
done
if [[ -z "$operation" ]]; then exit 91; fi
if [[ "$operation" == "update" && "$id_or_name" == "$MOCK_FAIL_UPDATE_ID" ]]; then
  exit 92
fi
if [[ "$operation" == "create" && "$id_or_name" == "$MOCK_FAIL_CREATE_NAME" ]]; then
  exit 95
fi
node - "$MOCK_HYPERDRIVE_STATE" "$operation" "$id_or_name" <<'NODE'
const { readFileSync, writeFileSync } = require("node:fs");
const [file, operation, idOrName] = process.argv.slice(2);
const state = JSON.parse(readFileSync(file, "utf8"));
const targets = {
  "${existingApiId}": ${JSON.stringify(canonicalApi)},
  "${existingReconcilerId}": ${JSON.stringify(canonicalReconciler)},
  "${legacyId}": ${JSON.stringify(canonicalApi)},
};
const createTargets = {
  "werehere-hotel-api-preview": { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", origin: ${JSON.stringify(canonicalApi)} },
  "werehere-hotel-reconciler-preview": { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", origin: ${JSON.stringify(canonicalReconciler)} },
};
if (operation === "update") {
  const match = state.find((entry) => entry.id === idOrName);
  if (!match || !targets[idOrName]) process.exit(93);
  match.origin = targets[idOrName];
} else {
  const target = createTargets[idOrName];
  if (!target || state.some((entry) => entry.name === idOrName)) process.exit(94);
  state.push({ id: target.id, name: idOrName, origin: target.origin, caching: { disabled: true } });
  console.log("✅ Created new Hyperdrive PostgreSQL config: " + target.id);
}
writeFileSync(file, JSON.stringify(state));
NODE
`,
    { mode: 0o755 },
  );

  rmSync(fixedSnapshotDirectory, { recursive: true, force: true });
  const script = workflowRun("Create or update Preview Hyperdrives")
    .replaceAll(
      "${{ steps.worker_snapshot.outputs.api_existed }}",
      String(options.workersExist !== false),
    )
    .replaceAll(
      "${{ steps.worker_snapshot.outputs.reconciler_existed }}",
      String(options.reconcilerWorkerExists ?? options.workersExist !== false),
    )
    .replaceAll(
      "${{ steps.worker_snapshot.outputs.web_existed }}",
      String(options.workersExist !== false),
    )
    .replaceAll(
      "${{ steps.worker_snapshot.outputs.api_hyperdrive_id }}",
      options.apiBindingId ??
        (options.workersExist !== false ? existingApiId : ""),
    )
    .replaceAll(
      "${{ steps.worker_snapshot.outputs.reconciler_hyperdrive_id }}",
      options.reconcilerBindingId ??
        ((options.reconcilerWorkerExists ?? options.workersExist !== false)
          ? existingReconcilerId
          : ""),
    );
  const result = spawnSync("bash", ["-c", script], {
    cwd: join(repoRoot, "apps/api"),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDirectory}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
      GITHUB_WORKSPACE: repoRoot,
      GITHUB_OUTPUT: outputFile,
      CLOUDFLARE_ACCOUNT_ID: "fixture-account",
      CLOUDFLARE_API_TOKEN: "fixture-token",
      API_RUNTIME_DATABASE_URL_FILE: apiUrlFile,
      RECONCILER_DATABASE_URL_FILE: reconcilerUrlFile,
      PREVIEW_HYPERDRIVE_RETARGET_APPROVED: String(options.approved),
      PREVIEW_HYPERDRIVE_RETARGET_REQUIRED: String(options.required),
      PREVIEW_LEGACY_SCHEMA_RECOVERY_ATTESTED: String(
        options.legacySchemaRecoveryAttested ?? false,
      ),
      PREVIEW_LEGACY_SCHEMA_RECOVERY_REQUIRED: String(
        options.legacySchemaRecovery ?? false,
      ),
      MOCK_HYPERDRIVE_STATE: stateFile,
      MOCK_HYPERDRIVE_CALLS: callsFile,
      MOCK_FAIL_UPDATE_ID: options.failUpdateId ?? "",
      MOCK_FAIL_CREATE_NAME: options.failCreateName ?? "",
    },
  });
  const calls = readFileSync(callsFile, "utf8").split("\n").filter(Boolean);
  const state = JSON.parse(readFileSync(stateFile, "utf8")) as Config[];
  const githubOutput = readFileSync(outputFile, "utf8");
  const snapshotFiles = existsSync(fixedSnapshotDirectory)
    ? readdirSync(fixedSnapshotDirectory).sort()
    : [];
  const snapshotContents = Object.fromEntries(
    snapshotFiles.map((name) => [
      name,
      readFileSync(join(fixedSnapshotDirectory, name), "utf8"),
    ]),
  );
  rmSync(fixedSnapshotDirectory, { recursive: true, force: true });
  rmSync(directory, { recursive: true, force: true });
  return {
    result,
    calls,
    state,
    githubOutput,
    snapshotFiles,
    snapshotContents,
  };
}

function runHyperdriveRecovery(
  state: Config[],
  snapshotContents: Record<string, string>,
) {
  const directory = mkdtempSync(join(tmpdir(), "preview-hyperdrive-recovery-"));
  const binDirectory = join(directory, "bin");
  mkdirSync(binDirectory);
  mkdirSync(fixedSnapshotDirectory);
  for (const [name, content] of Object.entries(snapshotContents)) {
    writeFileSync(join(fixedSnapshotDirectory, name), content, { mode: 0o600 });
  }
  const stateFile = join(directory, "state.json");
  const apiUrlFile = join(directory, "api-url");
  const reconcilerUrlFile = join(directory, "reconciler-url");
  writeFileSync(stateFile, JSON.stringify(state));
  writeFileSync(
    apiUrlFile,
    `postgresql://${canonicalApi.user}:fixture-password@${canonicalApi.host}:${canonicalApi.port}/${canonicalApi.database}`,
  );
  writeFileSync(
    reconcilerUrlFile,
    `postgresql://${canonicalReconciler.user}:fixture-password@${canonicalReconciler.host}:${canonicalReconciler.port}/${canonicalReconciler.database}`,
  );
  writeFileSync(
    join(binDirectory, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
node - "$MOCK_HYPERDRIVE_STATE" <<'NODE'
const { readFileSync } = require("node:fs");
const result = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(JSON.stringify({
  success: true,
  result,
  result_info: { page: 1, per_page: 100, count: result.length, total_count: result.length, total_pages: 1 },
}));
NODE
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(binDirectory, "jq"),
    `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const args = process.argv.slice(2);
const variables = {};
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--arg") {
    variables[args[index + 1]] = args[index + 2];
    index += 2;
  } else if (!args[index].startsWith("-")) {
    positional.push(args[index]);
  }
}
const query = positional[0];
const input = JSON.parse(readFileSync(positional[1], "utf8"));
if (query.includes(".id") && !query.includes(".result")) {
  if (typeof input.id !== "string" || input.id.length === 0) process.exit(1);
  process.stdout.write(input.id + "\\n");
  process.exit(0);
}
if (query.includes(".name") && !query.includes(".result")) {
  if (typeof input.name !== "string" || input.name.length === 0) process.exit(1);
  process.stdout.write(input.name + "\\n");
  process.exit(0);
}
const selected = input.result.filter((entry) =>
  (!variables.id || entry.id === variables.id) &&
  (!variables.name || entry.name === variables.name)
);
if (query.includes("| length")) {
  process.stdout.write(String(selected.length));
  process.exit(0);
}
if (selected.length !== 1) process.exit(1);
const entry = selected[0];
const output = query.includes("{id, name, origin, caching}")
  ? { id: entry.id, name: entry.name, origin: entry.origin, caching: entry.caching }
  : entry;
process.stdout.write(JSON.stringify(output, null, 2) + "\\n");
`,
    { mode: 0o755 },
  );
  const rollback = workflowRun("Roll back failed Worker release");
  const start = rollback.indexOf(
    "cloudflare_token_name=CLOUDFLARE_API_TOKEN\n",
  );
  const end = rollback.indexOf(
    '\nif [[ "$CONTRACT_STARTED" == "true" ]]; then',
    start,
  );
  if (start < 0 || end < 0) throw new Error("Recovery classifier is missing");
  const script = `set -euo pipefail\n${rollback.slice(start, end)}\nclassify_hyperdrive_recovery`;
  const result = spawnSync("bash", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDirectory}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
      MOCK_HYPERDRIVE_STATE: stateFile,
      CLOUDFLARE_ACCOUNT_ID: "fixture-account",
      CLOUDFLARE_API_TOKEN: "fixture-token",
      API_RUNTIME_DATABASE_URL_FILE: apiUrlFile,
      RECONCILER_DATABASE_URL_FILE: reconcilerUrlFile,
      CONTRACT_STARTED: "false",
      API_DEPLOY_ATTEMPTED: "false",
      RECONCILER_DEPLOY_ATTEMPTED: "false",
      WEB_DEPLOY_ATTEMPTED: "false",
    },
  });
  rmSync(fixedSnapshotDirectory, { recursive: true, force: true });
  rmSync(directory, { recursive: true, force: true });
  return result;
}

afterEach(() => {
  rmSync(fixedSnapshotDirectory, { recursive: true, force: true });
});

describe("Preview Hyperdrive source-faithful shell sequence", () => {
  it("accepts attested schema recovery without enabling retarget", () => {
    const execution = runPreHyperdriveCompatibility({
      approved: false,
      attested: true,
      classification: "SCHEMA_NOT_READY",
      status: 11,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.githubOutput).toContain("retarget_required=false");
    expect(execution.githubOutput).toContain(
      "legacy_schema_recovery_required=true",
    );
    expect(execution.githubOutput).toContain(
      "legacy_schema_recovery_attested=true",
    );
  });

  it("rejects unattested schema recovery when retarget approval is false", () => {
    const execution = runPreHyperdriveCompatibility({
      approved: false,
      attested: false,
      classification: "SCHEMA_NOT_READY",
      status: 11,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.githubOutput).toBe("");
  });

  it("does not let schema attestation approve a database dependency retarget", () => {
    const execution = runPreHyperdriveCompatibility({
      approved: false,
      attested: true,
      classification: "DB_DEPENDENCY_UNAVAILABLE",
      status: 10,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.githubOutput).toBe("");
  });

  it("performs no mutation for default-false existing canonical targets", () => {
    const execution = runHyperdriveStep({
      apiOrigin: canonicalApi,
      reconcilerOrigin: canonicalReconciler,
      approved: false,
      required: false,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toEqual([]);
  });

  it("creates both canonical configs only for an empty first-deploy topology", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: staleOrigin,
      approved: false,
      required: false,
      apiPresent: false,
      reconcilerPresent: false,
      workersExist: false,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toHaveLength(2);
    expect(execution.calls[0]).toContain(
      "hyperdrive create werehere-hotel-api-preview",
    );
    expect(execution.calls[1]).toContain(
      "hyperdrive create werehere-hotel-reconciler-preview",
    );
    expect(
      execution.state.find(({ name }) => name === "werehere-hotel-api-preview")
        ?.origin,
    ).toEqual(canonicalApi);
    expect(
      execution.state.find(
        ({ name }) => name === "werehere-hotel-reconciler-preview",
      )?.origin,
    ).toEqual(canonicalReconciler);
    expect(execution.snapshotFiles).toEqual([
      "api_id-create-attempted",
      "api_id-created-id",
      "reconciler_id-create-attempted",
      "reconciler_id-created-id",
    ]);
    expect(
      execution.state.find(({ name }) => name === "werehere-hotel-api-preview")
        ?.id,
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("records an exact first-deploy split when reconciler create fails", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: staleOrigin,
      approved: false,
      required: false,
      apiPresent: false,
      reconcilerPresent: false,
      workersExist: false,
      failCreateName: "werehere-hotel-reconciler-preview",
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toHaveLength(2);
    expect(
      execution.state.find(({ name }) => name === "werehere-hotel-api-preview")
        ?.id,
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(
      execution.state.some(
        ({ name }) => name === "werehere-hotel-reconciler-preview",
      ),
    ).toBe(false);
    expect(execution.snapshotFiles).toEqual([
      "api_id-create-attempted",
      "api_id-created-id",
      "reconciler_id-create-attempted",
    ]);
    expect(execution.result.stderr).toContain(
      "Hyperdrive create outcome was ambiguous",
    );
  });

  it("rejects a missing config in an existing Worker topology with zero mutation", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: canonicalReconciler,
      approved: false,
      required: false,
      apiPresent: false,
      workersExist: true,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toEqual([]);
    expect(execution.result.stderr).toContain(
      "Worker exists without its required Hyperdrive config",
    );
  });

  it("rejects default-false mismatch with zero provider mutations", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: canonicalReconciler,
      approved: false,
      required: false,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toEqual([]);
    expect(execution.result.stderr).toContain(
      "Hyperdrive target mismatch requires the approved retarget state",
    );
  });

  it("retargets existing API and creates reconciler for the legacy API-Web topology", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: staleOrigin,
      approved: true,
      required: true,
      apiPresent: false,
      reconcilerPresent: false,
      workersExist: true,
      reconcilerWorkerExists: false,
      apiBindingId: legacyId,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toHaveLength(2);
    expect(execution.calls[0]).toContain(`hyperdrive update ${legacyId}`);
    expect(execution.calls[1]).toContain(
      "hyperdrive create werehere-hotel-reconciler-preview",
    );
    expect(execution.state.find(({ id }) => id === legacyId)?.origin).toEqual(
      canonicalApi,
    );
    expect(
      execution.state.find(
        ({ id }) => id === "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      )?.origin,
    ).toEqual(canonicalReconciler);
    expect(execution.snapshotFiles).toEqual([
      "api_id-before.json",
      "reconciler_id-create-attempted",
      "reconciler_id-created-id",
    ]);
  });

  it("continues canonical legacy schema recovery without mutating Hyperdrives", () => {
    const execution = runHyperdriveStep({
      apiOrigin: canonicalApi,
      reconcilerOrigin: canonicalReconciler,
      approved: true,
      required: false,
      legacySchemaRecovery: true,
      legacyConfigOrigin: canonicalApi,
      apiPresent: false,
      reconcilerPresent: true,
      workersExist: true,
      reconcilerWorkerExists: false,
      apiBindingId: legacyId,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toEqual([]);
    expect(execution.result.stdout).toContain(
      "PREVIEW_CANONICAL_LEGACY_SCHEMA_RECOVERY_CONFIRMED",
    );
    expect(execution.result.stdout).toContain(
      "PREVIEW_LEGACY_HYPERDRIVE_PROMOTED_TO_CANONICAL_API",
    );
    expect(execution.githubOutput).toContain(`api_id=${legacyId}`);
    expect(execution.githubOutput).toContain(
      `reconciler_id=${existingReconcilerId}`,
    );
    expect(execution.githubOutput).toContain("legacy_api_promoted=true");
    expect(execution.snapshotFiles).toEqual([]);
  });

  it("continues attested canonical legacy recovery without retarget approval", () => {
    const execution = runHyperdriveStep({
      apiOrigin: canonicalApi,
      reconcilerOrigin: canonicalReconciler,
      approved: false,
      required: false,
      legacySchemaRecovery: true,
      legacySchemaRecoveryAttested: true,
      legacyConfigOrigin: canonicalApi,
      apiPresent: false,
      reconcilerPresent: true,
      workersExist: true,
      reconcilerWorkerExists: false,
      apiBindingId: legacyId,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toEqual([]);
    expect(execution.result.stdout).toContain(
      "PREVIEW_CANONICAL_LEGACY_SCHEMA_RECOVERY_CONFIRMED",
    );
    expect(execution.result.stdout).toContain(
      "PREVIEW_CANONICAL_LEGACY_RECOVERY_PROVIDER_MUTATION_DENIED",
    );
    expect(execution.githubOutput).toContain(`api_id=${legacyId}`);
    expect(execution.snapshotFiles).toEqual([]);
  });

  it("rejects attested legacy recovery when the API target is not canonical", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: canonicalReconciler,
      approved: false,
      required: false,
      legacySchemaRecovery: true,
      legacySchemaRecoveryAttested: true,
      legacyConfigOrigin: staleOrigin,
      apiPresent: false,
      reconcilerPresent: true,
      workersExist: true,
      reconcilerWorkerExists: false,
      apiBindingId: legacyId,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toEqual([]);
    expect(execution.result.stderr).toContain(
      "Preview canonical legacy recovery decision was denied.",
    );
  });

  it("rejects attested legacy recovery without creating a missing reconciler config", () => {
    const execution = runHyperdriveStep({
      apiOrigin: canonicalApi,
      reconcilerOrigin: canonicalReconciler,
      approved: false,
      required: false,
      legacySchemaRecovery: true,
      legacySchemaRecoveryAttested: true,
      legacyConfigOrigin: canonicalApi,
      apiPresent: false,
      reconcilerPresent: false,
      workersExist: true,
      reconcilerWorkerExists: false,
      apiBindingId: legacyId,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toEqual([]);
    expect(execution.result.stderr).toContain(
      "Preview canonical legacy recovery requires one exact reconciler Hyperdrive identity.",
    );
    expect(execution.snapshotFiles).toEqual([]);
  });

  it("classifies legacy API update plus reconciler create failure as split recovery", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: staleOrigin,
      approved: true,
      required: true,
      apiPresent: false,
      reconcilerPresent: false,
      workersExist: true,
      reconcilerWorkerExists: false,
      apiBindingId: legacyId,
      failCreateName: "werehere-hotel-reconciler-preview",
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toHaveLength(2);
    expect(execution.calls[0]).toContain(`hyperdrive update ${legacyId}`);
    expect(execution.calls[1]).toContain(
      "hyperdrive create werehere-hotel-reconciler-preview",
    );
    expect(execution.state.find(({ id }) => id === legacyId)?.origin).toEqual(
      canonicalApi,
    );
    expect(
      execution.state.some(
        ({ name }) => name === "werehere-hotel-reconciler-preview",
      ),
    ).toBe(false);
    expect(execution.snapshotFiles).toEqual([
      "api_id-before.json",
      "reconciler_id-create-attempted",
    ]);
    const recovery = runHyperdriveRecovery(
      execution.state,
      execution.snapshotContents,
    );
    expect(recovery.status).not.toBe(0);
    expect(recovery.stderr).toContain(
      "PREVIEW_HYPERDRIVE_SPLIT_TOPOLOGY_OPERATOR_RECOVERY_REQUIRED",
    );
    expect(recovery.stderr).not.toContain(
      "PREVIEW_HYPERDRIVE_RECOVERY_STATE_INDETERMINATE",
    );
  });

  it("retargets the exact reviewed IDs after typed failure and explicit approval", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: staleOrigin,
      approved: true,
      required: true,
    });
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toHaveLength(2);
    expect(execution.calls[0]).toContain(`hyperdrive update ${existingApiId}`);
    expect(execution.calls[1]).toContain(
      `hyperdrive update ${existingReconcilerId}`,
    );
    expect(
      execution.state.find(({ id }) => id === existingApiId)?.origin,
    ).toEqual(canonicalApi);
    expect(
      execution.state.find(({ id }) => id === existingReconcilerId)?.origin,
    ).toEqual(canonicalReconciler);
  });

  it("exposes a split topology when the reconciler update fails after API update", () => {
    const execution = runHyperdriveStep({
      apiOrigin: staleOrigin,
      reconcilerOrigin: staleOrigin,
      approved: true,
      required: true,
      failUpdateId: existingReconcilerId,
    });
    expect(execution.result.status).not.toBe(0);
    expect(execution.calls).toHaveLength(2);
    expect(
      execution.state.find(({ id }) => id === existingApiId)?.origin,
    ).toEqual(canonicalApi);
    expect(
      execution.state.find(({ id }) => id === existingReconcilerId)?.origin,
    ).toEqual(staleOrigin);
  });
});
