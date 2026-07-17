#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const MANIFEST_VERSION = 1;
const STABILITY_ATTEMPTS = 4;

function usage() {
  return [
    "Capture before editing:",
    "  node scripts/verify-file-mutations.mjs --capture <manifest> --expect <path> [--expect <path> ...]",
    "Verify after editing:",
    "  node scripts/verify-file-mutations.mjs --baseline <manifest> --seal <sha256>",
    "Optional for both modes: --repo <repository or its subdirectory>",
  ].join("\n");
}

function parseArguments(argv) {
  const result = { baseline: undefined, capture: undefined, expected: [], repo: process.cwd(), seal: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--capture" || argument === "--baseline" || argument === "--expect" || argument === "--repo" || argument === "--seal") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--capture") result.capture = value;
      if (argument === "--baseline") result.baseline = value;
      if (argument === "--expect") result.expected.push(value);
      if (argument === "--repo") result.repo = value;
      if (argument === "--seal") result.seal = value;
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (Boolean(result.capture) === Boolean(result.baseline)) {
    throw new Error("exactly one of --capture or --baseline is required");
  }
  if (result.capture && result.expected.length === 0) {
    throw new Error("capture mode requires at least one --expect path");
  }
  if (result.baseline && result.expected.length > 0) {
    throw new Error("baseline mode reads expected paths from the manifest");
  }
  if (result.capture && result.seal) throw new Error("capture mode does not accept --seal");
  if (result.baseline && !/^[a-f0-9]{64}$/u.test(result.seal ?? "")) {
    throw new Error("baseline mode requires a valid --seal SHA-256");
  }
  return result;
}

function git(cwd, arguments_) {
  const result = spawnSync("git", arguments_, { cwd, encoding: "buffer" });
  if (result.error) throw new Error(`cannot execute git: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = result.stderr?.toString("utf8").trim();
    throw new Error(stderr || `git ${arguments_.join(" ")} failed with status ${String(result.status)}`);
  }
  return result.stdout;
}

async function repositoryRoot(input) {
  const existing = await realpath(resolve(input));
  const root = git(existing, ["rev-parse", "--show-toplevel"]).toString("utf8").trim();
  return realpath(root);
}

function normalizePath(repo, input) {
  if (input.includes("\0")) throw new Error("path contains a NUL byte");
  const absolute = resolve(repo, input);
  const repoRelative = relative(repo, absolute);
  if (
    !repoRelative ||
    repoRelative === ".." ||
    repoRelative.startsWith(`..${sep}`) ||
    isAbsolute(repoRelative)
  ) {
    throw new Error(`path must be a repository-relative file: ${input}`);
  }
  return repoRelative.split(sep).join("/");
}

function nulPaths(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function changedPaths(repo) {
  const staged = nulPaths(git(repo, ["diff", "--cached", "--no-renames", "--name-only", "-z", "--"]));
  const unstaged = nulPaths(git(repo, ["diff", "--no-renames", "--name-only", "-z", "--"]));
  const untracked = nulPaths(git(repo, ["ls-files", "--others", "--exclude-standard", "-z", "--"]));
  return new Set([...staged, ...unstaged, ...untracked]);
}

async function fingerprint(repo, path) {
  const absolute = resolve(repo, path);
  const segments = path.split("/");
  let ancestor = repo;
  for (const segment of segments.slice(0, -1)) {
    ancestor = join(ancestor, segment);
    try {
      const ancestorMetadata = await lstat(ancestor);
      if (ancestorMetadata.isSymbolicLink()) throw new Error(`symbolic link ancestor is not allowed: ${path}`);
      if (!ancestorMetadata.isDirectory()) throw new Error(`non-directory ancestor is not allowed: ${path}`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") break;
      throw error;
    }
  }

  let worktreeState;
  try {
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink()) throw new Error(`symbolic links are not allowed: ${path}`);
    if (!metadata.isFile()) throw new Error(`non-regular files are not allowed: ${path}`);
    const contentHash = createHash("sha256").update(await readFile(absolute)).digest("hex");
    worktreeState = `file:${(metadata.mode & 0o777).toString(8)}:${contentHash}`;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") worktreeState = "deleted";
    else throw error;
  }

  const indexState = git(repo, ["ls-files", "--stage", "-z", "--", path]);
  return createHash("sha256")
    .update(worktreeState)
    .update("\0")
    .update(indexState)
    .digest("hex");
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

async function stableSnapshot(repo, requiredPaths) {
  let observed = new Set(requiredPaths);
  let previous;

  for (let attempt = 0; attempt < STABILITY_ATTEMPTS; attempt += 1) {
    const changed = changedPaths(repo);
    observed = new Set([...observed, ...changed]);
    const fingerprints = {};
    for (const path of [...observed].sort()) fingerprints[path] = await fingerprint(repo, path);
    const current = { changed, fingerprints };

    if (previous && sameSet(previous.changed, current.changed)) {
      const paths = new Set([...Object.keys(previous.fingerprints), ...Object.keys(current.fingerprints)]);
      if ([...paths].every((path) => previous.fingerprints[path] === current.fingerprints[path])) return current;
    }
    previous = current;
  }

  throw new Error("worktree changed during verification; retry after concurrent writers stop");
}

function snapshotsEqual(left, right) {
  if (!sameSet(left.changed, right.changed)) return false;
  const paths = new Set([...Object.keys(left.fingerprints), ...Object.keys(right.fingerprints)]);
  return [...paths].every((path) => left.fingerprints[path] === right.fingerprints[path]);
}

async function stableRepositorySnapshot(repo, requiredPaths) {
  for (let attempt = 0; attempt < STABILITY_ATTEMPTS; attempt += 1) {
    const headBefore = git(repo, ["rev-parse", "--verify", "HEAD"]).toString("utf8").trim();
    const before = await stableSnapshot(repo, requiredPaths);
    const headMiddle = git(repo, ["rev-parse", "--verify", "HEAD"]).toString("utf8").trim();
    const after = await stableSnapshot(repo, requiredPaths);
    const headAfter = git(repo, ["rev-parse", "--verify", "HEAD"]).toString("utf8").trim();
    if (headBefore === headMiddle && headMiddle === headAfter && snapshotsEqual(before, after)) {
      return { head: headAfter, snapshot: after };
    }
  }
  throw new Error("repository changed during verification; retry after concurrent writers stop");
}

async function manifestPathOutsideRepo(repo, input) {
  const absolute = resolve(input);
  const canonicalParent = await realpath(dirname(absolute));
  const canonical = join(canonicalParent, basename(absolute));
  const repoRelative = relative(repo, canonical);
  if (repoRelative && repoRelative !== ".." && !repoRelative.startsWith(`..${sep}`) && !isAbsolute(repoRelative)) {
    throw new Error("baseline manifest must be stored outside the repository");
  }
  return canonical;
}

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`invalid baseline manifest field: ${field}`);
  }
  return value;
}

function parseManifest(source) {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("baseline manifest is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid baseline manifest");
  if (value.version !== MANIFEST_VERSION) throw new Error("unsupported baseline manifest version");
  if (typeof value.repo !== "string" || typeof value.head !== "string") throw new Error("invalid baseline manifest identity");
  if (!value.fingerprints || typeof value.fingerprints !== "object" || Array.isArray(value.fingerprints)) {
    throw new Error("invalid baseline manifest fingerprints");
  }
  const expected = assertStringArray(value.expected, "expected");
  const changed = assertStringArray(value.changed, "changed");
  const fingerprints = {};
  for (const [path, hash] of Object.entries(value.fingerprints)) {
    if (typeof hash !== "string") throw new Error(`invalid baseline fingerprint: ${path}`);
    fingerprints[path] = hash;
  }
  return { changed, expected, fingerprints, head: value.head, repo: value.repo, version: value.version };
}

async function capture(options, repo) {
  const expected = [...new Set(options.expected.map((path) => normalizePath(repo, path)))].sort();
  const { head, snapshot } = await stableRepositorySnapshot(repo, expected);
  const manifest = {
    version: MANIFEST_VERSION,
    repo,
    head,
    expected,
    changed: [...snapshot.changed].sort(),
    fingerprints: snapshot.fingerprints,
  };
  const target = await manifestPathOutsideRepo(repo, options.capture);
  const source = `${JSON.stringify(manifest, null, 2)}\n`;
  const seal = createHash("sha256").update(source).digest("hex");
  await writeFile(target, source, { flag: "wx", mode: 0o600 });
  process.stdout.write(`FILE_MUTATION_BASELINE_CAPTURED ${JSON.stringify(target)} ${seal}\n`);
}

async function verify(options, repo) {
  const baselinePath = await manifestPathOutsideRepo(repo, options.baseline);
  const baselineMetadata = await lstat(baselinePath);
  if (baselineMetadata.isSymbolicLink() || !baselineMetadata.isFile()) {
    throw new Error("baseline manifest must be a regular file");
  }
  const source = await readFile(baselinePath, "utf8");
  const actualSeal = createHash("sha256").update(source).digest("hex");
  if (actualSeal !== options.seal) throw new Error("baseline manifest seal does not match");
  const baseline = parseManifest(source);
  if (baseline.repo !== repo) throw new Error("baseline repository does not match the current repository");


  const expected = new Set(baseline.expected.map((path) => normalizePath(repo, path)));
  const baselineChanged = new Set(baseline.changed.map((path) => normalizePath(repo, path)));
  for (const path of [...expected, ...baselineChanged]) {
    if (!baseline.expected.includes(path) && !baseline.changed.includes(path)) {
      throw new Error(`baseline path is not canonical: ${path}`);
    }
    const fingerprint = baseline.fingerprints[path];
    if (!/^[a-f0-9]{64}$/u.test(fingerprint ?? "")) {
      throw new Error(`invalid or missing baseline fingerprint: ${path}`);
    }
  }
  const { head, snapshot } = await stableRepositorySnapshot(repo, new Set([...expected, ...baselineChanged]));
  if (baseline.head !== head) throw new Error("HEAD changed after baseline capture");
  const unexpected = [...snapshot.changed]
    .filter((path) => !expected.has(path) && !baselineChanged.has(path))
    .sort();
  const alteredPreexisting = [...baselineChanged]
    .filter((path) => !expected.has(path) && baseline.fingerprints[path] !== snapshot.fingerprints[path])
    .sort();
  const missing = [...expected]
    .filter((path) => baseline.fingerprints[path] === snapshot.fingerprints[path])
    .sort();

  if (missing.length > 0 || unexpected.length > 0 || alteredPreexisting.length > 0) {
    if (missing.length > 0) process.stderr.write(`FILE_MUTATION_MISSING ${JSON.stringify(missing)}\n`);
    if (unexpected.length > 0) process.stderr.write(`FILE_MUTATION_UNEXPECTED ${JSON.stringify(unexpected)}\n`);
    if (alteredPreexisting.length > 0) {
      process.stderr.write(`FILE_MUTATION_PREEXISTING_CHANGED ${JSON.stringify(alteredPreexisting)}\n`);
    }
    process.exitCode = 1;
    return;
  }

  for (const path of [...expected].sort()) {
    process.stdout.write(`FILE_MUTATION_VERIFIED ${JSON.stringify(path)} ${snapshot.fingerprints[path]}\n`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const repo = await repositoryRoot(options.repo);
  if (options.capture) await capture(options, repo);
  else await verify(options, repo);
}

main().catch((error) => {
  process.stderr.write(`FILE_MUTATION_VERIFIER_ERROR ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
