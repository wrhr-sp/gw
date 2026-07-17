#!/usr/bin/env node

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const verifier = resolve(import.meta.dirname, "verify-file-mutations.mjs");
const repo = await mkdtemp(join(tmpdir(), "werehere-mutation-verifier-"));
const manifests = [];
const manifestSeals = new Map();
const externalPaths = [];
let manifestSequence = 0;

function run(command, arguments_, options = {}) {
  return spawnSync(command, arguments_, { cwd: repo, encoding: "utf8", ...options });
}

function git(...arguments_) {
  const result = run("git", arguments_);
  assert.equal(result.status, 0, result.stderr);
}

function nextManifest() {
  manifestSequence += 1;
  const path = `${repo}-baseline-${String(manifestSequence)}.json`;
  manifests.push(path);
  return path;
}

function capture(expected, options = {}) {
  const manifest = nextManifest();
  const arguments_ = [verifier, "--repo", options.repo ?? repo, "--capture", manifest];
  for (const path of expected) arguments_.push("--expect", path);
  const result = run(process.execPath, arguments_, { env: options.env });
  if (result.status === 0) {
    const seal = result.stdout.match(/ ([a-f0-9]{64})\n$/u)?.[1];
    assert.ok(seal, `capture did not return a seal: ${result.stdout}`);
    manifestSeals.set(manifest, seal);
  }
  return { manifest, result };
}

function verify(manifest, options = {}) {
  const seal = options.seal ?? manifestSeals.get(manifest);
  return run(process.execPath, [verifier, "--repo", options.repo ?? repo, "--baseline", manifest, "--seal", seal], {
    env: options.env,
  });
}

async function reset() {
  git("reset", "--hard", "HEAD");
  git("clean", "-fd");
}

try {
  git("init", "--quiet");
  git("config", "user.email", "verifier@example.invalid");
  git("config", "user.name", "Mutation Verifier Test");
  await writeFile(join(repo, "a.txt"), "initial-a\n");
  await writeFile(join(repo, "b.txt"), "initial-b\n");
  await mkdir(join(repo, "sub"));
  await writeFile(join(repo, "sub", "tracked.txt"), "sub\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "initial");

  let baseline = capture(["a.txt"]);
  assert.equal(baseline.result.status, 0, baseline.result.stderr);
  await writeFile(join(repo, "a.txt"), "changed-a\n");
  let result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^FILE_MUTATION_VERIFIED "a\.txt" [a-f0-9]{64}\n$/u);
  await reset();

  const wrapperDirectory = await mkdtemp(join(tmpdir(), "werehere-mutation-git-wrapper-"));
  externalPaths.push(wrapperDirectory);
  const realGit = run("sh", ["-c", "command -v git"]).stdout.trim();
  const gitWrapper = join(wrapperDirectory, "git");
  const raceCounter = join(wrapperDirectory, "counter");
  await writeFile(gitWrapper, [
    "#!/bin/sh",
    'if [ "$1" = "rev-parse" ] && [ "$2" = "--verify" ] && [ "$3" = "HEAD" ]; then',
    '  count="$(cat "$RACE_COUNTER" 2>/dev/null || printf 0)"',
    '  count=$((count + 1))',
    '  printf "%s" "$count" > "$RACE_COUNTER"',
    '  if [ "$count" -eq 2 ]; then printf "raced-a\\n" > "$RACE_TARGET"; fi',
    "fi",
    'exec "$REAL_GIT" "$@"',
    "",
  ].join("\n"));
  await chmod(gitWrapper, 0o755);
  const raceEnvironment = {
    ...process.env,
    PATH: `${wrapperDirectory}:${process.env.PATH ?? ""}`,
    RACE_COUNTER: raceCounter,
    RACE_TARGET: join(repo, "a.txt"),
    REAL_GIT: realGit,
  };
  baseline = capture(["a.txt"], { env: raceEnvironment });
  assert.equal(baseline.result.status, 0, baseline.result.stderr);
  result = verify(baseline.manifest);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FILE_MUTATION_MISSING ["a.txt"]\n');
  await reset();

  baseline = capture(["a.txt"]);
  result = verify(baseline.manifest);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FILE_MUTATION_MISSING ["a.txt"]\n');

  baseline = capture(["new.txt"]);
  await writeFile(join(repo, "new.txt"), "new\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  await reset();

  baseline = capture(["공백 file.txt"]);
  await writeFile(join(repo, "공백 file.txt"), "unicode\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  await reset();

  baseline = capture(["줄\n바꿈.txt"]);
  await writeFile(join(repo, "줄\n바꿈.txt"), "newline\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /FILE_MUTATION_VERIFIED "줄\\n바꿈\.txt"/u);
  await reset();

  baseline = capture(["a.txt"]);
  await writeFile(join(repo, "a.txt"), "changed-a\n");
  await writeFile(join(repo, "b.txt"), "unexpected-b\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FILE_MUTATION_UNEXPECTED ["b.txt"]\n');
  await reset();

  baseline = capture(["a.txt"]);
  await writeFile(join(repo, "b.txt"), "staged-only-b\n");
  git("add", "b.txt");
  await writeFile(join(repo, "b.txt"), "initial-b\n");
  await writeFile(join(repo, "a.txt"), "changed-a\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FILE_MUTATION_UNEXPECTED ["b.txt"]\n');
  await reset();

  await writeFile(join(repo, "b.txt"), "baseline-index-b\n");
  git("add", "b.txt");
  await writeFile(join(repo, "b.txt"), "initial-b\n");
  baseline = capture(["a.txt"]);
  await writeFile(join(repo, "b.txt"), "changed-index-b\n");
  git("add", "b.txt");
  await writeFile(join(repo, "b.txt"), "initial-b\n");
  await writeFile(join(repo, "a.txt"), "changed-a\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FILE_MUTATION_PREEXISTING_CHANGED ["b.txt"]\n');
  await reset();

  await writeFile(join(repo, "b.txt"), "preexisting-b\n");
  baseline = capture(["a.txt"]);
  await writeFile(join(repo, "a.txt"), "changed-a\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  await writeFile(join(repo, "b.txt"), "altered-after-baseline\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'FILE_MUTATION_PREEXISTING_CHANGED ["b.txt"]\n');
  await reset();

  baseline = capture(["a.txt"]);
  await writeFile(join(repo, "a.txt"), "staged-a\n");
  git("add", "a.txt");
  await writeFile(join(repo, "a.txt"), "staged-and-unstaged-a\n");
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  await reset();

  baseline = capture(["a.txt"]);
  await chmod(join(repo, "a.txt"), 0o755);
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  await reset();

  baseline = capture(["a.txt", "renamed.txt"]);
  git("mv", "a.txt", "renamed.txt");
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /FILE_MUTATION_VERIFIED "a\.txt" [a-f0-9]{64}/u);
  assert.match(result.stdout, /FILE_MUTATION_VERIFIED "renamed\.txt" [a-f0-9]{64}/u);
  await reset();

  baseline = capture(["a.txt"]);
  await rm(join(repo, "a.txt"));
  result = verify(baseline.manifest);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^FILE_MUTATION_VERIFIED "a\.txt" [a-f0-9]{64}\n$/u);
  await reset();

  baseline = capture(["link.txt"]);
  await symlink("/etc/passwd", join(repo, "link.txt"));
  result = verify(baseline.manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /symbolic links are not allowed: link\.txt/u);
  await reset();

  const externalDirectory = await mkdtemp(join(tmpdir(), "werehere-mutation-external-"));
  externalPaths.push(externalDirectory);
  await writeFile(join(externalDirectory, "value.txt"), "external\n");
  await symlink(externalDirectory, join(repo, "ancestor-link"));
  git("add", "ancestor-link");
  git("commit", "--quiet", "-m", "tracked symlink ancestor probe");
  baseline = capture(["ancestor-link/value.txt"]);
  assert.equal(baseline.result.status, 2);
  assert.match(baseline.result.stderr, /symbolic link ancestor is not allowed: ancestor-link\/value\.txt/u);
  git("reset", "--hard", "HEAD~1");

  baseline = capture(["directory"]);
  await mkdir(join(repo, "directory"));
  result = verify(baseline.manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /non-regular files are not allowed: directory/u);
  await reset();

  baseline = capture(["sub/tracked.txt"], { repo: join(repo, "sub") });
  await writeFile(join(repo, "sub", "tracked.txt"), "changed-sub\n");
  result = verify(baseline.manifest, { repo: join(repo, "sub") });
  assert.equal(result.status, 0, result.stderr);
  await reset();

  baseline = capture(["a.txt"]);
  await writeFile(join(repo, "b.txt"), "new-commit\n");
  git("add", "b.txt");
  git("commit", "--quiet", "-m", "head changed");
  result = verify(baseline.manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /HEAD changed after baseline capture/u);
  git("reset", "--hard", "HEAD~1");

  baseline = capture(["a.txt"]);
  const damagedManifest = JSON.parse(await readFile(baseline.manifest, "utf8"));
  delete damagedManifest.fingerprints["a.txt"];
  await writeFile(baseline.manifest, `${JSON.stringify(damagedManifest)}\n`);
  result = verify(baseline.manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /baseline manifest seal does not match/u);

  baseline = capture(["a.txt"]);
  await rm(baseline.manifest);
  await symlink("/etc/passwd", baseline.manifest);
  result = verify(baseline.manifest);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /baseline manifest must be a regular file/u);

  const invalidRepo = run(process.execPath, [
    verifier,
    "--repo",
    join(repo, "missing"),
    "--capture",
    nextManifest(),
    "--expect",
    "a.txt",
  ]);
  assert.equal(invalidRepo.status, 2);
  assert.match(invalidRepo.stderr, /ENOENT/u);

  const insideManifest = run(process.execPath, [
    verifier,
    "--repo",
    repo,
    "--capture",
    join(repo, "baseline.json"),
    "--expect",
    "a.txt",
  ]);
  assert.equal(insideManifest.status, 2);
  assert.match(insideManifest.stderr, /baseline manifest must be stored outside the repository/u);

  const manifestParentLink = `${repo}-manifest-parent-link`;
  externalPaths.push(manifestParentLink);
  await symlink(repo, manifestParentLink);
  const linkedParentManifest = run(process.execPath, [
    verifier,
    "--repo",
    repo,
    "--capture",
    join(manifestParentLink, "baseline.json"),
    "--expect",
    "a.txt",
  ]);
  assert.equal(linkedParentManifest.status, 2);
  assert.match(linkedParentManifest.stderr, /baseline manifest must be stored outside the repository/u);

  process.stdout.write("FILE_MUTATION_VERIFIER_TEST_OK\n");
} finally {
  await rm(repo, { force: true, recursive: true });
  for (const manifest of manifests) await rm(manifest, { force: true });
  for (const path of externalPaths) await rm(path, { force: true, recursive: true });
}
