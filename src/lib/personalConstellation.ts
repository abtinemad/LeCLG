import { EMOTIONS } from "../data/emotions";
import { normalizeSphere } from "./carnet-helpers";
import { personalSignature, type PersonalSignature } from "./personalSignature";

/**
 * Constellation personnelle — frère de `personalSignature`, pour la « Galaxie
 * personnelle » (vue contemplative du parcours, ouverte depuis la Matrice).
 *
 * Même donnée que la signature, autre forme : la signature au repos, vue du
 * dessus. La comète-signature occupe le centre (réutilisée telle quelle) ; la
 * constellation est l'ensemble des cartes traversées, placées autour.
 *
 * Géométrie (cf. décisions du chantier) :
 *  - RAYON = ÂGE. Loi exponentielle vers un horizon : r(âge) recalculé à chaque
 *    ouverture → dérive centrifuge même statique, bornée (le vieux s'entasse au
 *    bord, jamais hors-champ), rythme récent préservé (les ~TAU_DAYS derniers
 *    jours occupent le gros de l'espace radial). Rayon interne R0 > 0 : pas de
 *    singularité au centre (sinon tous les points "récents" s'effondrent quel
 *    que soit leur angle — la séparation angulaire tombe à longueur d'arc nulle).
 *  - ANGLE = SPHÈRE (4 bras). Séparabilité des bras : 2σ < 360/N. À N=4,
 *    espacement 90°, donc ±35° de dispersion laisse ~20° de vide entre bras
 *    (spirale lisible). À N=16 ce serait impossible (radar ou bouillie).
 *  - COULEUR = prisme || emotion (cohérent avec la dominante de la signature).
 *  - RÉCENCE = éclat + taille (récent = gros+vif). Redondant avec le rayon À
 *    DESSEIN : déclutter le cœur dense (quelques gros points vifs dominent, la
 *    poussière ancienne recule).
 *  - Cartes SANS sphère connue → étoiles de fond (angle uniforme 0..2π semé),
 *    jamais droppées, jamais rattachées à un bras (« on ne sait pas le où »).
 *  - Placement DÉTERMINISTE (semé par id||date) : le ciel ne se rebat pas, il
 *    s'étend. Aléatoire interdit.
 */

// --- Molettes (réglées à l'œil sur device en Phase 1) ---
export const CONSTELLATION_R0 = 0.14;         // rayon interne normalisé (0..1)
const TAU_DAYS = 75;                          // échelle du « récent », en jours
const ARM_SIGMA_RAD = (35 * Math.PI) / 180;   // demi-largeur de bras (±35°)
const ANGLE_OFFSET = Math.PI / 7;             // décalage global (évite l'alignement sur les axes)
const RECENCY_MIN_ALPHA = 0.18;               // opacité plancher (plus ancien)
const RECENCY_MIN_SIZE = 0.3;                 // taille plancher 0..1 (plus ancien)
const DEFAULT_COLOR = "#E8D5B0";              // ancre beige (cohérent personalSignature)

// --- Rayonnement (XP) : volume × régularité, concave. Galaxie SEULE — n'altère
// pas personalSignature (donc pas la comète du Chat). ---
const RADIANCE_N_FULL = 156; // cartes pour le plein (≈ 1 an à 3/sem)
const RADIANCE_W_FULL = 52; // semaines actives pour le plein (1 an)
const RADIANCE_CONCAVITY = 0.6; // <1 = concave (récompense rapide tôt, plateau tard)
const WEEK_MS = 7 * 86400000;

/**
 * Rayonnement ∈ [0,1] : monte avec le VOLUME (n cartes) ET la RÉGULARITÉ
 * (semaines distinctes d'activité), couplés par un min → ni le bourrage (peu de
 * semaines) ni l'attente (peu de cartes) ne suffisent. Concave (`^concavity`).
 * Indépendant de `now` : XP cumulée, pas activité récente.
 */
export function constellationRadiance(
  cards: ConstellationCard[],
  concavity: number = RADIANCE_CONCAVITY,
): number {
  const list = Array.isArray(cards) ? cards : [];
  const n = list.length;
  if (n === 0) return 0;
  const weeks = new Set<number>();
  for (const c of list) {
    if (!c.date) continue;
    const t = new Date(c.date).getTime();
    if (!Number.isNaN(t)) weeks.add(Math.floor(t / WEEK_MS));
  }
  const xpRaw = Math.min(
    1,
    Math.min(n / RADIANCE_N_FULL, weeks.size / RADIANCE_W_FULL),
  );
  return Math.pow(xpRaw, Math.max(0.05, concavity));
}

// Angle de base par sphère. Les 4 sphères → 4 quartiers. La PALETTE des sphères
// (or/violet/rose/gris) n'entre PAS ici : seule leur POSITION compte ; la
// couleur du point porte l'émotion.
const SPHERE_ANGLE: Record<string, number> = {
  familiale: 0,
  sociale: Math.PI / 2,
  amoureuse: Math.PI,
  professionnelle: (3 * Math.PI) / 2,
};

const EMOTION_KEYS = new Set<string>(Object.keys(EMOTIONS));

// Identique à personalSignature (le `norm` y est privé) : NFD + retrait diacritiques.
const norm = (v: string | null | undefined): string =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Hash déterministe (FNV-1a 32-bit) → [0,1). Stabilise le placement par carte.
function hash01(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function ageDays(date: string | null | undefined, now: number): number {
  if (!date) return 0;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / 86400000);
}

const radiusFor = (age: number, tau: number): number =>
  CONSTELLATION_R0 + (1 - CONSTELLATION_R0) * (1 - Math.exp(-age / tau));

const recencyFor = (age: number, tau: number): number => Math.exp(-age / tau);

function pointColor(prisme?: string | null, emotion?: string | null): string {
  const key = norm(prisme || emotion);
  if (key && EMOTION_KEYS.has(key)) {
    return EMOTIONS[key as keyof typeof EMOTIONS].color;
  }
  return DEFAULT_COLOR;
}

/** Superset minimal de SignatureCard : ajoute id + sphere pour le placement. */
export interface ConstellationCard {
  id?: string | null;
  prisme?: string | null;
  emotion?: string | null;
  sphere?: string | null;
  date?: string | null;
}

export interface ConstellationPoint {
  r: number;        // 0..1 (≥ R0), normalisé — le renderer multiplie par le rayon pixel
  theta: number;    // radians
  color: string;
  size: number;     // 0..1 (récence) — le renderer mappe en pixels
  alpha: number;    // 0..1
  isField: boolean; // true = étoile de fond (sphère inconnue)
}

export interface PersonalConstellation {
  core: PersonalSignature;
  points: ConstellationPoint[];
  /** Rayonnement (XP) ∈ [0,1] : volume × régularité, concave. Pilote le noyau. */
  radiance: number;
}

/** Réglages injectables (simulateur). Défauts = les molettes calées en Phase 1. */
export interface ConstellationOpts {
  /** Demi-largeur de bras en radians (dispersion ±σ). */
  armSigmaRad?: number;
  /** Échelle du « récent » en jours (loi radiale + récence). */
  tauDays?: number;
  /** Concavité de la courbe d'XP (<1 = concave). */
  radianceConcavity?: number;
}

/** Défauts des molettes — pour initialiser les curseurs du simulateur. */
export const CONSTELLATION_DEFAULTS = {
  armSigmaRad: ARM_SIGMA_RAD,
  tauDays: TAU_DAYS,
  radianceConcavity: RADIANCE_CONCAVITY,
} as const;

/**
 * @param now  horloge injectable (tests). Par défaut l'instant courant : l'âge
 *             des cartes croît dans le temps → la galaxie vieillit / dérive.
 * @param opts réglages injectables (simulateur). Omis → comportement identique
 *             (défauts = constantes Phase 1) : strictement non-breaking.
 */
export function personalConstellation(
  cards: ConstellationCard[],
  now: number = Date.now(),
  opts?: ConstellationOpts,
): PersonalConstellation {
  const tau = opts?.tauDays ?? TAU_DAYS;
  const sigma = opts?.armSigmaRad ?? ARM_SIGMA_RAD;
  const list = Array.isArray(cards) ? cards : [];
  const core = personalSignature(list);
  const radiance = constellationRadiance(list, opts?.radianceConcavity);

  const points: ConstellationPoint[] = list.map((card, i) => {
    const seedBase = String(card.id || card.date || i);
    const age = ageDays(card.date, now);
    const rec = recencyFor(age, tau);
    const sphereKey = norm(normalizeSphere(card.sphere || undefined));
    const base = SPHERE_ANGLE[sphereKey]; // number | undefined
    const disp = hash01(seedBase + "t");
    const theta =
      base === undefined
        ? disp * 2 * Math.PI
        : ANGLE_OFFSET + base + (disp * 2 - 1) * sigma;
    return {
      r: radiusFor(age, tau),
      theta,
      color: pointColor(card.prisme, card.emotion),
      size: RECENCY_MIN_SIZE + (1 - RECENCY_MIN_SIZE) * rec,
      alpha: RECENCY_MIN_ALPHA + (1 - RECENCY_MIN_ALPHA) * rec,
      isField: base === undefined,
    };
  });

  return { core, points, radiance };
}
