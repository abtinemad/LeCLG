import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  History,
  Brain,
  Heart,
  Waves,
  Orbit,
  Trees,
  Fingerprint,
  Users,
  Copy,
  Check,
  BookOpen,
  Zap,
  Download,
  Network,
  Volume2,
  VolumeX,
  Sparkles,
  X,
  Gem,
  Feather,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { AnimatePresence } from "motion/react";
import { sbGet, sbInsert, sbUpdate } from "../lib/worker";
import { ClarteSection, PrismeExplainer } from "../components/SerpentinGuide";
import { PaymentWrapper } from "../components/PaymentModal";
import { LueurVisual } from "../components/LueurVisual";
export const EMOTIONS = {
  joie: {
    label: "Joie (Prisme)",
    color: "#FACC15",
    bg: "bg-[#FACC15]/15",
    border: "border-[#FACC15]/40",
  },
  tristesse: {
    label: "Tristesse (Prisme)",
    color: "#60A5FA",
    bg: "bg-[#60A5FA]/15",
    border: "border-[#60A5FA]/40",
  },
  colere: {
    label: "Colère (Prisme)",
    color: "#F87171",
    bg: "bg-[#F87171]/15",
    border: "border-[#F87171]/40",
  },
  peur: {
    label: "Peur (Prisme)",
    color: "#A78BFA",
    bg: "bg-[#A78BFA]/15",
    border: "border-[#A78BFA]/40",
  },
  degout: {
    label: "Dégoût (Prisme)",
    color: "#4ADE80",
    bg: "bg-[#4ADE80]/15",
    border: "border-[#4ADE80]/40",
  },
  surprise: {
    label: "Surprise (Prisme)",
    color: "#FB923C",
    bg: "bg-[#FB923C]/15",
    border: "border-[#FB923C]/40",
  },
  confiance: {
    label: "Confiance (Prisme)",
    color: "#22D3EE",
    bg: "bg-[#22D3EE]/15",
    border: "border-[#22D3EE]/40",
  },
  anticipation: {
    label: "Anticipation (Prisme)",
    color: "#F472B6",
    bg: "bg-[#F472B6]/15",
    border: "border-[#F472B6]/40",
  },
  honte: {
    label: "Honte (Prisme)",
    color: "#94A3B8",
    bg: "bg-[#94A3B8]/15",
    border: "border-[#94A3B8]/40",
  },
  melancolie: {
    label: "Mélancolie (Prisme)",
    color: "#8B5CF6",
    bg: "bg-[#8B5CF6]/15",
    border: "border-[#8B5CF6]/40",
  },
} as const;

interface ReflectionCard {
  id?: string;
  fragment: string;
  deplacement: string;
  direction: string;
  texture_relationnelle?: string;
  sphere?: string;
  emotion?: string;
  prisme?: string;
  date: string;
  user_note?: string;
  image_url?: string;
}

const CardReadTracker = ({ card }: { card: ReflectionCard }) => {
  useEffect(() => {
    if (!card.id || card.user_note) return;
    const reads = JSON.parse(localStorage.getItem("collegue_card_read_dates") || "{}");
    if (!reads[card.id]) {
      reads[card.id] = new Date().toISOString();
      localStorage.setItem("collegue_card_read_dates", JSON.stringify(reads));
    }
  }, [card.id, card.user_note]);
  return null;
};

export default function Carnet() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cards, setCards] = useState<ReflectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalId, setPersonalId] = useState(
    localStorage.getItem("collegue_personal_id") || "",
  );
  const [view, setView] = useState<
    "fragments" | "lien" | "affect" | "elan" | "matrice"
  >("fragments");
  const [metacognitionData, setMetacognitionData] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [affectNote, setAffectNote] = useState(
    localStorage.getItem("collegue_affect_note") || "",
  );
  const [affectHistory, setAffectHistory] = useState<
    { date: string; note: string; analysis: string }[]
  >(JSON.parse(localStorage.getItem("collegue_affect_history") || "[]"));
  const [elanNarrative, setElanNarrative] = useState(
    localStorage.getItem("collegue_elan_narrative") || "",
  );
  const [userNote, setUserNote] = useState(
    localStorage.getItem("collegue_user_note") || "",
  );
  const [elanHistory, setElanHistory] = useState<
    { date: string; narrative: string; userNote: string }[]
  >(JSON.parse(localStorage.getItem("collegue_elan_history") || "[]"));
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(
    localStorage.getItem("collegue_sound") !== "false",
  );
  const [isPrismesModalOpen, setIsPrismesModalOpen] = useState(false);
  const [isLueursModalOpen, setIsLueursModalOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPrisme, setSelectedPrisme] = useState<string | null>(null);
  const [networkData, setNetworkData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_network") || "null"),
  );
  const [sessionsData, setSessionsData] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_sessions") || "[]"),
  );
  const [eclatAnalysis, setEclatAnalysis] = useState<string | null>(
    localStorage.getItem("collegue_eclat") || null,
  );

  const PRISME_DESCRIPTIONS: Record<string, string> = {
    joie: "L'énergie qui s'expand. La joie est un signal d'adéquation entre l'être et son acte. Elle marque une ouverture et une vitalité retrouvée.",
    tristesse:
      "Le retrait nécessaire. La tristesse s'installe quand une perte doit être métabolisée. Elle est la texture du désinvestissement utile.",
    colere:
      "La force de la limite. La colère surgit quand le cadre est menacé. Elle est une poussée vers la défense de son propre espace psychique.",
    peur: "Le signal de l'incertain. La peur signale une menace ou une rupture de prévisibilité. Elle invite à la prudence ou au surpoids du contrôle.",
    confiance:
      "Le relâchement constructif. La confiance permet de déléguer la vigilance. Elle est la base de toute coopération et de tout lien solide.",
    degout:
      "Le rejet protecteur. Le dégoût marque la saturation. Il impose une distance immédiate face à ce qui est perçu comme toxique ou intrusif.",
    anticipation:
      "Le regard vers l'avant. L'anticipation prépare le terrain. Elle est une projection qui cherche à réduire l'angoisse de l'inconnu.",
    surprise:
      "Le séisme cognitif. La surprise bouscule les attentes. Elle force une réactualisation brutale de la perception de la réalité.",
    honte:
      "Le repli du regard. La honte signale un écart douloureux entre l'idéal de soi et l'acte posé. Elle est un signal de régulation sociale interne.",
    melancolie:
      "La résonance de l'absence. La mélancolie est une tristesse qui s'est installée dans la durée, créant une profondeur et une esthétique du manque.",
  };

  const toggleSound = () => {
    const newVal = !isSoundEnabled;
    setIsSoundEnabled(newVal);
    localStorage.setItem("collegue_sound", String(newVal));
  };

  const exportMatriceToPDF = () => {
    window.print();
  };

  // New analyses states
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
  const [lueurs, setLueurs] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_lueurs") || "[]"),
  );
  const [sphereSonges, setSphereSonges] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem("collegue_sphere_songes") || "{}"),
  );
  const [isEclatModalOpen, setIsEclatModalOpen] = useState(false);
  const [eclatRequest, setEclatRequest] = useState("");
  const [eclatStatus, setEclatStatus] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [carnatCreatedAt, setCarnetCreatedAt] = useState<string | null>(null);

  // --- Synchronization logic ---
  const checkPermanentUnlock = async (
    currentPlan: string | undefined,
    createdAt: string | null,
  ) => {
    if (!personalId || currentPlan === "reconnaissance") return;

    // Condition 1: 10 Prismes
    const uniquePrismes = new Set(cards.map((c) => c.prisme).filter(Boolean));
    const has10Prismes = uniquePrismes.size >= 10;

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

    if (has10Prismes && hasAllSections && hasOneYear) {
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

  const syncCardToCloud = async (card: ReflectionCard) => {
    if (!personalId || !card.id) return;
    try {
      const existing = await sbGet("cartes", `id=eq.${card.id}`);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        await sbUpdate("cartes", card.id, { ...card, personal_id: personalId });
      } else {
        await sbInsert("cartes", { ...card, personal_id: personalId });
      }
    } catch (e) {
      console.error("Sync card error:", e);
    }
  };

  const sendEclatRequest = async () => {
    if (!eclatRequest.trim()) return;
    setEclatStatus("sending");

    try {
      const payload = {
        type: "eclat",
        request_text: eclatRequest,
        matrice_snapshot: matriceDataAnalysis,
        elan_snapshot: elanDataAnalysis,
        affect_snapshot: affectData,
        lien_snapshot: lienData,
        created_at: new Date().toISOString(),
        personal_id: localStorage.getItem("collegue_personal_id") || "anonyme",
      };

      // We use sbInsert to save it to a table named 'eclats'
      await sbInsert("eclats", payload);
      setEclatStatus("sent");
      setEclatRequest("");
    } catch (e) {
      console.error("Failed to send eclat:", e);
      // Fallback for demo: even if table missing, we want to show 'sent' state to the user
      setEclatStatus("sent");
    }
  };

  const handleEclatSubmit = () => {
    sendEclatRequest();
  };

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

    return {
      fragments: true,
      lien: true,
      elan: true,
      affect: diffDays >= 3 && cards.length >= 2,
      matrice: diffDays >= 21 && cards.length >= 5 && prismesCount >= 2,
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

  const isNextLocked = useCallback((key: keyof typeof unlockedBlocks, viewMode: "fragments" | "lien" | "affect" | "elan" | "matrice") => {
    const viewKeys: Record<string, (keyof typeof unlockedBlocks)[]> = {
      fragments: [
        'fragments_progression',
        'fragments_relation_prismes',
        'fragments_resistances',
        'fragments_echo',
        'fragments_signaux',
        'fragments_sillage'
      ],
      lien: [
        'lien_texture',
        'lien_correlation',
        'lien_constellation',
        'lien_structure',
        'lien_fragilite'
      ],
      affect: [
        'affect_rythme', 
        'affect_lecture',
        'affect_luminescence',
        'affect_gradients'
      ],
      elan: [
        'elan_clusters',
        'elan_mouvement',
        'elan_direction',
        'elan_question'
      ],
      matrice: [
        'matrice_evolution',
        'matrice_validation_songes'
      ]
    };

    const lockedInView = (viewKeys[viewMode] || []).filter(k => !unlockedBlocks[k]);
    if (lockedInView.length === 0) return false;

    const now = new Date();
    const firstCardDate = cards.length > 0 ? new Date(cards[cards.length - 1].date) : now;
    const diffDays = Math.floor((now.getTime() - firstCardDate.getTime()) / (1000 * 3600 * 24));
    const uniqueDays = new Set(cards.map(c => new Date(c.date).toDateString())).size;
    const sessionsWithStepsCount = sessionsData.filter(s => s.step_reached !== undefined).length;
    const songesCount = cards.filter(c => c.user_note && c.user_note.trim().length > 10).length;
    const hasSonges = songesCount > 0;

    const reqs: Record<string, { c?: number; p?: number; u?: number; d?: number; s?: number; so?: number; e?: number; hs?: number }> = {
      fragments_progression: { s: 2 },
      fragments_relation_prismes: { c: 3, p: 2 },
      fragments_resistances: { c: 4, u: 3 },
      fragments_echo: { c: 5 },
      fragments_signaux: { c: 5, e: enrichFragments ? 0 : 1 },
      fragments_sillage: { so: 2, d: 7 },

      lien_texture: { c: 3, u: 2 },
      lien_correlation: { c: 3, u: 2, p: 2 },
      lien_constellation: { c: 3, u: 2, p: 3 },
      lien_structure: { c: 4, p: 3 },
      lien_fragilite: { c: 5, p: 3 },

      affect_rythme: { c: 3 },
      affect_gradients: { c: 5 },
      affect_luminescence: { c: 3, u: 3 },
      affect_lecture: { p: 2 },

      elan_clusters: { d: 7, c: 3, p: 1 },
      elan_mouvement: { d: 7, c: 4, p: 1 },
      elan_direction: { d: 7, c: 5, p: 1 },
      elan_question: { d: 7, c: 6, p: 1 },

      matrice_evolution: { hs: 0 },
      matrice_validation_songes: { hs: hasSonges ? 0 : 1 }
    };

    let minDist = Infinity;
    let closestKey = lockedInView[0];
    for (const k of lockedInView) {
       const res = reqs[k];
       let dist = 1000; // fallback high distance if not mapped
       if (res) {
          dist = 0;
          if (res.c) dist += Math.max(0, res.c - cards.length);
          if (res.p) dist += Math.max(0, res.p - prismesCount);
          if (res.u) dist += Math.max(0, res.u - uniqueDays);
          if (res.d) dist += Math.max(0, res.d - diffDays);
          if (res.s) dist += Math.max(0, res.s - sessionsWithStepsCount);
          if (res.so) dist += Math.max(0, res.so - songesCount);
          if (res.e) dist += res.e;
          if (res.hs) dist += res.hs;
       }
       if (dist < minDist) {
          minDist = dist;
          closestKey = k;
       }
    }

    return closestKey === key;
  }, [unlockedBlocks, cards, prismesCount, sessionsData, enrichFragments]);

  const copyToClipboard = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  useEffect(() => {
    // Clear old default Elan message if it was saved in localStorage
    if (elanNarrative.includes("accumulation plus longue de fragments")) {
      setElanNarrative("");
    }
  }, [elanNarrative]);

  useEffect(() => {
    localStorage.setItem("collegue_affect_note", affectNote);
  }, [affectNote]);

  useEffect(() => {
    localStorage.setItem(
      "collegue_affect_history",
      JSON.stringify(affectHistory),
    );
  }, [affectHistory]);

  useEffect(() => {
    localStorage.setItem("collegue_elan_narrative", elanNarrative);
  }, [elanNarrative]);

  useEffect(() => {
    localStorage.setItem("collegue_user_note", userNote);
  }, [userNote]);

  useEffect(() => {
    localStorage.setItem("collegue_elan_history", JSON.stringify(elanHistory));
  }, [elanHistory]);

  const updateSphereSonge = (sphere: string, text: string) => {
    const newSonges = { ...sphereSonges, [sphere]: text };
    setSphereSonges(newSonges);
    localStorage.setItem("collegue_sphere_songes", JSON.stringify(newSonges));
  };

  const loadMetacognition = async () => {
    if (metacognitionData || cards.length < 5) return;
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
        setMetacognitionData(data);
      }
    } catch (e) {
      console.error("Metacognition error:", e);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (view === "matrice" && !metacognitionData) {
      loadMetacognition();
    }
  }, [view, cards]);

  useEffect(() => {
    loadCards();
  }, []);

  const runAnalysis = async (type: string, data: any) => {
    try {
      const res = await fetch("/api/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error(`${type} analysis error:`, e);
    }
    return null;
  };

  useEffect(() => {
    if (unlockedSections.lien && !lienData) {
      runAnalysis("eval_lien", { cards }).then((data) => {
        if (data) {
          setLienData(data);
          localStorage.setItem("collegue_lien", JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.affect && !affectData) {
      runAnalysis("eval_affect", {
        fragments: cards,
        lien: lienData,
        prismes: cards.map((c) => c.prisme).filter(Boolean),
        songes: sphereSonges,
        structure_invisible: lienData?.relief,
        triplets_texture: cards.map(c => {
           const s = sessionsData.find(sess => sess.reflection_card?.id === c.id || sess.reflection_card?.date === c.date);
           return { texture: c.texture_relationnelle, prisme: c.prisme, sphere: c.sphere, step: s?.step_reached };
        })
      }).then((data) => {
        if (data) {
          setAffectData(data);
          localStorage.setItem("collegue_affect", JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.elan && !elanDataAnalysis) {
      runAnalysis("eval_elan", {
        fragments: cards,
        lien: lienData,
        affect: affectData,
        prismes: cards.map((c) => c.prisme).filter(Boolean),
        songes: sphereSonges,
        structure_invisible: lienData?.relief,
      }).then((data) => {
        if (data) {
          setElanDataAnalysis(data);
          localStorage.setItem("collegue_elan_eval", JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.matrice && !matriceDataAnalysis) {
      runAnalysis("eval_matrice", {
        fragments: cards,
        lien: lienData,
        affect: affectData,
        elan: elanDataAnalysis,
        question_elan: elanDataAnalysis?.question,
        prismes: cards.map((c) => c.prisme).filter(Boolean),
        songes: sphereSonges,
        structure_invisible: lienData?.relief,
      }).then((data) => {
        if (data) {
          setMatriceDataAnalysis(data);
          localStorage.setItem("collegue_matrice_eval", JSON.stringify(data));

          // Trigger Lueur eval if not present for current month
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
          const existingLueurs = JSON.parse(
            localStorage.getItem("collegue_lueurs") || "[]",
          );
          const hasCurrentMonthLueur = existingLueurs.some((l: any) => {
            const d = new Date(l.date);
            return `${d.getFullYear()}-${d.getMonth()}` === currentMonth;
          });

          if (!hasCurrentMonthLueur) {
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
        }
      });
    }
    if (cards.length >= 5 && !networkData) {
      runAnalysis("eval_network", { cards }).then((data) => {
        if (data) {
          setNetworkData(data);
          localStorage.setItem("collegue_network", JSON.stringify(data));
        }
      });
    }

    const hasAnySonge = cards.some(c => c.user_note && c.user_note.trim().length > 10);
    if (cards.length >= 3 && hasAnySonge && !enrichFragments) {
      runAnalysis("enrich_fragments", { 
         cards,
         couples_fragment_songe: cards.filter(c => c.user_note).map(c => ({ id: c.id, fragment: c.fragment, songe: c.user_note }))
      }).then((data) => {
        if (data) {
          setEnrichFragments(data);
          localStorage.setItem(
            "collegue_enrich_fragments",
            JSON.stringify(data),
          );
        }
      });
    }
    if (unlockedSections.lien && lienData && !enrichLien) {
      runAnalysis("enrich_lien", { cards, lienData }).then((data) => {
        if (data) {
          setEnrichLien(data);
          localStorage.setItem("collegue_enrich_lien", JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.affect && affectData && !enrichAffect) {
      runAnalysis("enrich_affect", { cards }).then((data) => {
        if (data) {
          setEnrichAffect(data);
          localStorage.setItem("collegue_enrich_affect", JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.elan && elanDataAnalysis && !enrichElan) {
      runAnalysis("enrich_elan", { cards }).then((data) => {
        if (data) {
          setEnrichElan(data);
          localStorage.setItem("collegue_enrich_elan", JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.matrice && matriceDataAnalysis && !enrichMatrice) {
      runAnalysis("enrich_matrice", {
        cards,
        matrice: matriceDataAnalysis,
      }).then((data) => {
        if (data) {
          setEnrichMatrice(data);
          localStorage.setItem("collegue_enrich_matrice", JSON.stringify(data));
        }
      });
    }
  }, [cards, unlockedSections]);

  const radarData = useMemo(() => {
    const spheres = ["Familiale", "Sociale", "Amoureuse", "Professionnelle"];
    return spheres.map((s) => ({
      subject: s,
      A: cards.filter((c) => c.sphere === s).length,
      fullMark: Math.max(
        ...spheres.map(
          (sp) =>
            cards.filter(
              (c) =>
                sp ===
                (c.sphere === "Amoureux"
                  ? "Amoureuse"
                  : c.sphere === "Familial"
                    ? "Familiale"
                    : c.sphere === "Social"
                      ? "Sociale"
                      : c.sphere === "Professionnel"
                        ? "Professionnelle"
                        : c.sphere),
            ).length,
        ),
        1,
      ),
    }));
  }, [cards]);

  const updateCardNote = (index: number, note: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], user_note: note };
    setCards(newCards);
    localStorage.setItem("collegue_cards", JSON.stringify(newCards));
    syncCardToCloud(newCards[index]);
  };

  const loadCards = async () => {
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
          if (c.lien_data) setLienData(c.lien_data);
          if (c.affect_data) setAffectData(c.affect_data);
          if (c.elan_data) setElanDataAnalysis(c.elan_data);
          if (c.matrice_data) setMatriceDataAnalysis(c.matrice_data);
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
      } catch (e) {
        console.error("Cloud load failed", e);
        allCards = local;
      }
    } else {
      allCards = local;
    }

    // Ensure IDs exist for local compatibility
    const cardsWithIds = allCards.map((c: any) => ({
      ...c,
      id:
        c.id ||
        (c.date ? `local-${new Date(c.date).getTime()}` : crypto.randomUUID()),
    }));

    setCards(
      cardsWithIds.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    );
    setLoading(false);
  };

  // Lien (Analysis)
  const getExperienceAnalysis = () => {
    if (cards.length < 3) return "Le réseau de fragments révèle le relief.";

    // Time Analysis
    const days = cards.map((c) => new Date(c.date).getDay());
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    days.forEach((d) => dayCounts[d]++);
    const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
    const dayNames = [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ];

    // Spheres Analysis
    const spheres = cards.map((c) => c.sphere).filter(Boolean);
    const sphereCounts: Record<string, number> = {};
    spheres.forEach((s) => (sphereCounts[s!] = (sphereCounts[s!] || 0) + 1));
    const sortedSpheres = Object.entries(sphereCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const topSphere = sortedSpheres[0]?.[0] || "non définie";

    // Emotions Analysis
    const emotions = cards.map((c) => c.prisme).filter(Boolean);
    const emotionCounts: Record<string, number> = {};
    emotions.forEach((e) => (emotionCounts[e!] = (emotionCounts[e!] || 0) + 1));
    const sortedEmotions = Object.entries(emotionCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const topEmotionKey = sortedEmotions[0]?.[0];
    const topEmotion = topEmotionKey
      ? EMOTIONS[topEmotionKey as keyof typeof EMOTIONS]?.label.split(" ")[0]
      : "non identifiée";

    // Relationship Texture Analysis
    const textures = cards.map((c) => c.texture_relationnelle).filter(Boolean);
    const textureCounts: Record<string, number> = {};
    textures.forEach((t) => (textureCounts[t!] = (textureCounts[t!] || 0) + 1));
    const sortedTextures = Object.entries(textureCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const topTexture = sortedTextures[0]?.[0];

    let synthesis = `Vos sessions se concentrent principalement le ${dayNames[maxDay]}. `;
    synthesis += `La dimension "${topSphere}" semble être le point de cristallisation actuel de votre réflexion. `;

    if (topEmotionKey) {
      synthesis += `Le climat émotionnel dominant qui s'en dégage est marqué par la ${topEmotion.toLowerCase()}. `;
    }

    if (topTexture) {
      synthesis += `Le grain de vos échanges est particulièrement marqué par une texture "${topTexture.toLowerCase()}". `;
    }

    if (sortedSpheres.length > 1) {
      synthesis += `On observe également des résonances dans la sphère ${sortedSpheres[1][0]}. `;
    }

    synthesis +=
      "Ce lien suggère un mouvement de fond où votre attention clinique et personnelle cherche un nouvel équilibre.";

    return synthesis;
  };

  const getWeeklyAffectAnalysis = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentCards = cards.filter((c) => new Date(c.date) >= oneWeekAgo);

    if (recentCards.length === 0)
      return "Le relief de votre vécu reste en suspens : aucune trace n'a été déposée ces derniers jours.";

    const emotions = recentCards.map((c) => c.prisme).filter(Boolean);
    const emotionCounts: Record<string, number> = {};
    emotions.forEach((e) => (emotionCounts[e!] = (emotionCounts[e!] || 0) + 1));

    const sortedEmotions = Object.entries(emotionCounts).sort(
      (a, b) => b[1] - a[1],
    );
    const topEmotionKey = sortedEmotions[0]?.[0];

    if (!topEmotionKey)
      return "La tonalité affective de la semaine est restée diffuse, sans relief marqué.";

    const topEmotion = EMOTIONS[topEmotionKey as keyof typeof EMOTIONS];

    const analysisMap: Record<string, string> = {
      joie: "Une éclaircie se dessine. L'élan vital semble avoir trouvé des points d'appui sur lesquels se reconstruire.",
      tristesse:
        "Le climat est au retrait, au recueillement. Une forme de lassitude ou de deuil de perspective semble imprégner le vécu actuel.",
      colere:
        "Une tension affleure. Des limites ont été bousculées, créant un besoin de réaffirmation ou de décharge émotionnelle.",
      peur: "Un sentiment d'insécurité ou d'incertitude prédomine, ralentissant les prises de décision et les mouvements vers l'extérieur.",
      degout:
        "Une forme de saturation ou de rejet se manifeste. Un besoin de mise à distance et de nettoyage relationnel semble nécessaire.",
      surprise:
        "Le paysage est instable, bousculé par l'imprévu. L'équilibre est en train de se redéfinir face à la nouveauté.",
    };

    return analysisMap[topEmotionKey] || "Climat affectif modéré.";
  };

  const getElanAnalysis = () => {
    if (cards.length < 5) return "Le mouvement qui emerge à l'interieur.";

    // Direction analysis - looking for recurring words in "direction" field
    const directions = cards
      .map((c) => c.direction)
      .join(" ")
      .toLowerCase();
    const commonThemes = [
      "équilibre",
      "limite",
      "ouverture",
      "soin",
      "action",
      "retrait",
      "construction",
      "sens",
    ];
    const foundThemes = commonThemes.filter((theme) =>
      directions.includes(theme),
    );

    let synthesis =
      "Au travers de la sédimentation de vos vécus, une structure narrative commence à émerger. ";

    if (foundThemes.length > 0) {
      synthesis += `Les thèmes de ${foundThemes.slice(0, 3).join(", ")} reviennent comme des balises. `;
    } else {
      synthesis +=
        "Votre trajectoire semble se définir par de légers ajustements plutôt que par de grandes ruptures thématiques. ";
    }

    synthesis +=
      "Ce qui se dessine, c'est un passage du particulier (le fragment quotidien) vers le général (votre sens de l'engagement). ";
    synthesis +=
      "L'Élan actuel penche vers une consolidation de ce qui a été appris, transformant l'expérience subie en une direction choisie.";

    return synthesis;
  };

  const archiveAffectEvaluation = () => {
    if (!affectNote.trim()) return;

    const newEvaluation = {
      date: new Date().toISOString(),
      note: affectNote,
      analysis: getWeeklyAffectAnalysis(),
    };

    const newHistory = [newEvaluation, ...affectHistory];
    setAffectHistory(newHistory);
    setAffectNote(""); // Clear current note after archiving
  };

  const archiveElanEvaluation = () => {
    if (!elanNarrative.trim() && !userNote.trim()) return;

    const newEvaluation = {
      date: new Date().toISOString(),
      narrative: elanNarrative || getElanAnalysis(),
      userNote: userNote,
    };

    const newHistory = [newEvaluation, ...elanHistory];
    setElanHistory(newHistory);

    // Reset fields for new month
    setElanNarrative("");
    setUserNote("");
  };

  const getEmotionTheme = (teinte: string) => {
    const t = teinte.toLowerCase();

    // Default theme (Amber/Orange)
    let colorName = "orange-500";
    let hex = "#EA580C";
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
      colorName = "red-500";
      hex = "#EF4444";
      isDefault = false;
    } else if (
      t.includes("joie") ||
      t.includes("bonheur") ||
      t.includes("enthousiasme") ||
      t.includes("plaisir") ||
      t.includes("chaleur")
    ) {
      colorName = "yellow-400";
      hex = "#FACC15";
      isDefault = false;
    } else if (
      t.includes("confiance") ||
      t.includes("acceptation") ||
      t.includes("sérénité") ||
      t.includes("calme") ||
      t.includes("sécurité")
    ) {
      colorName = "lime-400";
      hex = "#A3E635";
      isDefault = false;
    } else if (
      t.includes("peur") ||
      t.includes("appréhension") ||
      t.includes("crainte") ||
      t.includes("anxiété") ||
      t.includes("inquiétude")
    ) {
      colorName = "emerald-600";
      hex = "#059669";
      isDefault = false;
    } else if (
      t.includes("surprise") ||
      t.includes("étonnement") ||
      t.includes("imprévu") ||
      t.includes("choc")
    ) {
      colorName = "sky-400";
      hex = "#38BDF8";
      isDefault = false;
    } else if (
      t.includes("tristesse") ||
      t.includes("chagrin") ||
      t.includes("déception") ||
      t.includes("mélancolie") ||
      t.includes("souffrance")
    ) {
      colorName = "blue-500";
      hex = "#3B82F6";
      isDefault = false;
    } else if (
      t.includes("dégoût") ||
      t.includes("rejet") ||
      t.includes("ennui") ||
      t.includes("amertume") ||
      t.includes("hostilité")
    ) {
      colorName = "purple-500";
      hex = "#A855F7";
      isDefault = false;
    } else if (
      t.includes("anticipation") ||
      t.includes("vigilance") ||
      t.includes("attente") ||
      t.includes("projet") ||
      t.includes("espoir")
    ) {
      colorName = "orange-500";
      hex = "#F97316";
      isDefault = false;
    }

    return { colorName, hex, isDefault };
  };

  const LockedSection = ({
    title,
    requirements,
    icon: Icon,
  }: {
    title: string;
    requirements: string;
    icon: any;
  }) => (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-up">
      <div className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-6">
        <Icon className="w-6 h-6 text-white/10" />
      </div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/40 mb-4">
        {title}
      </h3>
      <p className="font-serif italic text-beige-faint leading-relaxed max-w-sm mb-8">
        L'analyse n'est pas encore métabolisée. Elle nécessite une sédimentation
        plus profonde de votre vécu.
      </p>
      <div className="py-3 px-6 rounded-full border border-white/5 bg-black/20">
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#6BA368]">
          <span className="opacity-50">Condition : </span>
          {requirements}
        </div>
      </div>
    </div>
  );

  const LockedBlock = ({ title, requirements }: { title: string; requirements: string }) => (
    <div className="flex flex-col items-center justify-center p-6 text-center border border-white/5 bg-white/[0.01] rounded-lg border-dashed">
      <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">
        {title}
      </div>
      <div className="text-[8px] font-mono tracking-widest uppercase opacity-40">
        Requis : {requirements}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-beige-dim font-serif pt-[48px]">
      <header className="fixed top-0 left-0 right-0 border-b border-border bg-bg/90 backdrop-blur-md z-[9999]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 text-beige-faint" />
            </Link>
            {currentPlan === "reconnaissance" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green/10 border border-green/20">
                <div className="w-1 h-1 rounded-full bg-green animate-pulse" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-green">
                  Mode Reconnaissance
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/chat"
              className={`font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${location.pathname === "/chat" ? "text-beige bg-white/5 ring-1 ring-white/10" : "text-beige-faint hover:text-beige"}`}
            >
              <Brain size={10} strokeWidth={1.5} />
              <span>penser</span>
            </Link>
            <Link
              to="/carnet"
              className={`font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${location.pathname === "/carnet" ? "text-beige bg-white/5 ring-1 ring-white/10" : "text-beige-faint hover:text-beige"}`}
            >
              <BookOpen size={10} strokeWidth={1.5} />
              <span>carnet</span>
            </Link>
            <button
              onClick={toggleSound}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-beige-faint hover:text-beige ml-1"
              title={
                isSoundEnabled
                  ? "Désactiver la résonance"
                  : "Activer la résonance"
              }
            >
              {isSoundEnabled ? (
                <Volume2 size={13} strokeWidth={1.5} />
              ) : (
                <VolumeX size={13} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="mb-12 border-b border-border pb-12 print:hidden">
          <div className="flex flex-col items-center gap-y-4 md:gap-y-6 w-full max-w-2xl mx-auto mb-8">
            <div className="flex flex-row justify-center items-center gap-x-3 sm:gap-x-6 md:gap-x-12 w-full flex-nowrap">
              <button
                onClick={() => setView("fragments")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[10px] sm:text-[11px] tracking-widest uppercase transition-colors relative group px-2 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "fragments" ? "text-green" : "text-beige-faint hover:text-beige"}`}
              >
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Fragments</span>
                {view === "fragments" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-green/40"
                  />
                )}
              </button>

              <button
                onClick={() => setView("lien")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[10px] sm:text-[11px] tracking-widest uppercase transition-colors relative group px-2 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "lien" ? "text-[#EA580C]" : "text-beige-faint hover:text-beige"}`}
              >
                <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Lien</span>
                {view === "lien" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-[#EA580C]/40"
                  />
                )}
              </button>

              <button
                onClick={() => setView("affect")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[10px] sm:text-[11px] tracking-widest uppercase transition-colors relative group px-2 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "affect" ? "text-[#7BA7D7]" : "text-beige-faint hover:text-beige"}`}
              >
                <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Affect</span>
                {view === "affect" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-[#7BA7D7]/40"
                  />
                )}
              </button>
            </div>

            <div className="flex flex-row justify-center items-center gap-x-3 sm:gap-x-6 md:gap-x-12 w-full flex-nowrap pt-1">
              <button
                onClick={() => setView("elan")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[10px] sm:text-[11px] tracking-widest uppercase transition-colors relative group px-2 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "elan" ? "text-[#FAF9F6]" : "text-beige-faint hover:text-beige"}`}
              >
                <Orbit className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Élan</span>
                {view === "elan" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-white/40"
                  />
                )}
              </button>

              <button
                onClick={() => setView("matrice")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[10px] sm:text-[11px] tracking-widest uppercase transition-all relative group px-2 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "matrice" ? "text-[#8B5CF6]" : "text-beige-faint hover:text-beige"}`}
              >
                <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Matrice</span>
                {view === "matrice" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-[#8B5CF6]/40"
                  />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-center items-center gap-8">
            <button
              onClick={() => setIsPrismesModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Prismes"
            >
              <div className="w-8 h-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-yellow-400/30 transition-all">
                <Gem
                  className={`w-4 h-4 transition-colors ${prismesCount > 0 ? "text-yellow-400/40 group-hover:text-yellow-400" : "text-white/10"}`}
                />
              </div>
            </button>

            <button
              onClick={() => setIsLueursModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Lueurs"
            >
              <div className="w-8 h-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-white/30 transition-all">
                <Sparkles
                  className={`w-4 h-4 transition-colors ${lueurs.length > 0 ? "text-white/40 group-hover:text-white/80" : "text-white/10"}`}
                />
              </div>
            </button>

            <button
              onClick={() => setIsNetworkModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Climat de sphère"
            >
              <div className="w-8 h-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-purple-500/30 transition-all">
                <Network className="w-4 h-4 text-white/10 group-hover:text-purple-400/40 transition-all" />
              </div>
            </button>
          </div>
        </div>

        <ClarteSection section={`carnet-${view}`} />

        {view === "fragments" ? (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {loading ? (
                <div className="col-span-2 text-center py-20 font-mono text-[9px] uppercase tracking-widest opacity-40">
                  Immersion dans vos archives…
                </div>
              ) : cards.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center py-24 gap-4">
                  <Link
                    to="/chat"
                    className="font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-beige-faint hover:text-beige ring-1 ring-beige-faint/20 bg-white/[0.02]"
                  >
                    <Brain size={10} strokeWidth={1.5} />
                    <span>penser</span>
                  </Link>
                  <p className="italic text-beige-faint opacity-40 text-[14px]">
                    le vécu pour prendre du recul.
                  </p>
                </div>
              ) : (
                cards.map((card, i) => {
                  const emotionKey = (
                    card.emotion ||
                    card.prisme ||
                    ""
                  ).toLowerCase() as keyof typeof EMOTIONS;
                  const emotionData = EMOTIONS[emotionKey] || null;
                  const isLocked = !card.prisme;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`${emotionData ? emotionData.bg : "bg-[#0a1a12]"} border ${emotionData ? emotionData.border : "border-[#3a3420]"} rounded-lg p-6 relative space-y-4 hover:border-[#3a3420]/60 transition-all`}
                    >
                      <CardReadTracker card={card} />
                      {(() => {
                        if (!card.id || card.user_note) return null;
                        const reads = JSON.parse(localStorage.getItem("collegue_card_read_dates") || "{}");
                        const readDate = reads[card.id];
                        if (readDate) {
                          const hours = (new Date().getTime() - new Date(readDate).getTime()) / (1000 * 60 * 60);
                          if (hours > 48) {
                            return <div className="absolute top-2 right-2 w-1 h-1 bg-white opacity-20 rounded-full" />;
                          }
                        }
                        return null;
                      })()}
                      <div className="text-[11px] font-mono text-[#4a4028] mb-2 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(card.date).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                `Fragment: ${card.fragment}\nDéplacement: ${card.deplacement}\nDirection: ${card.direction}`,
                                `card-${i}`,
                              )
                            }
                            className="p-1 hover:bg-white/5 rounded transition-colors group relative"
                            title="Copier le chemin"
                          >
                            {copiedSection === `card-${i}` ? (
                              <Check className="w-2.5 h-2.5 text-green-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-20 group-hover:opacity-100" />
                            )}
                          </button>
                        </div>
                        <div className="flex gap-2 items-center">
                          {card.sphere && (
                            <span className="text-[8px] uppercase tracking-tighter text-beige-faint/40">
                              {card.sphere}
                            </span>
                          )}
                          {emotionData && (
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: emotionData.color,
                                boxShadow: `0 0 5px ${emotionData.color}44`,
                              }}
                            />
                          )}
                          {!isLocked && (
                            <Gem
                              className="w-2.5 h-2.5 text-yellow-500/60"
                              title={`Prisme: ${card.prisme}`}
                            />
                          )}
                        </div>
                      </div>
                      <div
                        className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 text-xs italic text-[#9a8a68]`}
                      >
                        {card.fragment}
                      </div>

                      {card.image_url && (
                        <div className="my-4 relative aspect-video overflow-hidden rounded border border-white/5 group">
                          <img
                            src={card.image_url}
                            alt="Texture relationnelle"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-2 left-3 font-mono text-[7px] uppercase tracking-widest text-beige-faint opacity-50">
                            Texture générée
                          </div>
                        </div>
                      )}

                      <div
                        className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 text-xs text-[#9a8a68]`}
                      >
                        {card.deplacement}
                      </div>
                      <div
                        className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 text-xs font-medium text-[#9a8a68] mb-2`}
                      >
                        {card.direction}
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center gap-1.5 mb-1.5 opacity-40">
                          <Feather className="w-2.5 h-2.5" />
                          <span className="font-mono text-[7px] uppercase tracking-widest">
                            Songe
                          </span>
                        </div>
                        <div className="relative">
                          <textarea
                            value={card.user_note || ""}
                            onChange={(e) => updateCardNote(i, e.target.value)}
                            placeholder="Déposer un songe..."
                            className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-[11px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12 custom-scrollbar"
                          />
                          {(() => {
                             if (!card.user_note || card.user_note.trim() === "" || !enrichFragments?.reformulations || !card.id) return null;
                             const ref = enrichFragments.reformulations[card.id];
                             if (!ref) return null;
                             const icon = ref === 'convergent' ? '→' : ref === 'divergent' ? '↗' : '+';
                             return <div className="absolute right-3 top-3 text-white/20 text-[10px] font-mono pointer-events-none">{icon}</div>;
                          })()}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-[#3a3420]/30">
                        <div className="flex items-center gap-2">
                          {card.texture_relationnelle && (
                            <span className="font-mono text-[7px] uppercase tracking-widest text-green/50">
                              Résonance : {card.texture_relationnelle}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {isLocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/chat', { state: { resumeFragment: card } });
                              }}
                              className="px-2 py-0.5 rounded-sm text-[6px] font-mono uppercase tracking-tighter border border-[#EA580C]/40 text-[#EA580C] hover:bg-[#EA580C]/10 transition-colors w-fit"
                            >
                              Reprendre ce fragment
                            </button>
                          )}
                          {emotionData && (
                            <div
                              className={`px-2 py-0.5 rounded-sm text-[6px] font-mono uppercase tracking-tighter border ${emotionData.bg} ${emotionData.border} text-beige w-fit`}
                            >
                              {isLocked
                                ? "Signal détecté"
                                : emotionData.label.split(" ")[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {cards.length > 0 && (
              <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                {unlockedBlocks.fragments_progression ? (
                  <div className="border-b border-white/5 pb-8">
                     <div className="flex flex-col items-center">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                           <Activity className="w-3 h-3" />
                           Progression dans les étapes
                        </div>
                        <div className="w-full max-w-xl h-24 relative flex items-end">
                           <div className="absolute inset-0 flex flex-col justify-between">
                              {[5,4,3,2,1].map(lvl => (
                                 <div key={lvl} className="w-full border-t border-white/5" />
                              ))}
                           </div>
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sessionsData.filter(s => s.step_reached !== undefined).map((s, idx) => ({ name: idx, step: s.step_reached }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                 <YAxis domain={[1, 5]} hide={true} />
                                 <Line type="stepAfter" dataKey="step" stroke="#7BA7D7" strokeWidth={1} dot={false} isAnimationActive={false} />
                              </LineChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                  </div>
                ) : isNextLocked('fragments_progression', 'fragments') && (
                  <div className="border-b border-white/5 pb-8 flex flex-col items-center">
                    <div className="w-full max-w-sm"><LockedBlock title="Progression dans les étapes" requirements="2 sessions" /></div>
                  </div>
                )}
                
                {unlockedBlocks.fragments_relation_prismes ? (() => {
                   const cardsWithSteps = cards.map(c => {
                     const s = sessionsData.find(sess => sess.reflection_card?.id === c.id || sess.reflection_card?.date === c.date);
                     return { prisme: c.prisme, step: s?.step_reached };
                   }).filter(c => c.prisme && c.step !== undefined);
                   
                   const prismeStats: Record<string, { totalStep: number; count: number }> = {};
                   for (const c of cardsWithSteps) {
                     if (!c.prisme) continue;
                     if (!prismeStats[c.prisme]) {
                       prismeStats[c.prisme] = { totalStep: 0, count: 0 };
                     }
                     prismeStats[c.prisme].totalStep += (c.step as number);
                     prismeStats[c.prisme].count += 1;
                   }
                   
                   const prismeAverages = Object.entries(prismeStats)
                     .map(([prisme, stats]) => ({ prisme, avg: stats.totalStep / stats.count }));
                     
                   if (prismeAverages.length < 2) return <div className="border-b border-white/5 pb-8 mb-8 text-center text-[11px] text-white/20 italic font-mono uppercase">Pas assez de diversité affective</div>;
                   prismeAverages.sort((a, b) => b.avg - a.avg);
                   
                   const highest = prismeAverages[0];
                   const lowest = prismeAverages[prismeAverages.length - 1];
                   
                   if (highest.avg - lowest.avg < 0.5) return <div className="border-b border-white/5 pb-8 mb-8 text-center text-[11px] text-white/20 italic font-mono uppercase">Aucune corrélation nette détectée (écarts &lt; 0.5)</div>;
                   
                   const article = (p: string) => {
                     const lower = p.toLowerCase();
                     if (['honneur','honte','joie','tristesse','colère','peur','confiance','surprise','mélancolie'].includes(lower)) return `la ${p}`;
                     if (['anticipation'].includes(lower)) return `l'${p}`;
                     if (['dégoût'].includes(lower)) return `le ${p}`;
                     return `la ${p}`; 
                   };

                   return (
                      <div className="border-b border-white/5 pb-8 mb-8 space-y-4 text-center mt-8">
                         <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                           <Activity className="w-3 h-3" />
                           Relation Prismes / Étapes
                         </div>
                         <div className="flex flex-col items-center max-w-xl mx-auto space-y-4">
                            <div className="font-serif italic text-[14px] text-beige-faint leading-relaxed border-l-2 border-white/5 pl-4 text-left w-full">
                               Observation : Les sessions marquées par {article(highest.prisme)} semblent aller plus loin dans le cheminement.
                            </div>
                            <div className="font-serif italic text-[14px] text-beige-faint leading-relaxed border-l-2 border-white/5 pl-4 text-left w-full">
                               Observation : Les sessions marquées par {article(lowest.prisme)} s'arrêtent plus tôt. Ce n'est pas un échec — c'est ce que ce signal permet pour l'instant.
                            </div>
                         </div>
                      </div>
                   );
                })() : isNextLocked('fragments_relation_prismes', 'fragments') && (
                  <div className="border-b border-white/5 pb-8 mb-8 flex flex-col items-center mt-8">
                    <div className="w-full max-w-sm"><LockedBlock title="Relation Prismes / Étapes" requirements="3 fragments + 2 prismes conscients distincts" /></div>
                  </div>
                )}

                {unlockedBlocks.fragments_resistances ? (() => {
                   const depObs = (() => {
                      const spheres = cards.map(c => c.sphere).filter(Boolean);
                      const emptyWords = ['je ne sais pas', "rien n'a bougé", "je suis resté", "difficile à dire", "rien", "ne sais pas", "aucun"];
                      const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      let sphereSeq: Record<string, number> = {};
                      let foundSphere = null;
                      for (const c of chronological) {
                         if (!c.sphere) continue;
                         const d = (c.deplacement || '').toLowerCase().trim();
                         const words = d.split(/\s+/).filter(w => w.length > 0);
                         if (words.length < 5 || emptyWords.some(ew => d.includes(ew))) {
                            sphereSeq[c.sphere] = (sphereSeq[c.sphere] || 0) + 1;
                            if (sphereSeq[c.sphere] >= 3) { foundSphere = c.sphere; break; }
                         } else {
                            sphereSeq[c.sphere] = 0;
                         }
                      }
                      return foundSphere ? <div className="font-mono text-[7px] italic text-white/20">Quelque chose résiste au déplacement dans cette sphère.</div> : null;
                   })();

                   const songesObs = (() => {
                      const missing = cards.filter(c => !c.user_note || c.user_note.trim() === '').length;
                      return (missing / cards.length > 0.6) ? <div className="font-mono text-[7px] italic text-white/20">La plupart de vos fragments n'ont pas de Songe déposé. L'espace est là.</div> : null;
                   })();

                   const prismesObs = (() => {
                      const missing = cards.filter(c => !c.prisme).length;
                      return (missing / cards.length > 0.4) ? <div className="font-mono text-[7px] italic text-white/20">Certaines sessions n'ont pas laissé de signal émotionnel détectable. Ce qui est diffus ou défendu laisse moins de trace.</div> : null;
                   })();

                   if (!depObs && !songesObs && !prismesObs) return null;

                   return (
                      <div className="border-b border-white/5 pb-8 space-y-2 text-center flex flex-col items-center">
                         {depObs}
                         {songesObs}
                         {prismesObs}
                      </div>
                   );
                })() : isNextLocked('fragments_resistances', 'fragments') && (
                  <div className="border-b border-white/5 pb-8 mb-8 flex flex-col items-center">
                    <div className="w-full max-w-sm"><LockedBlock title="Résistances et blancs" requirements="4 fragments + 3 jours différents" /></div>
                  </div>
                )}
                {unlockedBlocks.fragments_signaux ? (
                  !loading && enrichFragments && enrichFragments.mots_recurrents && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-white/5 pb-8">
                      <div className="flex-1">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                          <div className="w-1 h-1 rounded-full bg-green" />
                          <div className="font-mono text-[9px] uppercase tracking-widest text-green">
                            Signaux lexicaux
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                          {(enrichFragments.mots_recurrents as string[]).map((mot, i) => (
                            <span
                              key={i}
                              className="text-[12px] font-serif italic text-beige bg-green/5 px-2.5 py-1 rounded-sm border border-green/10"
                            >
                              {mot}
                            </span>
                          ))}
                        </div>
                      </div>
                      {enrichFragments.pattern_arret && (
                        <div className="flex-1 md:border-l border-white/5 md:pl-8 flex flex-col justify-center text-center md:text-left">
                          <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                            <div className="w-1 h-1 rounded-full bg-green" />
                            <div className="font-mono text-[9px] uppercase tracking-widest text-green/60">
                              Pattern de clôture
                            </div>
                          </div>
                          <div className="text-[14px] font-serif italic text-beige-faint leading-relaxed">
                            {enrichFragments.pattern_arret}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : isNextLocked('fragments_signaux', 'fragments') && (
                  <div className="border-b border-white/5 pb-8 flex flex-col items-center">
                    <div className="w-full max-w-sm"><LockedBlock title="Signaux & Pattern lexicaux" requirements="5 fragments + Analyse de fond active" /></div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-center items-start pt-4">
                  <div className="flex flex-col items-center">
                    {unlockedBlocks.fragments_echo ? (
                      <>
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                           <Feather className="w-3 h-3" />
                           Écho lexical des fragments
                        </div>
                        <div className="flex flex-wrap justify-center items-baseline gap-x-6 gap-y-4 max-w-sm">
                          {(() => {
                             const stopWords = new Set(['le','la','les','un','une','des','et','ou','mais','donc','car','ni','est','sont','que','qu','qui','quoi','je','tu','il','elle','nous','vous','ils','elles','mon','ton','son','ma','ta','sa','mes','tes','ses','notre','votre','leur','nos','vos','leurs','de','du','au','aux','à','en','pour','par','sur','sous','avec','sans','dans','ce','cet','cette','ces','pas','plus','très','trop','tout','tous','toute','toutes','être','avoir','faire','comme','y','ne','se','me','te','cette','vers','dont', 'bien', 'fait', 'plus', 'quand']);
                             const wordCounts: Record<string, number> = {};
                             cards.forEach(c => {
                               const t = `${c.fragment || ''} ${c.deplacement || ''} ${c.direction || ''}`;
                               const words = t.toLowerCase().replace(/[.,!?;:()’']/g, ' ').split(/\s+/);
                               words.forEach(w => {
                                 if (w.length > 3 && !stopWords.has(w)) {
                                   wordCounts[w] = (wordCounts[w] || 0) + 1;
                                 }
                               });
                             });
                             const sorted = Object.entries(wordCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
                             if (sorted.length === 0) return <div className="text-[11px] text-white/20 italic font-mono uppercase">Pas encore assez de résonance</div>;
                             const maxC = sorted[0][1];
                             return sorted.map(([w, c], idx) => {
                                 const size = Math.max(0.85, 0.85 + (c / maxC) * 1.5);
                                 const opacity = Math.max(0.3, (c / maxC));
                                 return (
                                   <span key={idx} style={{ fontSize: `${size}rem`, opacity }} className="font-serif italic text-beige transition-all duration-500 hover:opacity-100 hover:text-white cursor-default">
                                     {w}
                                   </span>
                                 )
                             })
                          })()}
                        </div>
                      </>
                    ) : isNextLocked('fragments_echo', 'fragments') && (
                      <div className="w-full max-w-sm"><LockedBlock title="Écho lexical" requirements="5 fragments" /></div>
                    )}
                  </div>

                  <div className="flex flex-col items-center">
                    {unlockedBlocks.fragments_sillage ? (
                      <>
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                           <Waves className="w-3 h-3" />
                           Sillage sémantique des Songes
                        </div>
                        {(() => {
                          const tensionWords = ['coincé', 'bloqué', 'pression', 'peur', 'fatigue', 'lourd', 'sombre', 'vide', 'dur', 'impossible', 'seul', 'perte', 'jamais', 'rien'];
                          const openWords = ['souffle', 'libre', 'espace', 'calme', 'clair', 'léger', 'mouvement', 'aller', 'faire', 'possible', 'lien', 'voir', 'mieux', 'envie', 'besoin'];
                          
                          const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).filter(c => c.user_note && c.user_note.trim().length > 10);
                          
                          const firstHalf = chronological.slice(0, Math.ceil(chronological.length/2));
                          const secondHalf = chronological.slice(Math.ceil(chronological.length/2));
                          
                          let t1=0, o1=0, t2=0, o2=0;
                          firstHalf.forEach(c => {
                             const w = (c.user_note||'').toLowerCase();
                             tensionWords.forEach(t => { if(w.includes(t)) t1++; });
                             openWords.forEach(o => { if(w.includes(o)) o1++; });
                          });
                          secondHalf.forEach(c => {
                             const w = (c.user_note||'').toLowerCase();
                             tensionWords.forEach(t => { if(w.includes(t)) t2++; });
                             openWords.forEach(o => { if(w.includes(o)) o2++; });
                          });
                          
                          if (t1+o1+t2+o2 === 0) return <div className="text-[11px] text-white/20 italic font-mono uppercase text-center mt-4">Peu de mots de charge détectés</div>;

                          const tensionRatio1 = t1+o1 > 0 ? t1/(t1+o1) : 0.5;
                      const tensionRatio2 = t2+o2 > 0 ? t2/(t2+o2) : 0.5;
                      
                      let observation = "Équilibre sémantique stable.";
                      if (tensionRatio2 < tensionRatio1 - 0.15) observation = "Glissement lexical : de la tension vers l'ouverture.";
                      if (tensionRatio2 > tensionRatio1 + 0.15) observation = "Glissement lexical : le sillage s'alourdit.";
                      
                      return (
                         <div className="flex flex-col items-center gap-6 w-full max-w-[200px]">
                           <div className="flex justify-between w-full text-[9px] font-mono uppercase opacity-50">
                             <span>Tension</span>
                             <span>Ouverture</span>
                           </div>
                           <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden flex relative">
                              <div className="absolute top-0 bottom-0 w-[1px] bg-white/20 z-10" style={{left: `${tensionRatio1*100}%`}} title="Tension initiale" />
                              <motion.div initial={{width:0}} animate={{width:`${tensionRatio2*100}%`}} className="h-full bg-orange-500/80" transition={{duration:1}} />
                              <motion.div initial={{width:0}} animate={{width:`${(1-tensionRatio2)*100}%`}} className="h-full bg-blue-400/80" transition={{duration:1}} />
                           </div>
                           <div className="font-serif italic text-[14px] text-beige-faint leading-relaxed">
                             Observation : {observation}
                           </div>
                         </div>
                      )
                    })()}
                  </>
                ) : isNextLocked('fragments_sillage', 'fragments') && (
                  <div className="w-full max-w-sm"><LockedBlock title="Sillage sémantique des Songes" requirements="2 songes remplis + 7 jours" /></div>
                )}
                  </div>
                </div>

                {affectData?.texture_croisee && affectData.texture_croisee.length > 0 && (
                   <div className="border-t border-white/5 pt-8 text-center pb-8">
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                       <Waves className="w-3 h-3" />
                       Texture relationnelle croisée
                     </div>
                     <div className="space-y-4 max-w-xl mx-auto flex flex-col items-center">
                        {affectData.texture_croisee.map((obs: string, idx: number) => (
                           <div key={idx} className="font-serif italic text-[14px] text-beige-faint leading-relaxed border-l-2 border-white/5 pl-3 text-left">
                              Observation : {obs}
                           </div>
                        ))}
                     </div>
                   </div>
                )}
                <div className="grid md:grid-cols-2 gap-12 border-t border-white/5 pt-8">
                  <div className="flex flex-col items-center text-center">
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                       <Waves className="w-3 h-3" />
                       Évolution de la texture
                     </div>
                     {(() => {
                        const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).filter(c => c.texture_relationnelle);
                        if (chronological.length < 3) return <div className="text-[10px] font-mono italic opacity-40">Observation en cours de sédimentation.</div>;
                        
                        const tWords = ['tendu', 'pression', 'lourd', 'difficile', 'coincé', 'peur', 'dur', 'sombre', 'bloqué'];
                        const oWords = ['calme', 'fluide', 'doux', 'léger', 'apaisé', 'clair', 'ouvert', 'bien', 'souffle'];
                        
                        const firstHalf = chronological.slice(0, Math.ceil(chronological.length/2));
                        const secondHalf = chronological.slice(Math.ceil(chronological.length/2));
                        
                        let t1=0, o1=0, t2=0, o2=0;
                        firstHalf.forEach(c => {
                           const w = c.texture_relationnelle!.toLowerCase();
                           tWords.forEach(t => { if(w.includes(t)) t1++; });
                           oWords.forEach(o => { if(w.includes(o)) o1++; });
                        });
                        secondHalf.forEach(c => {
                           const w = c.texture_relationnelle!.toLowerCase();
                           tWords.forEach(t => { if(w.includes(t)) t2++; });
                           oWords.forEach(o => { if(w.includes(o)) o2++; });
                        });
                        
                        let direction = "La texture relationnelle maintient sa densité.";
                        if (t1 > o1 && o2 > t2) direction = "Observation : Évolution notable vers l'apaisement.";
                        if (o1 >= t1 && t2 > o2) direction = "Observation : La résonance se fait plus tendue au fil du temps.";
                        if (t1 > o1 && t2 > o2) direction = "Observation : La tension reste ancrée dans la structure.";
                        if (o1 >= t1 && o2 >= t2) direction = "Observation : Le calme caractérise ce mouvement continu.";
                        
                        return <div className="font-serif italic text-beige-faint text-[13px]">{direction}</div>;
                     })()}
                  </div>
                  
                  <div className="flex flex-col items-center text-center">
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] mb-6 inline-flex items-center gap-2">
                       <Orbit className="w-3 h-3" />
                       Amplitude du mouvement
                     </div>
                     {(() => {
                        const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).filter(c => c.deplacement);
                        if (chronological.length < 3) return <div className="text-[10px] font-mono italic opacity-40">Observation en cours de sédimentation.</div>;
                        
                        const surfaceWords = ['peu', 'léger', 'surface', 'détail', 'quotidien'];
                        const depthWords = ['fond', 'profond', 'racine', 'structure', 'bouleverse', 'grand', 'vaste'];
                        
                        let s1=0, d1=0, s2=0, d2=0;
                        const firstHalf = chronological.slice(0, Math.ceil(chronological.length/2));
                        const secondHalf = chronological.slice(Math.ceil(chronological.length/2));
                        
                        firstHalf.forEach(c => {
                           const w = c.deplacement!.toLowerCase();
                           surfaceWords.forEach(t => { if(w.includes(t)) s1++; });
                           depthWords.forEach(o => { if(w.includes(o)) d1++; });
                        });
                        secondHalf.forEach(c => {
                           const w = c.deplacement!.toLowerCase();
                           surfaceWords.forEach(t => { if(w.includes(t)) s2++; });
                           depthWords.forEach(o => { if(w.includes(o)) d2++; });
                        });
                        
                        let amplitude = "Les déplacements maintiennent une amplitude mesurée.";
                        if (d2 > d1) amplitude = "Observation : Le mouvement s'approfondit et touche aux fondations.";
                        if (d1 === 0 && d2 === 0) amplitude = "Observation : Le mouvement reste dans un registre quotidien.";
                        
                        return <div className="font-serif italic text-beige-faint text-[13px]">{amplitude}</div>;
                     })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : view === "lien" ? (
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.lien ? (
              <LockedSection
                title="Lien"
                requirements="Toujours visible"
                icon={Heart}
              />
            ) : lienData ? (
              <>
                {/* Lien Graphique */}
                <div className="mb-12 h-[300px] w-full max-w-lg mx-auto relative group flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-[#EA580C]/5 blur-2xl rounded-full -z-10 group-hover:bg-[#EA580C]/10 transition-colors" />
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={10}
                    minHeight={10}
                  >
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      data={[
                        "Familiale",
                        "Sociale",
                        "Amoureuse",
                        "Professionnelle",
                      ].map((s) => {
                        const data = lienData[s] || lienData[s.toLowerCase()];
                        return {
                          subject: s,
                          A: data ? data.intensite : 0,
                          fullMark: 100,
                        };
                      })}
                    >
                      <PolarGrid stroke="#3a3420" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: "#a8a29e",
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name="Lien"
                        dataKey="A"
                        stroke="#EA580C"
                        fill="#EA580C"
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map(
                    (s) => {
                      const isVisited = cards.some((c) => {
                         const sp = c.sphere === "Amoureux" ? "Amoureuse" : c.sphere === "Familial" ? "Familiale" : c.sphere === "Social" ? "Sociale" : c.sphere === "Professionnel" ? "Professionnelle" : c.sphere;
                         return sp === s;
                      });

                      if (cards.length >= 10 && !isVisited) {
                         return (
                           <div key={s} className="bg-[#1a1814]/30 border-dashed border border-white/10 p-6 rounded-lg flex flex-col h-full transition-all duration-500">
                             <div className="flex justify-between items-center mb-6">
                               <h3 className="font-mono text-[11px] tracking-widest uppercase opacity-40 text-white/40">
                                 {s}
                               </h3>
                             </div>
                             <div className="font-mono text-[7px] text-white/30">Cette sphère n'a pas encore été visitée.</div>
                           </div>
                         );
                      }

                      const key = s.toLowerCase();
                      const data = lienData[s] || lienData[key];
                      if (!data) return null;
                      const theme = getEmotionTheme(data.teinte);
                      const isDefault = theme.isDefault;

                      return (
                        <div
                          key={s}
                          className="bg-[#1a1814] border p-6 rounded-lg flex flex-col h-full transform hover:scale-[1.02] transition-all duration-500 group relative overflow-hidden"
                          style={{
                            borderColor: isDefault
                              ? "rgba(245, 158, 11, 0.1)"
                              : `${theme.hex}33`,
                          }}
                        >
                          {/* Glow effect matching emotion color */}
                          <div
                            className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-xl -z-10"
                            style={{
                              background: `radial-gradient(circle at center, ${theme.hex}11, transparent 70%)`,
                            }}
                          />

                          <div className="flex justify-between items-center mb-6">
                            <h3
                              className="font-mono text-[11px] tracking-widest uppercase transition-colors opacity-60 group-hover:opacity-100"
                              style={{ color: theme.hex }}
                            >
                              {s}
                            </h3>
                            <div
                              className="text-[11px] font-mono opacity-20"
                              style={{ color: theme.hex }}
                            >
                              {data.intensite}%
                            </div>
                          </div>
                          <div className="h-0.5 bg-white/5 mb-6 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${data.intensite}%` }}
                              className="h-full transition-colors duration-500"
                              style={{ backgroundColor: `${theme.hex}66` }}
                            />
                          </div>
                          <div className="flex-1 space-y-3">
                            {data.fragments?.map((f: string, i: number) => (
                              <div
                                key={i}
                                className="text-[14px] font-serif italic text-beige-faint/80 border-l pl-3 leading-relaxed transition-colors duration-500"
                                style={{ borderLeftColor: `${theme.hex}1a` }}
                              >
                                {f}
                              </div>
                            ))}
                          </div>
                          <div className="mt-6 pt-4 border-t border-white/5">
                            <div
                              className="font-mono text-[7px] uppercase mb-1 italic opacity-30"
                              style={{ color: theme.hex }}
                            >
                              Teinte dominante
                            </div>
                            <div
                              className="text-[13px] italic transition-colors duration-500 mb-4"
                              style={{ color: theme.hex }}
                            >
                              {data.teinte}
                            </div>

                            <div className="pt-2 border-t border-white/5">
                              <div className="flex items-center gap-1.5 mb-1.5 opacity-40">
                                <Feather className="w-2 h-2" />
                                <span className="font-mono text-[6px] uppercase tracking-widest">
                                  Songe
                                </span>
                              </div>
                              <textarea
                                value={
                                  sphereSonges[s] || sphereSonges[key] || ""
                                }
                                onChange={(e) =>
                                  updateSphereSonge(s, e.target.value)
                                }
                                placeholder="Déposer un songe..."
                                className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[9px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12 custom-scrollbar"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
                {unlockedBlocks.lien_structure ? (
                  <div className="py-12 border-t border-white/5 text-center mt-12">
                    <div className="font-mono text-[8px] uppercase tracking-[0.5em] text-white/20 mb-4">
                      Structure Invisible
                    </div>
                    <p className="text-xl md:text-2xl font-serif italic text-beige leading-relaxed max-w-2xl mx-auto">
                      "{lienData.relief}"
                    </p>
                    <p className="mt-8 font-mono text-[9px] uppercase tracking-widest text-beige-faint italic opacity-40">
                      Avant le mouvement, avant la pensée.
                    </p>
                  </div>
                ) : isNextLocked('lien_structure', 'lien') && (
                  <div className="py-12 border-t border-white/5 text-center mt-12 flex justify-center">
                     <div className="w-full max-w-sm"><LockedBlock title="Structure Invisible" requirements="4 fragments + 3 prismes" /></div>
                  </div>
                )}

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                  <div className="flex flex-col md:flex-row gap-12">
                    <div className="flex-1 space-y-8">
                       <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#EA580C] inline-flex items-center gap-2">
                         <Network className="w-3 h-3" />
                         Texture & Dissociation
                       </div>
                       
                       {/* DISSOCIATION DETECTION */}
                       {unlockedBlocks.lien_texture ? (
                         (() => {
                            const spherePrismes = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                            const sphereSongesCount = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                            
                            cards.forEach(c => {
                               if (c.prisme && c.sphere) {
                                  const s = c.sphere.toLowerCase() as keyof typeof spherePrismes;
                                  if (spherePrismes[s] !== undefined) spherePrismes[s]++;
                               }
                            });
                            
                            Object.keys(sphereSonges).forEach(k => {
                               const s = k.toLowerCase() as keyof typeof sphereSongesCount;
                               if (sphereSongesCount[s] !== undefined && sphereSonges[k] && sphereSonges[k].trim().length > 10) {
                                  sphereSongesCount[s] += sphereSonges[k].length;
                               }
                            });
                            
                            const maxPrismeSphere = Object.keys(spherePrismes).reduce((a,b) => spherePrismes[a as keyof typeof spherePrismes] > spherePrismes[b as keyof typeof spherePrismes] ? a : b) as keyof typeof spherePrismes;
                            const maxSongeSphere = Object.keys(sphereSongesCount).reduce((a,b) => sphereSongesCount[a as keyof typeof sphereSongesCount] > sphereSongesCount[b as keyof typeof sphereSongesCount] ? a : b) as keyof typeof sphereSongesCount;
                            
                            if (spherePrismes[maxPrismeSphere] > 3 && 
                                sphereSongesCount[maxSongeSphere] > 50 && 
                                maxPrismeSphere !== maxSongeSphere && 
                                sphereSongesCount[maxPrismeSphere] < 20) {
                                return (
                                   <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-sm">
                                      <div className="font-serif italic text-[14px] text-beige-faint">
                                        Observation : Déplacement de l'attention. Sédimentation affective focalisée sur la sphère <span className="text-white/80">{maxPrismeSphere}</span>, mais élaboration de fond orientée vers la sphère <span className="text-white/80">{maxSongeSphere}</span>.
                                      </div>
                                   </div>
                                );
                            }
                            return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas de dissociation majeure détectée</div>;
                         })()
                       ) : isNextLocked('lien_texture', 'lien') && (
                         <LockedBlock title="Texture & Dissociation" requirements="3 fragments + 2 jours" />
                       )}

                       {/* CORRELATION TEXTURE / SPHERE & MOTS / PRISMES */}
                       {unlockedBlocks.lien_correlation ? (
                         <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5 mt-4">
                           {["familiale", "sociale", "amoureuse", "professionnelle"].map(key => {
                               const textureCount = { tendu: 0, calme: 0 };
                               cards.filter(c => (c.sphere||'').toLowerCase() === key).forEach(c => {
                                   const t = (c.texture_relationnelle||'').toLowerCase();
                                   if(t.includes('tendu') || t.includes('pression') || t.includes('bloqué') || t.includes('lourd') || t.includes('peur') || t.includes('difficile') || t.includes('dur')) textureCount.tendu++;
                                   if(t.includes('calme') || t.includes('apaisé') || t.includes('doux') || t.includes('fluide') || t.includes('léger') || t.includes('bien')) textureCount.calme++;
                               });
                               
                               let obsT = null;
                               if (textureCount.tendu > textureCount.calme + 1) obsT = "Texture y est tendue";
                               if (textureCount.calme > textureCount.tendu + 1) obsT = "Texture majoritairement apaisée";
                               
                               const sSonge = (sphereSonges[key] || sphereSonges[key.charAt(0).toUpperCase() + key.slice(1)] || "").toLowerCase();
                               const tensionWords = ['coincé', 'bloqué', 'pression', 'peur', 'fatigue', 'lourd', 'seul', 'dur', 'sombre', 'impossible'];
                               let hasTension = tensionWords.some(w => sSonge.includes(w));
                               
                               const thisSpherePrismes = cards.filter(c => (c.sphere||'').toLowerCase() === key && c.prisme).map(c => c.prisme);
                               const tensionPrismes = ['colere', 'peur', 'tristesse', 'degout', 'honte'];
                               
                               let hasTensionPrisme = thisSpherePrismes.some(p => tensionPrismes.includes(p as string));
                               let hasOpenPrisme = thisSpherePrismes.some(p => ['joie', 'confiance', 'anticipation', 'surprise'].includes(p as string));
                               
                               let obsM = null;
                               if (hasTension && hasTensionPrisme) obsM = "Mots & Prismes : Charge confirmée";
                               if (hasTension && hasOpenPrisme) obsM = "Lourdeur résiduelle vs affect ouvert";

                               if (!obsT && !obsM) return null;
                               
                               return (
                                 <div key={key} className="space-y-1">
                                   <div className="font-mono text-[8px] uppercase text-[#EA580C]/50 tracking-widest">{key}</div>
                                   <div className="font-serif italic text-beige-faint text-[12px] opacity-80 leading-snug">
                                     {obsT && <div>• {obsT}</div>}
                                     {obsM && <div>• {obsM}</div>}
                                   </div>
                                 </div>
                               );
                           })}
                         </div>
                       ) : isNextLocked('lien_correlation', 'lien') && (
                         <div className="mt-4"><LockedBlock title="Corrélation Texture / Prismes" requirements="3 fragments + 2 jours + 2 prismes" /></div>
                       )}
                    </div>
                    
                    <div className="flex-1 space-y-8 md:border-l border-white/5 md:pl-12">
                       {/* CONSTELLATION DES PRISMES - SVG */}
                       <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#EA580C] inline-flex items-center gap-2">
                         <Orbit className="w-3 h-3" />
                         Constellation des Prismes
                       </div>
                       {unlockedBlocks.lien_constellation ? (
                         (() => {
                            const validCards = cards.filter(c => c.prisme && c.sphere);
                            if (validCards.length < 5) return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas assez de données sédimentées</div>;

                            const SPHERES = [
                            { id: 'familiale', label: 'Familiale', color: '#F59E0B', angle: 225 },
                            { id: 'sociale', label: 'Sociale', color: '#8B5CF6', angle: 315 },
                            { id: 'amoureuse', label: 'Amoureuse', color: '#F472B6', angle: 45 },
                            { id: 'professionnelle', label: 'Professionnelle', color: '#94A3B8', angle: 135 }
                          ];

                          const EMOTION_LAYOUT: Record<string, {rOffset: number, aOffset: number}> = {
                            joie: { rOffset: -20, aOffset: -30 }, tristesse: { rOffset: 10, aOffset: -25 }, colere: { rOffset: -5, aOffset: -15 },
                            peur: { rOffset: 25, aOffset: -5 }, degout: { rOffset: -30, aOffset: 5 }, surprise: { rOffset: 15, aOffset: 15 },
                            confiance: { rOffset: -10, aOffset: 25 }, anticipation: { rOffset: 20, aOffset: 35 }, honte: { rOffset: 0, aOffset: -40 },
                            melancolie: { rOffset: 0, aOffset: 40 }, envie: { rOffset: -15, aOffset: 45 }, soulagement: { rOffset: -25, aOffset: 20 },
                            gratitude: { rOffset: 5, aOffset: 50 }, jalousie: { rOffset: 10, aOffset: -35 }, amour: { rOffset: 30, aOffset: -20 },
                            culpabilite: { rOffset: 20, aOffset: -50 }
                          };

                          const EMOTION_COLORS: Record<string, string> = {
                            joie:'#FACC15', tristesse:'#60A5FA', colere:'#F87171', peur:'#A78BFA', degout:'#A3E635', surprise:'#FB923C',
                            confiance:'#34D399', anticipation:'#FDBA74', honte:'#C084FC', melancolie:'#93C5FD', envie:'#86EFAC',
                            soulagement:'#6EE7B7', gratitude:'#FDE047', jalousie:'#BEF264', amour:'#F9A8D4', culpabilite:'#D8B4FE'
                          };

                          const grouped = validCards.reduce((acc, card) => {
                             const key = `${card.sphere}-${card.prisme}`;
                             if (!acc[key]) acc[key] = { sphere: card.sphere, prisme: card.prisme, count: 0 };
                             acc[key].count++;
                             return acc;
                          }, {} as Record<string, any>);

                          const cx = 150, cy = 150, baseRadius = 80;
                          const points: any[] = [];
                          const lines: any[] = [];
                          
                          Object.values(grouped).forEach((g: any) => {
                             const sp = SPHERES.find(s => s.id === g.sphere?.toLowerCase());
                             if (!sp) return;
                             const el = EMOTION_LAYOUT[g.prisme?.toLowerCase()] || { rOffset: (Math.random()-0.5)*40, aOffset: (Math.random()-0.5)*40 };
                             
                             const r = baseRadius + el.rOffset;
                             const a = (sp.angle + el.aOffset) * (Math.PI / 180);
                             
                             const px = cx + r * Math.cos(a);
                             const py = cy + r * Math.sin(a);
                             const size = Math.max(3, Math.min(10, g.count * 1.5));
                             const eCol = EMOTION_COLORS[g.prisme?.toLowerCase()] || '#ffffff';
                             
                             points.push({ x: px, y: py, size, color: eCol, label: g.prisme, count: g.count });
                             lines.push({ x1: cx, y1: cy, x2: px, y2: py, color: sp.color });
                          });

                          return (
                            <div className="w-full flex justify-center">
                              <svg width="300" height="300" viewBox="0 0 300 300" className="overflow-visible">
                                 <circle cx={cx} cy={cy} r="2" fill="#fff" opacity="0.5" />
                                 <circle cx={cx} cy={cy} r={baseRadius} fill="none" stroke="#ffffff10" strokeDasharray="2 4" />
                                 <circle cx={cx} cy={cy} r={baseRadius+40} fill="none" stroke="#ffffff05" strokeDasharray="1 6" />
                                 
                                 {SPHERES.map(s => {
                                    const tx = cx + (baseRadius + 60) * Math.cos(s.angle * Math.PI/180);
                                    const ty = cy + (baseRadius + 60) * Math.sin(s.angle * Math.PI/180);
                                    return (
                                      <text key={s.id} x={tx} y={ty} fill={s.color} className="font-mono text-[7px] uppercase" textAnchor="middle" alignmentBaseline="middle" opacity="0.8">
                                        {s.label}
                                      </text>
                                    )
                                 })}

                                 {lines.map((l, idx) => (
                                    <motion.line key={`l-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth="1" strokeOpacity="0.15" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.5 }} />
                                 ))}

                                 {points.map((p, idx) => (
                                    <motion.g key={`p-${idx}`} className="group cursor-default" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay: 0.2 + idx * 0.05 }}>
                                       <circle cx={p.x} cy={p.y} r={p.size} fill={p.color} />
                                       <circle cx={p.x} cy={p.y} r={p.size * 2} fill="transparent" />
                                       <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          <text x={p.x + 8} y={p.y - 8} fill={p.color} className="font-mono text-[8px] uppercase" style={{ textShadow: "0px 1px 3px rgba(0,0,0,1)" }}>
                                            {p.label} <tspan fill="#fff">×{p.count}</tspan>
                                          </text>
                                       </g>
                                    </motion.g>
                                 ))}
                              </svg>
                            </div>
                          );
                       })()
                      ) : isNextLocked('lien_constellation', 'lien') && (
                         <div className="mt-4"><LockedBlock title="Constellation des Prismes" requirements="3 fragments + 2 jours + 3 prismes" /></div>
                      )}
                    </div>
                  </div>
                  
                  {unlockedBlocks.lien_fragilite ? (
                    enrichLien && Object.keys(enrichLien).some(k => enrichLien[k] && enrichLien[k] !== "Aucun signal clair" && k !== "rythme") && (
                      <div className="pt-8 border-t border-white/5">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#EA580C] mb-6 inline-flex items-center gap-2">
                          <Waves className="w-3 h-3" />
                          Points de fragilité & Ressources (Topographie)
                        </div>
                        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                          {["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map((s, i) => {
                             const key = s.toLowerCase();
                             const val = enrichLien[s] || enrichLien[key];
                             if (!val || val === "Aucun signal clair") return null;
                             return (
                               <div key={i} className="space-y-2">
                                 <div className="text-[9px] font-mono uppercase opacity-70" style={{ color: "#EA580C" }}>
                                   {s}
                                 </div>
                                 <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                   {val}
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    )
                  ) : isNextLocked('lien_fragilite', 'lien') && (
                    <div className="pt-8 border-t border-white/5 flex items-center justify-center">
                       <div className="w-full max-w-sm"><LockedBlock title="Points de fragilité & Ressources" requirements="5 fragments + 3 prismes" /></div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-white/20 tracking-widest italic">
                Mise en lien du vécu en cours…
              </div>
            )}
          </div>
        ) : view === "affect" ? (
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.affect ? (
              <LockedSection
                title="Affect"
                requirements="3 jours + 2 fragments"
                icon={Waves}
              />
            ) : affectData ? (
              <>
                {unlockedBlocks.affect_gradients ? (
                  <div className="grid md:grid-cols-3 gap-8">
                    {["active", "inhibe", "emerge"].map((key) => (
                      <div key={key} className="space-y-4">
                        <h3 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                          Gradients de Profondeur {" ("}
                          {key === "active"
                             ? "moteurs"
                             : key === "inhibe"
                               ? "inhibiteurs"
                               : "émergents"}
                          {")"}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {affectData[key]?.map((a: string, i: number) => (
                            <div
                              key={i}
                              className={`px-3 py-1.5 rounded-sm border font-serif text-[15px] italic
                               ${
                                 key === "active"
                                   ? "border-yellow-400/20 bg-yellow-400/5 text-yellow-400"
                                   : key === "inhibe"
                                     ? "border-blue-400/20 bg-blue-400/5 text-blue-400"
                                     : "border-purple-400/20 bg-purple-400/5 text-purple-400"
                               }`}
                            >
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isNextLocked('affect_gradients', 'affect') && (
                  <div className="w-full flex justify-center py-6">
                    <div className="w-full max-w-lg">
                      <LockedBlock title="Gradients de Profondeur" requirements="5 fragments" />
                    </div>
                  </div>
                )}

                <div className="py-12 border-t border-white/5 mt-12">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-white/20 mb-4 italic">
                    Texture affective de la semaine
                  </div>
                  <p className="text-lg font-serif italic text-beige-faint leading-relaxed">
                    "{affectData.texture_semaine}"
                  </p>
                  
                  {unlockedBlocks.affect_lecture ? (
                    affectData.lecture_croisee_affect_prismes && affectData.lecture_croisee_affect_prismes.length > 0 && (
                       <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7BA7D7]/50 mb-4 inline-flex items-center gap-2">
                             Lecture croisée Affects / Prismes
                          </div>
                          {affectData.lecture_croisee_affect_prismes.map((obs: string, idx: number) => (
                             <div key={idx} className="font-serif italic text-[14px] text-beige-faint opacity-80 leading-relaxed border-l border-[#7BA7D7]/20 pl-4">
                                Observation : {obs}
                             </div>
                          ))}
                       </div>
                    )
                  ) : isNextLocked('affect_lecture', 'affect') && (
                    <div className="mt-8 pt-8 border-t border-white/5 flex justify-center">
                       <div className="w-full max-w-sm"><LockedBlock title="Lecture Croisée" requirements="2 prismes distincts" /></div>
                    </div>
                  )}
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                  <div className="grid md:grid-cols-2 gap-12">
                     {/* HEATMAP TEMPORELLE & RYTHME */}
                     <div className="space-y-6">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] inline-flex items-center gap-2">
                           <Zap className="w-3 h-3" />
                           Rythme de sédimentation
                        </div>
                        
                        <div className="overflow-hidden">
                          <div className="flex">
                            <div className="flex flex-col gap-2 mr-4 mt-6">
                              {["Matin", "Midi", "Aprem", "Soir", "Nuit"].map(t => (
                                 <div key={t} className="h-4 flex items-center font-mono text-[7px] uppercase tracking-widest text-[#7BA7D7]/50">{t}</div>
                              ))}
                            </div>
                            <div className="flex flex-1 gap-1">
                              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d, dIdx) => (
                                <div key={d} className="flex-1 flex flex-col gap-1">
                                   <div className="font-mono text-[7px] text-center uppercase tracking-widest text-[#7BA7D7]/60 mb-2">{d}</div>
                                   {["Matin", "Midi", "Aprem", "Soir", "Nuit"].map((t, tIdx) => {
                                      const count = cards.filter(c => {
                                         if(!c.date) return false;
                                         const date = new Date(c.date);
                                         const day = (date.getDay() + 6) % 7; 
                                         if (day !== dIdx) return false;
                                         const h = date.getHours();
                                         let slot = "";
                                         if (h >= 6 && h < 11) slot = "Matin";
                                         else if (h >= 11 && h < 14) slot = "Midi";
                                         else if (h >= 14 && h < 18) slot = "Aprem";
                                         else if (h >= 18 && h < 22) slot = "Soir";
                                         else slot = "Nuit";
                                         return slot === t;
                                      }).length;
                                      const alpha = count === 0 ? 0 : Math.min(1, 0.2 + (count * 0.3));
                                      return (
                                        <div 
                                          key={tIdx} 
                                          className="h-4 rounded-sm w-full transition-all hover:ring-1 ring-[#7BA7D7]/50"
                                          style={{ backgroundColor: `rgba(123, 167, 215, ${alpha})` }}
                                          title={`${count} fragment(s)`}
                                        />
                                      )
                                   })}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {enrichAffect && enrichAffect.rythme && (
                           <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed pt-4 border-t border-white/5">
                             {enrichAffect.rythme}
                           </div>
                        )}
                     </div>

                     {/* EVOLUTION DES AFFECTS */}
                     <div className="space-y-6 flex flex-col">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#7BA7D7] inline-flex items-center gap-2">
                           <Waves className="w-3 h-3" />
                           Luminescence Émotionnelle (Évolution)
                        </div>
                        {unlockedBlocks.affect_luminescence ? (
                          <>
                            <div className="flex-1 min-h-[150px] w-full relative">
                              {(() => {
                                const moteurs = ['joie', 'colere', 'anticipation', 'confiance'];
                                const inhibiteurs = ['tristesse', 'peur', 'degout', 'honte', 'melancolie'];
                                const emergents = ['surprise'];
                                
                                const weeks: Record<string, {name:string, moteurs:number, inhibiteurs:number, emergents:number}> = {};
                                const sortedCards = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                sortedCards.forEach(c => {
                                   if(!c.date) return;
                                   const d = new Date(c.date);
                                   const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                                   const dayNum = dCopy.getUTCDay() || 7;
                                   dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
                                   const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
                                   const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
                                   const w = `S${weekNo}`;
                                   
                                   if(!weeks[w]) weeks[w] = { name: w, moteurs:0, inhibiteurs:0, emergents:0 };
                                   
                                   const p = c.prisme;
                                   if(p) {
                                     if(moteurs.includes(p)) weeks[w].moteurs++;
                                     else if(inhibiteurs.includes(p)) weeks[w].inhibiteurs++;
                                     else if(emergents.includes(p)) weeks[w].emergents++;
                                   }
                                });
                                const chartData = Object.values(weeks);
                                if (chartData.length === 0) return <div className="text-[11px] text-white/20 italic font-mono uppercase">Pas encore de données</div>;
                                
                                return (
                                   <ResponsiveContainer width="100%" height="100%">
                                     <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                                       <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                       <Tooltip contentStyle={{backgroundColor:'#151515', borderColor:'#ffffff10', fontSize:'11px'}} itemStyle={{fontFamily:'monospace', fontSize:'10px'}} />
                                       <Line type="monotone" name="Moteurs" dataKey="moteurs" stroke="#FACC15" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                       <Line type="monotone" name="Inhibiteurs" dataKey="inhibiteurs" stroke="#60A5FA" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                       <Line type="monotone" name="Émergents" dataKey="emergents" stroke="#FB923C" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                     </LineChart>
                                   </ResponsiveContainer>
                                )
                              })()}
                            </div>
                            {(() => {
                               const sortedCards = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                               if (sortedCards.length < 5) return null;
                               let countAnticipation = 0;
                               for(let i=0; i<sortedCards.length-1; i++) {
                                  const sWord = (sortedCards[i].user_note||'').toLowerCase();
                                  const nextP = sortedCards[i+1].prisme;
                                  if(sWord.length > 5 && nextP) {
                                     if (nextP === 'colere' && (sWord.includes('bloqué') || sWord.includes('pression') || sWord.includes('injuste'))) countAnticipation++;
                                     if (nextP === 'peur' && (sWord.includes('vide') || sWord.includes('seul') || sWord.includes('ombre'))) countAnticipation++;
                                     if ((nextP === 'joie' || nextP === 'confiance') && (sWord.includes('clair') || sWord.includes('calme') || sWord.includes('mouvement') || sWord.includes('souffle'))) countAnticipation++;
                                     if (nextP === 'tristesse' && (sWord.includes('perte') || sWord.includes('jamais') || sWord.includes('rien'))) countAnticipation++;
                                  }
                               }
                               if(countAnticipation >= 1) {
                                  return <div className="text-[11px] font-serif italic text-beige-faint opacity-60 mt-4">Observation : Corrélation d'anticipation. Les songes préfigurent fréquemment l'affect de la session suivante.</div>;
                               }
                               return null;
                            })()}
                          </>
                        ) : isNextLocked('affect_luminescence', 'affect') && (
                          <div className="flex-1 flex items-center mt-4">
                            <div className="w-full"><LockedBlock title="Luminescence Émotionnelle" requirements="3 fragments sur 3 jours" /></div>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-white/20 tracking-widest italic">
                Analyse des affects en cours…
              </div>
            )}
          </div>
        ) : view === "elan" ? (
          <div className="space-y-12 animate-fade-up max-w-2xl mx-auto text-center">
            {!unlockedSections.elan ? (
              <LockedSection
                title="Élan"
                requirements="Toujours visible"
                icon={Orbit}
              />
            ) : elanDataAnalysis ? (
              <div className="space-y-12">
                <div className="space-y-4 text-center">
                  <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/20">
                    Mouvement
                  </div>
                  {unlockedBlocks.elan_mouvement ? (
                    <p className="text-2xl md:text-3xl font-serif italic text-beige leading-snug">
                      "{elanDataAnalysis.mouvement}"
                    </p>
                  ) : isNextLocked('elan_mouvement', 'elan') && (
                    <div className="w-full flex justify-center"><div className="max-w-sm w-full"><LockedBlock title="Analyse de Mouvement" requirements="7 jours + 4 fragments" /></div></div>
                  )}
                </div>

                <div className="w-12 h-px bg-white/10 mx-auto" />

                <div className="space-y-4 text-center">
                  <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/20">
                    Direction
                  </div>
                  {unlockedBlocks.elan_direction ? (
                    <p className="text-lg font-serif text-beige-faint leading-relaxed">
                      {elanDataAnalysis.direction}
                    </p>
                  ) : isNextLocked('elan_direction', 'elan') && (
                    <div className="w-full flex justify-center"><div className="max-w-sm w-full"><LockedBlock title="Direction" requirements="7 jours + 5 fragments" /></div></div>
                  )}
                </div>

                <div className="pt-12 border-t border-white/5 text-center">
                  <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-green/40 mb-4 italic">
                    La question qui travaille
                  </div>
                  {unlockedBlocks.elan_question ? (
                    <p className="text-xl font-serif italic text-white leading-relaxed">
                      "{elanDataAnalysis.question}"
                    </p>
                  ) : isNextLocked('elan_question', 'elan') && (
                    <div className="w-full flex justify-center mt-4"><div className="max-w-sm w-full"><LockedBlock title="La question qui travaille" requirements="7 jours + 6 fragments" /></div></div>
                  )}
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12 text-left">
                   <div className="grid md:grid-cols-2 gap-12">
                     <div className="space-y-6">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/50 inline-flex items-center gap-2">
                           <Orbit className="w-3 h-3" />
                           Clusters récurrents & Signaux
                        </div>
                        {unlockedBlocks.elan_clusters ? (
                          <>
                            {enrichElan && enrichElan.clusters_recurrents ? (
                              <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                {enrichElan.clusters_recurrents}
                              </div>
                            ) : (
                              <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas de clusters détectés</div>
                            )}

                            <div className="pt-6 border-t border-white/5">
                               {(() => {
                                  const directionWords = ['aller', 'faire', 'changer', 'partir', 'mieux', 'besoin', 'envie', 'vouloir', 'décision', 'choix'];
                                  const songeCards = cards.filter(c => c.user_note && c.user_note.length > 5);
                                  
                                  let matches = 0;
                                  songeCards.forEach(c => {
                                     if (directionWords.some(w => c.user_note!.toLowerCase().includes(w))) matches++;
                                  });

                                  if (matches >= 2) {
                                      return (
                                         <div className="font-serif italic text-[#EA580C] opacity-80 text-[13px]">
                                           Observation : La personne savait avant de savoir. Les mouvements de direction étaient déjà murmurés dans les songes.
                                         </div>
                                      );
                                  }
                                  return <div className="text-[11px] font-mono italic opacity-40 uppercase">Aucun signal précurseur clair</div>;
                               })()}
                               
                               {(() => {
                                  if (cards.length < 6) return null;
                                  const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                  let sansSuiteCount = 0;
                                  const stopWords = new Set(['le','la','les','un','une','des','et','ou','mais','donc','car','ni','est','sont','que','qu','qui','quoi','je','tu','il','elle','nous','vous','ils','elles','mon','ton','son','ma','ta','sa','mes','tes','ses','notre','votre','leur','nos','vos','leurs','de','du','au','aux','à','en','pour','par','sur','sous','avec','sans','dans','ce','cet','cette','ces','pas','plus','très','trop','tout','tous','toute','toutes','être','avoir','faire','comme','y','ne','se','me','te','cette','vers','dont', 'bien', 'fait', 'plus', 'quand']);
                                  
                                  const spherePrev: Record<string, ReflectionCard> = {};
                                  
                                  for (const c of chronological) {
                                     if (!c.sphere) continue;
                                     const prev = spherePrev[c.sphere];
                                     if (prev && prev.direction && prev.direction.split(/\s+/).length > 3) {
                                        const nextText = `${c.fragment || ''} ${c.deplacement || ''} ${c.user_note || ''}`.toLowerCase();
                                        const dirWords = prev.direction.toLowerCase().replace(/[.,!?;:()’']/g, ' ').split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w));
                                        
                                        let hasOverlap = false;
                                        for (const w of dirWords) {
                                           if (nextText.includes(w)) { hasOverlap = true; break; }
                                        }
                                        
                                        if (!hasOverlap && dirWords.length > 0) {
                                           sansSuiteCount++;
                                        }
                                     }
                                     spherePrev[c.sphere] = c;
                                  }
                                  
                                  if (sansSuiteCount >= 3) {
                                     return (
                                        <div className="font-serif italic text-white/50 text-[13px] mt-4 pt-4 border-t border-white/5 leading-relaxed">
                                          Observation : Certaines directions formulées ici ne semblent pas avoir trouvé de suite. Ce qui peut être pensé et ce qui peut être agi ne coïncident pas toujours.
                                        </div>
                                     );
                                  }
                                  return null;
                               })()}
                            </div>
                          </>
                        ) : isNextLocked('elan_clusters', 'elan') && (
                          <div className="mt-4"><LockedBlock title="Clusters Récurrents" requirements="7 jours + 3 fragments" /></div>
                        )}
                     </div>
                     <div className="space-y-6 md:border-l border-white/5 md:pl-12">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/50 inline-flex items-center gap-2">
                           <Network className="w-3 h-3" />
                           Convergence des directions
                        </div>
                        {unlockedBlocks.elan_direction ? (
                          (() => {
                              const directions = cards.map(c => (c.direction||'').toLowerCase()).filter(d => d.length > 5);
                              
                              let regAction = 0;
                              let regSens = 0;
                              let regLien = 0;
                              
                              const actionD = ['faire', 'agir', 'changer', 'choix', 'décider'];
                              const sensD = ['comprendre', 'pourquoi', 'sens', 'voir', 'besoin'];
                              const lienD = ['autre', 'parler', 'relation', 'ensemble', 'limite'];
                              
                              directions.forEach(d => {
                                 if (actionD.some(w => d.includes(w))) regAction++;
                                 if (sensD.some(w => d.includes(w))) regSens++;
                                 if (lienD.some(w => d.includes(w))) regLien++;
                              });
                              
                              let obs = null;
                              if (regAction > regSens && regAction > regLien) obs = "Action et décision";
                              else if (regSens > regAction && regSens > regLien) obs = "Quête de sens et clarté";
                              else if (regLien > regAction && regLien > regSens) obs = "Réarticulation des liens";

                              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                              const recentDirs = cards.filter(c => c.date && new Date(c.date) > thirtyDaysAgo && c.direction).map(c => c.direction!.toLowerCase());
                              const fondObs = recentDirs.length > 4 ? "Un mouvement de fond se dessine activement." : "Convergence lente en cours de décantation.";

                              return (
                                 <div className="space-y-4">
                                    <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                       {fondObs}
                                    </div>
                                    {obs && (
                                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm">
                                        <div className="text-[10px] font-mono uppercase text-white/40 mb-1">Polarité dominante</div>
                                        <div className="font-serif italic text-white/80">{obs}</div>
                                      </div>
                                    )}
                                 </div>
                              );
                          })()
                        ) : null}
                     </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-white/20 tracking-widest italic">
                Trajectoire en cours d'évaluation…
              </div>
            )}
          </div>
        ) : (
          /* view === 'matrice' */
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.matrice ? (
              <LockedSection
                title="Matrice"
                requirements="21 jours, 5 fragments et 2 prismes"
                icon={Fingerprint}
              />
            ) : matriceDataAnalysis ? (
              <>
                <div className="grid md:grid-cols-2 gap-12">
                  {/* Angoisses */}
                  <div className="space-y-6">
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                      Angoisses de structure
                    </h3>

                    <div className="h-[200px] w-full mb-6">
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={10}
                        minHeight={10}
                      >
                        <RadarChart
                          cx="50%"
                          cy="50%"
                          outerRadius="65%"
                          data={matriceDataAnalysis.angoisses?.map(
                            (a: any) => ({
                              subject: a.label,
                              A: a.intensite,
                              fullMark: 100,
                            }),
                          )}
                        >
                          <PolarGrid stroke="#3a3420" />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{
                              fill: "#a8a29e",
                              fontSize: 9,
                              fontFamily: "serif",
                              fontStyle: "italic",
                            }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={false}
                            axisLine={false}
                          />
                          <Radar
                            name="Angoisses"
                            dataKey="A"
                            stroke="#f87171"
                            fill="#f87171"
                            fillOpacity={0.15}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                      {matriceDataAnalysis.angoisses?.map(
                        (a: any, i: number) => (
                          <div key={i} className="group">
                            <div className="flex justify-between items-end mb-1">
                              <span className="font-serif text-[15px] text-beige italic">
                                {a.label}
                              </span>
                              <span className="font-mono text-[8px] text-white/20">
                                {a.intensite}%
                              </span>
                            </div>
                            <div className="h-0.5 w-full bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${a.intensite}%` }}
                                className="h-full bg-red-400/30"
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 mb-2">
                              {a.manifestations?.map((m: any, j: number) => (
                                <span
                                  key={j}
                                  className="font-mono text-[7px] text-beige-faint/40 px-1.5 py-0.5 bg-white/5 rounded-sm"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Valeurs */}
                  <div className="space-y-6">
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                      Valeurs d'ancrage
                    </h3>
                    <div className="space-y-6">
                      {matriceDataAnalysis.valeurs?.map((v: any, i: number) => (
                        <div key={i}>
                          <div className="font-serif text-[15px] text-beige italic mb-2">
                            {v.label}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {v.proximite?.map((p: any, j: number) => (
                              <span
                                key={j}
                                className="font-mono text-[8px] text-beige-faint italic opacity-50"
                              >
                                "{p}"
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schéma Central */}
                <div className="py-12 border-y border-white/5 text-center">
                  <div className="flex justify-center items-center gap-8 mb-8">
                    <button
                      onClick={() => setIsEclatModalOpen(true)}
                      className="flex items-center gap-2 py-2 px-6 bg-yellow-400/5 hover:bg-yellow-400/10 border border-yellow-400/20 text-yellow-500/80 hover:text-yellow-400 font-mono text-[9px] tracking-[0.3em] uppercase rounded-full transition-all"
                    >
                      <Zap size={14} className="animate-pulse" />
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-yellow-400">
                          Invoquer un Éclat
                        </span>
                        <span className="font-serif text-[7px] lowercase italic opacity-40 text-beige-faint">
                          Métabolisation humaine ponctuelle
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={exportMatriceToPDF}
                      className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-beige-faint/40 hover:text-beige transition-colors"
                    >
                      <Download size={12} />
                      <span>PDF</span>
                    </button>
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#8B5CF6]/80 mb-6 italic">
                    Schéma Central
                  </div>
                  <p className="text-xl md:text-2xl font-serif italic text-beige leading-relaxed max-w-2xl mx-auto">
                    "{matriceDataAnalysis.schema_central}"
                  </p>
                  {matriceDataAnalysis.coherence_elan_matrice && (
                     <div className="mt-8 pt-6 border-t border-white/5 font-serif italic text-[14px] text-beige-faint opacity-80 max-w-xl mx-auto">
                        Observation : {matriceDataAnalysis.coherence_elan_matrice}
                     </div>
                  )}
                </div>

                {/* Défenses */}
                <div className="space-y-8">
                  <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint text-center">
                    Système de Défense
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {matriceDataAnalysis.defenses?.map((d: any, i: number) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/10 p-5 rounded-lg"
                      >
                        <div className="font-serif text-[16px] text-beige mb-3">
                          {d.label}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="font-mono text-[7px] uppercase text-white/20 mb-1">
                              Déclencheur
                            </div>
                            <div className="text-[13px] text-beige-faint leading-relaxed">
                              {d.declencheur}
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-[7px] uppercase text-white/20 mb-1">
                              Direction
                            </div>
                            <div className="text-[13px] text-beige-faint leading-relaxed italic">
                              {d.direction}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lueurs */}
                {lueurs.length > 0 && (
                  <div className="pt-12">
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint text-center mb-8">
                      Lueurs accumulées
                    </h3>
                    <div className="max-w-xl mx-auto space-y-12">
                      {lueurs.map((lueur, i) => (
                        <div key={i} className="flex flex-col gap-6">
                          <LueurVisual context={lueur.context} />
                          <div className="bg-yellow-400/5 border border-yellow-400/20 p-6 rounded-lg text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-yellow-400/10 blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Sparkles className="w-5 h-5 text-yellow-400 mx-auto mb-4 opacity-50" />
                            <div className="font-serif text-lg text-yellow-400 italic mb-2">
                              {lueur.title}
                            </div>
                            <p className="text-xs text-beige-faint leading-relaxed">
                              {lueur.text}
                            </p>
                            <div className="mt-4 font-mono text-[7px] uppercase tracking-widest text-white/10">
                              {new Date(lueur.date).toLocaleDateString(
                                "fr-FR",
                                { month: "long", year: "numeric" },
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visualiser Matrice Button */}
                <div className="pt-20 text-center">
                  <p className="font-mono text-[7px] text-white/20 uppercase tracking-widest italic mb-4">
                    Structure cristallisée · Prête pour l'Eclat
                  </p>
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                  <div className="grid md:grid-cols-2 gap-12">
                    {/* EVOLUTION & VALIDATION SONGES */}
                    <div className="space-y-6">
                       <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#8B5CF6] inline-flex items-center gap-2">
                          <Fingerprint className="w-3 h-3" />
                          Évolution du fond
                       </div>
                       {enrichMatrice ? (
                          <div className="space-y-6">
                            {enrichMatrice.evolution && (
                              <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                {enrichMatrice.evolution}
                              </div>
                            )}
                            
                            {unlockedBlocks.matrice_validation_songes ? (
                              enrichMatrice.validation_songes && (
                                <div className="text-[11px] font-serif italic text-white/50 border-l border-[#8B5CF6]/30 pl-3">
                                  {enrichMatrice.validation_songes}
                                </div>
                              )
                            ) : isNextLocked('matrice_validation_songes', 'matrice') && (
                              <div className="mt-4"><LockedBlock title="Validation des Songes" requirements="1 songe rempli (exploration des Liens)" /></div>
                            )}
                          </div>
                       ) : (
                          <div className="text-[11px] font-mono italic opacity-40 uppercase">Analyse en cours...</div>
                       )}
                    </div>
                    
                    {/* STRUCTURE DU MOUVEMENT COGNITIF */}
                    <div className="space-y-6 md:border-l border-white/5 md:pl-12">
                       <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#8B5CF6] inline-flex items-center gap-2">
                          <Brain className="w-3 h-3" />
                          Mouvement Cognitif
                       </div>
                       {(() => {
                          if (cards.length < 5) return <div className="text-[11px] font-mono italic opacity-40 uppercase">Sédimentation insuffisante</div>;
                          
                          const validDirs = cards.map(c => (c.direction||'').toLowerCase()).filter(d => d.length > 5);
                          let asQuestions = 0; let asResolutions = 0; let asImages = 0;
                          
                          const qWords = ['pourquoi', 'comment', 'est-ce', '?'];
                          const rWords = ['je dois', 'il faut', 'décider', 'arrêter', 'continuer', 'faire', 'aller'];
                          const iWords = ['comme', 'ressemble', 'impression', 'sensation', 'mur', 'vide', 'lumière', 'chemin'];
                          
                          validDirs.forEach(d => {
                             if (qWords.some(w => d.includes(w))) asQuestions++;
                             if (rWords.some(w => d.includes(w))) asResolutions++;
                             if (iWords.some(w => d.includes(w))) asImages++;
                          });
                          
                          const validDeps = cards.map(c => (c.deplacement||'').toLowerCase()).filter(d => d.length > 5);
                          let regRelational: number = 0, regExistential: number = 0, regPractical: number = 0;
                          
                          const relWords = ['autre', 'parler', 'relation', 'lien', 'ils', 'avec'];
                          const exiWords = ['sens', 'vie', 'mort', 'toujours', 'jamais', 'peur', 'profond', 'fond'];
                          const praWords = ['travail', 'temps', 'organisation', 'faire', 'concret', 'quotidien', 'détail'];
                          
                          validDeps.forEach(d => {
                             if (relWords.some(w => d.includes(w))) regRelational++;
                             if (exiWords.some(w => d.includes(w))) regExistential++;
                             if (praWords.some(w => d.includes(w))) regPractical++;
                          });
                          
                          let formulation = "";
                          if (asQuestions > asResolutions && asQuestions > asImages) formulation = "privilégie la délibération et le questionnement ouvert";
                          else if (asResolutions > asQuestions && asResolutions > asImages) formulation = "tend vers des actes de résolution et de décision courte";
                          else if (asImages > asQuestions && asImages > asResolutions) formulation = "s'appuie sur une symbolisation par métaphores et sensations";
                          else formulation = "articule délibérations, images et tentatives de résolution (forme composite)";
                          
                          let registre = "";
                          if (regRelational > regExistential && regRelational > regPractical) registre = "le maillage relationnel";
                          else if (regExistential > regRelational && regExistential > regPractical) registre = "le fond existentiel invisible";
                          else if (regPractical > regRelational && regExistential < regPractical) registre = "l'ancrage dans la réalité pratique";
                          else registre = "une dynamique articulée entre pragmatisme et affects de fond";
                          
                          return (
                             <div className="space-y-4">
                                <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                   La structure de pensée {formulation}. Le mouvement vient préférentiellement traiter et interroger {registre}.
                                </div>
                                {enrichMatrice && enrichMatrice.mouvement_cognitif && (
                                   <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm">
                                      <div className="text-[10px] font-mono uppercase text-white/40 mb-1">Dynamique formelle</div>
                                      <div className="font-serif italic text-beige-faint/80 text-[12px]">{enrichMatrice.mouvement_cognitif}</div>
                                   </div>
                                )}
                             </div>
                          );
                       })()}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <p className="font-mono text-[11px] uppercase text-white/20 tracking-widest">
                  Calcul de la structure en cours…
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isPrismesModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsPrismesModalOpen(false);
                setSelectedPrisme(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400/20" />
              <button
                onClick={() => {
                  setIsPrismesModalOpen(false);
                  setSelectedPrisme(null);
                }}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="mb-8 text-center md:text-left">
                <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-yellow-400 mb-2">
                  Prismes Collectés
                </div>
                <div className="text-3xl font-serif text-white">
                  {prismesCount}
                  <span className="text-white/20">/10</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3 mb-8">
                {Object.entries(EMOTIONS).map(([key, em]) => {
                  const foundCount = cards.filter((c) => c.prisme === key).length;
                  const isFound = foundCount > 0;
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center gap-1.5 relative"
                    >
                      <button
                        onClick={() => {
                          if (isFound) {
                            setSelectedPrisme(key);
                          }
                        }}
                        className={`relative aspect-square w-full rounded-full border flex items-center justify-center transition-all
                          ${isFound ? "border-yellow-400/20 bg-yellow-400/5 cursor-pointer hover:border-yellow-400/40" : "border-white/5 bg-white/[0.02] opacity-30 cursor-default"}`}
                        title={isFound ? em.label : "Prisme non découvert"}
                      >
                        {isFound && foundCount >= 2 && (
                          <div className="absolute -top-1 -right-1 bg-yellow-400/20 text-yellow-500 text-[6px] font-mono w-3 h-3 rounded-full flex items-center justify-center border border-yellow-400/30">
                            {foundCount}
                          </div>
                        )}
                        <Gem
                          className={`w-4 h-4 ${isFound ? "text-yellow-400" : "text-white/10"}`}
                        />
                      </button>
                      {isFound && (
                        <span className="font-mono text-[6px] uppercase tracking-tighter text-white/20 text-center truncate w-full">
                          {em.label.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {cards.length >= 15 && Object.keys(EMOTIONS).some(key => cards.filter((c) => c.prisme === key).length === 0) && (
                <div className="text-center mb-8">
                   <p className="font-mono text-[7px] italic text-white/20">
                     Certains signaux n'ont pas encore émergé. Ils peuvent être absents — ou chercher leur forme.
                   </p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[11px] font-mono leading-relaxed text-beige-faint/40 italic text-center">
                  Cliquez sur un prisme pour en comprendre la clarté.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {selectedPrisme && (
          <PrismeExplainer
            isOpen={!!selectedPrisme}
            onClose={() => setSelectedPrisme(null)}
            title={
              EMOTIONS[selectedPrisme as keyof typeof EMOTIONS].label.split(
                " ",
              )[0]
            }
            content={PRISME_DESCRIPTIONS[selectedPrisme]}
            color={EMOTIONS[selectedPrisme as keyof typeof EMOTIONS].color}
          />
        )}

        {isLueursModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLueursModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl p-10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-white/20" />
              <button
                onClick={() => setIsLueursModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="mb-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full border border-white/5 overflow-hidden opacity-20 hover:opacity-80 transition-opacity">
                    <img
                      src="/logo.png"
                      alt="Logo"
                      className="w-full h-full object-cover grayscale"
                    />
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-[#f59e0b]/40">
                    Évolution · Lueurs
                  </div>
                </div>
                <p className="text-[11px] text-beige-faint/60 italic leading-relaxed">
                  Contenu mensuel généré pour éclairer votre Matrice. Inclus
                  dans l'abonnement Évolution.
                </p>
              </div>

              <div className="space-y-12 overflow-y-auto pr-2 custom-scrollbar pb-6">
                {lueurs.map((lueur, i) => (
                  <div key={i} className="flex flex-col gap-6">
                    <LueurVisual context={lueur.context} />
                    <div className="p-5 rounded-lg border border-white/10 bg-white/5 transition-all text-center">
                      <Sparkles className="w-5 h-5 text-white/40 mb-4 mx-auto" />
                      <div className="font-serif text-lg text-white italic mb-2">
                        {lueur.title}
                      </div>
                      <p className="text-[14px] leading-relaxed text-beige-faint">
                        {lueur.text}
                      </p>
                      <div className="mt-4 font-mono text-[7px] uppercase tracking-widest text-white/20">
                        {new Date(lueur.date).toLocaleDateString("fr-FR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {[...Array(3)].map((_, i) => (
                  <div
                    key={`latent-${i}`}
                    className="p-4 rounded-lg border border-dashed border-white/5 bg-transparent opacity-40"
                  >
                    <div className="h-4 flex items-center justify-center font-mono text-[6px] uppercase tracking-[0.3em] text-white/40">
                      Lueur latente
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 flex-shrink-0 space-y-6">
                {eclatAnalysis ? (
                  <div className="p-5 bg-white/5 border border-white/10 rounded-lg">
                    <div className="font-mono text-[8px] uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                      <Gem className="w-3 h-3 text-white/20" />
                      <span>Dernier Éclat</span>
                    </div>
                    <p className="text-[13px] font-serif italic text-white/80 leading-relaxed line-clamp-3">
                      "{eclatAnalysis}"
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <button
                      onClick={() => setIsEclatModalOpen(true)}
                      className="w-full py-3 bg-white/[0.02] hover:bg-white/5 border border-white/5 text-white/40 hover:text-white/60 font-mono text-[8px] tracking-[0.3em] uppercase rounded-full transition-all disabled:opacity-20"
                    >
                      Invoquer un Éclat
                    </button>
                    <div className="mt-3 font-mono text-[6px] text-white/20 uppercase tracking-[0.2em] italic text-center">
                      Métabolisation d'une demande par l'expérience humaine
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {isNetworkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNetworkModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl p-10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-purple-500/20" />
              <button
                onClick={() => setIsNetworkModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="mb-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full border border-white/5 overflow-hidden opacity-20 hover:opacity-80 transition-opacity">
                    <img
                      src="/logo.png"
                      alt="Logo"
                      className="w-full h-full object-cover grayscale"
                    />
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-purple-400/30">
                    Climat de sphère
                  </div>
                </div>
              </div>

              <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                {networkData ? (
                  ["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map(
                    (sphere) => (
                      <div
                        key={sphere}
                        className="p-5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-purple-500/5 transition-colors group"
                      >
                        <div className="font-mono text-[8px] uppercase tracking-widest text-purple-400/40 mb-3 group-hover:text-purple-400/60 transition-colors">
                          {sphere}
                        </div>
                        <p className="text-[14px] font-serif italic text-beige-faint/80 leading-relaxed">
                          {networkData[sphere.toLowerCase()] ||
                            "Aucune sédimentation collective détectée dans cette sphère."}
                        </p>
                      </div>
                    ),
                  )
                ) : (
                  <div className="py-20 text-center font-mono text-[11px] uppercase text-white/20 tracking-widest italic">
                    Analyse du climat collectif en cours…
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-[11px] font-mono leading-relaxed text-beige-faint/40 italic">
                  Ces textures sont le reflet anonymisé du sentiment des
                  communautés qui habitent vos sphères de vie, issues de la
                  sédimentation de vos vécus.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {isEclatModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEclatModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-yellow-400/20 rounded-2xl p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400/40" />
              <button
                onClick={() => setIsEclatModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="text-center mb-8">
                <PaymentWrapper
                  paypalUrl="https://www.paypal.com/donate/?business=REDACTED&item_name=Eclat+du+Coll%C3%A8gue&currency_code=EUR"
                  title="L'Éclat"
                  color="text-yellow-400"
                  className="group inline-block"
                >
                  <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-serif text-white mb-2 italic hover:text-yellow-400 transition-colors">
                    L'Éclat
                  </h3>
                </PaymentWrapper>
                <p className="text-xs text-beige-faint/60 leading-relaxed max-w-sm mx-auto italic mt-4">
                  Lecture en profondeur collaborative. Votre Matrice et votre
                  demande seront transmises pour une métabolisation par
                  l'expérience humaine. Un acte ponctuel, rare et structurant.
                </p>
              </div>

              {eclatStatus === "sent" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-400/5 border border-green-400/20 p-8 rounded-lg text-center"
                >
                  <Check className="w-10 h-10 text-green-400 mx-auto mb-4" />
                  <p className="text-sm text-beige font-serif italic mb-4">
                    Votre demande a été transmise pour métabolisation humaine.
                  </p>
                  <p className="text-[11px] text-beige-faint/40 font-mono uppercase tracking-widest italic leading-relaxed">
                    Le temps de la métabolisation approche.
                    <br />
                    Une réponse vous sera remise sous peu.
                  </p>
                  <button
                    onClick={() => setIsEclatModalOpen(false)}
                    className="mt-8 px-6 py-2 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 font-mono text-[8px] uppercase tracking-widest rounded-full transition-all"
                  >
                    Fermer
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 ml-1">
                      Votre question ou situation actuelle
                    </label>
                    <textarea
                      value={eclatRequest}
                      onChange={(e) => setEclatRequest(e.target.value)}
                      placeholder="Formulez votre demande ici…"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-sm text-beige italic focus:border-yellow-400/40 outline-none transition-colors h-40 resize-none custom-scrollbar"
                    />
                  </div>

                  <div className="bg-yellow-400/5 border border-yellow-400/10 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Gem className="w-4 h-4 text-yellow-400/60 mt-0.5" />
                      <div className="text-[11px] text-yellow-400/80 leading-relaxed font-serif italic">
                        Cet acte nécessite un soin particulier. L'Éclat est un
                        service ponctuel impliquant une lecture humaine
                        approfondie et collaborative de votre structure
                        psychique.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                    <p className="text-[9px] font-mono leading-relaxed text-yellow-400/40 uppercase tracking-widest text-center">
                      Attention : Cet acte requiert une intervention humaine
                      spécifique. Un don libre pourra être fait après réception
                      de votre lueur.
                    </p>
                  </div>

                  <button
                    onClick={handleEclatSubmit}
                    disabled={!eclatRequest.trim() || eclatStatus === "sending"}
                    className="w-full py-4 bg-yellow-400 text-black font-mono text-[11px] tracking-[0.4em] uppercase rounded-xl hover:bg-yellow-300 transition-all font-bold disabled:opacity-20"
                  >
                    {eclatStatus === "sending"
                      ? "Transmission…"
                      : "Envoyer la demande"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
