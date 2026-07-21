import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function validateCloudflareHyperdriveList(value) {
  if (
    !isPlainObject(value) ||
    value.success !== true ||
    !Array.isArray(value.result)
  )
    return false;
  if (!isPlainObject(value.result_info)) return false;

  const info = value.result_info;
  if (!isInteger(info.page) || info.page !== 1) return false;
  if (!isInteger(info.per_page) || info.per_page <= 0) return false;
  if (!isInteger(info.count) || info.count < 0) return false;
  if (!isInteger(info.total_count) || info.total_count < 0) return false;
  if (!isInteger(info.total_pages) || info.total_pages !== 1) return false;
  if (info.count !== value.result.length) return false;
  if (info.total_count !== info.count) return false;
  if (info.per_page < info.count) return false;

  const ids = new Set();
  for (const item of value.result) {
    if (!isPlainObject(item)) return false;
    if (typeof item.name !== "string" || item.name.length === 0) return false;
    if (typeof item.id !== "string" || item.id.length === 0 || ids.has(item.id))
      return false;
    ids.add(item.id);
  }
  return true;
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Hyperdrive list response path is required");
  let value;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error("Hyperdrive list response is not valid JSON");
  }
  if (!validateCloudflareHyperdriveList(value)) {
    throw new Error("Hyperdrive list response failed safety validation");
  }
  process.stdout.write("HYPERDRIVE_LIST_VALID\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Hyperdrive validation failed"}\n`,
    );
    process.exitCode = 1;
  });
}
