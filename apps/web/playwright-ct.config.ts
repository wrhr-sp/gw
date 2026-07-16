import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/experimental-ct-react";

export default defineConfig({
  testDir: "./visual",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 150,
      scale: "css",
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    ctPort: 3100,
    ctViteConfig: {
      css: { postcss: {} },
      publicDir: resolve(process.cwd(), "public"),
    },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
});
