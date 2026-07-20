import { chromium } from "@playwright/test";

const webPreviewUrl = process.env.WEB_PREVIEW_URL?.trim().replace(/\/+$/u, "");
const issuer = process.env.ZITADEL_ISSUER?.trim().replace(/\/+$/u, "");
const consoleClientId = process.env.ZITADEL_CONSOLE_CLIENT_ID?.trim();
if (!webPreviewUrl || !issuer || !consoleClientId) {
  throw new Error("Console Preview smoke configuration is missing");
}
const webOrigin = new URL(webPreviewUrl).origin;
const issuerUrl = new URL(issuer);
if (issuerUrl.protocol !== "https:" || issuerUrl.origin !== issuer || !/^[A-Za-z0-9_-]{1,200}$/u.test(consoleClientId)) {
  throw new Error("Console Preview smoke configuration is invalid");
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
} finally {
  await browser.close();
}

console.log("ZITADEL_CONSOLE_PREVIEW_PREAUTH_SMOKE_OK");
