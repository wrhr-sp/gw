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

const apiHyperdriveId = required("API_HYPERDRIVE_ID");
const issuer = new URL(required("ZITADEL_ISSUER"));
const redirectUri = new URL(required("ZITADEL_REDIRECT_URI"));
const webPreviewUrl = new URL(required("WEB_PREVIEW_URL"));
if (
  issuer.protocol !== "https:" || issuer.username || issuer.password ||
  issuer.pathname !== "/" || issuer.search || issuer.hash ||
  redirectUri.protocol !== "https:"
) {
  throw new Error("ZITADEL issuer must be a credential-free HTTPS origin");
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
const clientId = required("ZITADEL_CLIENT_ID");
const consoleClientId = required("ZITADEL_CONSOLE_CLIENT_ID");
const googleCalendarClientId = required("GOOGLE_CALENDAR_OAUTH_CLIENT_ID");
const googleCalendarRedirectUri = new URL(required("GOOGLE_CALENDAR_OAUTH_REDIRECT_URI"));
const calendarAesVersion = required("CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION");
const calendarHmacVersion = required("CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION");
if (!/^[1-9][0-9]*$/u.test(calendarAesVersion) || !/^[1-9][0-9]*$/u.test(calendarHmacVersion)) {
  throw new Error("Calendar key versions must be positive integers");
}
if (googleCalendarRedirectUri.toString() !== new URL("/api/admin/calendar-connections/oauth/callback", webPreviewUrl).toString()) {
  throw new Error("GOOGLE_CALENDAR_OAUTH_REDIRECT_URI must match the Preview Web callback");
}
if (!/^[A-Za-z0-9._-]{10,300}$/u.test(googleCalendarClientId)) {
  throw new Error("GOOGLE_CALENDAR_OAUTH_CLIENT_ID is invalid");
}
if (
  !/^[A-Za-z0-9_-]{1,200}$/u.test(clientId) ||
  !/^[A-Za-z0-9_-]{1,200}$/u.test(consoleClientId) ||
  consoleClientId === clientId
) {
  throw new Error("ZITADEL_CONSOLE_CLIENT_ID must identify the separate built-in Console client");
}

const source = await readFile(resolve(inputPath), "utf8");
const config = JSON.parse(source.replace(/,\s*([}\]])/gu, "$1"));
config.hyperdrive = [
  { binding: "API_HYPERDRIVE", id: apiHyperdriveId },
];
config.vars = {
  ...config.vars,
  ZITADEL_ISSUER: issuer.toString().replace(/\/$/u, ""),
  ZITADEL_CLIENT_ID: clientId,
  ZITADEL_CONSOLE_CLIENT_ID: consoleClientId,
  ZITADEL_ORGANIZATION_ID: required("ZITADEL_ORGANIZATION_ID"),
  ZITADEL_REDIRECT_URI: redirectUri.toString(),
  GOOGLE_CALENDAR_OAUTH_CLIENT_ID: googleCalendarClientId,
  GOOGLE_CALENDAR_OAUTH_REDIRECT_URI: googleCalendarRedirectUri.toString(),
  CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION: calendarAesVersion,
  CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION: calendarHmacVersion,
};

await writeFile(resolve(outputPath), `${JSON.stringify(config, null, 2)}\n`);
console.log("API_PREVIEW_CONFIG_RENDERED");
