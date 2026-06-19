import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Servers are managed by run.mjs (one for main's baseline, one for the branch),
// so the config has no webServer — it only points at the URL the orchestrator
// passes in. Fixed viewport + scale + reduced motion keep pixels stable.
export default defineConfig({
  testDir: HERE,
  testMatch: /capture\.spec\.ts/,
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: process.env.VRT_BASE_URL || "http://localhost:5302",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  },
});
