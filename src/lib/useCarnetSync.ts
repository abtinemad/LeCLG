import { useEffect } from "react";
import type { ReflectionCard } from "../data/emotions";
import { sbGet, sbInsert, sbUpdate } from "./worker";

// Synchronisation du Carnet global vers Supabase : upsert débouncé (5 s) de
// l'état d'analyse + lueurs + songes + prismes débloqués, et vérification du
// passage permanent en mode « reconnaissance ». Hook à effet de bord pur :
// il ne lit que ce qu'on lui passe et n'expose aucun état.
export function useCarnetSync({
  personalId,
  cards,
  lienData,
  affectData,
  elanDataAnalysis,
  matriceDataAnalysis,
  lueurs,
  sphereSonges,
  carnatCreatedAt,
}: {
  personalId: string;
  cards: ReflectionCard[];
  lienData: any;
  affectData: any;
  elanDataAnalysis: any;
  matriceDataAnalysis: any;
  lueurs: any[];
  sphereSonges: Record<string, string>;
  carnatCreatedAt: string | null;
}) {
  const checkPermanentUnlock = async (
    currentPlan: string | undefined,
    createdAt: string | null,
  ) => {
    if (!personalId || currentPlan === "reconnaissance") return;

    // Condition 1: les 16 Prismes
    const uniquePrismes = new Set(cards.map((c) => c.prisme).filter(Boolean));
    const hasAllPrismes = uniquePrismes.size >= 16;

    // Condition 2: All sections active
    const hasAllSections = !!(
      lienData &&
      affectData &&
      elanDataAnalysis &&
      matriceDataAnalysis
    );

    // Condition 3: One year of practice
    if (!createdAt) return;
    const createdDate = new Date(createdAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const hasOneYear = createdDate <= oneYearAgo;

    if (hasAllPrismes && hasAllSections && hasOneYear) {
      try {
        const existing = await sbGet("carnet", `personal_id=eq.${personalId}`);
        if (existing && existing.length > 0) {
          await sbUpdate("carnet", existing[0].id, { plan: "reconnaissance" });
        }
      } catch (e) {
        console.error("Failed to upgrade to Reconnaissance mode", e);
      }
    }
  };

  const syncCarnet = async () => {
    if (!personalId) return;
    try {
      const existing = await sbGet("carnet", `personal_id=eq.${personalId}`);
      const currentPlan = existing?.[0]?.plan;
      const createdAt = existing?.[0]?.created_at || carnatCreatedAt;

      const payload = {
        personal_id: personalId,
        lien_data: lienData,
        affect_data: affectData,
        elan_data: elanDataAnalysis,
        matrice_data: matriceDataAnalysis,
        lueurs: lueurs,
        songes: sphereSonges,
        prismes_unlocked: Array.from(
          new Set(cards.map((c) => (c as any).prisme).filter(Boolean)),
        ),
        last_sync: new Date().toISOString(),
      };

      if (existing && Array.isArray(existing) && existing.length > 0) {
        await sbUpdate("carnet", existing[0].id, payload);
      } else {
        await sbInsert("carnet", payload);
      }

      // Check for permanent unlock after sync
      checkPermanentUnlock(currentPlan, createdAt);
    } catch (e) {
      console.error("Sync carnet error:", e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (personalId) syncCarnet();
    }, 5000); // 5s debounce
    return () => clearTimeout(timer);
  }, [
    lienData,
    affectData,
    elanDataAnalysis,
    matriceDataAnalysis,
    lueurs,
    sphereSonges,
    cards,
  ]);
}
