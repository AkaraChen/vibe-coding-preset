import { defineConfig, devices } from "@playwright/test";

const webOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: webOrigin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @workboard/api start",
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgres://workboard:workboard@127.0.0.1:55432/workboard",
      },
      reuseExistingServer: !process.env.CI,
      url: "http://127.0.0.1:3001/health",
    },
    {
      command: process.env.CI
        ? "pnpm --filter @workboard/web start"
        : "pnpm --filter @workboard/web dev",
      reuseExistingServer: !process.env.CI,
      url: "http://127.0.0.1:3000",
    },
  ],
});
