import { describe, it, expect } from "vitest";
import { personalConstellation } from "./personalConstellation";
import type { ReflectionCard } from "../data/emotions";

const NOW = new Date("2026-06-30T00:00:00.000Z").getTime();

const card = (over: Partial<ReflectionCard>): ReflectionCard => ({
  fragment: "",
  deplacement: "",
  direction: "",
  date: "2026-06-29T00:00:00.000Z",
  ...over,
});

describe("personalConstellation", () => {
  it("vide → cœur par défaut, aucun point", () => {
    const c = personalConstellation([], NOW);
    expect(c.points).toHaveLength(0);
    expect(c.core.dominant).toBeNull();
    expect(c.core.color).toBe("#E8D5B0");
  });

  it("sphère connue → point de bras (pas étoile de fond)", () => {
    const c = personalConstellation(
      [card({ id: "a", sphere: "familiale", prisme: "joie" })],
      NOW,
    );
    expect(c.points[0].isField).toBe(false);
  });

  it("variante de sphère normalisée (Amoureux → Amoureuse)", () => {
    const c = personalConstellation(
      [card({ id: "b", sphere: "Amoureux", prisme: "amour" })],
      NOW,
    );
    expect(c.points[0].isField).toBe(false);
  });

  it("sans sphère → étoile de fond, angle dans [0, 2π)", () => {
    const c = personalConstellation([card({ id: "c", prisme: "peur" })], NOW);
    expect(c.points[0].isField).toBe(true);
    expect(c.points[0].theta).toBeGreaterThanOrEqual(0);
    expect(c.points[0].theta).toBeLessThan(2 * Math.PI);
  });

  it("couleur = prisme || emotion", () => {
    const byPrisme = personalConstellation([card({ id: "d", prisme: "joie" })], NOW);
    const byEmotion = personalConstellation([card({ id: "e", emotion: "joie" })], NOW);
    expect(byPrisme.points[0].color).toBe("#C6AF53");
    expect(byEmotion.points[0].color).toBe("#C6AF53");
  });

  it("récence : ancien = plus loin + plus pâle que récent", () => {
    const recent = card({ id: "r", date: "2026-06-29T00:00:00.000Z", sphere: "sociale" });
    const old = card({ id: "o", date: "2025-01-01T00:00:00.000Z", sphere: "sociale" });
    const c = personalConstellation([recent, old], NOW);
    const [pr, po] = c.points;
    expect(po.r).toBeGreaterThan(pr.r);
    expect(po.alpha).toBeLessThan(pr.alpha);
    expect(po.size).toBeLessThan(pr.size);
  });

  it("déterministe : même id → même angle d'un appel à l'autre", () => {
    const a = personalConstellation([card({ id: "stable", prisme: "joie" })], NOW);
    const b = personalConstellation([card({ id: "stable", prisme: "joie" })], NOW);
    expect(a.points[0].theta).toBe(b.points[0].theta);
  });

  it("rayon borné dans [R0, 1]", () => {
    const c = personalConstellation(
      [card({ id: "x", date: "2010-01-01T00:00:00.000Z" }), card({ id: "y" })],
      NOW,
    );
    for (const p of c.points) {
      expect(p.r).toBeGreaterThanOrEqual(0.14);
      expect(p.r).toBeLessThanOrEqual(1);
    }
  });

  it("diacritiques retirés : prisme accentué → couleur de la clé canonique", () => {
    const cole = personalConstellation([card({ id: "ac1", prisme: "colère" })], NOW);
    const mela = personalConstellation([card({ id: "ac2", prisme: "Mélancolie" })], NOW);
    expect(cole.points[0].color).toBe("#C56459"); // colere
    expect(mela.points[0].color).toBe("#669DC2"); // melancolie
  });
});
