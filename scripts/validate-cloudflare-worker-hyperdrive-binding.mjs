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

export function validateWorkerHyperdriveBinding(envelope, bindingName) {
  if (
    !isPlainObject(envelope) ||
    envelope.success !== true ||
    !isPlainObject(envelope.result) ||
    !Array.isArray(envelope.result.bindings) ||
    typeof bindingName !== "string" ||
    bindingName.length === 0
  ) {
    throw new Error("Worker settings binding envelope was invalid");
  }

  const matchingName = envelope.result.bindings.filter(
    (binding) => isPlainObject(binding) && binding.name === bindingName,
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
  const [inputPath, bindingName] = process.argv.slice(2);
  if (!inputPath || !bindingName) {
    throw new Error(
      "Usage: validate-cloudflare-worker-hyperdrive-binding.mjs <settings.json> <binding-name>",
    );
  }
  const envelope = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  process.stdout.write(
    `${validateWorkerHyperdriveBinding(envelope, bindingName)}\n`,
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
