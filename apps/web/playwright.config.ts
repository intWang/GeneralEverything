import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3020);
const chromeChannel =
  process.platform === "darwin" && existsSync("/Applications/Google Chrome.app")
    ? "chrome"
    : undefined;

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"]],
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next dev -p ${PORT} -H 127.0.0.1`,
    reuseExistingServer: true,
    timeout: 120_000,
    url: `http://127.0.0.1:${PORT}`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromeChannel ? { channel: chromeChannel } : {}),
      },
    },
  ],
});
