import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function validateWorkerR2Binding(
  envelope,
  bindingName,
  expectedBucketName,
) {
  if (
    !isPlainObject(envelope) ||
    envelope.success !== true ||
    !isPlainObject(envelope.result) ||
    !Array.isArray(envelope.result.bindings) ||
    typeof bindingName !== "string" ||
    !/^[A-Z][A-Z0-9_]{0,63}$/u.test(bindingName) ||
    typeof expectedBucketName !== "string" ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(expectedBucketName)
  ) {
    throw new Error("Worker R2 binding envelope was invalid");
  }

  const matches = envelope.result.bindings.filter(
    (binding) => isPlainObject(binding) && binding.name === bindingName,
  );
  if (matches.length !== 1) {
    throw new Error("Worker R2 binding was unavailable or ambiguous");
  }
  const [binding] = matches;
  if (
    binding.type !== "r2_bucket" ||
    binding.bucket_name !== expectedBucketName
  ) {
    throw new Error("Worker R2 binding identity was invalid");
  }
  return binding.bucket_name;
}

async function main() {
  const [inputPath, bindingName, expectedBucketName] = process.argv.slice(2);
  if (!inputPath || !bindingName || !expectedBucketName) {
    throw new Error(
      "Usage: validate-cloudflare-worker-r2-binding.mjs <settings.json> <binding-name> <bucket-name>",
    );
  }
  const envelope = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  validateWorkerR2Binding(envelope, bindingName, expectedBucketName);
  process.stdout.write("WORKER_R2_BINDING_VALID\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write("Worker R2 binding validation failed.\n");
    process.exitCode = 1;
  });
}
