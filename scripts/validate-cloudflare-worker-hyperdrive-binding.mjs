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

export function validateWorkerHyperdriveBinding(envelope, bindingNames) {
  const acceptedNames = Array.isArray(bindingNames)
    ? bindingNames
    : [bindingNames];
  if (
    !isPlainObject(envelope) ||
    envelope.success !== true ||
    !isPlainObject(envelope.result) ||
    !Array.isArray(envelope.result.bindings) ||
    acceptedNames.length === 0 ||
    acceptedNames.some(
      (name) => typeof name !== "string" || name.length === 0,
    ) ||
    new Set(acceptedNames).size !== acceptedNames.length
  ) {
    throw new Error("Worker settings binding envelope was invalid");
  }

  const matchingName = envelope.result.bindings.filter(
    (binding) => isPlainObject(binding) && acceptedNames.includes(binding.name),
  );
  if (matchingName.length !== 1) {
    throw new Error("Worker Hyperdrive binding was unavailable or ambiguous");
  }

  const [binding] = matchingName;
  if (
    binding.type !== "hyperdrive" ||
    typeof binding.id !== "string" ||
    !/^[0-9a-f]{32}$/u.test(binding.id)
  ) {
    throw new Error("Worker Hyperdrive binding identity was invalid");
  }

  return binding.id;
}

async function main() {
  const [inputPath, ...bindingNames] = process.argv.slice(2);
  if (!inputPath || bindingNames.length === 0) {
    throw new Error(
      "Usage: validate-cloudflare-worker-hyperdrive-binding.mjs <settings.json> <binding-name> [binding-alias...]",
    );
  }
  const envelope = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  process.stdout.write(
    `${validateWorkerHyperdriveBinding(envelope, bindingNames)}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write("Worker Hyperdrive binding validation failed.\n");
    process.exitCode = 1;
  });
}
