// Orchestrates the full visual-regression run:
//   1. baseline  -> git worktree of `main`, served by vite, captured
//   2. current   -> the working branch, served by vite, captured
//   3. compare   -> pixel diff + report
//
// Non-destructive: the working branch is never checked out/modified; main is
// read through an isolated, auto-removed git worktree.
//
// Usage:  node visual/run.mjs            (full run)
//         node visual/run.mjs --current  (skip baseline, recapture branch only)
//         node visual/run.mjs --compare  (just re-diff existing captures)
import { spawn, execSync } from "child_process";
import {
  rmSync,
  mkdirSync,
  symlinkSync,
  existsSync,
} from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "__output__");

const BASELINE_REF = process.env.VRT_BASELINE_REF || "main";
const BASE_PORT = Number(process.env.VRT_BASELINE_PORT || 5301);
const CUR_PORT = Number(process.env.VRT_CURRENT_PORT || 5302);

const args = new Set(process.argv.slice(2));
const only = {
  baseline: args.has("--baseline"),
  current: args.has("--current"),
  compare: args.has("--compare"),
};
const runAll = !only.baseline && !only.current && !only.compare;

const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();

function startVite(cwd, port) {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
     "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    { cwd, env: { ...process.env, DISABLE_HMR: "true" }, stdio: "ignore" },
  );
  return child;
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Serveur jamais prêt: ${url}`);
}

function runPlaywright(baseUrl, outSubdir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["playwright", "test", "--config", path.join(__dirname, "playwright.config.ts")],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: {
          ...process.env,
          VRT_BASE_URL: baseUrl,
          VRT_OUT: path.join(OUT, outSubdir),
        },
      },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`playwright exit ${code}`)),
    );
  });
}

async function capture({ cwd, port, outSubdir, label }) {
  rmSync(path.join(OUT, outSubdir), { recursive: true, force: true });
  console.log(`\n▶ ${label} — vite @ :${port} (root: ${path.relative(ROOT, cwd) || "."})`);
  const server = startVite(cwd, port);
  try {
    await waitForServer(`http://127.0.0.1:${port}/`);
    await runPlaywright(`http://127.0.0.1:${port}`, outSubdir);
  } finally {
    server.kill("SIGTERM");
  }
}

async function captureBaseline() {
  const wt = path.join(os.tmpdir(), `leclg-vrt-${BASELINE_REF}-${process.pid}`);
  rmSync(wt, { recursive: true, force: true });
  console.log(`\n▶ baseline — création du worktree git de '${BASELINE_REF}'`);
  sh(`git worktree add --detach "${wt}" ${BASELINE_REF}`, { cwd: ROOT });
  try {
    // Deps are identical across the refactor, so share node_modules.
    const nm = path.join(wt, "node_modules");
    if (!existsSync(nm)) symlinkSync(path.join(ROOT, "node_modules"), nm, "dir");
    await capture({
      cwd: wt,
      port: BASE_PORT,
      outSubdir: "baseline",
      label: `baseline (${BASELINE_REF})`,
    });
  } finally {
    try {
      sh(`git worktree remove --force "${wt}"`, { cwd: ROOT });
    } catch {
      rmSync(wt, { recursive: true, force: true });
    }
  }
}

function compare() {
  console.log("\n▶ compare — diff baseline vs current");
  execSync(`node "${path.join(__dirname, "compare.mjs")}"`, {
    cwd: ROOT,
    stdio: "inherit",
  });
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  if (runAll || only.baseline) await captureBaseline();
  if (runAll || only.current)
    await capture({
      cwd: ROOT,
      port: CUR_PORT,
      outSubdir: "current",
      label: "current (branche)",
    });
  if (runAll || only.compare) compare();
})().catch((err) => {
  console.error("\n✗ Échec:", err.message);
  process.exit(1);
});
