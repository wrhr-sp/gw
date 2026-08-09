import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: render-reconciler-preview-config <input> <output>");
}

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const reconcilerHyperdriveId = required("RECONCILER_HYPERDRIVE_ID");
const issuer = new URL(required("ZITADEL_ISSUER"));
const googleCalendarClientId = required("GOOGLE_CALENDAR_OAUTH_CLIENT_ID");
const calendarAesVersion = required("CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION");
const calendarHmacVersion = required("CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION");
if (!/^[A-Za-z0-9._-]{10,300}$/u.test(googleCalendarClientId) || !/^[1-9][0-9]*$/u.test(calendarAesVersion) || !/^[1-9][0-9]*$/u.test(calendarHmacVersion)) throw new Error("Google Calendar reconciler configuration is invalid");
if (issuer.protocol !== "https:") throw new Error("ZITADEL_ISSUER must use HTTPS");

const source = await readFile(resolve(inputPath), "utf8");
const config = JSON.parse(source.replace(/,\s*([}\]])/gu, "$1"));
config.hyperdrive = [
  { binding: "RECONCILER_HYPERDRIVE", id: reconcilerHyperdriveId },
];
config.vars = {
  ...config.vars,
  ZITADEL_ISSUER: issuer.toString().replace(/\/$/u, ""),
  ZITADEL_ORGANIZATION_ID: required("ZITADEL_ORGANIZATION_ID"),
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID: googleCalendarClientId,
  CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION: calendarAesVersion,
  CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION: calendarHmacVersion,
};

await writeFile(resolve(outputPath), `${JSON.stringify(config, null, 2)}\n`);
console.log("RECONCILER_PREVIEW_CONFIG_RENDERED");
