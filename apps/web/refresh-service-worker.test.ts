import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("refresh service worker", () => {
  it("intercepts browser reload navigations with the refresh page and bypasses its own preload", () => {
    const swSource = readFileSync("public/sw.js", "utf8");
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");

    expect(swSource).toContain('const GW_REFRESH_BYPASS_HEADER = "x-gw-refresh-preload";');
    expect(swSource).toContain('request.mode !== "navigate"');
    expect(swSource).toContain('request.cache === "reload" || request.cache === "no-cache"');
    expect(swSource).toContain('request.headers.get(GW_REFRESH_BYPASS_HEADER) === "1"');
    expect(swSource).toContain('url.pathname === "/refresh"');
    expect(swSource).toContain('createRefreshResponse(event.request.url)');
    expect(swSource).toContain('cache: "reload"');
    expect(swSource).toContain('credentials: "same-origin"');
    expect(swSource).toContain('headers: { [preloadHeaderName]: "1" }');
    expect(swSource).toContain('window.location.replace(returnUrl);');
    expect(swSource).toContain('WE’REHERE');
    expect(swSource).toContain('overflow: hidden');
    expect(swSource).toContain('refresh-logo-letter-wave');
    expect(swSource).not.toContain('<button');

    expect(shellSource).not.toContain('function handleAppRefreshShortcut(event: KeyboardEvent)');
    expect(shellSource).not.toContain('event.key === "F5"');
    expect(shellSource).not.toContain('event.ctrlKey || event.metaKey');
  });

  it("asks the browser to update the active service worker on app start", () => {
    const bootstrapSource = readFileSync("app/_components/pwa-install-bootstrap.tsx", "utf8");

    expect(bootstrapSource).toContain('navigator.serviceWorker');
    expect(bootstrapSource).toContain('.register("/sw.js", { scope: "/" })');
    expect(bootstrapSource).toContain('.then((registration) => registration.update())');
  });
});
