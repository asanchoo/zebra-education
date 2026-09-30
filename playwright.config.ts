import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ??
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : undefined),
    },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
