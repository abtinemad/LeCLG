import { EMOTIONS } from "../data/emotions";

/**
 * Signature personnelle de la comète / sinusoïde.
 *
 * Source UNIQUE de la personnalisation, consommée par les différents serpentins
 * (Chat, Clarté, Prisme) via leurs props existantes — sans fusionner les moteurs
 * de rendu, qui restent volontairement séparés. Chaque personne « porte » ainsi
 * la même comète partout.
 *
 * Deux signaux, depuis les seules cartes de la personne (aucun backend) :
 *  - color     : sa dominante émotionnelle (couleur de repos de la comète) ;
 *  - intensity : sa puissance, qui monte avec le volume de cartes.
 *
 * Principe d'ancrage : tant qu'il y a peu de cartes, on reste sur l'allure de
 * repos actuelle (couleur/puissance par défaut). La signature « se gagne » et
 * dérive lentement dans le temps — discrète, jamais figée.
 */
export interface PersonalSignature {
  /** Couleur de repos de la comète (dominante), ou le défaut tant que peu de cartes. */
  color: string;
  /** Puissance de la comète : du défaut (peu de cartes) vers une plage large. */
  intensity: number;
  /** Clé d'émotion dominante, ou null si pas encore de signal. Utile au câblage. */
  dominant: EmotionKey | null;
}

type EmotionKey = keyof typeof EMOTIONS;

// Allure de repos actuelle, avant toute personnalisation (l'ancre).
const DEFAULT_COLOR = "#E8D5B0";
const DEFAULT_INTENSITY = 0.5;

// En dessous de ce nombre de cartes, la comète reste sur le défaut.
const ANCHOR_CARDS = 3;
// Volume de cartes pour approcher la pleine puissance.
const FULL_AT = 40;
// Plage de puissance : ancrée sur le défaut, monte large.
const MAX_INTENSITY = 2.0;

const VALID = new Set<string>(Object.keys(EMOTIONS));

const norm = (v: string | null | undefined): string =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Type minimal accepté par le calcul : seuls `prisme`, `emotion` et `date` sont
 * lus. Découplé de l'interface `ReflectionCard` exacte pour accepter aussi bien
 * les cartes du Carnet que celles du Chat (dont le type local diffère légèrement).
 */
export interface SignatureCard {
  prisme?: string | null;
  emotion?: string | null;
  date?: string | null;
}

export function personalSignature(cards: SignatureCard[]): PersonalSignature {
  const list = Array.isArray(cards) ? cards : [];
  const n = list.length;

  // Puissance : volume → [DEFAULT, MAX], saturation douce, ancrée à 0 carte utile.
  const t = Math.min(1, Math.max(0, (n - ANCHOR_CARDS) / (FULL_AT - ANCHOR_CARDS)));
  const intensity = DEFAULT_INTENSITY + (MAX_INTENSITY - DEFAULT_INTENSITY) * t;

  // Peu de cartes → on n'invente aucune couleur : allure de repos.
  if (n < ANCHOR_CARDS) {
    return { color: DEFAULT_COLOR, intensity, dominant: null };
  }

  // Récence : les cartes récentes pèsent plus, pour que la dominante évolue
  // dans le temps au lieu de rester figée sur le passé.
  const sorted = [...list].sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );

  const weights: Record<string, number> = {};
  sorted.forEach((card, i) => {
    // Le prisme révèle l'émotion ; à défaut, l'émotion brute de la carte.
    const key = norm(card.prisme || card.emotion);
    if (!key || !VALID.has(key)) return; // on ne compte que ce qui mappe une couleur connue
    const recency = 1 / (1 + i * 0.15); // 1, 0.87, 0.77, … : le récent pèse plus
    weights[key] = (weights[key] || 0) + recency;
  });

  let dominant: EmotionKey | null = null;
  let max = 0;
  for (const k of Object.keys(weights)) {
    if (weights[k] > max) {
      max = weights[k];
      dominant = k as EmotionKey;
    }
  }

  const color = dominant ? EMOTIONS[dominant].color : DEFAULT_COLOR;
  return { color, intensity, dominant };
}
