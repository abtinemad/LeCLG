import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PORT = Number(process.env.ENGINE_PORT || 5310);

// Réutilise l'installation Playwright et la façon de servir l'app du harnais
// visuel (Vite hors-ligne, sans secrets) — mais via webServer (un seul serveur
// suffit ici, contrairement au baseline/branche du harnais visuel). On ne touche
// pas à visual/.
export default defineConfig({
  testDir: HERE,
  testMatch: /engine\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}/`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, DISABLE_HMR: "true" },
  },
});
