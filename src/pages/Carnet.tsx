import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useGoBack } from "../lib/useGoBack";
import { useCarnetIdentity } from "../lib/useCarnetIdentity";
import { useAffectElanNotes } from "../lib/useAffectElanNotes";
import { useCarnetAnalyses } from "../lib/useCarnetAnalyses";
import { useEclat } from "../lib/useEclat";
import {
  AnalysisError,
  LienSphereDeck,
  LockedSection,
  LockedBlock,
} from "../components/carnet/CarnetPrimitives";
import { AffectView } from "../components/carnet/AffectView";
import { ElanView } from "../components/carnet/ElanView";
import { ResumeModal } from "../components/carnet/ResumeModal";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  History,
  Heart,
  Waves,
  Orbit,
  Trees,
  Fingerprint,
  Users,
  Copy,
  Check,
  BookOpen,
  Cloud,
  Zap,
  Download,
  Network,
  Sparkles,
  Star,
  X,
  Feather,
  Activity,
  MessagesSquare,
  Smartphone,
  RotateCw,
  LogOut,
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
import { ClarteSection, PrismeExplainer, CLARTE_LOADING } from "../components/SerpentinGuide";
import PrismeIcon from "../components/PrismeIcon";
import CollegueMark from "../components/CollegueMark";
import { PaymentWrapper } from "../components/PaymentModal";
import { LueurVisual } from "../components/LueurVisual";
import { RetourModal } from "../components/RetourModal";
import { EMOTIONS, SPHERES as SPHERE_PALETTE, type ReflectionCard } from "../data/emotions";
import { PRISME_DESCRIPTIONS } from "../data/prismes";
import {
  normalizeSphere,
  type FragWeek,
  miroirPromptFor,
  fetchMiroir,
  groupCardsByWeek,
} from "../lib/carnet-helpers";

// Réexport conservé pour compatibilité d'éventuels imports externes.
export { EMOTIONS } from "../data/emotions";


export default function Carnet() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useGoBack();
  const [cards, setCards] = useState<ReflectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    personalId,
    showKey,
    setShowKey,
    keyCopied,
    copyKey,
    showQr,
    setShowQr,
    confirmLogout,
    setConfirmLogout,
    handleLogout,
  } = useCarnetIdentity();
  const {
    affectNote,
    setAffectNote,
    affectHistory,
    setAffectHistory,
    elanNarrative,
    setElanNarrative,
    userNote,
    setUserNote,
    elanHistory,
    setElanHistory,
  } = useAffectElanNotes();
  const [view, setView] = useState<
    "fragments" | "lien" | "affect" | "elan" | "matrice"
  >("fragments");
  // Index de la carte affichée par semaine (feuilletage des piles).
  const [weekFlip, setWeekFlip] = useState<Record<string, number>>({});
  // Carte dont la bulle « Signal détecté » est ouverte (une à la fois).
  // Texte de la voix du Collègue à afficher dans la boîte (null = fermée).
  const [collegueVoice, setCollegueVoice] = useState<string | null>(null);
  // Cache de session des miroirs générés (par fragment) pour éviter de relancer
  // le worker à chaque ouverture.
  // Cache de session des miroirs générés à la demande (réutilisé sans re-render).
  // La persistance DURABLE (et cross-appareil) se fait en écrivant le miroir
  // directement SUR la carte via persistMiroir -> aucun nouvel appel worker.
  const miroirCache = useRef<Record<string, string>>({});
  // Quels fragments ont eu leur message du Collègue consulté (éteint le brillant).
  const [voiceRead, setVoiceRead] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("collegue_voice_read") || "{}"); } catch { return {}; }
  });
  // Fragment dont la fenêtre « reprendre la réflexion » est ouverte (null = fermée).
  const [resumeConfirm, setResumeConfirm] = useState<ReflectionCard | null>(null);
  // Reprend un fragment : on le mémorise (localStorage survit au reload/re-render,
  // contrairement à location.state) puis on ouvre le chat dessus.
  const resumeFragment = (card: ReflectionCard) => {
    try {
      localStorage.setItem("collegue_resume_fragment", JSON.stringify(card));
    } catch (err) {
      console.warn("resume fragment store failed", err);
    }
    navigate("/chat", { state: { resumeFragment: card } });
  };
  const markVoiceRead = (key: string) => {
    setVoiceRead((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      try { localStorage.setItem("collegue_voice_read", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  // Écrit le miroir directement SUR la carte : state + localStorage "collegue_cards"
  // + Supabase (via syncCardToCloud). Au rechargement (n'importe quel appareil),
  // loadCards ramène card.miroir -> openVoice prend le chemin "stored" -> 0 appel worker.
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
  // Ouvre la voix du Collègue sur un fragment : miroir déjà stocké/caché s'il
  // existe, sinon génération à la demande via le worker (le supercerveau).
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
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(
    localStorage.getItem("collegue_sound") !== "false",
  );
  const [isPrismesModalOpen, setIsPrismesModalOpen] = useState(false);
  const [isLueursModalOpen, setIsLueursModalOpen] = useState(false);

  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPrisme, setSelectedPrisme] = useState<string | null>(null);
  const [sessionsData, setSessionsData] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_sessions") || "[]"),
  );

  const toggleSound = () => {
    const newVal = !isSoundEnabled;
    setIsSoundEnabled(newVal);
    localStorage.setItem("collegue_sound", String(newVal));
  };

  const exportMatriceToPDF = () => {
    window.print();
  };

  const [lueurs, setLueurs] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_lueurs") || "[]"),
  );
  const [sphereSonges, setSphereSonges] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem("collegue_sphere_songes") || "{}"),
  );
  const [readingLueur, setReadingLueur] = useState<any | null>(null);
  const [carnatCreatedAt, setCarnetCreatedAt] = useState<string | null>(null);

  // Retour : ouverture de la modale partagée (état interne géré par le
  // composant RetourModal).
  const [isRetourModalOpen, setIsRetourModalOpen] = useState(false);

  const {
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
  } = useCarnetAnalyses({
    cards,
    sphereSonges,
    sessionsData,
    view,
    setLueurs,
  });

  const {
    eclatList,
    setEclatList,
    isEclatModalOpen,
    setIsEclatModalOpen,
    readingEclat,
    setReadingEclat,
    replyDraft,
    setReplyDraft,
    replySending,
    replyError,
    eclatRequest,
    setEclatRequest,
    eclatStatus,
    setEclatStatus,
    sendEclatRequest,
    handleEclatSubmit,
    sendReply,
  } = useEclat({
    personalId,
    matriceDataAnalysis,
    elanDataAnalysis,
    affectData,
    lienData,
  });

  // --- Synchronization logic ---
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


  // Normalise un prisme (minuscule, sans accent) pour le comparer aux clés
  // de EMOTIONS — les cartes stockent "Joie", "Colère", la clé est "joie".
  const prismeKey = (v?: string) =>
    (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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

  const isNextLocked = useCallback((key: keyof typeof unlockedBlocks, viewMode: "fragments" | "lien" | "affect" | "elan" | "matrice") => {
    return false;
  }, []);

  const copyToClipboard = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const updateSphereSonge = (sphere: string, text: string) => {
    const newSonges = { ...sphereSonges, [sphere]: text };
    setSphereSonges(newSonges);
    localStorage.setItem("collegue_sphere_songes", JSON.stringify(newSonges));
  };



  useEffect(() => {
    loadCards();
  }, []);




  const radarData = useMemo(() => {
    const spheres = ["Familiale", "Sociale", "Amoureuse", "Professionnelle"];
    return spheres.map((s) => ({
      subject: s,
      A: cards.filter((c) => normalizeSphere(c.sphere) === s).length,
      fullMark: Math.max(
        ...spheres.map(
          (sp) =>
            cards.filter((c) => normalizeSphere(c.sphere) === sp).length,
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
    const spheres = cards.map((c) => normalizeSphere(c.sphere)).filter(Boolean);
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


  return (
    <div className="min-h-screen bg-bg text-beige-dim font-serif pt-[48px]" style={{ paddingTop: "calc(48px + env(safe-area-inset-top))" }}>
      <header className="fixed top-0 left-0 right-0 border-b border-border bg-bg/90 backdrop-blur-md z-[9999]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 text-beige-faint" />
            </button>
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
              to="/climat"
              className={`transition-colors flex items-center p-1.5 ${location.pathname === "/climat" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Climat de la communauté"
            >
              <Cloud size={13} strokeWidth={1.5} />
            </Link>
            <Link
              to="/chat"
              className={`transition-colors flex items-center p-1.5 ${location.pathname === "/chat" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Penser"
            >
              <MessagesSquare size={13} strokeWidth={1.5} />
            </Link>
            <Link
              to="/carnet"
              className={`transition-colors flex items-center p-1.5 ${location.pathname === "/carnet" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Carnet"
            >
              <BookOpen size={13} strokeWidth={1.5} />
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowKey((v) => !v)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-beige-faint hover:text-beige"
                title="Votre clé d'accès"
              >
                <Fingerprint size={13} strokeWidth={1.5} />
              </button>
              {showKey && (
                <div className="absolute right-0 top-full mt-2 w-[270px] bg-[#0e0d08] border border-border rounded-md p-4 shadow-lg shadow-black/40">
                  <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-beige-faint mb-2">
                    Votre Clé-LCLG
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-[12px] text-beige bg-[#161512] border border-border rounded px-2.5 py-1.5 select-all break-all">
                      {personalId || "—"}
                    </code>
                    <button
                      onClick={copyKey}
                      className="shrink-0 text-beige-faint hover:text-beige transition-colors p-1.5"
                      title="Copier"
                    >
                      {keyCopied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-beige-faint italic leading-relaxed mt-2.5">
                    Gardez-la : c'est elle qui vous permet de retrouver ce
                    carnet, ici ou sur un autre appareil.
                  </p>

                  {personalId && (
                    <>
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <button
                        onClick={() => setShowQr((v) => !v)}
                        className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-beige-faint hover:text-beige transition-colors"
                      >
                        <Smartphone size={12} strokeWidth={1.5} />
                        {showQr
                          ? "Masquer le QR"
                          : "Transférer vers un autre appareil"}
                      </button>
                      {showQr && (
                        <div className="mt-3 flex flex-col items-center">
                          <div className="bg-[#f3efe6] rounded-md p-3">
                            <QRCodeSVG
                              value={`${window.location.origin}/restore#k=${encodeURIComponent(personalId)}`}
                              size={168}
                              bgColor="#f3efe6"
                              fgColor="#1a1814"
                              level="M"
                            />
                          </div>
                          <p className="text-[10px] text-beige-faint italic leading-relaxed mt-2.5 text-center">
                            Scannez-le avec l'appareil photo de l'autre
                            téléphone, puis saisissez votre code. Ne le partagez
                            pas.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/60">
                      {!confirmLogout ? (
                        <button
                          onClick={() => setConfirmLogout(true)}
                          className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-beige-faint hover:text-red transition-colors"
                        >
                          <LogOut size={12} strokeWidth={1.5} />
                          Se déconnecter
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-red/80 italic leading-relaxed">
                            Sans votre phrase de clé, vous perdrez l'accès à ce carnet. Confirmer la déconnexion ?
                          </p>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={handleLogout}
                              className="font-mono text-[9px] uppercase tracking-[0.16em] text-red hover:text-heart transition-colors"
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmLogout(false)}
                              className="font-mono text-[9px] uppercase tracking-[0.16em] text-beige-faint hover:text-beige transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto pt-5 pb-12 px-6">
        <div className="mb-12 border-b border-border pb-12 print:hidden">
          <div className="flex flex-col items-center gap-y-4 md:gap-y-6 w-full max-w-2xl mx-auto mb-8">
            <div className="flex flex-row justify-center items-center gap-x-3 sm:gap-x-6 md:gap-x-12 w-full flex-nowrap">
              <button
                onClick={() => setView("fragments")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "fragments" ? "text-green" : "text-beige-faint hover:text-beige"}`}
              >
                <History className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
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
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "lien" ? "text-lien" : "text-beige-faint hover:text-beige"}`}
              >
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>Lien</span>
                {view === "lien" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-lien/40"
                  />
                )}
              </button>

              <button
                onClick={() => setView("affect")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "affect" ? "text-affect" : "text-beige-faint hover:text-beige"}`}
              >
                <Waves className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>Affect</span>
                {view === "affect" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-affect/40"
                  />
                )}
              </button>
            </div>

            <div className="flex flex-row justify-center items-center gap-x-3 sm:gap-x-6 md:gap-x-12 w-full flex-nowrap pt-1">
              <button
                onClick={() => setView("elan")}
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "elan" ? "text-[#FAF9F6]" : "text-beige-faint hover:text-beige"}`}
              >
                <Orbit className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
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
                className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-all relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "matrice" ? "text-matrice" : "text-beige-faint hover:text-beige"}`}
              >
                <Fingerprint className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>Matrice</span>
                {view === "matrice" && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-matrice/40"
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
              <PrismeIcon
                rainbow={prismesCount > 0}
                strokeWidth={1.5}
                className={`w-5 h-5 transition-colors ${prismesCount > 0 ? "" : "text-beige/10"}`}
              />
            </button>

            <button
              onClick={() => setIsLueursModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Lueurs"
            >
              <Sparkles
                strokeWidth={1.5}
                className={`w-5 h-5 transition-colors ${lueurs.length > 0 ? "text-beige/40 group-hover:text-beige/80" : "text-beige/10"}`}
              />
            </button>

            <button
              onClick={() => setIsRetourModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Faire un retour"
            >
              <MessagesSquare strokeWidth={1.5} className="w-5 h-5 text-beige/10 group-hover:text-beige/60 transition-all" />
            </button>
          </div>
        </div>

        <ClarteSection section={`carnet-${view}`} voix={collegueVoice} onVoixClose={() => setCollegueVoice(null)} />

        {view === "fragments" ? (
          <div className="space-y-6">
            <div className="space-y-12">
              <style>{`
                .card-holo {
                  position: absolute; inset: 0; border-radius: 0.5rem;
                  overflow: hidden; pointer-events: none; z-index: 5;
                }
                /* la lame de lumière qui traverse la carte en diagonale, coin à coin */
                .card-holo::before {
                  content: ""; position: absolute; top: -60%; left: -60%;
                  width: 220%; height: 220%;
                  background: linear-gradient(115deg,
                    transparent 38%,
                    rgba(253,245,230,0.10) 46%,
                    rgba(255,255,255,0.42) 50%,
                    rgba(253,245,230,0.10) 54%,
                    transparent 62%);
                  transform: translate(-120%, -120%);
                  animation: cardHoloSweep 4.2s ease-in-out infinite;
                }
                /* teinte holographique discrète facon "foil" */
                .card-holo::after {
                  content: ""; position: absolute; inset: 0; border-radius: inherit;
                  background: linear-gradient(115deg,
                    transparent 40%,
                    rgba(99,163,104,0.10),
                    rgba(123,167,215,0.12),
                    rgba(234,88,12,0.08),
                    rgba(139,92,246,0.12),
                    transparent 60%);
                  background-size: 260% 260%;
                  mix-blend-mode: screen; opacity: 0.55;
                  animation: cardHoloHue 4.2s ease-in-out infinite;
                }
                @keyframes cardHoloSweep {
                  0%   { transform: translate(-120%, -120%); }
                  28%  { transform: translate(120%, 120%); }
                  100% { transform: translate(120%, 120%); }
                }
                @keyframes cardHoloHue {
                  0%   { background-position: 0% 0%; }
                  28%  { background-position: 100% 100%; }
                  100% { background-position: 100% 100%; }
                }
                @media (prefers-reduced-motion: reduce) {
                  .card-holo::before, .card-holo::after { animation: none; opacity: 0; }
                }
              `}</style>
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
                    <MessagesSquare size={10} strokeWidth={1.5} />
                    <span>penser</span>
                  </Link>
                  <p className="italic text-beige-faint opacity-40 text-[14px]">
                    le vécu pour prendre du recul.
                  </p>
                </div>
              ) : (
                groupCardsByWeek(cards).map((week) => {
                  const __n = week.items.length;
                  const __active = Math.min(weekFlip[week.key] ?? 0, __n - 1);
                  const { card, i } = week.items[__active];
                  const emotionKey = (
                    card.emotion ||
                    card.prisme ||
                    ""
                  ).toLowerCase() as keyof typeof EMOTIONS;
                  const emotionData = EMOTIONS[emotionKey] || null;
                  const isLocked = !card.prisme;
                  const __edOf = (k: number) => {
                    const c = week.items[__active + k]?.card;
                    if (!c) return null;
                    const ek = (c.emotion || c.prisme || "").toLowerCase() as keyof typeof EMOTIONS;
                    return EMOTIONS[ek] || null;
                  };
                  const __ed1 = __edOf(1);
                  const __ed2 = __edOf(2);
                  // « neuve » = encore jamais affichée (aucune date de lecture).
                                    // Brillant tant que le message du Collègue n'a pas été consulté
                  // (openVoice marque la lecture -> le brillant s'éteint).
                  const isShiny = !voiceRead[card.id || `idx-${i}`];
                  return (
                    <div key={week.key} className="max-w-lg mx-auto w-full px-3">
                      <div className="flex items-baseline justify-between mb-3 px-1">
                        <span className="font-mono text-[10px] tracking-widest uppercase text-beige-faint">{week.label}</span>
                        <span className="font-mono text-[9px] tracking-widest text-beige-faint/50">{__n} fragment{__n > 1 ? "s" : ""}</span>
                      </div>
                      <div className="relative">
                        {__n - 1 - __active >= 2 && (
                          <div className={`absolute inset-0 rounded-lg ${__ed2 ? __ed2.bg : "bg-[#0a1a12]"} border ${__ed2 ? __ed2.border : "border-[#3a3420]"} pointer-events-none`} style={{ transform: "translateY(8px) rotate(-6deg)", zIndex: 0 }} />
                        )}
                        {__n - 1 - __active >= 1 && (
                          <div className={`absolute inset-0 rounded-lg ${__ed1 ? __ed1.bg : "bg-[#0a1a12]"} border ${__ed1 ? __ed1.border : "border-[#3a3420]"} pointer-events-none`} style={{ transform: "translateY(4px) rotate(5deg)", zIndex: 1 }} />
                        )}
                        {/* base opaque : empêche la carte du dessus de laisser passer le fond */}
                        <div className="absolute inset-0 rounded-lg bg-[#0a1a12] pointer-events-none" style={{ zIndex: 2 }} />
                    <motion.div
                      key={`${week.key}-${card.id ?? i}-${i}`}
                      initial={{ opacity: 0, x: 28, rotate: -1.5 }}
                      animate={{ opacity: 1, x: 0, rotate: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      style={{ position: "relative", zIndex: 3, touchAction: "pan-y" }}
                      drag={__n > 1 ? "x" : false}
                      dragSnapToOrigin
                      dragElastic={0.18}
                      onDragEnd={(_, info) => {
                        if (__n <= 1) return;
                        if (info.offset.x <= -60) setWeekFlip((st) => ({ ...st, [week.key]: (__active + 1) % __n }));
                        else if (info.offset.x >= 60) setWeekFlip((st) => ({ ...st, [week.key]: (__active - 1 + __n) % __n }));
                      }}
                      className={`${emotionData ? emotionData.bg : "bg-[#0a1a12]"} border ${emotionData ? emotionData.border : "border-[#3a3420]"} rounded-lg p-6 relative space-y-4 hover:border-[#3a3420]/60 transition-all`}
                    >
                      {isShiny && (
                        <div className="card-holo" aria-hidden="true" />
                      )}
                      <div className="text-[11px] font-mono text-[#4a4028] mb-2 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(card.date).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
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
                              <Check className="w-2.5 h-2.5 text-green" />
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
                          {!isLocked && emotionData ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedPrisme(prismeKey(card.prisme)); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm border ${emotionData.bg} ${emotionData.border} hover:brightness-125 transition-all`}
                                title="Prisme — toucher pour comprendre sa clarté"
                              >
                                <PrismeIcon
                                  rainbow={false}
                                  color={emotionData.color}
                                  className="w-2.5 h-2.5"
                                  title={`Prisme: ${card.prisme}`}
                                />
                                <span className="text-[8px] font-mono uppercase tracking-tighter text-beige">
                                  {emotionData.label.split(" ")[0]}
                                </span>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openVoice(card, card.id || `idx-${i}`); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border transition-colors ${
                                  voiceRead[card.id || `idx-${i}`]
                                    ? "border-beige-faint/45 hover:border-beige-faint/70"
                                    : "border-green/50 hover:border-green/80"
                                }`}
                                title="Signal capté — toucher pour entendre le collègue"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  voiceRead[card.id || `idx-${i}`]
                                    ? "bg-beige-faint"
                                    : "bg-green animate-pulse"
                                }`} />
                                <span className={`text-[9px] font-mono uppercase tracking-tighter ${
                                  voiceRead[card.id || `idx-${i}`]
                                    ? "text-beige-dim"
                                    : "text-green animate-pulse"
                                }`}>
                                  Signal capté
                                </span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); openVoice(card, card.id || `idx-${i}`); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border transition-colors ${
                                voiceRead[card.id || `idx-${i}`]
                                  ? "border-beige-faint/45 hover:border-beige-faint/70"
                                  : "border-red/50 hover:border-red/80"
                              }`}
                              title="Signal détecté — toucher pour entendre le collègue"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                voiceRead[card.id || `idx-${i}`]
                                  ? "bg-beige-faint"
                                  : "bg-red animate-pulse"
                              }`} />
                              <span className={`text-[9px] font-mono uppercase tracking-tighter ${
                                voiceRead[card.id || `idx-${i}`]
                                  ? "text-beige-dim"
                                  : "text-red animate-pulse"
                              }`}>
                                Signal détecté
                              </span>
                            </button>
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
                            onPointerDown={(e) => e.stopPropagation()}
                            placeholder="Déposer un songe..."
                            className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-[11px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12 custom-scrollbar"
                          />
                          {(() => {
                             if (!card.user_note || card.user_note.trim() === "" || !enrichFragments?.reformulations || !card.id) return null;
                             const ref = enrichFragments.reformulations[card.id];
                             if (!ref) return null;
                             const icon = ref === 'convergent' ? '→' : ref === 'divergent' ? '↗' : '+';
                             return <div className="absolute right-3 top-3 text-beige/20 text-[10px] font-mono pointer-events-none">{icon}</div>;
                          })()}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-[#3a3420]/30">
                        <div className="flex items-center gap-2">
                          {card.texture_relationnelle && (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-green/60">
                              Résonance : {card.texture_relationnelle}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {isLocked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setResumeConfirm(card); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="p-2 rounded-md border border-beige-faint/25 text-beige-faint hover:text-beige hover:border-beige-faint/50 hover:bg-beige/5 transition-colors"
                              title="Reprendre cette réflexion"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                      </div>
                      {__n > 1 && (
                        <div className="flex items-center justify-center gap-5 mt-4">
                          <button onClick={() => setWeekFlip((st) => ({ ...st, [week.key]: (__active - 1 + __n) % __n }))} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="précédent">‹</button>
                          <span className="font-mono text-[9px] tracking-widest text-beige-faint/60">{__active + 1} / {__n}</span>
                          <button onClick={() => setWeekFlip((st) => ({ ...st, [week.key]: (__active + 1) % __n }))} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="suivant">›</button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {cards.length > 0 && (
              <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                {unlockedBlocks.fragments_progression ? (
                  <div className="border-b border-white/5 pb-8">
                     <div className="flex flex-col items-center">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
                           <Activity className="w-3 h-3" />
                           Progression dans les étapes
                        </div>
                        <div className="w-full max-w-xl h-24 relative flex items-end">
                           <div className="absolute inset-0 flex flex-col justify-between">
                              {[5,4,3,2,1].map(lvl => (
                                 <div key={lvl} className="w-full border-t border-white/5" />
                              ))}
                           </div>
                           <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                              <LineChart data={sessionsData.filter(s => s.step_reached !== undefined).map((s, idx) => ({ name: idx, step: s.step_reached }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                 <YAxis domain={[1, 5]} hide={true} />
                                 <Line type="stepAfter" dataKey="step" stroke="var(--color-green)" strokeWidth={1} dot={false} isAnimationActive={false} />
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
                     
                   if (prismeAverages.length < 2) return <div className="border-b border-white/5 pb-8 mb-8 text-center text-[11px] text-beige/20 italic font-mono uppercase">Pas assez de diversité affective</div>;
                   prismeAverages.sort((a, b) => b.avg - a.avg);
                   
                   const highest = prismeAverages[0];
                   const lowest = prismeAverages[prismeAverages.length - 1];
                   
                   if (highest.avg - lowest.avg < 0.5) return <div className="border-b border-white/5 pb-8 mb-8 text-center text-[11px] text-beige/20 italic font-mono uppercase">Aucune corrélation nette détectée (écarts &lt; 0.5)</div>;
                   
                   const article = (p: string) => {
                     const lower = p.toLowerCase();
                     if (['honneur','honte','joie','tristesse','colère','peur','confiance','surprise','mélancolie'].includes(lower)) return `la ${p}`;
                     if (['anticipation'].includes(lower)) return `l'${p}`;
                     if (['dégoût'].includes(lower)) return `le ${p}`;
                     return `la ${p}`; 
                   };

                   return (
                      <div className="border-b border-white/5 pb-8 mb-8 space-y-4 text-center mt-8">
                         <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
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
                      const spheres = cards.map(c => normalizeSphere(c.sphere)).filter(Boolean);
                      const emptyWords = ['je ne sais pas', "rien n'a bougé", "je suis resté", "difficile à dire", "rien", "ne sais pas", "aucun"];
                      const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      let sphereSeq: Record<string, number> = {};
                      let foundSphere = null;
                      for (const c of chronological) {
                         const normSp = normalizeSphere(c.sphere);
                         if (!normSp) continue;
                         const d = (c.deplacement || '').toLowerCase().trim();
                         const words = d.split(/\s+/).filter(w => w.length > 0);
                         if (words.length < 5 || emptyWords.some(ew => d.includes(ew))) {
                            sphereSeq[normSp] = (sphereSeq[normSp] || 0) + 1;
                            if (sphereSeq[normSp] >= 3) { foundSphere = normSp; break; }
                         } else {
                            sphereSeq[normSp] = 0;
                         }
                      }
                      return foundSphere ? <div className="font-mono text-[7px] italic text-beige/20">Quelque chose résiste au déplacement dans cette sphère.</div> : null;
                   })();

                   const songesObs = (() => {
                      const missing = cards.filter(c => !c.user_note || c.user_note.trim() === '').length;
                      return (missing / cards.length > 0.6) ? <div className="font-mono text-[7px] italic text-beige/20">La plupart de vos fragments n'ont pas de Songe déposé. L'espace est là.</div> : null;
                   })();

                   const prismesObs = (() => {
                      const missing = cards.filter(c => !c.prisme).length;
                      return (missing / cards.length > 0.4) ? <div className="font-mono text-[7px] italic text-beige/20">Certaines sessions n'ont pas laissé de signal émotionnel détectable. Ce qui est diffus ou défendu laisse moins de trace.</div> : null;
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
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
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
                             if (sorted.length === 0) return <div className="text-[11px] text-beige/20 italic font-mono uppercase">Pas encore assez de résonance</div>;
                             const maxC = sorted[0][1];
                             return sorted.map(([w, c], idx) => {
                                 const size = Math.max(0.85, 0.85 + (c / maxC) * 1.5);
                                 const opacity = Math.max(0.3, (c / maxC));
                                 return (
                                   <span key={idx} style={{ fontSize: `${size}rem`, opacity }} className="font-serif italic text-beige transition-all duration-500 hover:opacity-100 hover:text-beige cursor-default">
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
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
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
                          
                          if (t1+o1+t2+o2 === 0) return <div className="text-[11px] text-beige/20 italic font-mono uppercase text-center mt-4">Peu de mots de charge détectés</div>;

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
                              <motion.div initial={{width:0}} animate={{width:`${tensionRatio2*100}%`}} className="h-full bg-clay/80" transition={{duration:1}} />
                              <motion.div initial={{width:0}} animate={{width:`${(1-tensionRatio2)*100}%`}} className="h-full bg-slate/80" transition={{duration:1}} />
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
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
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
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
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
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
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
                <div className="mb-8 h-[220px] w-full max-w-sm mx-auto relative group flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-lien/5 blur-2xl rounded-full -z-10 group-hover:bg-lien/10 transition-colors" />
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
                          A: typeof data?.intensite === "number" ? data.intensite : 0,
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
                        stroke="var(--color-lien)"
                        fill="var(--color-lien)"
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {(() => {
                  const renderSphereCard = (s: string) => {
                    const isVisited = cards.some((c) => {
                       return normalizeSphere(c.sphere) === s;
                    });

                    if (cards.length >= 10 && !isVisited) {
                       return (
                         <div key={s} className="bg-[#1a1814]/30 border-dashed border border-white/10 p-6 rounded-lg flex flex-col h-full transition-all duration-500">
                           <div className="flex justify-between items-center mb-6">
                             <h3 className="font-mono text-[11px] tracking-widest uppercase opacity-40 text-beige/40">
                               {s}
                             </h3>
                           </div>
                           <div className="font-mono text-[7px] text-beige/30">Cette sphère n'a pas encore été visitée.</div>
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
                            className="text-[12px] font-mono font-medium opacity-70 group-hover:opacity-100 transition-colors"
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
                        <div className="flex-1 space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
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
                  };
                  const sphereCards = ["Familiale", "Sociale", "Amoureuse", "Professionnelle"]
                    .map(renderSphereCard)
                    .filter(Boolean);
                  return (
                    <>
                      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {sphereCards}
                      </div>
                      <LienSphereDeck cards={sphereCards} />
                    </>
                  );
                })()}
                {unlockedBlocks.lien_structure ? (
                  <div className="py-12 border-t border-white/5 text-center mt-12">
                    <div className="font-mono text-[8px] uppercase tracking-[0.5em] text-beige/20 mb-4">
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
                     {(unlockedBlocks.lien_texture || unlockedBlocks.lien_correlation || isNextLocked('lien_texture', 'lien') || isNextLocked('lien_correlation', 'lien')) && (
                        <div className="flex-1 space-y-8">
                           {/* DISSOCIATION DETECTION */}
                           {unlockedBlocks.lien_texture && (

                         <>
                           <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                             <Network className="w-3 h-3" />
                             Texture & Dissociation
                           </div>
                           {(() => {
                              const spherePrismes = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                              const sphereSongesCount = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                              
                              cards.forEach(c => {
                                 const normSp = normalizeSphere(c.sphere);
                                  if (c.prisme && normSp) {
                                    const s = normalizeSphere(c.sphere).toLowerCase() as keyof typeof spherePrismes;
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
                                     <div className="p-4 bg-clay/5 border border-clay/10 rounded-sm">
                                        <div className="font-serif italic text-[14px] text-beige-faint">
                                          Observation : Déplacement de l'attention. Sédimentation affective focalisée sur la sphère <span className="text-beige/80">{maxPrismeSphere}</span>, mais élaboration de fond orientée vers la sphère <span className="text-beige/80">{maxSongeSphere}</span>.
                                        </div>
                                     </div>
                                  );
                              }
                              return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas de dissociation majeure détectée</div>;
                           })()}
                         </>
                       )}
                       {!unlockedBlocks.lien_texture && isNextLocked('lien_texture', 'lien') && (
                         <div className="mb-8">
                           <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                             <Network className="w-3 h-3" />
                             Texture & Dissociation
                           </div>
                           <LockedBlock title="Texture & Dissociation" requirements="3 fragments + 2 jours" />
                         </div>
                       )}

                       {/* CORRELATION TEXTURE / SPHERE & MOTS / PRISMES */}
                       {unlockedBlocks.lien_correlation ? (() => {
                         const correlationItems = ["familiale", "sociale", "amoureuse", "professionnelle"].map(key => {
                               const textureCount = { tendu: 0, calme: 0 };
                               cards.filter(c => normalizeSphere(c.sphere).toLowerCase() === key).forEach(c => {
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
                               
                               const thisSpherePrismes = cards.filter(c => normalizeSphere(c.sphere).toLowerCase() === key && c.prisme).map(c => c.prisme);
                               const tensionPrismes = ['colere', 'peur', 'tristesse', 'degout', 'honte'];
                               
                               let hasTensionPrisme = thisSpherePrismes.some(p => tensionPrismes.includes(p as string));
                               let hasOpenPrisme = thisSpherePrismes.some(p => ['joie', 'confiance', 'anticipation', 'surprise'].includes(p as string));
                               
                               let obsM = null;
                               if (hasTension && hasTensionPrisme) obsM = "Mots & Prismes : Charge confirmée";
                               if (hasTension && hasOpenPrisme) obsM = "Lourdeur résiduelle vs affect ouvert";

                               if (!obsT && !obsM) return null;
                               
                               return (
                                 <div key={key} className="space-y-1">
                                   <div className="font-mono text-[8px] uppercase text-lien/50 tracking-widest">{key}</div>
                                   <div className="font-serif italic text-beige-faint text-[12px] opacity-80 leading-snug">
                                     {obsT && <div>• {obsT}</div>}
                                     {obsM && <div>• {obsM}</div>}
                                   </div>
                                 </div>
                               );
                           }).filter(Boolean);

                         if (correlationItems.length === 0) return null;

                         return (
                           <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5 mt-4">
                             {correlationItems}
                           </div>
                         );
                       })() : isNextLocked('lien_correlation', 'lien') && (
                         <div className="mt-4"><LockedBlock title="Corrélation Texture / Prismes" requirements="3 fragments + 2 jours + 2 prismes" /></div>
                       )}
                    </div>
                    )}
                    
                    {(unlockedBlocks.lien_constellation || isNextLocked('lien_constellation', 'lien')) && (
                    <div className={`flex-1 space-y-8 ${(unlockedBlocks.lien_texture || unlockedBlocks.lien_correlation || isNextLocked('lien_texture', 'lien') || isNextLocked('lien_correlation', 'lien')) ? "md:border-l border-white/5 md:pl-12" : ""}`}>
                       {/* CONSTELLATION DES PRISMES - SVG */}
                       {unlockedBlocks.lien_constellation && (

                         <>
                           <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                             <Orbit className="w-3 h-3" />
                             Constellation des Prismes
                           </div>
                           {(() => {
                              const validCards = cards.filter(c => c.prisme && c.sphere);
                              if (validCards.length < 5) return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas assez de données sédimentées</div>;

                              // Couleurs + libellés depuis la source unique (emotions.ts).
                              // Seuls les angles (géométrie de la constellation) restent locaux.
                              const SPHERES = ([
                              { id: 'familiale', angle: 225 },
                              { id: 'sociale', angle: 315 },
                              { id: 'amoureuse', angle: 45 },
                              { id: 'professionnelle', angle: 135 },
                            ] as const).map((s) => ({ ...s, color: SPHERE_PALETTE[s.id].color, label: SPHERE_PALETTE[s.id].label }));

                            const EMOTION_LAYOUT: Record<string, {rOffset: number, aOffset: number}> = {
                              joie: { rOffset: -20, aOffset: -30 }, tristesse: { rOffset: 10, aOffset: -25 }, colere: { rOffset: -5, aOffset: -15 },
                              peur: { rOffset: 25, aOffset: -5 }, degout: { rOffset: -30, aOffset: 5 }, surprise: { rOffset: 15, aOffset: 15 },
                              confiance: { rOffset: -10, aOffset: 25 }, anticipation: { rOffset: 20, aOffset: 35 }, honte: { rOffset: 0, aOffset: -40 },
                              melancolie: { rOffset: 0, aOffset: 40 }, envie: { rOffset: -15, aOffset: 45 }, soulagement: { rOffset: -25, aOffset: 20 },
                              gratitude: { rOffset: 5, aOffset: 50 }, jalousie: { rOffset: 10, aOffset: -35 }, amour: { rOffset: 30, aOffset: -20 },
                              culpabilite: { rOffset: 20, aOffset: -50 }
                            };

                            // EMOTION_COLORS supprimée : les couleurs viennent désormais
                            // de la source unique (EMOTIONS[clé].color).

                            const grouped = validCards.reduce((acc, card) => {
                               const normSp = normalizeSphere(card.sphere);
                               const key = `${normSp}-${card.prisme}`;
                               if (!acc[key]) acc[key] = { sphere: normSp, prisme: card.prisme, count: 0 };
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
                               const eCol = EMOTIONS[g.prisme?.toLowerCase() as keyof typeof EMOTIONS]?.color || '#ffffff';
                               
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
                         })()}
                         </>
                       )}
                       {!unlockedBlocks.lien_constellation && isNextLocked('lien_constellation', 'lien') && (
                         <div className="mt-4">
                           <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                             <Orbit className="w-3 h-3" />
                             Constellation des Prismes
                           </div>
                           <LockedBlock title="Constellation des Prismes" requirements="3 fragments + 2 jours + 3 prismes" />
                         </div>
                       )}
                    </div>
                    )}
                  </div>
                  
                  {unlockedBlocks.lien_fragilite ? (
                    enrichLien && Object.keys(enrichLien).some(k => enrichLien[k] && enrichLien[k] !== "Aucun signal clair" && k !== "rythme") && (
                      <div className="pt-8 border-t border-white/5">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien mb-6 inline-flex items-center gap-2">
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
                                 <div className="text-[9px] font-mono uppercase opacity-70" style={{ color: "var(--color-lien)" }}>
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

                  {/* Climat de sphère — relogé depuis son ancienne fenêtre :
                      le climat collectif appartient à la lecture du Lien. */}
                  <div className="pt-8 border-t border-white/5">
                    <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien mb-6 inline-flex items-center gap-2">
                      <Network className="w-3 h-3" />
                      Climat de sphère
                    </div>
                    {networkData ? (
                      <>
                        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                          {["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map(
                            (sphere) => (
                              <div key={sphere} className="space-y-2">
                                <div className="text-[9px] font-mono uppercase opacity-70 text-lien">
                                  {sphere}
                                </div>
                                <p className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                  {networkData[sphere.toLowerCase()] ||
                                    "Aucune sédimentation collective détectée dans cette sphère."}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                        <p className="mt-6 text-[11px] font-mono leading-relaxed text-beige-faint/40 italic">
                          Le climat de sphère reflète les sentiments qui
                          habitent vos sphères de vie.
                        </p>
                      </>
                    ) : analysisErrors["network"] ? (
                      <AnalysisError onRetry={() => retryAnalysis("network")} />
                    ) : (
                      <div className="py-10 text-center font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
                        Analyse du climat collectif en cours…
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : analysisErrors["lien"] ? (
              <AnalysisError onRetry={() => retryAnalysis("lien")} />
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
                Mise en lien du vécu en cours…
              </div>
            )}
          </div>
        ) : view === "affect" ? (
          <AffectView
            affectData={affectData}
            enrichAffect={enrichAffect}
            analysisErrors={analysisErrors}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            cards={cards}
            isNextLocked={isNextLocked}
            retryAnalysis={retryAnalysis}
            prismeKey={prismeKey}
          />
        ) : view === "elan" ? (
          <ElanView
            elanDataAnalysis={elanDataAnalysis}
            enrichElan={enrichElan}
            analysisErrors={analysisErrors}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            cards={cards}
            isNextLocked={isNextLocked}
            retryAnalysis={retryAnalysis}
          />
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
                          data={(matriceDataAnalysis.angoisses || []).map(
                            (a: any) => ({
                              subject: a.label,
                              A: typeof a.intensite === "number" ? a.intensite : 0,
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
                            stroke="var(--color-red)"
                            fill="var(--color-red)"
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
                              <span className="font-mono text-[8px] text-beige/20">
                                {a.intensite}%
                              </span>
                            </div>
                            <div className="h-0.5 w-full bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${a.intensite}%` }}
                                className="h-full bg-red/30"
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
                      className="flex items-center gap-2 py-2 px-6 bg-evolution/5 hover:bg-evolution/10 border border-evolution/20 text-evolution/80 hover:text-evolution font-mono text-[9px] tracking-[0.3em] uppercase rounded-full transition-all"
                    >
                      <CollegueMark size={26} className="animate-pulse text-red" />
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-evolution">
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
                  <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-matrice/80 mb-6 italic">
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
                            <div className="font-mono text-[7px] uppercase text-beige/20 mb-1">
                              Déclencheur
                            </div>
                            <div className="text-[13px] text-beige-faint leading-relaxed">
                              {d.declencheur}
                            </div>
                          </div>
                          <div>
                            <div className="font-mono text-[7px] uppercase text-beige/20 mb-1">
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
                          <div className="bg-evolution/5 border border-evolution/20 p-6 rounded-lg text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-evolution/10 blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Sparkles className="w-5 h-5 text-evolution mx-auto mb-4 opacity-50" />
                            <div className="font-serif text-lg text-evolution italic mb-2">
                              {lueur.title}
                            </div>
                            <p className="text-xs text-beige-faint leading-relaxed">
                              {lueur.text}
                            </p>
                            <div className="mt-4 font-mono text-[7px] uppercase tracking-widest text-beige/10">
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
                  <p className="font-mono text-[7px] text-beige/20 uppercase tracking-widest italic mb-4">
                    Structure cristallisée · Prête pour l'Eclat
                  </p>
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                  <div className="grid md:grid-cols-2 gap-12">
                    {/* EVOLUTION & VALIDATION SONGES */}
                    <div className="space-y-6">
                       <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-matrice inline-flex items-center gap-2">
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
                                <div className="text-[11px] font-serif italic text-beige/50 border-l border-matrice/30 pl-3">
                                  {enrichMatrice.validation_songes}
                                </div>
                              )
                            ) : isNextLocked('matrice_validation_songes', 'matrice') && (
                              <div className="mt-4"><LockedBlock title="Validation des Songes" requirements="1 songe rempli (exploration des Liens)" /></div>
                            )}
                          </div>
                       ) : analysisErrors["enrich_matrice"] ? (
                          <AnalysisError onRetry={() => retryAnalysis("enrich_matrice")} />
                       ) : (
                          <div className="text-[11px] font-mono italic opacity-40 uppercase">Analyse en cours...</div>
                       )}
                    </div>
                    
                    {/* STRUCTURE DU MOUVEMENT COGNITIF */}
                    <div className="space-y-6 md:border-l border-white/5 md:pl-12">
                       <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-matrice inline-flex items-center gap-2">
                          <MessagesSquare className="w-3 h-3" />
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
                                      <div className="text-[10px] font-mono uppercase text-beige/40 mb-1">Dynamique formelle</div>
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
            ) : analysisErrors["matrice"] ? (
              <AnalysisError onRetry={() => retryAnalysis("matrice")} />
            ) : (
              <div className="text-center py-20">
                <p className="font-mono text-[11px] uppercase text-beige/20 tracking-widest">
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
              <div
                className="absolute top-0 inset-x-0 h-1 opacity-60"
                style={{ background: "linear-gradient(90deg, var(--color-heart), var(--color-clay), var(--color-ember), var(--color-green), var(--color-slate), var(--color-plum))" }}
              />
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
                <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-beige-faint mb-2">
                  Prismes Collectés
                </div>
                <div className="text-3xl font-serif text-beige">
                  {prismesCount}
                  <span className="text-beige/20">/{Object.keys(EMOTIONS).length}</span>
                </div>
                <p className="text-[11px] text-beige-faint/70 italic leading-relaxed mt-2 max-w-sm mx-auto md:mx-0">
                  Une lentille qui décompose ce que tu traverses pour le rendre lisible.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-8">
                {Object.entries(EMOTIONS).map(([key, em]) => {
                  const foundCount = cards.filter((c) => prismeKey(c.prisme) === key).length;
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
                        className={`relative aspect-square w-full flex items-center justify-center transition-all
                          ${isFound ? "cursor-pointer hover:scale-110" : "opacity-30 cursor-default"}`}
                        title={isFound ? em.label : "Prisme non découvert"}
                      >
                        {isFound && foundCount >= 2 && (
                          <div className="absolute -top-1 -right-1 bg-white/10 text-beige/70 text-[6px] font-mono w-3 h-3 rounded-full flex items-center justify-center border border-white/20">
                            {foundCount}
                          </div>
                        )}
                        <PrismeIcon
                          rainbow={false}
                          color={isFound ? em.color : undefined}
                          strokeWidth={1.5}
                          className={`w-8 h-8 ${isFound ? "" : "text-beige/10"}`}
                        />
                      </button>
                      {isFound && (
                        <span className="font-mono text-[6px] uppercase tracking-tighter text-beige/20 text-center truncate w-full">
                          {em.label.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {cards.length >= 15 && Object.keys(EMOTIONS).some(key => cards.filter((c) => prismeKey(c.prisme) === key).length === 0) && (
                <div className="text-center mb-8">
                   <p className="font-mono text-[7px] italic text-beige/20">
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
              <div className="absolute top-0 inset-x-0 h-1 bg-evolution/40" />
              <button
                onClick={() => setIsLueursModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="mb-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles
                    strokeWidth={1.5}
                    className="w-5 h-5 text-evolution/40 shrink-0"
                  />
                  <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-evolution/40">
                    Lueurs &amp; Éclats
                  </div>
                </div>
                <p className="text-[11px] text-beige-faint/60 italic leading-relaxed">
                  Pour éclairer les vides de votre Matrice.
                </p>
              </div>

              <div className="overflow-y-auto pr-2 custom-scrollbar pb-6">
                {lueurs.length > 0 ? (
                  <div className="space-y-3">
                    {lueurs.map((lueur, i) => (
                      <button
                        key={i}
                        onClick={() => setReadingLueur(lueur)}
                        className="w-full text-left p-5 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-lg transition-colors group"
                      >
                        <div className="font-mono text-[8px] uppercase tracking-widest text-beige/40 mb-3 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-beige/20" />
                            <span>{i === 0 ? "Dernière lueur" : "Lueur"}</span>
                          </span>
                          {lueur.date && (
                            <span className="text-beige/25 tracking-wider">
                              {new Date(lueur.date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <div className="font-serif text-base text-beige/90 italic mb-1.5">
                          {lueur.title}
                        </div>
                        <p className="text-[13px] font-serif text-beige/70 leading-relaxed line-clamp-3">
                          {lueur.text}
                        </p>
                        <div className="mt-3 font-mono text-[7px] uppercase tracking-[0.25em] text-beige/30 group-hover:text-beige/50 transition-colors">
                          Lire en entier →
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="w-full max-w-sm mx-auto">
                    <LockedBlock
                      title="Lueurs"
                      requirements="30 jours + Matrice dévoilée"
                    />
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 flex-shrink-0 space-y-6">
                {eclatList.length > 0 ? (
                  <div className="space-y-3">
                    {eclatList.map((e, i) => (
                      <button
                        key={e.id || i}
                        onClick={() => setReadingEclat(e)}
                        className="w-full text-left p-5 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-lg transition-colors group"
                      >
                        <div className="font-mono text-[8px] uppercase tracking-widest text-beige/40 mb-3 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <CollegueMark className="w-6 h-6 text-red/70" />
                            <span>{i === 0 ? "Dernier Éclat" : "Éclat"}</span>
                          </span>
                          {e.answered_at && (
                            <span className="text-beige/25 tracking-wider">
                              {new Date(e.answered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] font-serif italic text-beige/80 leading-relaxed line-clamp-3">
                          "{e.response_text}"
                        </p>
                        <div className="mt-3 font-mono text-[7px] uppercase tracking-[0.25em] text-beige/30 group-hover:text-beige/50 transition-colors">
                          Lire en entier →
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center">
                    <button
                      onClick={() => setIsEclatModalOpen(true)}
                      className="w-full py-3 bg-white/[0.02] hover:bg-white/5 border border-white/5 text-beige/40 hover:text-beige/60 font-mono text-[8px] tracking-[0.3em] uppercase rounded-full transition-all disabled:opacity-20"
                    >
                      Invoquer un Éclat
                    </button>
                    <div className="mt-3 font-mono text-[6px] text-beige/20 uppercase tracking-[0.2em] italic text-center">
                      Métabolisation d'une demande par l'expérience humaine
                    </div>
                  </div>
                )}
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
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-evolution/20 rounded-2xl p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red/50" />
              <button
                onClick={() => setIsEclatModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="text-center mb-8">
                <CollegueMark className="w-14 h-14 text-red mx-auto mb-4" />
                <h3 className="text-xl font-serif text-beige mb-2 italic">
                  L'Éclat
                </h3>
                <p className="text-xs text-beige-faint/60 leading-relaxed max-w-sm mx-auto italic mt-4">
                  Votre Matrice et votre demande seront métabolisées par
                  l'expérience humaine. Un acte ponctuel, rare et structurant.
                </p>
              </div>

              {eclatStatus === "sent" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green/5 border border-green/20 p-8 rounded-lg text-center"
                >
                  <Check className="w-10 h-10 text-green mx-auto mb-4" />
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
                    className="mt-8 px-6 py-2 border border-white/10 hover:border-white/20 text-beige/40 hover:text-beige/60 font-mono text-[8px] uppercase tracking-widest rounded-full transition-all"
                  >
                    Fermer
                  </button>
                </motion.div>
              ) : eclatStatus === "error" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red/5 border border-red/20 p-8 rounded-lg text-center"
                >
                  <p className="text-sm text-beige font-serif italic mb-4">
                    Votre demande n'a pas pu être transmise.
                  </p>
                  <p className="text-[11px] text-beige-faint/40 font-mono uppercase tracking-widest italic leading-relaxed">
                    Rien n'a été perdu de ce que vous avez écrit.
                    <br />
                    Vous pouvez réessayer.
                  </p>
                  <button
                    onClick={() => setEclatStatus("idle")}
                    className="mt-8 px-6 py-2 border border-white/10 hover:border-white/20 text-beige/40 hover:text-beige/60 font-mono text-[8px] uppercase tracking-widest rounded-full transition-all"
                  >
                    Réessayer
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-beige/30 ml-1">
                      Votre question ou situation actuelle
                    </label>
                    <textarea
                      value={eclatRequest}
                      onChange={(e) => setEclatRequest(e.target.value)}
                      placeholder="Formulez votre demande ici…"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-sm text-beige italic focus:border-evolution/40 outline-none transition-colors h-40 resize-none custom-scrollbar"
                    />
                  </div>

                  <button
                    onClick={handleEclatSubmit}
                    disabled={!eclatRequest.trim() || eclatStatus === "sending"}
                    className="w-full py-4 bg-evolution text-black font-mono text-[11px] tracking-[0.4em] uppercase rounded-xl hover:bg-evolution transition-all font-bold disabled:opacity-20"
                  >
                    {eclatStatus === "sending"
                      ? "Transmission…"
                      : "Envoyer la demande"}
                  </button>

                  {/* Don — discret, secondaire, sous l'action principale */}
                  <div className="flex justify-center">
                    <PaymentWrapper
                      paypalUrl="https://www.paypal.com/donate/?business=REDACTED&item_name=Eclat+du+Coll%C3%A8gue&currency_code=EUR"
                      title="Soutien"
                      color="text-evolution"
                      className="group inline-flex"
                    >
                      <div className="flex items-center gap-1.5 text-beige/25 group-hover:text-evolution/70 transition-colors">
                        <Heart className="w-3 h-3" />
                        <span className="font-mono text-[8px] uppercase tracking-[0.25em]">
                          Soutenir
                        </span>
                      </div>
                    </PaymentWrapper>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Lecture d'un Éclat — le retour humain s'affiche en entier, dans
            le Carnet de la personne. Pas de fichier : la réponse vit ici. */}
        {readingEclat && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadingEclat(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0a0a0a] border border-evolution/20 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red/50" />
              <button
                onClick={() => setReadingEclat(null)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>
              <div className="px-10 pt-10 pb-5 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-evolution/50">
                    <CollegueMark className="w-7 h-7 text-red/70" />
                    <span>L'Éclat</span>
                  </div>
                  {readingEclat.answered_at && (
                    <span className="font-mono text-[9px] tracking-wider text-beige/30">
                      {new Date(readingEclat.answered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-10 pb-10 overflow-y-auto custom-scrollbar">
                {readingEclat.request_text && (
                  <div className="mb-6 pb-6 border-b border-white/5">
                    <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/25 mb-2">
                      Votre demande
                    </div>
                    <p className="text-[12px] font-serif italic text-beige/45 leading-relaxed whitespace-pre-wrap">
                      "{readingEclat.request_text}"
                    </p>
                  </div>
                )}
                <p className="text-[15px] font-serif italic text-beige/85 leading-loose whitespace-pre-wrap">
                  {readingEclat.response_text}
                </p>

                {/* Réponses de la personne — elle peut répondre tant que
                    l'admin n'a pas clôturé. Ce n'est pas un fil symétrique :
                    le collègue lit, et clôture quand il le décide. */}
                {(((readingEclat.replies && readingEclat.replies.length > 0)) ||
                  !readingEclat.replies_closed) && (
                  <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                    {readingEclat.replies && readingEclat.replies.length > 0 && (
                      <div className="space-y-3">
                        {readingEclat.replies.map((r: any, i: number) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg bg-white/[0.03] border border-white/5"
                          >
                            <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/25 mb-2">
                              Votre réponse
                              {r.at
                                ? " · " +
                                  new Date(r.at).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                  })
                                : ""}
                            </div>
                            <p className="text-[13px] font-serif text-beige/70 leading-relaxed whitespace-pre-wrap">
                              {r.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {readingEclat.replies_closed ? (
                      <div className="text-center font-mono text-[7px] uppercase tracking-[0.3em] text-beige/20 italic py-2">
                        Échange clôturé
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Répondre à cet Éclat…"
                          rows={4}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-beige italic focus:border-evolution/30 outline-none transition-colors resize-none custom-scrollbar"
                        />
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-mono text-[8px] text-beige/25 italic leading-relaxed">
                            {replyError ? (
                              <span className="text-soutien">
                                Échec de l'envoi — réessayer.
                              </span>
                            ) : (
                              "Votre réponse sera lue par le collègue."
                            )}
                          </span>
                          <button
                            onClick={sendReply}
                            disabled={!replyDraft.trim() || replySending}
                            className="flex-shrink-0 px-5 py-2 bg-evolution/90 text-black font-mono text-[8px] uppercase tracking-[0.2em] rounded-full hover:bg-evolution transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            {replySending ? "Envoi…" : "Envoyer"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {/* Lecture d'une Lueur — la reconnaissance s'affiche en entier,
            avec son visuel. Ouverte depuis la pile du modal Lueurs. */}
        {readingLueur && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadingLueur(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0a0a0a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-evolution/40" />
              <button
                onClick={() => setReadingLueur(null)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>
              <div className="px-10 pt-10 pb-5 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-beige/40">
                    <Sparkles className="w-3.5 h-3.5 text-beige/30" />
                    <span>Lueur</span>
                  </div>
                  {readingLueur.date && (
                    <span className="font-mono text-[9px] tracking-wider text-beige/30">
                      {new Date(readingLueur.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-10 pb-10 overflow-y-auto custom-scrollbar">
                <div className="mb-6">
                  <LueurVisual context={readingLueur.context} />
                </div>
                <div className="font-serif text-xl text-beige italic mb-3 text-center">
                  {readingLueur.title}
                </div>
                <p className="text-[15px] font-serif text-beige-faint leading-loose whitespace-pre-wrap text-center">
                  {readingLueur.text}
                </p>
              </div>
            </motion.div>
          </div>
        )}

        <ResumeModal
          resumeConfirm={resumeConfirm}
          setResumeConfirm={setResumeConfirm}
          resumeFragment={resumeFragment}
        />

      </AnimatePresence>

      <RetourModal
        open={isRetourModalOpen}
        onClose={() => setIsRetourModalOpen(false)}
        personalId={personalId}
      />
    </div>
  );
}