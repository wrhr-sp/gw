import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: render-api-production-config <input> <output>");
}

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const apiHyperdriveId = required("API_HYPERDRIVE_ID");
if (!/^[0-9a-f]{32}$/u.test(apiHyperdriveId)) {
  throw new Error("API_HYPERDRIVE_ID must be a 32-character lowercase hexadecimal identifier");
}
const rawOrigin = required("WEB_PRODUCTION_URL");
const productionUrl = new URL(rawOrigin);
if (
  productionUrl.protocol !== "https:" ||
  productionUrl.username ||
  productionUrl.password ||
  productionUrl.pathname !== "/" ||
  productionUrl.search ||
  productionUrl.hash
) {
  throw new Error("WEB_PRODUCTION_URL must be a credential-free HTTPS origin");
}

const source = await readFile(resolve(inputPath), "utf8");
const config = JSON.parse(source.replace(/,\s*([}\]])/gu, "$1"));
config.hyperdrive = [
  { binding: "API_HYPERDRIVE", id: apiHyperdriveId },
];
config.vars = {
  ...config.vars,
  PUBLIC_APP_ORIGIN: productionUrl.origin,
};
await writeFile(resolve(outputPath), `${JSON.stringify(config, null, 2)}\n`);
console.log("API_PRODUCTION_CONFIG_RENDERED");
