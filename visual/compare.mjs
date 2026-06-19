// Pixel-diff baseline (main) vs current (branch). Produces one diff PNG per
// screen that differs, plus a console table and a JSON/Markdown report.
//
// Chart-bearing views (recharts ResponsiveContainer) render with a few pixels
// of sub-pixel jitter between independent processes — even same-code-vs-itself.
// To separate that noise from a real refactor regression we:
//   - compare on the common (min) overlap when heights differ by a hair, and
//   - treat a diff ratio at/under VRT_NOISE_RATIO as "within noise".
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "__output__");
const baselineDir = path.join(OUT, "baseline");
const currentDir = path.join(OUT, "current");
const diffDir = path.join(OUT, "diff");
mkdirSync(diffDir, { recursive: true });

// Ratio of differing pixels (over the compared area) at/under which a screen is
// considered visually identical (chart render noise). Default 0.05%.
const NOISE_RATIO = Number(process.env.VRT_NOISE_RATIO || 0.0005);

const pngs = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : [];

const baseFiles = new Set(pngs(baselineDir));
const curFiles = new Set(pngs(currentDir));
const all = [...new Set([...baseFiles, ...curFiles])].sort();

// Extract the top-left w×h RGBA region from a PNG into a fresh buffer.
function crop(png, w, h) {
  if (png.width === w && png.height === h) return png.data;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    png.data.copy(
      out,
      y * w * 4,
      y * png.width * 4,
      y * png.width * 4 + w * 4,
    );
  }
  return out;
}

const results = [];

for (const name of all) {
  const screen = name.replace(/\.png$/, "");
  const inBase = baseFiles.has(name);
  const inCur = curFiles.has(name);

  if (!inBase || !inCur) {
    results.push({
      screen,
      status: "MANQUANT",
      detail: inBase ? "absent du rendu branche" : "absent de la baseline main",
      diffPath: null,
    });
    continue;
  }

  const a = PNG.sync.read(readFileSync(path.join(baselineDir, name)));
  const b = PNG.sync.read(readFileSync(path.join(currentDir, name)));

  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const sizeNote =
    a.width !== b.width || a.height !== b.height
      ? ` · dimensions ${a.width}x${a.height} vs ${b.width}x${b.height}`
      : "";

  const da = crop(a, w, h);
  const db = crop(b, w, h);
  const diff = new PNG({ width: w, height: h });
  const diffPixels = pixelmatch(da, db, diff.data, w, h, {
    threshold: 0.1,
    includeAA: false,
  });

  const area = w * h;
  const ratio = diffPixels / area;
  const pct = (ratio * 100).toFixed(4);

  let status;
  if (diffPixels === 0) status = "IDENTIQUE";
  else if (ratio <= NOISE_RATIO) status = "~IDENTIQUE";
  else status = "DIFFÉRENT";

  let diffPath = null;
  if (diffPixels > 0) {
    diffPath = path.join(diffDir, name);
    writeFileSync(diffPath, PNG.sync.write(diff));
  }

  results.push({
    screen,
    status,
    detail: `${diffPixels} px (${pct}%)${sizeNote}`,
    diffPixels,
    ratio,
    diffPath,
  });
}

// --- Report ---
const pad = (s, n) => String(s).padEnd(n);
console.log("\n  Régression visuelle — main (baseline) vs branche (current)");
console.log(`  Seuil de bruit (charts) : ${(NOISE_RATIO * 100).toFixed(3)}%\n`);
console.log("  " + pad("ÉCRAN", 27) + pad("STATUT", 13) + "DÉTAIL");
console.log("  " + "-".repeat(78));
for (const r of results) {
  console.log("  " + pad(r.screen, 27) + pad(r.status, 13) + r.detail);
}
const identical = results.filter((r) => r.status === "IDENTIQUE").length;
const noise = results.filter((r) => r.status === "~IDENTIQUE").length;
const regressions = results.filter(
  (r) => r.status === "DIFFÉRENT" || r.status === "MANQUANT",
);
console.log("  " + "-".repeat(78));
console.log(
  `  ${results.length} écrans · ${identical} identiques · ${noise} sous le seuil de bruit · ${regressions.length} écart(s) réel(s)\n`,
);
if (results.some((r) => r.diffPath)) {
  console.log("  Images de diff (écrans non strictement identiques) :");
  for (const r of results.filter((x) => x.diffPath)) {
    console.log(
      `   - ${path.relative(process.cwd(), r.diffPath)}  [${r.status}]`,
    );
  }
  console.log("");
}

writeFileSync(
  path.join(OUT, "report.json"),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), noiseRatio: NOISE_RATIO, results },
    null,
    2,
  ),
);

const md = [
  "# Régression visuelle — Carnet (main vs branche)",
  "",
  `Généré le ${new Date().toISOString()}`,
  `Seuil de bruit (charts recharts) : ${(NOISE_RATIO * 100).toFixed(3)} %`,
  "",
  "| Écran | Statut | Détail | Diff |",
  "| --- | --- | --- | --- |",
  ...results.map(
    (r) =>
      `| ${r.screen} | ${r.status} | ${r.detail} | ${
        r.diffPath ? path.relative(OUT, r.diffPath) : "—"
      } |`,
  ),
  "",
].join("\n");
writeFileSync(path.join(OUT, "report.md"), md);

// Exit non-zero only on a real regression, so the harness is CI-usable.
process.exit(regressions.length > 0 ? 1 : 0);
