import { test } from "@playwright/test";
import path from "path";
import { prepareContext, gotoDefault } from "./lib/harness";
import { TARGETS } from "./targets";

// Where to write the PNGs for this run (baseline | current). The orchestrator
// sets VRT_OUT; falling back to a local dir keeps the spec runnable on its own.
const OUT_DIR =
  process.env.VRT_OUT ||
  path.resolve(process.cwd(), "visual/__output__/current");

// One isolated test per screen: fresh context => fresh seed + clean UI state,
// so modal/view interactions never bleed between screenshots.
for (const target of TARGETS) {
  test.describe(target.name, () => {
    for (const screen of target.screens) {
      test(screen.name, async ({ page, context }) => {
        await prepareContext(context, target);
        await gotoDefault(page, target);

        if (screen.action) await screen.action(page);

        const file = path.join(OUT_DIR, `${target.name}-${screen.name}.png`);
        if (screen.clip) {
          await page.screenshot({
            path: file,
            clip: screen.clip,
            animations: "disabled",
            caret: "hide",
          });
        } else {
          await page.screenshot({
            path: file,
            fullPage: true,
            animations: "disabled",
            caret: "hide",
          });
        }
      });
    }
  });
}
