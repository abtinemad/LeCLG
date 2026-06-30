import type { ConstellationCard } from "./personalConstellation";
import { SPHERES, EMOTIONS } from "../data/emotions";

// Outil de réglage (dev) — génère un corpus synthétique pour juger σ/τ sur des
// bras que le compte réel n'a pas encore. Amorcé sur les VRAIES cartes en
// LECTURE SEULE (palette de teintes), structure = 4 sphères peuplées.

/** Lit les cartes du visiteur depuis localStorage. LECTURE SEULE — jamais d'écriture. */
export function readSeedCards(): ConstellationCard[] {
  try {
    const raw = localStorage.getItem("collegue_cards");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// PRNG déterministe (mulberry32) — graine fixe → corpus reproductible : bouger
// σ/τ (rendu) ne doit pas rebattre le ciel ; seuls N/étalement le régénèrent.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DensifyParams {
  count: number; // N cartes cible
  spanYears: number; // étalement temporel
}

/**
 * Corpus synthétique densifié depuis la graine (teintes réelles), réparti sur
 * les 4 sphères à des dates étalées → des bras se forment. Déterministe.
 */
export function densifyFromSeed(
  seed: ConstellationCard[],
  params: DensifyParams,
  now: number = Date.now(),
): ConstellationCard[] {
  const rng = mulberry32(0x5eed);
  const sphereKeys = Object.keys(SPHERES); // 4 — clés minuscules
  const emotionKeys = Object.keys(EMOTIONS); // 16

  // Palette = teintes réelles de la personne ; à défaut, toutes les émotions.
  const seedTints = seed
    .map((c) => (c.prisme || c.emotion || "").toString())
    .filter(Boolean);
  const palette = seedTints.length > 0 ? seedTints : emotionKeys;

  const spanMs = params.spanYears * 365 * 86400000;
  const out: ConstellationCard[] = [];
  for (let i = 0; i < params.count; i++) {
    // Date : biais doux vers le récent (on réfléchit plus récemment), rafales.
    const ageMs = rng() * spanMs; // uniforme : usage ~régulier (fréquence ~constante), pas de biais récent
    const date = new Date(now - ageMs).toISOString();
    // Tour de rôle sur les 4 sphères → chaque bras peuplé à plusieurs rayons.
    const sphere = sphereKeys[i % sphereKeys.length];
    // Teinte tirée de la palette (les couleurs réelles de la personne).
    const prisme = palette[Math.floor(rng() * palette.length)];
    out.push({ id: `sim-${i}`, date, sphere, prisme });
  }
  return out;
}
