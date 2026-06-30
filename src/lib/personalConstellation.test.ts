import { describe, it, expect } from "vitest";
import { personalConstellation, constellationRadiance, constellationPrismes, constellationDiversity } from "./personalConstellation";
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

  it("opts.armSigmaRad = 0 → bras sans dispersion (theta = offset + base)", () => {
    const c = personalConstellation(
      [card({ id: "z", sphere: "familiale", prisme: "joie" })],
      NOW,
      { armSigmaRad: 0 },
    );
    // familiale → base 0 ; sans dispersion, theta = ANGLE_OFFSET = π/7.
    expect(c.points[0].theta).toBeCloseTo(Math.PI / 7, 10);
  });

  it("opts.tauDays plus court → même carte plus loin (rayon plus grand)", () => {
    const old = card({ id: "t", date: "2026-05-01T00:00:00.000Z", sphere: "sociale" });
    const slow = personalConstellation([old], NOW, { tauDays: 200 });
    const fast = personalConstellation([old], NOW, { tauDays: 20 });
    expect(fast.points[0].r).toBeGreaterThan(slow.points[0].r);
  });

  it("radiance : vide → 0", () => {
    expect(constellationRadiance([])).toBe(0);
  });

  it("radiance : 1 an régulier (~52 semaines, ~156 cartes) → proche du plein", () => {
    const reg: ReflectionCard[] = [];
    for (let w = 0; w < 52; w++)
      for (let k = 0; k < 3; k++)
        reg.push(card({ id: `r${w}-${k}`, date: new Date(NOW - w * 7 * 86400000 - k * 86400000).toISOString() }));
    expect(constellationRadiance(reg)).toBeGreaterThan(0.9);
  });

  it("radiance : bourrage (156 cartes, 1 semaine) → bridé par la régularité", () => {
    const binge: ReflectionCard[] = [];
    for (let i = 0; i < 156; i++)
      binge.push(card({ id: `b${i}`, date: "2026-06-01T00:00:00.000Z" }));
    expect(constellationRadiance(binge)).toBeLessThan(0.3);
  });

  it("arm : sphère connue → arm = azimut ; inconnue → null (field)", () => {
    const c = personalConstellation([
      card({ id: "s", sphere: "sociale" }),
      card({ id: "f" }),
    ]);
    expect(c.points[0].arm).toBeCloseTo(Math.PI / 2, 10);
    expect(c.points[0].isField).toBe(false);
    expect(c.points[1].arm).toBeNull();
    expect(c.points[1].isField).toBe(true);
  });

  it("prismes : aucun → 0 ; les 16 présents → 16 (état terminal)", () => {
    expect(constellationPrismes([])).toBe(0);
    const keys = [
      "joie", "tristesse", "colere", "peur", "confiance", "degout",
      "anticipation", "surprise", "honte", "melancolie", "envie",
      "soulagement", "gratitude", "jalousie", "amour", "culpabilite",
    ];
    const all = keys.map((p, i) => card({ id: `p${i}`, prisme: p }));
    expect(constellationPrismes(all)).toBe(16);
  });

  it("diversité : une seule sphère → 0 ; 4 équilibrées → 1", () => {
    const mono = [
      card({ id: "m1", sphere: "familiale" }),
      card({ id: "m2", sphere: "familiale" }),
      card({ id: "m3", sphere: "familiale" }),
    ];
    expect(constellationDiversity(mono)).toBeCloseTo(0, 10);
    const balanced = [
      card({ id: "b1", sphere: "familiale" }),
      card({ id: "b2", sphere: "sociale" }),
      card({ id: "b3", sphere: "amoureuse" }),
      card({ id: "b4", sphere: "professionnelle" }),
    ];
    expect(constellationDiversity(balanced)).toBeCloseTo(1, 10);
  });
});
