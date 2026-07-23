import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function classifyReadinessResponses(live, ready) {
  if (
    !isObject(live) ||
    live.status !== 200 ||
    !isObject(live.body) ||
    live.body.ok !== true ||
    live.body.data?.status !== "UP"
  ) {
    return "UNCLASSIFIED_FAILURE";
  }
  if (
    isObject(ready) &&
    ready.status === 200 &&
    isObject(ready.body) &&
    ready.body.ok === true &&
    ready.body.data?.status === "READY"
  ) {
    return "READY";
  }
  if (
    isObject(ready) &&
    ready.status === 500 &&
    isObject(ready.body) &&
    ready.body.ok === false &&
    ready.body.error?.code === "INTERNAL_ERROR"
  ) {
    return "DB_DEPENDENCY_UNAVAILABLE";
  }
  if (
    isObject(ready) &&
    ready.status === 503 &&
    isObject(ready.body) &&
    ready.body.ok === false &&
    ready.body.error?.code === "SCHEMA_NOT_READY"
  ) {
    return "SCHEMA_NOT_READY";
  }
  return "UNCLASSIFIED_FAILURE";
}

export function hyperdriveTargetState(config, targetValue) {
  if (!isObject(config) || !isObject(config.origin)) return "INVALID";
  let target;
  try {
    target = new URL(targetValue);
  } catch {
    return "INVALID";
  }
  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
    return "INVALID";
  }
  const origin = config.origin;
  const expectedPort = Number(target.port || "5432");
  const expectedDatabase = decodeURIComponent(
    target.pathname.replace(/^\//u, ""),
  );
  const expectedUser = decodeURIComponent(target.username);
  if (
    typeof origin.host !== "string" ||
    origin.host.length === 0 ||
    !Number.isSafeInteger(origin.port) ||
    typeof origin.database !== "string" ||
    origin.database.length === 0 ||
    typeof origin.user !== "string" ||
    origin.user.length === 0 ||
    !Number.isSafeInteger(expectedPort) ||
    expectedDatabase.length === 0 ||
    expectedUser.length === 0
  ) {
    return "INVALID";
  }
  return origin.host === target.hostname &&
    origin.port === expectedPort &&
    origin.database === expectedDatabase &&
    origin.user === expectedUser
    ? "MATCH"
    : "MISMATCH";
}

export function decideRetarget({ approved, readiness, targetState, topology }) {
  if (targetState === "INVALID") return "DENY_INVALID_ORIGIN";
  if (readiness === "READY") {
    return targetState === "MATCH"
      ? "NORMAL_RELEASE"
      : "DENY_HEALTHY_TARGET_MISMATCH";
  }
  if (readiness === "SCHEMA_NOT_READY") {
    if (!approved) return "DENY_NOT_APPROVED";
    if (topology !== "API_WEB_LEGACY") {
      return "DENY_SCHEMA_RECOVERY_TOPOLOGY";
    }
    return targetState === "MATCH"
      ? "CONTINUE_CANONICAL_LEGACY_RECOVERY"
      : "DENY_SCHEMA_RECOVERY_TARGET_NOT_CANONICAL";
  }
  if (readiness !== "DB_DEPENDENCY_UNAVAILABLE") {
    return "DENY_UNCLASSIFIED_FAILURE";
  }
  if (!approved) return "DENY_NOT_APPROVED";
  if (topology !== "COMPLETE" && topology !== "API_WEB_LEGACY") {
    return "DENY_PARTIAL_TOPOLOGY";
  }
  if (targetState !== "MISMATCH") return "DENY_TARGET_ALREADY_MATCHED";
  return "RETARGET";
}

export function parseCreatedHyperdriveId(output) {
  if (typeof output !== "string") return null;
  const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
  const normalized = output.replace(ansiPattern, "");
  const successLikeLines = normalized
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /created\s+new\s+hyperdrive/iu.test(line));
  if (successLikeLines.length !== 1) return null;
  const match =
    /^✅ Created new Hyperdrive PostgreSQL config: ([0-9a-f]{32})$/u.exec(
      successLikeLines[0],
    );
  return match?.[1] ?? null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function main() {
  const [mode, first, second, third, fourth] = process.argv.slice(2);
  if (mode === "probe") {
    const baseUrl = first?.trim().replace(/\/+$/u, "");
    if (!baseUrl || !baseUrl.startsWith("https://")) {
      throw new Error("PREVIEW_READINESS_PROBE_INVALID_URL");
    }
    const classification = classifyReadinessResponses(
      await fetchJson(`${baseUrl}/api/health/live`),
      await fetchJson(`${baseUrl}/api/health/ready`),
    );
    process.stdout.write(`${classification}\n`);
    if (classification === "DB_DEPENDENCY_UNAVAILABLE") process.exitCode = 10;
    else if (classification === "SCHEMA_NOT_READY") process.exitCode = 11;
    else if (classification !== "READY") process.exitCode = 1;
    return;
  }
  if (mode === "target-state") {
    if (!first || !second)
      throw new Error("PREVIEW_HYPERDRIVE_TARGET_INPUT_MISSING");
    const state = hyperdriveTargetState(
      JSON.parse(await readFile(first, "utf8")),
      (await readFile(second, "utf8")).trim(),
    );
    process.stdout.write(`${state}\n`);
    if (state === "INVALID") process.exitCode = 2;
    return;
  }
  if (mode === "decide") {
    const decision = decideRetarget({
      approved: first === "true",
      readiness: second,
      targetState: third,
      topology: fourth,
    });
    process.stdout.write(`${decision}\n`);
    if (
      decision !== "RETARGET" &&
      decision !== "NORMAL_RELEASE" &&
      decision !== "CONTINUE_CANONICAL_LEGACY_RECOVERY"
    ) {
      process.exitCode = 3;
    }
    return;
  }
  if (mode === "parse-created-id") {
    if (!first) throw new Error("PREVIEW_HYPERDRIVE_CREATE_OUTPUT_MISSING");
    const id = parseCreatedHyperdriveId(await readFile(first, "utf8"));
    if (!id) throw new Error("PREVIEW_HYPERDRIVE_CREATE_ID_INVALID");
    process.stdout.write(`${id}\n`);
    return;
  }
  throw new Error("PREVIEW_HYPERDRIVE_CONTRACT_MODE_INVALID");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write("PREVIEW_HYPERDRIVE_CONTRACT_FAILED\n");
    process.exitCode = 1;
  });
}
