import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error Root smoke helper is executable JavaScript outside the TS workspace.
import { CONSOLE_CREDENTIAL_FAILURE_STAGES, consoleCallbackResponseFailureStage, consoleCredentialCompletionFailureStage, consoleCredentialFailureMarker, consoleCredentialFailureStage, consoleCustomLoginResponseFailureStage, isAuthenticatedConsoleResponse, isConsoleCallbackTarget, isSuccessfulConsoleCallbackResponse, isValidConsoleLanding } from "../../../scripts/lib/zitadel-console-smoke-contract.mjs";

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

  it("handles listener rejection before a submit failure without exposing raw diagnostics", () => {
    const rejectionSentinel = "listener-rejection-secret-sentinel";
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      process.on("unhandledRejection", (reason) => console.error(reason.message));
      const listener = new Promise((_, reject) => setTimeout(() => reject(new Error(${JSON.stringify(rejectionSentinel)})), 0));
      Promise.allSettled([listener]);
      setTimeout(() => console.error("ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_SUBMIT"), 20);
    `], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_SUBMIT",
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(rejectionSentinel);
  });

  it("accepts only a successful exact callback response and authenticated Console user response", () => {
    const issuerOrigin = "https://identity.example.test";
    expect(isConsoleCallbackTarget({
      issuerOrigin,
      url: `${issuerOrigin}/ui/console/auth/callback?opaque=redacted`,
    })).toBe(true);
    expect(isConsoleCallbackTarget({
      issuerOrigin,
      url: `${issuerOrigin}/ui/console/auth/callbackevil`,
    })).toBe(false);
    expect(isSuccessfulConsoleCallbackResponse({
      issuerOrigin,
      status: 302,
      url: `${issuerOrigin}/ui/console/auth/callback?code=opaque&state=opaque`,
    })).toBe(true);
    expect(isSuccessfulConsoleCallbackResponse({
      issuerOrigin,
      status: 200,
      url: `${issuerOrigin}/ui/console/auth/callback`,
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
    expect(consoleCallbackResponseFailureStage({
      issuerOrigin,
      status: 500,
      url: `${issuerOrigin}/ui/console/auth/callback`,
    })).toBe("CALLBACK_RESPONSE_STATUS");
    expect(consoleCallbackResponseFailureStage({
      issuerOrigin,
      status: 302,
      url: `${issuerOrigin}/ui/console/auth/callback?error=redacted`,
    })).toBe("CALLBACK_RESPONSE_ERROR");
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

  it("classifies custom login POST redirects without exposing their URL", () => {
    const issuerOrigin = "https://identity.example.test";
    const webOrigin = "https://preview.example.test";
    expect(consoleCustomLoginResponseFailureStage({
      issuerOrigin,
      webOrigin,
      status: 302,
      location: `${issuerOrigin}/ui/console/auth/callback?opaque=redacted`,
    })).toBeNull();
    expect(consoleCustomLoginResponseFailureStage({
      issuerOrigin,
      webOrigin,
      status: 500,
      location: null,
    })).toBe("CUSTOM_LOGIN_RESPONSE_STATUS");
    expect(consoleCustomLoginResponseFailureStage({
      issuerOrigin,
      webOrigin,
      status: 303,
      location: `${webOrigin}/api/auth/custom-login/start?error=invalid-credentials&authRequest=redacted`,
    })).toBe("CUSTOM_LOGIN_REDIRECT_INVALID_CREDENTIALS");
    expect(consoleCustomLoginResponseFailureStage({
      issuerOrigin,
      webOrigin,
      status: 303,
      location: `${webOrigin}/login?error=invalid-flow`,
    })).toBe("CUSTOM_LOGIN_REDIRECT_INVALID_FLOW");
  });

  it("classifies credential completion failures with a fixed secret-safe stage", () => {
    expect(CONSOLE_CREDENTIAL_FAILURE_STAGES).toEqual([
      "SUBMIT",
      "CUSTOM_LOGIN_RESPONSE",
      "CUSTOM_LOGIN_RESPONSE_STATUS",
      "CUSTOM_LOGIN_REDIRECT_INVALID_FLOW",
      "CUSTOM_LOGIN_REDIRECT_INVALID_CREDENTIALS",
      "CUSTOM_LOGIN_REDIRECT_MFA_REQUIRED",
      "CUSTOM_LOGIN_REDIRECT_RATE_LIMITED",
      "CUSTOM_LOGIN_REDIRECT_UNAVAILABLE",
      "CUSTOM_LOGIN_REDIRECT_OTHER",
      "CALLBACK_REQUEST",
      "CALLBACK_RESPONSE",
      "CALLBACK_RESPONSE_STATUS",
      "CALLBACK_RESPONSE_ERROR",
      "AUTHENTICATED_USER_RESPONSE",
      "TERMINAL_LANDING",
      "TOKEN_IDENTITY",
      "COOKIE_CLEANUP",
      "BROWSER_CLOSE",
    ]);
    const successful = {
      callbackStatus: "fulfilled",
      authenticatedUserStatus: "fulfilled",
      landingStatus: "fulfilled",
      identityVerified: true,
      cookieCleared: true,
    } as const;
    expect(consoleCredentialFailureStage(successful)).toBeNull();
    expect(consoleCredentialFailureStage({ ...successful, callbackStatus: "rejected" }))
      .toBe("CALLBACK_RESPONSE");
    expect(consoleCredentialFailureStage({ ...successful, authenticatedUserStatus: "rejected" }))
      .toBe("AUTHENTICATED_USER_RESPONSE");
    expect(consoleCredentialFailureStage({ ...successful, landingStatus: "rejected" }))
      .toBe("TERMINAL_LANDING");
    expect(consoleCredentialFailureStage({ ...successful, identityVerified: false }))
      .toBe("TOKEN_IDENTITY");
    expect(consoleCredentialFailureStage({ ...successful, cookieCleared: false }))
      .toBe("COOKIE_CLEANUP");
    expect(consoleCredentialFailureMarker("CALLBACK_RESPONSE"))
      .toBe("ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_CALLBACK_RESPONSE");
    expect(consoleCredentialFailureMarker("secret-sentinel"))
      .toBe("ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_UNCLASSIFIED");
    const fulfilled = { status: "fulfilled", value: undefined } as const;
    const rejected = { status: "rejected", reason: new Error("listener failed") } as const;
    expect(consoleCredentialCompletionFailureStage([rejected, rejected, rejected, rejected]))
      .toBe("CALLBACK_REQUEST");
    expect(consoleCredentialCompletionFailureStage([fulfilled, rejected, rejected, rejected]))
      .toBe("CALLBACK_RESPONSE");
    expect(consoleCredentialCompletionFailureStage([fulfilled, fulfilled, rejected, rejected]))
      .toBe("AUTHENTICATED_USER_RESPONSE");
  });

  it("keeps cookie cleanup failure fixed and prevents browser close from overwriting it", () => {
    const cookieSentinel = "cookie-cleanup-secret-sentinel";
    const closeSentinel = "browser-close-secret-sentinel";
    const run = (cookieFails: boolean) => spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `
        const marker = (stage) => \`ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_\${stage}\`;
        let failure;
        try {
          if (${cookieFails}) await Promise.reject(new Error(${JSON.stringify(cookieSentinel)}));
        } catch {
          failure = new Error(marker("COOKIE_CLEANUP"));
        } finally {
          try {
            await Promise.reject(new Error(${JSON.stringify(closeSentinel)}));
          } catch {
            if (!failure) failure = new Error(marker("BROWSER_CLOSE"));
          }
        }
        if (failure) console.error(failure.message);
      `],
      { encoding: "utf8" },
    );
    const bothFailed = run(true);
    expect(bothFailed.status).toBe(0);
    expect(`${bothFailed.stdout}${bothFailed.stderr}`).toContain(
      "ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_COOKIE_CLEANUP",
    );
    expect(`${bothFailed.stdout}${bothFailed.stderr}`).not.toContain("BROWSER_CLOSE");
    expect(`${bothFailed.stdout}${bothFailed.stderr}`).not.toContain(cookieSentinel);
    expect(`${bothFailed.stdout}${bothFailed.stderr}`).not.toContain(closeSentinel);
    const closeOnly = run(false);
    expect(closeOnly.status).toBe(0);
    expect(`${closeOnly.stdout}${closeOnly.stderr}`).toContain(
      "ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_FAILED_BROWSER_CLOSE",
    );
    expect(`${closeOnly.stdout}${closeOnly.stderr}`).not.toContain(closeSentinel);
  });

  it("submits the canonical bootstrap credential and proves provider callback completion", () => {
    expect(source).toContain('const previewPassword = process.env.ZITADEL_PREVIEW_PASSWORD');
    expect(source).toContain('page.locator("#login-name").fill("previewadmin")');
    expect(source).toContain('page.locator("#login-password").fill(previewPassword)');
    expect(source).toContain('page.getByRole("button", { name: "로그인", exact: true }).click()');
    expect(source).toContain("consoleCustomLoginResponseFailureStage");
    expect(source).toContain('candidate.pathname === "/api/auth/custom-login"');
    expect(source).toContain('headerValue("location")');
    expect(source).toContain("isConsoleCallbackTarget");
    expect(source).toContain("consoleCallbackResponseFailureStage");
    expect(source).toContain("isAuthenticatedConsoleResponse");
    expect(source).toContain("isValidConsoleLanding");
    expect(source).toContain("page.waitForRequest");
    expect(source).toContain("page.waitForResponse");
    expect(source).toContain("const credentialCompletion = Promise.allSettled([");
    expect(source.indexOf("const credentialCompletion = Promise.allSettled(["))
      .toBeLessThan(source.indexOf('page.locator("#login-name").fill("previewadmin")'));
    expect(source).toContain("consoleCredentialCompletionFailureStage(");
    expect(source).toContain("await credentialCompletion");
    expect(source).toContain("consoleCredentialFailureMarker(credentialFailureStage)");
    expect(source).not.toContain("Preview Console credential flow did not complete authenticated read-back");
    expect(source).toContain('storage.getItem("access_token")');
    expect(source).toContain('storage.getItem("id_token")');
    expect(source).toContain("payload.sub === expectedSubject");
    expect(source).toContain("audiences.includes(expectedAudience)");
    expect(source).toContain('consoleCredentialFailureMarker("COOKIE_CLEANUP")');
    expect(source).toContain('consoleCredentialFailureMarker("BROWSER_CLOSE")');
    expect(source).toContain("if (!browserFlowFailure)");
    expect(source).toContain("if (browserFlowFailure) throw browserFlowFailure;");
    expect(source).toContain("ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_CALLBACK_SMOKE_OK");
    expect(source).toContain("ZITADEL_CONSOLE_PREVIEW_PREAUTH_SMOKE_OK");
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:previewPassword|password)/u);
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:authRequest|csrf|candidate|request\.url)/u);
  });
});
