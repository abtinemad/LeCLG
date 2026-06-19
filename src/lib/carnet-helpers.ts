import type { ReflectionCard } from "../data/emotions";
import { EMOTIONS } from "../data/emotions";

export const normalizeSphere = (sphere?: string): string => {
  if (!sphere) return "";
  const s = sphere.trim();
  const lower = s.toLowerCase();
  if (lower === "amoureux" || lower === "amoureuse") return "Amoureuse";
  if (lower === "familial" || lower === "familiale") return "Familiale";
  if (lower === "social" || lower === "sociale") return "Sociale";
  if (lower === "professionnel" || lower === "professionnelle") return "Professionnelle";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const MAX_RETRY = 3;
export const RETRY_DELAYS_MS = [2000, 4000];
export const FAST_RETRY_DELAYS_MS = [500, 1500];

export type FragWeek = { key: string; label: string; items: { card: ReflectionCard; i: number }[] };

export function __isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

export function __mondayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return "Semaine du " + monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function miroirPromptFor(card: ReflectionCard): string {
  return `Voici un fragment déposé dans le Carnet d'une personne :
- Fragment : ${card.fragment}
- Déplacement : ${card.deplacement}
- Direction : ${card.direction}${card.texture_relationnelle ? `\n- Texture : ${card.texture_relationnelle}` : ""}

Écris un court miroir : une pensée que tu poses sur ce fragment, à relire plus tard. Fais surgir une image juste à partir de ces éléments, accueille ce qui s'est déplacé, et termine sur une ouverture — une phrase qui continue de travailler. Ne résume pas, ne donne aucun conseil, ne pose aucune question. Deux à quatre phrases.`;
}

export async function fetchMiroir(card: ReflectionCard): Promise<string> {
  const res = await fetch("/api/worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "chat",
      messages: [{ role: "user", content: miroirPromptFor(card) }],
      max_tokens: 400,
      data: {
        personal_id: localStorage.getItem("collegue_personal_id") || "",
        code: localStorage.getItem("collegue_access_code") || "",
      },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`worker ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        full += parsed.delta?.text || "";
      } catch {}
    }
  }
  return full.trim();
}

export function groupCardsByWeek(cards: ReflectionCard[]): FragWeek[] {
  const map = new Map<string, FragWeek>();
  cards.forEach((card, i) => {
    if (!card || !card.date) return;
    const k = __isoWeekKey(card.date);
    if (!map.has(k)) map.set(k, { key: k, label: __mondayLabel(card.date), items: [] });
    map.get(k)!.items.push({ card, i });
  });
  const arr = Array.from(map.values());
  arr.forEach((w) => w.items.sort((a, b) => new Date(b.card.date).getTime() - new Date(a.card.date).getTime()));
  arr.sort((a, b) => new Date(b.items[0].card.date).getTime() - new Date(a.items[0].card.date).getTime());
  return arr;
}

// --- Thème couleur d'une teinte émotionnelle (roue de Plutchik élargie) ---
// Fonction pure : même entrée -> même sortie. Déplacée depuis Carnet.tsx
// (consommée par LienView via prop getEmotionTheme).
export const getEmotionTheme = (teinte: string): { colorName: string; hex: string; isDefault: boolean } => {
  const t = teinte.toLowerCase();

  // Default theme (Amber/Orange)
  let colorName = "clay";
  let hex = "#C8794F"; // défaut neutre (clay reconcilié)
  let isDefault = true;

  // Plutchik's Wheel Logic
  if (
    t.includes("colère") ||
    t.includes("agacement") ||
    t.includes("fureur") ||
    t.includes("conflit") ||
    t.includes("conflict") ||
    t.includes("explosive") ||
    t.includes("tension") ||
    t.includes("agress")
  ) {
    colorName = "red";
    hex = EMOTIONS.colere.color;
    isDefault = false;
  } else if (
    t.includes("joie") ||
    t.includes("bonheur") ||
    t.includes("enthousiasme") ||
    t.includes("plaisir") ||
    t.includes("chaleur")
  ) {
    colorName = "evolution";
    hex = EMOTIONS.joie.color;
    isDefault = false;
  } else if (
    t.includes("confiance") ||
    t.includes("acceptation") ||
    t.includes("sérénité") ||
    t.includes("calme") ||
    t.includes("sécurité")
  ) {
    colorName = "lime-400";
    hex = EMOTIONS.confiance.color;
    isDefault = false;
  } else if (
    t.includes("peur") ||
    t.includes("appréhension") ||
    t.includes("crainte") ||
    t.includes("anxiété") ||
    t.includes("inquiétude")
  ) {
    colorName = "emerald-600";
    hex = EMOTIONS.peur.color;
    isDefault = false;
  } else if (
    t.includes("surprise") ||
    t.includes("étonnement") ||
    t.includes("imprévu") ||
    t.includes("choc")
  ) {
    colorName = "sky-400";
    hex = EMOTIONS.surprise.color;
    isDefault = false;
  } else if (
    t.includes("tristesse") ||
    t.includes("chagrin") ||
    t.includes("déception") ||
    t.includes("mélancolie") ||
    t.includes("souffrance")
  ) {
    colorName = "blue-500";
    hex = EMOTIONS.tristesse.color;
    isDefault = false;
  } else if (
    t.includes("dégoût") ||
    t.includes("rejet") ||
    t.includes("ennui") ||
    t.includes("amertume") ||
    t.includes("hostilité")
  ) {
    colorName = "purple-500";
    hex = EMOTIONS.degout.color;
    isDefault = false;
  } else if (
    t.includes("anticipation") ||
    t.includes("vigilance") ||
    t.includes("attente") ||
    t.includes("projet") ||
    t.includes("espoir")
  ) {
    colorName = "clay";
    hex = EMOTIONS.anticipation.color;
    isDefault = false;
  } else if (
    t.includes("envie") ||
    t.includes("convoitise")
  ) {
    colorName = "envie";
    hex = EMOTIONS.envie.color;
    isDefault = false;
  } else if (
    t.includes("soulagement") ||
    t.includes("soulagé") ||
    t.includes("apaisement") ||
    t.includes("délivrance")
  ) {
    colorName = "soulagement";
    hex = EMOTIONS.soulagement.color;
    isDefault = false;
  } else if (
    t.includes("gratitude") ||
    t.includes("reconnaissan") ||
    t.includes("merci")
  ) {
    colorName = "gratitude";
    hex = EMOTIONS.gratitude.color;
    isDefault = false;
  } else if (
    t.includes("jalousie") ||
    t.includes("jaloux") ||
    t.includes("jalouse")
  ) {
    colorName = "jalousie";
    hex = EMOTIONS.jalousie.color;
    isDefault = false;
  } else if (
    t.includes("amour") ||
    t.includes("tendresse") ||
    t.includes("affection") ||
    t.includes("aimer")
  ) {
    colorName = "amour";
    hex = EMOTIONS.amour.color;
    isDefault = false;
  } else if (
    t.includes("culpabilit") ||
    t.includes("coupable") ||
    t.includes("remords")
  ) {
    colorName = "culpabilite";
    hex = EMOTIONS.culpabilite.color;
    isDefault = false;
  } else if (
    t.includes("honte") ||
    t.includes("honteu") ||
    t.includes("humiliation") ||
    t.includes("gêne")
  ) {
    colorName = "honte";
    hex = EMOTIONS.honte.color;
    isDefault = false;
  } else if (
    t.includes("mélancol") ||
    t.includes("melancol") ||
    t.includes("nostalgie") ||
    t.includes("spleen")
  ) {
    colorName = "melancolie";
    hex = EMOTIONS.melancolie.color;
    isDefault = false;
  }

  return { colorName, hex, isDefault };
};

// Normalise un prisme (minuscule, sans accent) pour le comparer aux clés de
// EMOTIONS — les cartes stockent "Joie", "Colère", la clé est "joie".
export const prismeKey = (v?: string): string =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
