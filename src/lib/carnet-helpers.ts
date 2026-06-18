import type { ReflectionCard } from "../data/emotions";

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
