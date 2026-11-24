import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const chromium = "/opt/pw-browsers/chromium";
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    // Chromium ignores HTTPS_PROXY; route external hosts (Liveblocks) through the sandbox proxy, keep localhost direct.
    ignoreHTTPSErrors: !!proxy,
    launchOptions: {
      ...(existsSync(chromium) ? { executablePath: chromium } : {}),
      ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
    },
  },
  webServer: {
    command: "pnpm exec next start -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: !process.env.CI,
    env: { E2E_NO_AUTH: "1", CLERK_SECRET_KEY: "sk_test_dummy", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_cGVyZmVjdC1raXdpLTU2NTUuY2xlcmsuYWNjb3VudHMuZGV2JA" },
  },
});
