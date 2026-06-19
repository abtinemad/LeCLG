import { useState } from "react";
import type { ReflectionCard } from "../data/emotions";
import { sbGet, sbInsert, sbUpdate } from "./worker";

// Callbacks fournis À L'APPEL de load() : ils proviennent de hooks construits
// APRÈS useCarnetData (useCarnetAnalyses a besoin de cards/songes/sessions que
// ce hook possède). Les passer au moment de l'appel — et non les capturer —
// résout la dépendance circulaire à la construction.
type LoadDeps = {
  hydrateAnalyses: (c: any) => void;
  setEclatList: (list: any) => void;
};

// État de données du Carnet + opérations qui le mutent ou le synchronisent :
// chargement initial (local puis cloud), note de carte, songe de sphère,
// écriture du miroir sur la carte, push d'une carte vers le cloud.
export function useCarnetData(personalId: string) {
  const [cards, setCards] = useState<ReflectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [sessionsData, setSessionsData] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_sessions") || "[]"),
  );
  const [lueurs, setLueurs] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_lueurs") || "[]"),
  );
  const [sphereSonges, setSphereSonges] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem("collegue_sphere_songes") || "{}"),
  );
  const [carnatCreatedAt, setCarnetCreatedAt] = useState<string | null>(null);

  const syncCardToCloud = async (card: ReflectionCard) => {
    if (!personalId || !card.id) return;
    try {
      const existing = await sbGet("cartes", `id=eq.${card.id}&personal_id=eq.${personalId}`);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        await sbUpdate("cartes", card.id, { ...card, personal_id: personalId });
      } else {
        await sbInsert("cartes", { ...card, personal_id: personalId });
      }
    } catch (e) {
      console.error("Sync card error:", e);
    }
  };

  // Écrit le miroir directement SUR la carte : state + localStorage "collegue_cards"
  // + Supabase (via syncCardToCloud). Au rechargement (n'importe quel appareil),
  // load ramène card.miroir -> openVoice prend le chemin "stored" -> 0 appel worker.
  const persistMiroir = (card: ReflectionCard, text: string) => {
    setCards((prev) => {
      const next = prev.map((c) =>
        (card.id ? c.id === card.id : c === card) ? { ...c, miroir: text } : c,
      );
      try { localStorage.setItem("collegue_cards", JSON.stringify(next)); } catch {}
      if (card.id) {
        const updated = next.find((c) => c.id === card.id);
        if (updated) syncCardToCloud(updated);
      }
      return next;
    });
  };

  const updateCardNote = (index: number, note: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], user_note: note };
    setCards(newCards);
    localStorage.setItem("collegue_cards", JSON.stringify(newCards));
    syncCardToCloud(newCards[index]);
  };

  const updateSphereSonge = (sphere: string, text: string) => {
    const newSonges = { ...sphereSonges, [sphere]: text };
    setSphereSonges(newSonges);
    localStorage.setItem("collegue_sphere_songes", JSON.stringify(newSonges));
  };

  const load = async ({ hydrateAnalyses, setEclatList }: LoadDeps) => {
    setLoading(true);
    let allCards: ReflectionCard[] = [];

    // Load Local
    const local = JSON.parse(localStorage.getItem("collegue_cards") || "[]");

    // Load Cloud
    if (personalId) {
      try {
        // Load global carnet state first
        const cloudCarnet = await sbGet(
          "carnet",
          `personal_id=eq.${personalId}`,
        );
        if (
          cloudCarnet &&
          Array.isArray(cloudCarnet) &&
          cloudCarnet.length > 0
        ) {
          const c = cloudCarnet[0];
          setCarnetCreatedAt(c.created_at);
          setCurrentPlan(c.plan);
          hydrateAnalyses(c);
          if (c.lueurs) setLueurs(c.lueurs);
          if (c.songes) setSphereSonges(c.songes);
          else if (c.annotations) setSphereSonges(c.annotations);
        }

        // Load sessions for step_reached
        const cloudSessions = await sbGet(
          "sessions",
          `personal_id=eq.${personalId}&order=started_at.asc`,
        );
        if (cloudSessions && Array.isArray(cloudSessions)) {
          setSessionsData(cloudSessions);
          localStorage.setItem("collegue_sessions", JSON.stringify(cloudSessions));
        }

        // Load cards
        const cloudCards = await sbGet(
          "cartes",
          `personal_id=eq.${personalId}&order=date.desc`,
        );
        if (cloudCards && Array.isArray(cloudCards) && cloudCards.length > 0) {
          allCards = cloudCards;
        } else {
          allCards = local;
        }

        // Éclats répondus — le retour humain à une demande d'Éclat.
        // answered_at non nul = répondu. On récupère tous les Éclats répondus,
        // du plus récent au plus ancien : ils s'empilent dans le Carnet.
        const cloudEclats = await sbGet(
          "eclats",
          `personal_id=eq.${personalId}&answered_at=not.is.null&order=answered_at.desc`,
        );
        if (cloudEclats && Array.isArray(cloudEclats)) {
          const answered = cloudEclats
            .filter((e: any) => e.response_text)
            .map((e: any) => ({
              id: e.id,
              request_text: e.request_text,
              response_text: e.response_text,
              answered_at: e.answered_at,
              replies: Array.isArray(e.replies) ? e.replies : [],
              replies_closed: e.replies_closed === true,
            }));
          setEclatList(answered);
          localStorage.setItem("collegue_eclats", JSON.stringify(answered));
        }
      } catch (e) {
        console.error("Cloud load failed", e);
        allCards = local;
      }
    } else {
      allCards = local;
    }

    // Ensure IDs exist for local compatibility
    const cardsWithIds = allCards.map((c: any, index: number) => ({
      ...c,
      id:
        c.id ||
        (c.date ? `local-${new Date(c.date).getTime()}-${index}` : crypto.randomUUID()),
    }));

    setCards(
      cardsWithIds.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    );

    // Réaligne le cache local sur ce qu'on vient de charger (cloud inclus).
    // Climat lit `collegue_cards` en direct (zéro API pour l'effet de
    // décryptage) ; sans ça, sur un nouvel appareil les prismes pourtant
    // débloqués côté cloud restaient invisibles au radar.
    try {
      localStorage.setItem("collegue_cards", JSON.stringify(cardsWithIds));
    } catch {}

    setLoading(false);
  };

  return {
    cards,
    setCards,
    loading,
    currentPlan,
    sessionsData,
    lueurs,
    setLueurs,
    sphereSonges,
    carnatCreatedAt,
    persistMiroir,
    updateCardNote,
    updateSphereSonge,
    load,
  };
}
