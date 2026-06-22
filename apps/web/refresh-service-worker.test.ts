import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("refresh service worker", () => {
  it("keeps the service worker as an install/update shell and leaves refresh UI to the app", () => {
    const swSource = readFileSync("public/sw.js", "utf8");
    const shellSource = readFileSync("app/_components/mobile-app-shell.tsx", "utf8");

    expect(swSource).toContain('self.addEventListener("install"');
    expect(swSource).toContain('self.addEventListener("activate"');
    expect(swSource).not.toContain('self.addEventListener("fetch"');
    expect(swSource).not.toContain('GW_REFRESH_BYPASS_HEADER');
    expect(swSource).not.toContain('request.cache === "reload"');
    expect(swSource).not.toContain('document.write');
    expect(swSource).not.toContain('window.location.replace(returnUrl);');

    expect(shellSource).toContain('function handleAppRefreshShortcut(event: KeyboardEvent)');
    expect(shellSource).toContain('router.refresh();');
    expect(shellSource).toContain('function renderAppRefreshOverlay()');
    expect(shellSource).toContain('className="app-refresh-overlay"');
  });

  it("asks the browser to update the active service worker on app start", () => {
    const bootstrapSource = readFileSync("app/_components/pwa-install-bootstrap.tsx", "utf8");

    expect(bootstrapSource).toContain('navigator.serviceWorker');
    expect(bootstrapSource).toContain('.register("/sw.js", { scope: "/" })');
    expect(bootstrapSource).toContain('.then((registration) => registration.update())');
  });
});
