import { useState, useEffect, useRef, useMemo } from "react";
import type { ReflectionCard } from "../data/emotions";
import {
  MAX_RETRY,
  RETRY_DELAYS_MS,
  FAST_RETRY_DELAYS_MS,
} from "./carnet-helpers";

interface UseCarnetAnalysesArgs {
  cards: ReflectionCard[];
  sphereSonges: Record<string, string>;
  sessionsData: any[];
  view: string;
  setLueurs: (l: any[]) => void;
}

// Moteur d'analyses Gemini du Carnet : chaine lien -> affect -> elan -> matrice
// (+ network, enrichissements, metacognition), avec retry borne et etats
// d'erreur visibles. Les etats sont possedes ici ; loadCards (qui possede cards)
// hydrate les 4 analyses cloud via hydrateAnalyses. prismesCount /
// unlockedSections sont recalcules en interne (fonctions pures de cards) pour le
// gating de la chaine ; le composant garde ses propres memos pour son JSX.
export function useCarnetAnalyses({
  cards,
  sphereSonges,
  sessionsData,
  view,
  setLueurs,
}: UseCarnetAnalysesArgs) {
  const [metacognitionData, setMetacognitionData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_metacognition") || "null"),
  );
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [networkData, setNetworkData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_network") || "null"),
  );
  const [lienData, setLienData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_lien") || "null"),
  );
  const [affectData, setAffectData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_affect") || "null"),
  );
  const [elanDataAnalysis, setElanDataAnalysis] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_elan_eval") || "null"),
  );
  const [matriceDataAnalysis, setMatriceDataAnalysis] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_matrice_eval") || "null"),
  );
  const [enrichFragments, setEnrichFragments] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_enrich_fragments") || "null"),
  );
  const [enrichLien, setEnrichLien] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_enrich_lien") || "null"),
  );
  const [enrichAffect, setEnrichAffect] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_enrich_affect") || "null"),
  );
  const [enrichElan, setEnrichElan] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_enrich_elan") || "null"),
  );
  const [enrichMatrice, setEnrichMatrice] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_enrich_matrice") || "null"),
  );

  const runningFor = useRef<Record<string, boolean>>({});
  const attemptsRef = useRef<Record<string, number>>({});
  const retryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, boolean>>(
    {},
  );
  const [retryTick, setRetryTick] = useState(0);

  const retryAnalysis = (key: string) => {
    attemptsRef.current[key] = 0;
    setAnalysisErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRetryTick((t) => t + 1);
  };

  // Hydrate les 4 analyses depuis la ligne carnet cloud (appelee par loadCards).
  const hydrateAnalyses = (c: any) => {
    if (c.lien_data) setLienData(c.lien_data);
    if (c.affect_data) setAffectData(c.affect_data);
    if (c.elan_data) setElanDataAnalysis(c.elan_data);
    if (c.matrice_data) setMatriceDataAnalysis(c.matrice_data);
  };

  // Gating interne (copie pure des memos du composant, fonctions de cards).
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
      lueurs: matriceUnlocked && diffDays >= 30,
    };
  }, [cards, prismesCount]);

  const loadMetacognition = async () => {
    if (cards.length < 5) return;
    // À jour si la métacognition a été recalculée il y a moins de 21 jours.
    if (
      metacognitionData &&
      typeof metacognitionData._t === "number" &&
      Date.now() - metacognitionData._t < 21 * 86400000
    ) {
      return;
    }
    if (runningFor.current["metacognition"]) return; // déjà en cours
    runningFor.current["metacognition"] = true;
    setLoadingMeta(true);
    try {
      const res = await fetch("/api/metacognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessions: cards,
          lien: lienData,
          affect: affectData,
          elan: elanDataAnalysis,
          songes: sphereSonges,
          structure_invisible: lienData?.relief,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        data._t = Date.now();
        setMetacognitionData(data);
        localStorage.setItem("collegue_metacognition", JSON.stringify(data));
      }
    } catch (e) {
      console.error("Metacognition error:", e);
    } finally {
      setLoadingMeta(false);
      runningFor.current["metacognition"] = false;
    }
  };

  useEffect(() => {
    if (view === "matrice") {
      loadMetacognition();
    }
  }, [view, cards]);

  // Nettoie les relances en attente au démontage — évite un setRetryTick
  // sur un composant qui n'existe plus.
  useEffect(() => {
    return () => {
      Object.values(retryTimers.current).forEach((id) => clearTimeout(id as any));
    };
  }, []);

  const runAnalysis = async (type: string, data: any) => {
    try {
      const res = await fetch("/api/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      if (res.ok) return await res.json();
      // Échec serveur : on remonte le TYPE d'échec pour calibrer la relance.
      // 429 = vrai rate-limit (backoff long) ; tout le reste (5xx, etc.) =
      // transitoire (relance rapide).
      return { __failed: res.status === 429 ? "rate_limit" : "transient" };
    } catch (e) {
      // Panne réseau, ou JSON vide/malformé sur un 200 (res.json() lève) :
      // transitoire, une re-requête rapide a de bonnes chances de passer.
      console.error(`${type} analysis error:`, e);
      return { __failed: "transient" };
    }
  };

  useEffect(() => {
    if (cards.length === 0) return;
    const n = cards.length;

    // --- Tests "à jour" ---
    // Par fragment : le résultat a été calculé pour le nombre actuel de cartes.
    const freshByCount = (r: any) => !!r && r._n === n;
    // Par temps : le résultat a été calculé il y a moins de `days` jours.
    const freshByAge = (days: number) => (r: any) =>
      !!r && typeof r._t === "number" && Date.now() - r._t < days * 86400000;
    const elanFresh = freshByAge(7); // Élan : 1x / semaine
    const matriceFresh = freshByAge(21); // Matrice : 1x / 21 jours

    // Lance une analyse UNIQUEMENT si son résultat n'est pas à jour et qu'aucun
    // calcul n'est déjà en cours. Estampille le résultat (_n et _t), le met en
    // état et en cache.
    const refresh = (
      key: string,
      current: any,
      isFresh: (r: any) => boolean,
      type: string,
      payload: any,
      setResult: (d: any) => void,
      lsKey: string,
      after?: (d: any) => void,
    ) => {
      if (isFresh(current)) return; // déjà à jour
      if (runningFor.current[key]) return; // déjà en cours
      runningFor.current[key] = true;
      runAnalysis(type, payload).then((data) => {
        runningFor.current[key] = false;
        if (data && !data.__failed) {
          // Succès : on estampille, on stocke — et on efface toute trace
          // d'échec (compteur de tentatives remis à zéro, erreur levée si
          // elle était posée). Sans ça, le message resterait collé alors
          // que l'analyse est finalement passée.
          data._n = n;
          data._t = Date.now();
          setResult(data);
          localStorage.setItem(lsKey, JSON.stringify(data));
          attemptsRef.current[key] = 0;
          setAnalysisErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          });
          if (after) after(data);
        } else {
          // Échec explicite : runAnalysis renvoie null pour un échec réseau,
          // un res.ok faux, ou un 200 au JSON vide/malformé. On le traite
          // comme un événement, plus comme un non-événement silencieux.
          const tries = (attemptsRef.current[key] || 0) + 1;
          attemptsRef.current[key] = tries;
          if (tries < MAX_RETRY) {
            // Sous le plafond : on planifie UNE relance espacée. Le useEffect
            // ne se relançant pas seul, le setTimeout bump retryTick — ajouté
            // à ses deps — ce qui le relance et fait re-tenter ce maillon.
            // Le délai dépend du type d'échec : rapide pour un transitoire,
            // long pour un vrai rate-limit (429).
            const kind = (data && data.__failed) || "transient";
            const schedule =
              kind === "rate_limit" ? RETRY_DELAYS_MS : FAST_RETRY_DELAYS_MS;
            if (retryTimers.current[key]) clearTimeout(retryTimers.current[key]);
            const delay = schedule[tries - 1] ?? schedule[schedule.length - 1];
            retryTimers.current[key] = setTimeout(() => {
              delete retryTimers.current[key];
              setRetryTick((t) => t + 1);
            }, delay);
          } else {
            // Plafond atteint : on pose un état d'erreur visible pour la
            // section. Plus de relance automatique — la main repasse à
            // l'utilisateur via le bouton « Réessayer ».
            setAnalysisErrors((prev) =>
              prev[key] ? prev : { ...prev, [key]: true },
            );
          }
        }
      });
    };

    // --- Chaîne principale : lien -> affect -> elan -> matrice ---
    // Chaque maillon attend que son parent soit à jour (ou non concerné).

    // Lien — par fragment
    if (unlockedSections.lien) {
      refresh(
        "lien",
        lienData,
        freshByCount,
        "eval_lien",
        { cards },
        setLienData,
        "collegue_lien",
      );
    }

    // Affect — par fragment
    if (unlockedSections.affect && (!unlockedSections.lien || freshByCount(lienData))) {
      refresh(
        "affect",
        affectData,
        freshByCount,
        "eval_affect",
        {
          fragments: cards,
          lien: lienData,
          prismes: cards.map((c) => c.prisme).filter(Boolean),
          songes: sphereSonges,
          structure_invisible: lienData?.relief,
          triplets_texture: cards.map((c) => {
            const s = sessionsData.find(
              (sess) =>
                sess.reflection_card?.id === c.id ||
                sess.reflection_card?.date === c.date,
            );
            return {
              texture: c.texture_relationnelle,
              prisme: c.prisme,
              sphere: c.sphere,
              step: s?.step_reached,
            };
          }),
        },
        setAffectData,
        "collegue_affect",
      );
    }

    // Élan — 1x / semaine
    if (
      unlockedSections.elan &&
      (!unlockedSections.affect || freshByCount(affectData))
    ) {
      refresh(
        "elan",
        elanDataAnalysis,
        elanFresh,
        "eval_elan",
        {
          fragments: cards,
          lien: lienData,
          affect: affectData,
          prismes: cards.map((c) => c.prisme).filter(Boolean),
          songes: sphereSonges,
          structure_invisible: lienData?.relief,
        },
        setElanDataAnalysis,
        "collegue_elan_eval",
      );
    }

    // Matrice — 1x / 21 jours
    if (
      unlockedSections.matrice &&
      (!unlockedSections.elan || elanFresh(elanDataAnalysis))
    ) {
      refresh(
        "matrice",
        matriceDataAnalysis,
        matriceFresh,
        "eval_matrice",
        {
          fragments: cards,
          lien: lienData,
          affect: affectData,
          elan: elanDataAnalysis,
          question_elan: elanDataAnalysis?.question,
          prismes: cards.map((c) => c.prisme).filter(Boolean),
          songes: sphereSonges,
          structure_invisible: lienData?.relief,
        },
        setMatriceDataAnalysis,
        "collegue_matrice_eval",
        (data) => {
          // Lueur du mois — générée si la section Lueurs est débloquée
          // (Matrice active + 30 jours) et qu'aucune lueur n'existe encore
          // pour le mois en cours.
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
          const existingLueurs = JSON.parse(
            localStorage.getItem("collegue_lueurs") || "[]",
          );
          const hasCurrentMonthLueur = existingLueurs.some((l: any) => {
            const d = new Date(l.date);
            return `${d.getFullYear()}-${d.getMonth()}` === currentMonth;
          });
          if (unlockedSections.lueurs && !hasCurrentMonthLueur) {
            runAnalysis("eval_lueur", {
              matrice: data,
              lien: lienData,
              affect: affectData,
              elan: elanDataAnalysis,
              fragments: cards,
              songes: sphereSonges,
            }).then((lData) => {
              if (lData && lData.title && lData.text) {
                const newLueur = {
                  ...lData,
                  date: new Date().toISOString(),
                  context: {
                    songes: sphereSonges,
                    fragments: cards,
                    prismes: cards
                      .map((c) => (c as any).prisme)
                      .filter(Boolean),
                    elan: elanDataAnalysis,
                    affect: affectData,
                    matrice: data,
                  },
                };
                const newLueurs = [newLueur, ...existingLueurs];
                setLueurs(newLueurs);
                localStorage.setItem(
                  "collegue_lueurs",
                  JSON.stringify(newLueurs),
                );
              }
            });
          }
        },
      );
    }

    // --- Analyses secondaires ---

    // Réseau — par fragment
    if (cards.length >= 5) {
      refresh(
        "network",
        networkData,
        freshByCount,
        "eval_network",
        { cards },
        setNetworkData,
        "collegue_network",
      );
    }

    // Enrichissement des fragments — par fragment
    const hasAnySonge = cards.some(
      (c) => c.user_note && c.user_note.trim().length > 10,
    );
    if (cards.length >= 3 && hasAnySonge) {
      refresh(
        "enrich_fragments",
        enrichFragments,
        freshByCount,
        "enrich_fragments",
        {
          cards,
          couples_fragment_songe: cards
            .filter((c) => c.user_note)
            .map((c) => ({
              id: c.id,
              fragment: c.fragment,
              songe: c.user_note,
            })),
        },
        setEnrichFragments,
        "collegue_enrich_fragments",
      );
    }

    // Enrichissements — chacun attend que son analyse parente soit à jour,
    // et suit son rythme (par fragment pour lien/affect, par temps pour
    // elan/matrice).
    if (unlockedSections.lien && freshByCount(lienData)) {
      refresh(
        "enrich_lien",
        enrichLien,
        freshByCount,
        "enrich_lien",
        { cards, lienData },
        setEnrichLien,
        "collegue_enrich_lien",
      );
    }
    if (unlockedSections.affect && freshByCount(affectData)) {
      refresh(
        "enrich_affect",
        enrichAffect,
        freshByCount,
        "enrich_affect",
        { cards },
        setEnrichAffect,
        "collegue_enrich_affect",
      );
    }
    if (unlockedSections.elan && elanFresh(elanDataAnalysis)) {
      refresh(
        "enrich_elan",
        enrichElan,
        elanFresh,
        "enrich_elan",
        { cards },
        setEnrichElan,
        "collegue_enrich_elan",
      );
    }
    if (unlockedSections.matrice && matriceFresh(matriceDataAnalysis)) {
      refresh(
        "enrich_matrice",
        enrichMatrice,
        matriceFresh,
        "enrich_matrice",
        { cards, matrice: matriceDataAnalysis },
        setEnrichMatrice,
        "collegue_enrich_matrice",
      );
    }
  }, [
    cards,
    unlockedSections,
    lienData,
    affectData,
    elanDataAnalysis,
    matriceDataAnalysis,
    retryTick,
  ]);

  return {
    metacognitionData,
    loadingMeta,
    networkData,
    lienData,
    affectData,
    elanDataAnalysis,
    matriceDataAnalysis,
    enrichFragments,
    enrichLien,
    enrichAffect,
    enrichElan,
    enrichMatrice,
    analysisErrors,
    retryAnalysis,
    hydrateAnalyses,
  };
}
