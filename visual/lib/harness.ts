import type { BrowserContext, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Reusable visual-regression harness.
//
// A "Target" describes one page of the app and the discrete UI states we want
// to photograph. Each state is reached purely by interacting with the rendered
// page (clicks), so the harness never touches application code — it only seeds
// localStorage and blocks the network, then drives the UI.
//
// The Carnet target lives in ../targets/carnet.ts. To cover a future split
// (e.g. Chat.tsx) you add a sibling target file and list it in ../targets.
// ---------------------------------------------------------------------------

export type Screen = {
  /** File-safe id, becomes `<target>-<name>.png`. */
  name: string;
  /** Human description for the report. */
  description: string;
  /**
   * Drive the page from its freshly-loaded default state into the state to
   * photograph (click a nav button, open a modal, …). Omit for the default
   * state (e.g. the shell toolbar / first view).
   */
  action?: (page: Page) => Promise<void>;
  /**
   * Capture only this rectangle instead of the full page. Used for the shell
   * toolbar shot, where we want the chrome (header + nav) and nothing else.
   */
  clip?: { x: number; y: number; width: number; height: number };
};

export type Target = {
  name: string;
  /** SPA route to open, e.g. "/carnet". */
  path: string;
  /**
   * localStorage seed: key -> value. Objects are JSON-stringified; strings are
   * written verbatim. Applied via addInitScript before every navigation.
   */
  seed: Record<string, unknown>;
  /**
   * Keys within `seed` that are cached analysis results. The app treats a
   * result as "fresh" (and so skips the network re-fetch) when its `_n` matches
   * the current card count and `_t` is recent. The harness stamps both at seed
   * time so renders stay static and offline.
   */
  freshKeys?: string[];
  /** Value written to `_n` on every freshKey (typically the number of cards). */
  freshCount?: number;
  /** URL globs to abort, isolating the render from any backend. */
  blockRoutes?: string[];
  /** Resolve once the page is loaded and ready to photograph. */
  ready: (page: Page) => Promise<void>;
  screens: Screen[];
};

// Disable every animation/transition so motion/react entrances, CSS pulses and
// carets can't introduce frame-to-frame noise between runs or versions.
const FREEZE_CSS = `
*,*::before,*::after{
  animation-duration:0s!important;animation-delay:0s!important;
  transition-duration:0s!important;transition-delay:0s!important;
  scroll-behavior:auto!important;caret-color:transparent!important;
}`;

export async function prepareContext(context: BrowserContext, target: Target) {
  // Network isolation: the real dev backend talks to prod Supabase + a
  // Cloudflare worker. We abort all API calls; the Carnet's loadCards() catch
  // falls back entirely to the seeded localStorage, giving a deterministic,
  // offline render.
  for (const glob of target.blockRoutes ?? ["**/api/**"]) {
    await context.route(glob, (route) => route.abort());
  }

  // Seed localStorage + inject the freeze stylesheet on every document.
  await context.addInitScript(
    ({ seed, freshKeys, freshCount, freezeCss }) => {
      try {
        localStorage.clear();
        const now = Date.now();
        for (const [key, raw] of Object.entries(seed)) {
          let value: unknown = raw;
          if (
            value &&
            typeof value === "object" &&
            (freshKeys as string[]).includes(key)
          ) {
            value = { ...(value as object), _n: freshCount, _t: now };
          }
          const str =
            typeof value === "string" ? value : JSON.stringify(value);
          localStorage.setItem(key, str);
        }
      } catch {
        /* private mode / quota — nothing we can do, render will be empty */
      }

      const inject = () => {
        const style = document.createElement("style");
        style.setAttribute("data-vrt-freeze", "");
        style.textContent = freezeCss;
        document.head.appendChild(style);
      };
      if (document.head) inject();
      else document.addEventListener("DOMContentLoaded", inject);
    },
    {
      seed: target.seed,
      freshKeys: target.freshKeys ?? [],
      freshCount: target.freshCount ?? 0,
      freezeCss: FREEZE_CSS,
    },
  );
}

// Navigate to the target's default state and wait until it's stable.
export async function gotoDefault(page: Page, target: Target) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(target.path, { waitUntil: "domcontentloaded" });
  await target.ready(page);
}
