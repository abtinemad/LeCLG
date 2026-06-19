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
import { LueurReaderModal } from "../components/carnet/LueurReaderModal";
import { EclatModal } from "../components/carnet/EclatModal";
import { LueursEclatsModal } from "../components/carnet/LueursEclatsModal";
import { PrismesModal } from "../components/carnet/PrismesModal";
import { MatriceView } from "../components/carnet/MatriceView";
import { LienView } from "../components/carnet/LienView";
import { FragmentsView } from "../components/carnet/FragmentsView";
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
          <FragmentsView
            loading={loading}
            cards={cards}
            sessionsData={sessionsData}
            affectData={affectData}
            enrichFragments={enrichFragments}
            unlockedBlocks={unlockedBlocks}
            isNextLocked={isNextLocked}
            weekFlip={weekFlip}
            setWeekFlip={setWeekFlip}
            voiceRead={voiceRead}
            openVoice={openVoice}
            copyToClipboard={copyToClipboard}
            copiedSection={copiedSection}
            setSelectedPrisme={setSelectedPrisme}
            prismeKey={prismeKey}
            updateCardNote={updateCardNote}
            setResumeConfirm={setResumeConfirm}
          />
        ) : view === "lien" ? (
          <LienView
            lienData={lienData}
            networkData={networkData}
            cards={cards}
            sphereSonges={sphereSonges}
            updateSphereSonge={updateSphereSonge}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            isNextLocked={isNextLocked}
            prismeKey={prismeKey}
            enrichLien={enrichLien}
            retryAnalysis={retryAnalysis}
            analysisErrors={analysisErrors}
            getEmotionTheme={getEmotionTheme}
          />
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
          <MatriceView
            matriceDataAnalysis={matriceDataAnalysis}
            cards={cards}
            lueurs={lueurs}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            isNextLocked={isNextLocked}
            enrichMatrice={enrichMatrice}
            analysisErrors={analysisErrors}
            retryAnalysis={retryAnalysis}
            setIsEclatModalOpen={setIsEclatModalOpen}
            exportMatriceToPDF={exportMatriceToPDF}
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        <PrismesModal
          isPrismesModalOpen={isPrismesModalOpen}
          setIsPrismesModalOpen={setIsPrismesModalOpen}
          prismesCount={prismesCount}
          cards={cards}
          selectedPrisme={selectedPrisme}
          setSelectedPrisme={setSelectedPrisme}
          prismeKey={prismeKey}
        />

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

        <LueursEclatsModal
          isLueursModalOpen={isLueursModalOpen}
          setIsLueursModalOpen={setIsLueursModalOpen}
          lueurs={lueurs}
          eclatList={eclatList}
          setReadingLueur={setReadingLueur}
          setReadingEclat={setReadingEclat}
          setIsEclatModalOpen={setIsEclatModalOpen}
        />

        <EclatModal
          isEclatModalOpen={isEclatModalOpen}
          setIsEclatModalOpen={setIsEclatModalOpen}
          eclatRequest={eclatRequest}
          setEclatRequest={setEclatRequest}
          eclatStatus={eclatStatus}
          setEclatStatus={setEclatStatus}
          handleEclatSubmit={handleEclatSubmit}
        />

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
        <LueurReaderModal
          readingLueur={readingLueur}
          setReadingLueur={setReadingLueur}
        />
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