import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useGoBack } from "../lib/useGoBack";
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
import { sbGet, sbInsert, sbUpdate, sendEclatReply } from "../lib/worker";
import { ClarteSection, PrismeExplainer, CLARTE_LOADING } from "../components/SerpentinGuide";
import PrismeIcon from "../components/PrismeIcon";
import CollegueMark from "../components/CollegueMark";
import { PaymentWrapper } from "../components/PaymentModal";
import { LueurVisual } from "../components/LueurVisual";
import { RetourModal } from "../components/RetourModal";
import { EMOTIONS, SPHERES as SPHERE_PALETTE, type ReflectionCard } from "../data/emotions";
import { PRISME_DESCRIPTIONS } from "../data/prismes";

// Réexport conservé pour compatibilité d'éventuels imports externes.
export { EMOTIONS } from "../data/emotions";

// Helper to normalize spheres to "Familiale", "Sociale", "Amoureuse", "Professionnelle"
const normalizeSphere = (sphere?: string): string => {
  if (!sphere) return "";
  const s = sphere.trim();
  const lower = s.toLowerCase();
  if (lower === "amoureux" || lower === "amoureuse") return "Amoureuse";
  if (lower === "familial" || lower === "familiale") return "Familiale";
  if (lower === "social" || lower === "sociale") return "Sociale";
  if (lower === "professionnel" || lower === "professionnelle") return "Professionnelle";
  return s.charAt(0).toUpperCase() + s.slice(1);
};


// Chantier robustesse de la chaîne d'analyses : une analyse qui échoue est
// retentée un nombre borné de fois, puis — si elle échoue toujours — la
// section affiche une erreur sobre au lieu d'un spinner éternel.
const MAX_RETRY = 3; // tentatives totales avant de poser un état d'erreur
// Backoff des relances : 1re rapide (un blip réseau se rattrape vite),
// les suivantes plus espacées (sans inonder le Worker si c'est une vraie panne).
const RETRY_DELAYS_MS = [2000, 4000]; // ms, par numéro de tentative (backoff prudent : LLM rate-limité)

// Relances rapides pour les échecs transitoires (blip réseau, 5xx, JSON
// vide/malformé) : une re-requête quasi immédiate les rattrape souvent, inutile
// d'imposer 2 s. Le backoff long (RETRY_DELAYS_MS) reste réservé au vrai
// rate-limit (429), seul cas où patienter a vraiment un sens.
const FAST_RETRY_DELAYS_MS = [500, 1500];

// Affiché à la place du spinner quand une analyse a définitivement échoué.
// Ton accordé à LockedBlock / au « pas encore métabolisée » — discret,
// surtout pas un bandeau d'alerte.
const AnalysisError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="text-center py-20">
    <p className="font-serif italic text-beige-faint/70 leading-relaxed max-w-sm mx-auto mb-6">
      L'analyse n'a pas abouti. Le calcul n'a pas pu être mené jusqu'au bout.
    </p>
    <button
      onClick={onRetry}
      className="py-2 px-6 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] font-mono text-[9px] uppercase tracking-widest text-beige/50 hover:text-beige/70 transition-colors"
    >
      Réessayer
    </button>
  </div>
);

type FragWeek = { key: string; label: string; items: { card: ReflectionCard; i: number }[] };


function __isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}
function __mondayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return "Semaine du " + monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// Le « miroir » : la voix que le Collègue pose sur un fragment. Il est généré
// par le supercerveau du worker (type:"chat" — le même cerveau clinique que le
// chatbot, côté serveur), à partir des SEULES indications distillées du
// fragment (jamais la conversation) → la règle de confidentialité tient.
function miroirPromptFor(card: ReflectionCard): string {
  return `Voici un fragment déposé dans le Carnet d'une personne :
- Fragment : ${card.fragment}
- Déplacement : ${card.deplacement}
- Direction : ${card.direction}${card.texture_relationnelle ? `\n- Texture : ${card.texture_relationnelle}` : ""}

Écris un court miroir : une pensée que tu poses sur ce fragment, à relire plus tard. Fais surgir une image juste à partir de ces éléments, accueille ce qui s'est déplacé, et termine sur une ouverture — une phrase qui continue de travailler. Ne résume pas, ne donne aucun conseil, ne pose aucune question. Deux à quatre phrases.`;
}

// Appelle le worker (type:"chat") et reconstitue le texte depuis le flux SSE.
async function fetchMiroir(card: ReflectionCard): Promise<string> {
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

function groupCardsByWeek(cards: ReflectionCard[]): FragWeek[] {
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

function LienSphereDeck({ cards }: { cards: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const n = cards.length;
  if (n === 0) return null;
  const idx = Math.min(active, n - 1);
  const go = (dir: number) => setActive((a) => (Math.min(a, n - 1) + dir + n) % n);
  return (
    <div className="md:hidden max-w-sm mx-auto w-full">
      <div className="relative">
        {n - 1 - idx >= 2 && (
          <div className="absolute inset-0 rounded-lg bg-[#1a1814] border border-white/10 pointer-events-none" style={{ transform: "translateY(8px) rotate(-5deg)", zIndex: 0 }} />
        )}
        {n - 1 - idx >= 1 && (
          <div className="absolute inset-0 rounded-lg bg-[#1a1814] border border-white/10 pointer-events-none" style={{ transform: "translateY(4px) rotate(4deg)", zIndex: 1 }} />
        )}
        <div className="absolute inset-0 rounded-lg bg-[#1a1814] pointer-events-none" style={{ zIndex: 2 }} />
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 28, rotate: -1.5 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 3, touchAction: "pan-y" }}
          drag={n > 1 ? "x" : false}
          dragSnapToOrigin
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (n <= 1) return;
            if (info.offset.x <= -60) go(1);
            else if (info.offset.x >= 60) go(-1);
          }}
        >
          {cards[idx]}
        </motion.div>
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-5 mt-4">
          <button onClick={() => go(-1)} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="précédent">‹</button>
          <span className="font-mono text-[9px] tracking-widest text-beige-faint/60">{idx + 1} / {n}</span>
          <button onClick={() => go(1)} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="suivant">›</button>
        </div>
      )}
    </div>
  );
}

export default function Carnet() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useGoBack();
  const [cards, setCards] = useState<ReflectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalId, setPersonalId] = useState(
    localStorage.getItem("collegue_personal_id") || "",
  );
  // Affichage de la Clé-LCLG depuis le header (toujours consultable).
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const handleLogout = () => {
    try {
      localStorage.removeItem("collegue_personal_id");
      localStorage.removeItem("collegue_access_code");
    } catch {
      /* ignore */
    }
    navigate("/");
  };
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
    if (stored) { setCollegueVoice(stored); markVoiceRead(key); return; }
    setCollegueVoice(CLARTE_LOADING); // CollegueMark qui tourne pendant la génération
    try {
      const text = await fetchMiroir(card);
      if (!text) { setCollegueVoice(null); return; } // le cerveau n'a rien rendu : on n'invente rien
      miroirCache.current[key] = text;
      persistMiroir(card, text); // écrit le miroir SUR la carte (local + Supabase) -> cross-appareil, jamais régénéré
      setCollegueVoice(text);
      markVoiceRead(key); // la carte ne s'éteint qu'une fois le message vraiment affiché
    } catch {
      setCollegueVoice(null); // worker injoignable : on referme, la carte reste brillante (réessayable)
    }
  };
  const [metacognitionData, setMetacognitionData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_metacognition") || "null"),
  );
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

  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPrisme, setSelectedPrisme] = useState<string | null>(null);
  const [networkData, setNetworkData] = useState<any>(
    JSON.parse(localStorage.getItem("collegue_network") || "null"),
  );
  const [sessionsData, setSessionsData] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_sessions") || "[]"),
  );
  // Éclats répondus, du plus récent au plus ancien — ils s'empilent dans le
  // Carnet. Cache localStorage en JSON ; parse défensif pour qu'une valeur
  // héritée de l'ancienne clé string ne fasse pas planter l'initialisation.
  const [eclatList, setEclatList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem("collegue_eclats");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });


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

  // Mémorise les analyses dont un calcul est en cours — évite de lancer deux
  // fois la même analyse en parallèle.
  const runningFor = useRef<Record<string, boolean>>({});
  // Robustesse de la chaîne d'analyses :
  // - attemptsRef : nb de tentatives par clé d'analyse (ref — ne déclenche
  //   pas de rendu, c'est un simple compteur interne).
  // - retryTimers : les setTimeout de relance en attente, par clé — gardés
  //   pour pouvoir les annuler au démontage du composant.
  // - analysisErrors : échec définitif par clé (state — lu par l'UI pour
  //   remplacer le spinner par un message d'erreur).
  // - retryTick : bumpé par un setTimeout pour relancer le useEffect
  //   d'orchestration (qui, sinon, ne se relance que sur changement de deps).
  const attemptsRef = useRef<Record<string, number>>({});
  const retryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, boolean>>(
    {},
  );
  const [retryTick, setRetryTick] = useState(0);

  // « Réessayer » manuel : efface l'erreur de la section, remet son compteur
  // de tentatives à zéro, et bump retryTick pour relancer l'orchestration.
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
  const [lueurs, setLueurs] = useState<any[]>(
    JSON.parse(localStorage.getItem("collegue_lueurs") || "[]"),
  );
  const [sphereSonges, setSphereSonges] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem("collegue_sphere_songes") || "{}"),
  );
  const [isEclatModalOpen, setIsEclatModalOpen] = useState(false);
  const [readingEclat, setReadingEclat] = useState<any | null>(null);
  const [readingLueur, setReadingLueur] = useState<any | null>(null);
  // Zone d'écriture de la réponse de la personne dans la modale Éclat.
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState(false);
  const [eclatRequest, setEclatRequest] = useState("");
  const [eclatStatus, setEclatStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [carnatCreatedAt, setCarnetCreatedAt] = useState<string | null>(null);

  // Retour : ouverture de la modale partagée (état interne géré par le
  // composant RetourModal).
  const [isRetourModalOpen, setIsRetourModalOpen] = useState(false);

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
        personal_id: personalId,
      };

      // We use sbInsert to save it to a table named 'eclats'
      await sbInsert("eclats", payload);
      setEclatStatus("sent");
      setEclatRequest("");
    } catch (e) {
      console.error("Failed to send eclat:", e);
      // En cas d'échec, on le dit à la personne : l'Éclat est un geste
      // investi, lui afficher « envoyé » à tort lui ferait perdre sa demande
      // sans le savoir. Statut d'erreur -> elle peut réessayer.
      setEclatStatus("error");
    }
  };

  const handleEclatSubmit = () => {
    sendEclatRequest();
  };

  // Envoi d'une réponse de la personne à un Éclat. Passe par le handler
  // serveur dédié, qui vérifie l'appartenance et l'état de clôture.
  const sendReply = async () => {
    if (!readingEclat || !replyDraft.trim() || replySending) return;
    setReplySending(true);
    setReplyError(false);
    try {
      const result = await sendEclatReply(
        readingEclat.id,
        personalId,
        replyDraft.trim(),
      );
      const newReplies =
        result && Array.isArray(result.replies) ? result.replies : [];
      // Met à jour la modale, la pile, et le cache localStorage.
      setReadingEclat({ ...readingEclat, replies: newReplies });
      setEclatList((prev) => {
        const next = prev.map((e) =>
          e.id === readingEclat.id ? { ...e, replies: newReplies } : e,
        );
        localStorage.setItem("collegue_eclats", JSON.stringify(next));
        return next;
      });
      setReplyDraft("");
    } catch (e) {
      setReplyError(true);
    } finally {
      setReplySending(false);
    }
  };

  // Vider la zone d'écriture quand la modale Éclat se ferme.
  useEffect(() => {
    if (!readingEclat) {
      setReplyDraft("");
      setReplyError(false);
    }
  }, [readingEclat]);

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

  useEffect(() => {
    loadCards();
  }, []);

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
        <Icon className="w-6 h-6 text-beige/10" />
      </div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.4em] text-beige/40 mb-4">
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
      <div className="font-mono text-[9px] uppercase tracking-widest text-beige/30 mb-2">
        {title}
      </div>
      <div className="text-[8px] font-mono tracking-widest uppercase opacity-40">
        Requis : {requirements}
      </div>
    </div>
  );

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
                      onClick={() => {
                        if (!personalId) return;
                        try {
                          navigator.clipboard.writeText(personalId);
                        } catch (e) {
                          console.warn("copy failed", e);
                        }
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
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
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.affect ? (
              <LockedSection
                title="Affect"
                requirements="Toujours visible"
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
                                   ? "border-evolution/20 bg-evolution/5 text-evolution"
                                   : key === "inhibe"
                                     ? "border-slate/20 bg-slate/5 text-slate"
                                     : "border-green/20 bg-green/5 text-green"
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
                  <div className="font-mono text-[8px] uppercase tracking-widest text-beige/20 mb-4 italic">
                    Texture affective de la semaine
                  </div>
                  <p className="text-lg font-serif italic text-beige-faint leading-relaxed">
                    "{affectData.texture_semaine}"
                  </p>
                  
                  {unlockedBlocks.affect_lecture ? (
                    affectData.lecture_croisee_affect_prismes && affectData.lecture_croisee_affect_prismes.length > 0 && (
                       <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-affect/50 mb-4 inline-flex items-center gap-2">
                             Lecture croisée Affects / Prismes
                          </div>
                          {affectData.lecture_croisee_affect_prismes.map((obs: string, idx: number) => (
                             <div key={idx} className="font-serif italic text-[14px] text-beige-faint opacity-80 leading-relaxed border-l border-affect/20 pl-4">
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
                  <div className="flex flex-col md:flex-row gap-12">
                     {/* HEATMAP TEMPORELLE & RYTHME */}
                     <div className="flex-1 space-y-6">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-affect inline-flex items-center gap-2">
                           <Zap className="w-3 h-3" />
                           Rythme de sédimentation
                        </div>
                        
                        <div className="overflow-hidden">
                          <div className="flex">
                            <div className="flex flex-col gap-2 mr-4 mt-6">
                              {["Matin", "Midi", "Aprem", "Soir", "Nuit"].map(t => (
                                 <div key={t} className="h-4 flex items-center font-mono text-[7px] uppercase tracking-widest text-affect/50">{t}</div>
                              ))}
                            </div>
                            <div className="flex flex-1 gap-1">
                              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d, dIdx) => (
                                <div key={d} className="flex-1 flex flex-col gap-1">
                                   <div className="font-mono text-[7px] text-center uppercase tracking-widest text-affect/60 mb-2">{d}</div>
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
                                          className="h-4 rounded-sm w-full transition-all hover:ring-1 ring-affect/50"
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
                     {(unlockedBlocks.affect_luminescence || isNextLocked('affect_luminescence', 'affect')) && (
                     <div className="flex-1 space-y-6 flex flex-col md:border-l border-white/5 md:pl-12">
                        {unlockedBlocks.affect_luminescence && (
                          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-affect inline-flex items-center gap-2 mb-4">
                             <Waves className="w-3 h-3" />
                             Luminescence Émotionnelle (Évolution)
                          </div>
                        )}
                        {unlockedBlocks.affect_luminescence ? (
                          <>
                            <div className="h-[180px] w-full relative">
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
                                   
                                   const p = prismeKey(c.prisme);
                                   if(p) {
                                     if(moteurs.includes(p)) weeks[w].moteurs++;
                                     else if(inhibiteurs.includes(p)) weeks[w].inhibiteurs++;
                                     else if(emergents.includes(p)) weeks[w].emergents++;
                                   }
                                });
                                const chartData = Object.values(weeks);
                                if (chartData.length === 0) return <div className="text-[11px] text-beige/20 italic font-mono uppercase">Pas encore de données</div>;
                                
                                return (
                                   <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                                     <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                                       <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                       <Tooltip contentStyle={{backgroundColor:'#151515', borderColor:'#ffffff10', fontSize:'11px'}} itemStyle={{fontFamily:'monospace', fontSize:'10px'}} />
                                       <Line type="monotone" name="Moteurs" dataKey="moteurs" stroke="var(--color-ember)" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                       <Line type="monotone" name="Inhibiteurs" dataKey="inhibiteurs" stroke="var(--color-slate)" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                       <Line type="monotone" name="Émergents" dataKey="emergents" stroke="var(--color-green)" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
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
                     )}
                  </div>
                </div>
              </>
            ) : analysisErrors["affect"] ? (
              <AnalysisError onRetry={() => retryAnalysis("affect")} />
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
                Analyse des affects en cours…
              </div>
            )}
          </div>
        ) : view === "elan" ? (
          <div className="space-y-12 animate-fade-up max-w-2xl mx-auto text-center">
            {!unlockedSections.elan ? (
              <LockedSection
                title="Élan"
                requirements="7 jours + 3 fragments"
                icon={Orbit}
              />
            ) : elanDataAnalysis ? (
              <div className="space-y-12">
                <div className="space-y-4 text-center">
                  {unlockedBlocks.elan_mouvement && (
                    <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-beige/20 mb-4">
                      Mouvement
                    </div>
                  )}
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
                  {unlockedBlocks.elan_direction && (
                    <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-beige/20 mb-4">
                      Direction
                    </div>
                  )}
                  {unlockedBlocks.elan_direction ? (
                    <p className="text-lg font-serif text-beige-faint leading-relaxed">
                      {elanDataAnalysis.direction}
                    </p>
                  ) : isNextLocked('elan_direction', 'elan') && (
                    <div className="w-full flex justify-center"><div className="max-w-sm w-full"><LockedBlock title="Direction" requirements="7 jours + 5 fragments" /></div></div>
                  )}
                </div>

                <div className="pt-12 border-t border-white/5 text-center">
                  {unlockedBlocks.elan_question && (
                    <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-green/40 mb-4 italic">
                      La question qui travaille
                    </div>
                  )}
                  {unlockedBlocks.elan_question ? (
                    <p className="text-xl font-serif italic text-beige leading-relaxed">
                      "{elanDataAnalysis.question}"
                    </p>
                  ) : isNextLocked('elan_question', 'elan') && (
                    <div className="w-full flex justify-center mt-4"><div className="max-w-sm w-full"><LockedBlock title="La question qui travaille" requirements="7 jours + 6 fragments" /></div></div>
                  )}
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12 text-left">
                   <div className="flex flex-col md:flex-row gap-12">
                     {(unlockedBlocks.elan_clusters || isNextLocked('elan_clusters', 'elan')) && (
                     <div className="flex-1 space-y-6">
                        {unlockedBlocks.elan_clusters && (
                          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#FAF9F6] inline-flex items-center gap-2 mb-4">
                             <Orbit className="w-3 h-3" />
                             Clusters récurrents & Signaux
                          </div>
                        )}
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
                                         <div className="font-serif italic text-lien opacity-80 text-[13px]">
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
                                        <div className="font-serif italic text-beige/50 text-[13px] mt-4 pt-4 border-t border-white/5 leading-relaxed">
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
                     )}
                     
                     {(unlockedBlocks.elan_direction || isNextLocked('elan_direction', 'elan')) && (
                     <div className={`flex-1 space-y-6 ${(unlockedBlocks.elan_clusters || isNextLocked('elan_clusters', 'elan')) ? "md:border-l border-white/5 md:pl-12" : ""}`}>
                        {unlockedBlocks.elan_direction && (
                          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#FAF9F6] inline-flex items-center gap-2 mb-4">
                             <Network className="w-3 h-3" />
                             Convergence des directions
                          </div>
                        )}
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
                                        <div className="text-[10px] font-mono uppercase text-beige/40 mb-1">Polarité dominante</div>
                                        <div className="font-serif italic text-beige/80">{obs}</div>
                                      </div>
                                    )}
                                 </div>
                              );
                          })()
                        ) : null}
                     </div>
                     )}
                   </div>
                </div>
              </div>
            ) : analysisErrors["elan"] ? (
              <AnalysisError onRetry={() => retryAnalysis("elan")} />
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
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

        {resumeConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResumeConfirm(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-beige-faint/20 rounded-2xl p-8 shadow-2xl"
            >
              <button
                onClick={() => setResumeConfirm(null)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="text-center">
                <RotateCw className="w-9 h-9 text-beige-faint mx-auto mb-5" />
                <h3 className="text-xl font-serif italic text-beige mb-3">
                  Reprendre cette réflexion ?
                </h3>
                <p className="text-[13px] text-beige-faint/80 leading-relaxed max-w-sm mx-auto">
                  Allez au bout des cinq étapes pour déverrouiller le prisme : il décompose
                  un faisceau complexe en rayons distincts, perceptibles et analysables —
                  un signe de clairvoyance sur le mouvement en cours.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 mt-8">
                <button
                  onClick={() => {
                    const card = resumeConfirm;
                    setResumeConfirm(null);
                    if (card) resumeFragment(card);
                  }}
                  className="w-full text-center font-mono text-[11px] tracking-widest uppercase text-bg bg-beige px-8 py-3.5 rounded-sm hover:opacity-85 transition-opacity"
                >
                  Reprendre
                </button>
                <button
                  onClick={() => setResumeConfirm(null)}
                  className="w-full text-center font-mono text-[11px] tracking-widest uppercase text-beige-faint border border-beige-faint/20 px-8 py-3 rounded-sm hover:text-beige-dim hover:border-beige-faint/40 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>

      <RetourModal
        open={isRetourModalOpen}
        onClose={() => setIsRetourModalOpen(false)}
        personalId={personalId}
      />
    </div>
  );
}