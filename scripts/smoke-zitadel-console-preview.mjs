import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

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
    let callbackRequestObserved = false;
    const observeCallbackRequest = (request) => {
      const candidate = new URL(request.url());
      if (
        candidate.origin === issuerUrl.origin &&
        candidate.pathname === "/ui/console/auth/callback"
      ) {
        callbackRequestObserved = true;
      }
    };
    page.on("request", observeCallbackRequest);
    try {
      await page.locator("#login-name").fill("previewadmin");
      await page.locator("#login-password").fill(previewPassword);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await page.waitForURL((candidate) =>
        candidate.origin === issuerUrl.origin &&
        candidate.pathname.startsWith("/ui/console") &&
        candidate.pathname !== "/ui/console/auth/callback",
      { timeout: 60_000 });
    } catch {
      throw new Error("Preview Console credential flow did not complete");
    } finally {
      page.off("request", observeCallbackRequest);
    }
    if (!callbackRequestObserved) {
      throw new Error("Console callback request was not observed");
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
