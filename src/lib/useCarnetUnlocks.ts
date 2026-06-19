import { useMemo, useCallback } from "react";
import type { ReflectionCard } from "../data/emotions";

type ViewMode = "fragments" | "lien" | "affect" | "elan" | "matrice";

// Dérivations pures du Carnet : compte de prismes uniques + grilles de
// déverrouillage (sections et blocs). Aucun état propre, aucun effet : ces
// useMemo reproduisent à l'identique ce qui vivait dans Carnet.tsx.
export function useCarnetUnlocks({
  cards,
  sessionsData,
  enrichFragments,
}: {
  cards: ReflectionCard[];
  sessionsData: any[];
  enrichFragments: any;
}) {
  const prismesCount = useMemo(() => {
    const uniquePrismes = new Set(cards.map((c) => c.prisme).filter(Boolean));
    return uniquePrismes.size;
  }, [cards]);

  const unlockedSections = useMemo(() => {
    const now = new Date();
    const firstCardDate =
      cards.length > 0 ? new Date(cards[cards.length - 1].date) : now;
    const diffDays = Math.floor(
      (now.getTime() - firstCardDate.getTime()) / (1000 * 3600 * 24),
    );

    const matriceUnlocked =
      diffDays >= 21 && cards.length >= 5 && prismesCount >= 2;

    return {
      fragments: true,
      lien: true,
      elan: diffDays >= 7 && cards.length >= 3,
      affect: true,
      matrice: matriceUnlocked,
      // Lueurs : la Matrice doit être active, et 30 jours de pratique.
      lueurs: matriceUnlocked && diffDays >= 30,
    };
  }, [cards, prismesCount]);

  const unlockedBlocks = useMemo(() => {
    const now = new Date();
    const firstCardDate = cards.length > 0 ? new Date(cards[cards.length - 1].date) : now;
    const diffDays = Math.floor((now.getTime() - firstCardDate.getTime()) / (1000 * 3600 * 24));
    const uniqueDays = new Set(cards.map(c => new Date(c.date).toDateString())).size;
    const hasSonges = cards.some(c => c.user_note && c.user_note.trim().length > 10);
    const sessionsWithStepsCount = sessionsData.filter(s => s.step_reached !== undefined).length;
    const songesCount = cards.filter(c => c.user_note && c.user_note.trim().length > 10).length;

    return {
      fragments_progression: sessionsWithStepsCount >= 2,
      fragments_relation_prismes: cards.length >= 3 && prismesCount >= 2,
      fragments_resistances: cards.length >= 4 && uniqueDays >= 3,
      fragments_echo: cards.length >= 5,
      fragments_signaux: cards.length >= 5 && !!enrichFragments,
      fragments_sillage: songesCount >= 2 && diffDays >= 7,

      lien_texture: cards.length >= 3 && uniqueDays >= 2,
      lien_correlation: cards.length >= 3 && uniqueDays >= 2 && prismesCount >= 2,
      lien_constellation: cards.length >= 3 && uniqueDays >= 2 && prismesCount >= 3,
      lien_structure: cards.length >= 4 && prismesCount >= 3,
      lien_fragilite: cards.length >= 5 && prismesCount >= 3,

      affect_rythme: true,
      affect_gradients: cards.length >= 5,
      affect_luminescence: cards.length >= 3 && uniqueDays >= 3,
      affect_lecture: prismesCount >= 2,

      elan_clusters: diffDays >= 7 && cards.length >= 3 && prismesCount >= 1,
      elan_mouvement: diffDays >= 7 && cards.length >= 4 && prismesCount >= 1,
      elan_direction: diffDays >= 7 && cards.length >= 5 && prismesCount >= 1,
      elan_question: diffDays >= 7 && cards.length >= 6 && prismesCount >= 1,

      matrice_evolution: true,
      matrice_validation_songes: hasSonges
    };
  }, [cards, prismesCount, sessionsData, enrichFragments]);

  const isNextLocked = useCallback((key: keyof typeof unlockedBlocks, viewMode: ViewMode) => {
    return false;
  }, []);

  return { prismesCount, unlockedSections, unlockedBlocks, isNextLocked };
}
