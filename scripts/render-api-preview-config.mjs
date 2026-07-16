import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: render-api-preview-config <input> <output>");
}

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const hyperdriveId = required("HYPERDRIVE_ID");
const issuer = new URL(required("ZITADEL_ISSUER"));
const redirectUri = new URL(required("ZITADEL_REDIRECT_URI"));
const webPreviewUrl = new URL(required("WEB_PREVIEW_URL"));
if (issuer.protocol !== "https:" || redirectUri.protocol !== "https:") {
  throw new Error("ZITADEL URLs must use HTTPS");
}
if (
  webPreviewUrl.protocol !== "https:" ||
  webPreviewUrl.username ||
  webPreviewUrl.password ||
  webPreviewUrl.pathname !== "/" ||
  webPreviewUrl.search ||
  webPreviewUrl.hash
) {
  throw new Error("WEB_PREVIEW_URL must be an HTTPS origin");
}
const expectedRedirect = new URL(
  "/api/auth/callback",
  webPreviewUrl,
).toString();
if (redirectUri.toString() !== expectedRedirect) {
  throw new Error("ZITADEL_REDIRECT_URI must match the Preview Web callback");
}

const source = await readFile(resolve(inputPath), "utf8");
const config = JSON.parse(source.replace(/,\s*([}\]])/gu, "$1"));
config.hyperdrive = [{ binding: "HYPERDRIVE", id: hyperdriveId }];
config.vars = {
  ...config.vars,
  ZITADEL_ISSUER: issuer.toString().replace(/\/$/u, ""),
  ZITADEL_CLIENT_ID: required("ZITADEL_CLIENT_ID"),
  ZITADEL_REDIRECT_URI: redirectUri.toString(),
};

await writeFile(resolve(outputPath), `${JSON.stringify(config, null, 2)}\n`);
console.log("API_PREVIEW_CONFIG_RENDERED");
