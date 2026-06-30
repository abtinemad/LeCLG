import { describe, it, expect } from "vitest";
import { densifyFromSeed } from "./galaxySimData";
import { SPHERES } from "../data/emotions";

const NOW = new Date("2026-06-30T00:00:00.000Z").getTime();

describe("densifyFromSeed", () => {
  it("respecte le nombre demandé", () => {
    expect(densifyFromSeed([], { count: 50, spanYears: 3 }, NOW)).toHaveLength(50);
  });

  it("déterministe : mêmes params → même corpus", () => {
    const a = densifyFromSeed([], { count: 30, spanYears: 2 }, NOW);
    const b = densifyFromSeed([], { count: 30, spanYears: 2 }, NOW);
    expect(a).toEqual(b);
  });

  it("peuple les 4 sphères (des bras à former)", () => {
    const out = densifyFromSeed([], { count: 40, spanYears: 3 }, NOW);
    const used = new Set(out.map((c) => c.sphere));
    for (const k of Object.keys(SPHERES)) expect(used.has(k)).toBe(true);
  });

  it("amorce les teintes sur la graine quand présente", () => {
    const seed = [{ prisme: "colere", date: "2026-01-01" }];
    const out = densifyFromSeed(seed, { count: 20, spanYears: 1 }, NOW);
    expect(out.every((c) => c.prisme === "colere")).toBe(true);
  });

  it("dates dans la fenêtre [now - span, now]", () => {
    const span = 2;
    const out = densifyFromSeed([], { count: 30, spanYears: span }, NOW);
    const minT = NOW - span * 365 * 86400000;
    for (const c of out) {
      const t = new Date(c.date as string).getTime();
      expect(t).toBeGreaterThanOrEqual(minT);
      expect(t).toBeLessThanOrEqual(NOW);
    }
  });
});
