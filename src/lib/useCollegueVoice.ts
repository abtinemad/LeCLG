import { useState, useRef } from "react";
import type { ReflectionCard } from "../data/emotions";
import { CLARTE_LOADING } from "../components/SerpentinGuide";
import { fetchMiroir } from "./carnet-helpers";

// Voix du Collègue posée sur un fragment. Le hook possède l'état d'affichage
// (texte courant), le cache de session des miroirs, et la trace « déjà lu »
// (persistée en localStorage). La persistance DURABLE du miroir SUR la carte
// est déléguée à persistMiroir (injecté) car elle mute les cartes + le cloud.
export function useCollegueVoice(
  persistMiroir: (card: ReflectionCard, text: string) => void,
) {
  // Texte de la voix du Collègue à afficher dans la boîte (null = fermée).
  const [collegueVoice, setCollegueVoice] = useState<string | null>(null);
  // Cache de session des miroirs générés à la demande (réutilisé sans re-render).
  const miroirCache = useRef<Record<string, string>>({});
  // Quels fragments ont eu leur message du Collègue consulté (éteint le brillant).
  const [voiceRead, setVoiceRead] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("collegue_voice_read") || "{}"); } catch { return {}; }
  });

  const markVoiceRead = (key: string) => {
    setVoiceRead((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      try { localStorage.setItem("collegue_voice_read", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Ouvre la voix sur un fragment : miroir déjà stocké/caché s'il existe, sinon
  // génération à la demande via le worker (le supercerveau).
  const openVoice = async (card: ReflectionCard, key: string) => {
    const stored = (card.miroir || "").trim() || miroirCache.current[key];
    if (stored && !stored.startsWith("[")) { setCollegueVoice(stored); markVoiceRead(key); return; }
    setCollegueVoice(CLARTE_LOADING); // CollegueMark qui tourne pendant la génération
    try {
      const text = await fetchMiroir(card);
      if (!text || text.trim().startsWith("[")) { setCollegueVoice(null); return; }
      miroirCache.current[key] = text;
      persistMiroir(card, text); // écrit le miroir SUR la carte (local + Supabase) -> cross-appareil, jamais régénéré
      setCollegueVoice(text);
      markVoiceRead(key); // la carte ne s'éteint qu'une fois le message vraiment affiché
    } catch {
      setCollegueVoice(null); // worker injoignable : on referme, la carte reste brillante (réessayable)
    }
  };

  return { collegueVoice, setCollegueVoice, voiceRead, openVoice };
}
