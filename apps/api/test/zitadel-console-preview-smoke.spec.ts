import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL(
  "../../../scripts/smoke-zitadel-console-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");

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

  it("submits the canonical bootstrap credential and proves provider callback completion", () => {
    expect(source).toContain('const previewPassword = process.env.ZITADEL_PREVIEW_PASSWORD');
    expect(source).toContain('page.locator("#login-name").fill("previewadmin")');
    expect(source).toContain('page.locator("#login-password").fill(previewPassword)');
    expect(source).toContain('page.getByRole("button", { name: "로그인", exact: true }).click()');
    expect(source).toContain('candidate.pathname === "/ui/console/auth/callback"');
    expect(source).toContain('candidate.pathname.startsWith("/ui/console")');
    expect(source).toContain("Console callback request was not observed");
    expect(source).toContain("Preview Console browser binding cookie remained after terminal success");
    expect(source).toContain("ZITADEL_CONSOLE_PREVIEW_CREDENTIAL_CALLBACK_SMOKE_OK");
    expect(source).toContain("ZITADEL_CONSOLE_PREVIEW_PREAUTH_SMOKE_OK");
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:previewPassword|password)/u);
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:authRequest|csrf|candidate|request\.url)/u);
  });
});
