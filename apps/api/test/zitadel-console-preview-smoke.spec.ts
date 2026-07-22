import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error Root smoke helper is executable JavaScript outside the TS workspace.
import { isAuthenticatedConsoleResponse, isSuccessfulConsoleCallbackResponse, isValidConsoleLanding } from "../../../scripts/lib/zitadel-console-smoke-contract.mjs";

const smokeScriptUrl = new URL(
  "../../../scripts/smoke-zitadel-console-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeScriptUrl);
const source = readFileSync(smokeScriptUrl, "utf8");

describe("hosted Preview Console credential smoke", () => {
  it("is valid executable JavaScript", () => {
    expect(() => execFileSync(process.execPath, ["--check", smokePath], {
      stdio: "pipe",
    })).not.toThrow();
  });

  it("never exposes the Preview password through real process output", () => {
    const passwordSentinel = "console-preview-password-secret-sentinel";
    const result = spawnSync(process.execPath, [smokePath], {
      encoding: "utf8",
      env: {
        ...process.env,
        WEB_PREVIEW_URL: "invalid-preview-url",
        ZITADEL_ISSUER: "https://identity.example.test",
        ZITADEL_CONSOLE_CLIENT_ID: "console-client",
        ZITADEL_CONSOLE_REQUIRE_CREDENTIAL_CALLBACK: "true",
        ZITADEL_PREVIEW_SUBJECT: "bootstrap-subject",
        ZITADEL_PREVIEW_PASSWORD: passwordSentinel,
        API_RUNTIME_DATABASE_URL_FILE: "/nonexistent/runtime-url",
      },
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(passwordSentinel);
  });

  it("accepts only a successful exact callback response and authenticated Console user response", () => {
    const issuerOrigin = "https://identity.example.test";
    expect(isSuccessfulConsoleCallbackResponse({
      issuerOrigin,
      status: 302,
      url: `${issuerOrigin}/ui/console/auth/callback?code=opaque&state=opaque`,
    })).toBe(true);
    expect(isSuccessfulConsoleCallbackResponse({
      issuerOrigin,
      status: 500,
      url: `${issuerOrigin}/ui/console/auth/callback?error=denied`,
    })).toBe(false);
    expect(isSuccessfulConsoleCallbackResponse({
      issuerOrigin,
      status: 302,
      url: `${issuerOrigin}/ui/console/auth/callback?error=access_denied&state=opaque`,
    })).toBe(false);
    expect(isAuthenticatedConsoleResponse({
      issuerOrigin,
      status: 200,
      url: `${issuerOrigin}/zitadel.auth.v1.AuthService/GetMyUser`,
    })).toBe(true);
    expect(isAuthenticatedConsoleResponse({
      issuerOrigin,
      status: 401,
      url: `${issuerOrigin}/zitadel.auth.v1.AuthService/GetMyUser`,
    })).toBe(false);
    expect(isAuthenticatedConsoleResponse({
      issuerOrigin,
      status: 200,
      url: `${issuerOrigin}/management/v1/healthz`,
    })).toBe(false);
  });

  it("rejects callback, login, signed-out, error and error-query landing routes", () => {
    const issuerOrigin = "https://identity.example.test";
    expect(isValidConsoleLanding(`${issuerOrigin}/ui/console/`, issuerOrigin)).toBe(true);
    expect(isValidConsoleLanding(`${issuerOrigin}/ui/console/projects`, issuerOrigin)).toBe(true);
    for (const url of [
      `${issuerOrigin}/ui/console/auth/callback`,
      `${issuerOrigin}/ui/console/login`,
      `${issuerOrigin}/ui/console/error`,
      `${issuerOrigin}/ui/console/signedout`,
      `${issuerOrigin}/ui/console/?error=access_denied`,
      `${issuerOrigin}/ui/consoleevil`,
      "https://other.example.test/ui/console/",
    ]) {
      expect(isValidConsoleLanding(url, issuerOrigin)).toBe(false);
    }
  });

  it("submits the canonical bootstrap credential and proves provider callback completion", () => {
    expect(source).toContain('const previewPassword = process.env.ZITADEL_PREVIEW_PASSWORD');
    expect(source).toContain('page.locator("#login-name").fill("previewadmin")');
    expect(source).toContain('page.locator("#login-password").fill(previewPassword)');
    expect(source).toContain('page.getByRole("button", { name: "로그인", exact: true }).click()');
    expect(source).toContain("isSuccessfulConsoleCallbackResponse");
    expect(source).toContain("isAuthenticatedConsoleResponse");
    expect(source).toContain("isValidConsoleLanding");
    expect(source).toContain("page.waitForResponse");
    expect(source).toContain("await Promise.all([callbackResponse, authenticatedUserResponse, authenticatedLanding])");
    expect(source).toContain('storage.getItem("access_token")');
    expect(source).toContain('storage.getItem("id_token")');
    expect(source).toContain("payload.sub === expectedSubject");
    expect(source).toContain("audiences.includes(expectedAudience)");
    expect(source).toContain("Preview Console browser binding cookie remained after terminal success");
    expect(source).toContain("ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_CALLBACK_SMOKE_OK");
    expect(source).toContain("ZITADEL_CONSOLE_PREVIEW_PREAUTH_SMOKE_OK");
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:previewPassword|password)/u);
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:authRequest|csrf|candidate|request\.url)/u);
  });
});
