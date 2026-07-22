import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import {
  isAuthenticatedConsoleResponse,
  isSuccessfulConsoleCallbackResponse,
  isValidConsoleLanding,
} from "./lib/zitadel-console-smoke-contract.mjs";

const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const postgres = requireFromDb("postgres");

const webPreviewUrl = process.env.WEB_PREVIEW_URL?.trim().replace(/\/+$/u, "");
const issuer = process.env.ZITADEL_ISSUER?.trim().replace(/\/+$/u, "");
const consoleClientId = process.env.ZITADEL_CONSOLE_CLIENT_ID?.trim();
const bootstrapSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim();
const previewPassword = process.env.ZITADEL_PREVIEW_PASSWORD;
const requireCredentialCallback =
  process.env.ZITADEL_CONSOLE_REQUIRE_CREDENTIAL_CALLBACK === "true";
const apiUrlFile = process.env.API_RUNTIME_DATABASE_URL_FILE?.trim();
if (!webPreviewUrl || !issuer || !consoleClientId || !bootstrapSubject || !apiUrlFile) {
  throw new Error("Console Preview smoke configuration is missing");
}
if (requireCredentialCallback && !previewPassword) {
  throw new Error("Console Preview credential configuration is missing");
}
const webOrigin = new URL(webPreviewUrl).origin;
const issuerUrl = new URL(issuer);
if (issuerUrl.protocol !== "https:" || issuerUrl.origin !== issuer || !/^[A-Za-z0-9_-]{1,200}$/u.test(consoleClientId)) {
  throw new Error("Console Preview smoke configuration is invalid");
}

const apiDatabaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const apiSql = postgres(apiDatabaseUrl, { max: 1, prepare: false });
try {
  const canonical = await apiSql`
    select provider_subject
    from public.auth_resolve_login_identity_v1('previewadmin')
  `;
  const legacy = await apiSql`
    select provider_subject
    from public.auth_resolve_login_identity_v1('preview-admin')
  `;
  if (
    canonical.length !== 1 ||
    canonical[0]?.provider_subject !== bootstrapSubject ||
    legacy.length !== 0
  ) {
    throw new Error("Preview bootstrap login mapping is not canonical");
  }
} finally {
  await apiSql.end({ timeout: 2 });
}

const environmentResponse = await fetch(`${issuer}/ui/console/assets/environment.json`, {
  headers: { accept: "application/json" },
  redirect: "error",
});
if (!environmentResponse.ok) throw new Error("ZITADEL Console environment is unavailable");
const environment = await environmentResponse.json();
if (
  String(environment.issuer ?? "").replace(/\/+$/u, "") !== issuer ||
  String(environment.clientid ?? "") !== consoleClientId
) {
  throw new Error("ZITADEL Console environment does not match Preview configuration");
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${issuer}/ui/console`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForURL((candidate) => {
      if (candidate.origin !== webOrigin || candidate.pathname !== "/login") return false;
      return /^[A-Za-z0-9_-]{1,200}$/u.test(candidate.searchParams.get("authRequest") ?? "") &&
        /^[A-Za-z0-9_-]{43}$/u.test(candidate.searchParams.get("csrf") ?? "") &&
        !candidate.searchParams.has("error");
    }, { timeout: 60_000 });
    await page.locator("#login-name").waitFor({ state: "visible", timeout: 10_000 });
    await page.locator("#login-password").waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    throw new Error("ZITADEL Console did not reach the Preview custom login form");
  }

  const cookies = await context.cookies(webPreviewUrl);
  const browserBindings = cookies.filter((cookie) => cookie.name === "__Host-hotel_oauth_browser");
  if (
    browserBindings.length !== 1 ||
    !browserBindings[0].httpOnly ||
    !browserBindings[0].secure ||
    browserBindings[0].sameSite !== "Lax" ||
    browserBindings[0].domain !== new URL(webPreviewUrl).hostname ||
    browserBindings[0].path !== "/"
  ) {
    throw new Error("Preview Console browser binding cookie contract is invalid");
  }

  if (requireCredentialCallback) {
    try {
      const callbackResponse = page.waitForResponse((response) =>
        isSuccessfulConsoleCallbackResponse({
          issuerOrigin: issuerUrl.origin,
          status: response.status(),
          url: response.url(),
        }),
      { timeout: 60_000 });
      const authenticatedUserResponse = page.waitForResponse((response) =>
        isAuthenticatedConsoleResponse({
          issuerOrigin: issuerUrl.origin,
          status: response.status(),
          url: response.url(),
        }),
      { timeout: 60_000 });
      const authenticatedLanding = page.waitForURL(
        (candidate) => isValidConsoleLanding(candidate.toString(), issuerUrl.origin),
        { timeout: 60_000 },
      );
      await page.locator("#login-name").fill("previewadmin");
      await page.locator("#login-password").fill(previewPassword);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await Promise.all([callbackResponse, authenticatedUserResponse, authenticatedLanding]);
      const consoleIdentityVerified = await page.evaluate(
        ({ expectedAudience, expectedIssuer, expectedSubject }) => {
          for (const storage of [window.sessionStorage, window.localStorage]) {
            const accessToken = storage.getItem("access_token");
            const idToken = storage.getItem("id_token");
            if (!accessToken || !idToken) continue;
            try {
              const encodedPayload = idToken.split(".")[1];
              if (!encodedPayload) continue;
              const padded = encodedPayload.replace(/-/gu, "+").replace(/_/gu, "/")
                .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
              const payload = JSON.parse(window.atob(padded));
              const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
              if (
                payload.iss === expectedIssuer &&
                payload.sub === expectedSubject &&
                audiences.includes(expectedAudience) &&
                typeof payload.exp === "number" &&
                payload.exp * 1000 > Date.now()
              ) return true;
            } catch {
              continue;
            }
          }
          return false;
        },
        {
          expectedAudience: consoleClientId,
          expectedIssuer: issuer,
          expectedSubject: bootstrapSubject,
        },
      );
      if (!consoleIdentityVerified) {
        throw new Error("Preview Console authenticated identity could not be verified");
      }
    } catch {
      throw new Error("Preview Console credential flow did not complete authenticated read-back");
    }
    const terminalCookies = await context.cookies(webPreviewUrl);
    if (terminalCookies.some((cookie) => cookie.name === "__Host-hotel_oauth_browser")) {
      throw new Error("Preview Console browser binding cookie remained after terminal success");
    }
  }
} finally {
  await browser.close();
}

console.log(
  requireCredentialCallback
    ? "ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_CALLBACK_SMOKE_OK"
    : "ZITADEL_CONSOLE_PREVIEW_PREAUTH_SMOKE_OK",
);
