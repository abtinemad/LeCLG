import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  ArrowUp,
  Check,
  ArrowLeft,
  Brain,
  BookOpen,
  Cloud,
  X,
  Gem,
  MessageCircle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { sbInsert, sbUpdate, sbGet } from "../lib/worker";
import { ClarteSection } from "../components/SerpentinGuide";
import { LogoEmber } from "../components/LogoEmber";
import { RetourModal } from "../components/RetourModal";

// ============================================================
// ICONS
// ============================================================
const Lips = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 13c2-3 5-4 9-2c4-2 7-1 9 2c-1 4-4 6-9 6s-8-2-9-6Z" />
    <path d="M3 13c3 1.5 6 2 9 2s6-.5 9-2" />
  </svg>
);

// ============================================================
// WORKER — seul point d'entrée pour tous les appels IA
// ============================================================
const API_BASE = "/api";
const WORKER_URL = "/api/worker";

// Plafond de conversations réellement engagées par jour (le serveur fait foi).
const MAX_CONVERSATIONS_PER_DAY = 3;
// Seuil d'engagement : une conversation ne décompte un crédit du plafond
// qu'à partir du moment où la personne a écrit STRICTEMENT PLUS que ce
// nombre de messages. En deçà, c'est un simple coup d'œil — aucun crédit
// consommé. Concrètement : 1 à 3 messages = gratuit, le 4e verrouille le
// crédit. Le plafond s'appuyant sur `ended_at`, il suffit de ne poser
// `ended_at` qu'une fois ce seuil franchi (voir saveSession).
const ENGAGEMENT_MIN_USER_MESSAGES = 3;
// Plafond dur invisible : une conversation ne peut pas s'étendre sans fin.
// Plafond souple en deux temps. Le problème n'est pas la longueur en soi —
// c'est la conversation qui tourne en boucle et vire à la rumination.
// LANDING_THRESHOLD : à partir d'ici, si l'équilibre (étape 4) n'est pas
// validé, on injecte une note pour que le collègue oriente vers un point
// de pose — faire émerger une direction depuis l'intérieur de la personne.
// HARD_MESSAGE_LIMIT : limite finale. Le miroir se déclenche, équilibre
// validé ou non — une conversation se referme toujours par le miroir.
const LANDING_THRESHOLD = 28;
const HARD_MESSAGE_LIMIT = 32;
// Premier message à froid (primo-visite ou pas de reprise) : ton intuitif,
// invitation ouverte. La personnalisation tissée (phase 2) viendra par-dessus.
const COLD_OPENER =
  "Bonjour. Posez-vous un instant. Ce qui vous amène n'a pas besoin d'être clair ni bien formulé — juste présent. Dites-le comme ça vient ; on cheminera à partir de là.";

// Tap d'état du jour : la personne dit comment elle arrive, et l'ouverture
// rencontre cet état d'emblée. Comme l'opener nomme l'état et reste dans
// l'historique, le modèle calibre le ton du reste de la session tout seul.
// Libellés et phrases = la voix de l'app, à réécrire librement.
const DAY_PROMPT = "Comment arrivez-vous, aujourd'hui ?";
const DAY_STATES: { key: string; label: string; opener: string }[] = [
  {
    key: "lourd",
    label: "lourd",
    opener:
      "Bonjour. Il y a quelque chose de lourd aujourd'hui, on dirait. Pas besoin de le soulever d'un coup — posez-le ici, comme il est, et on le regardera ensemble.",
  },
  {
    key: "agite",
    label: "agité",
    opener:
      "Bonjour. Ça s'agite à l'intérieur. On va ralentir un peu. Dites ce qui tourne, même en désordre — on verra l'ordre après, ou pas.",
  },
  {
    key: "flou",
    label: "flou",
    opener:
      "Bonjour. Quelque chose est là sans être net. C'est un très bon point de départ. Dites-le flou ; le flou se laisse penser, lui aussi.",
  },
  {
    key: "pose",
    label: "posé",
    opener:
      "Bonjour. Vous arrivez plutôt posé — bien. On peut prendre de la hauteur tranquillement. Qu'est-ce que vous auriez envie de regarder de plus près ?",
  },
  {
    key: "nsp",
    label: "je ne sais pas",
    opener:
      "Bonjour. Pas besoin de savoir d'où vous arrivez. Posez-vous un instant, et dites ce qui vient en premier — on cheminera à partir de là.",
  },
];
// Phase 2 — personnalisation tissée : à partir de ce nombre de cartes passées,
// l'opener à froid laisse place à une ouverture générée qui fait un écho sobre
// au cheminement de la personne (jamais une récitation, jamais une présomption
// de son état du jour).
const WOVEN_THRESHOLD = 1;

// Distille un « fil de mémoire » court à partir des dernières cartes : la sphère
// récurrente et un ou deux fragments récents. Renvoie null s'il n'y a pas de
// quoi tisser quelque chose de juste.
function buildWovenContext(cards: any[]): string | null {
  const valid = (cards || []).filter((c) => c && (c.fragment || c.sphere));
  if (valid.length < WOVEN_THRESHOLD) return null;
  const sphereCounts: Record<string, number> = {};
  valid.forEach((c) => {
    if (c.sphere) sphereCounts[c.sphere] = (sphereCounts[c.sphere] || 0) + 1;
  });
  const topSphere =
    Object.entries(sphereCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const fragments = valid
    .map((c) => c.fragment)
    .filter(Boolean)
    .slice(0, 2);
  const single = valid.length === 1;
  const parts: string[] = [];
  if (topSphere)
    parts.push(
      single
        ? `la dernière fois, sa réflexion touchait à la sphère « ${topSphere} »`
        : `au fil de ses passages, ses réflexions ont souvent tourné autour de la sphère « ${topSphere} »`,
    );
  if (fragments.length) {
    const lead = single
      ? "elle avait laissé ce fragment"
      : fragments.length > 1
        ? "elle a récemment laissé ces fragments"
        : "elle a récemment laissé ce fragment";
    parts.push(`${lead} : ${fragments.map((f) => `« ${f} »`).join(" ; ")}`);
  }
  if (parts.length === 0) return null;
  return "Mémoire de la personne (ne pas réciter) : " + parts.join(" ; ") + ".";
}
const LANDING_NOTE =
  "[Note interne (ne pas citer) : la conversation s'étire et risque de tourner en boucle. Sans la clore brutalement ni l'annoncer, oriente-la vers un point de pose — aide la personne à faire émerger une direction, une clarté, quelque chose depuis l'intérieur d'elle-même. N'ouvre pas de nouveaux territoires. Si ça tourne sans avancer, nomme-le doucement.]";

// Nudge doux : au bout de NUDGE_THRESHOLD échanges sans progression (aucune
// étape validée), le collègue propose en douceur d'ouvrir un autre angle.
const NUDGE_THRESHOLD = 8;
// Si la boucle persiste au-delà de ce non-progrès soutenu, on n'insiste plus
// pour avancer : on oriente vers un point de pose (boucle = rumination).
const STUCK_LANDING_THRESHOLD = 11;
const NUDGE_NOTE =
  "[Note interne : l'échange creuse le même point depuis un moment. Si cela semble juste, propose à la personne, avec beaucoup de douceur, d'ouvrir un autre angle — sans le nommer, sans la presser. Si tu sens qu'elle a encore besoin de rester là, n'insiste pas et continue de l'accompagner.]";

const toWorkerMessages = (msgs: any[]) => {
  const formatted = msgs.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string" ? m.content : m.parts?.[0]?.text || "",
  }));
  
  // Claude requires strictly alternating roles, and MUST start with a 'user' message
  const merged: {role: string, content: string}[] = [];
  for (const msg of formatted) {
    if (merged.length === 0 && msg.role === "assistant") {
      merged.push({ role: "user", content: "(Début de l'échange)" });
    }
    
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += "\n\n" + msg.content;
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }
  return merged;
};

const STEP_NAMES_FR = [
  "Situation",
  "Ressenti",
  "Demande",
  "Diffraction",
  "Équilibre",
];

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
  ts?: string;
  isDictated?: boolean;
}

interface EvalResult {
  situation: boolean;
  ressenti: boolean;
  demande: boolean;
  diffraction: boolean;
  diffraction_sans_partage: boolean;
  equilibre: boolean;
  crisis: boolean;
  mots_cles: string[];
  emotional_charge: number;
  collegue_posture: number;
  tension: number;
  alliance: number;
}

interface ReflectionCard {
  id?: string;
  fragment: string;
  deplacement: string;
  direction: string;
  texture_relationnelle?: string;
  sphere?: string;
  emotion?: string;
  prisme?: string;
  date?: string;
  image_url?: string;
}

export const EMOTIONS = {
  joie: {
    label: "Joie (Prisme)",
    color: "#FACC15",
    bg: "bg-[#FACC15]/10",
    border: "border-[#FACC15]/40",
  },
  tristesse: {
    label: "Tristesse (Prisme)",
    color: "#60A5FA",
    bg: "bg-[#60A5FA]/10",
    border: "border-[#60A5FA]/40",
  },
  colere: {
    label: "Colère (Prisme)",
    color: "#F87171",
    bg: "bg-[#F87171]/10",
    border: "border-[#F87171]/40",
  },
  peur: {
    label: "Peur (Prisme)",
    color: "#A78BFA",
    bg: "bg-[#A78BFA]/10",
    border: "border-[#A78BFA]/40",
  },
  degout: {
    label: "Dégoût (Prisme)",
    color: "#4ADE80",
    bg: "bg-[#4ADE80]/10",
    border: "border-[#4ADE80]/40",
  },
  surprise: {
    label: "Surprise (Prisme)",
    color: "#FB923C",
    bg: "bg-[#FB923C]/10",
    border: "border-[#FB923C]/40",
  },
  confiance: {
    label: "Confiance (Prisme)",
    color: "#22D3EE",
    bg: "bg-[#22D3EE]/10",
    border: "border-[#22D3EE]/40",
  },
  anticipation: {
    label: "Anticipation (Prisme)",
    color: "#F472B6",
    bg: "bg-[#F472B6]/10",
    border: "border-[#F472B6]/40",
  },
  honte: {
    label: "Honte (Prisme)",
    color: "#94A3B8",
    bg: "bg-[#94A3B8]/10",
    border: "border-[#94A3B8]/40",
  },
  melancolie: {
    label: "Mélancolie (Prisme)",
    color: "#8B5CF6",
    bg: "bg-[#8B5CF6]/10",
    border: "border-[#8B5CF6]/40",
  },
} as const;

// ============================================================
// SERPENTIN — constantes (portées depuis index.html)
// ============================================================
type FlowLevel = {
  amplitude: number;
  speed: number;
  opacity: number;
  color: [number, number, number];
  thickness: number;
};

const FLOW_LEVELS: FlowLevel[] = [
  {
    amplitude: 1.5,
    speed: 0.005,
    opacity: 0.28,
    color: [232, 213, 176],
    thickness: 1.0,
  },
  {
    amplitude: 5.0,
    speed: 0.014,
    opacity: 0.48,
    color: [232, 213, 176],
    thickness: 1.4,
  },
  {
    amplitude: 10.0,
    speed: 0.028,
    opacity: 0.65,
    color: [232, 213, 176],
    thickness: 1.8,
  },
  {
    amplitude: 16.0,
    speed: 0.048,
    opacity: 0.85,
    color: [232, 213, 176],
    thickness: 2.2,
  },
];
const FLOW_LOADING: FlowLevel = {
  amplitude: 7.0,
  speed: 0.032,
  opacity: 0.58,
  color: [232, 213, 176],
  thickness: 1.6,
};
const FLOW_UNLOCK: FlowLevel = {
  amplitude: 18.0,
  speed: 0.05,
  opacity: 0.9,
  color: [140, 200, 120],
  thickness: 2.0,
};
const FLOW_VALIDATE: FlowLevel = {
  amplitude: 24.0,
  speed: 0.065,
  opacity: 1.0,
  color: [180, 230, 150],
  thickness: 2.4,
};
const FLOW_CHAOS: FlowLevel = {
  amplitude: 20.0,
  speed: 0.06,
  opacity: 1.0,
  color: [220, 35, 35],
  thickness: 2.8,
};

const POSTURE_COLORS: [number, number, number][] = [
  [232, 213, 176], // calme
  [240, 200, 145], // engagement — ambré
  [185, 205, 225], // provocation — acier
  [220, 218, 214], // rupture — argenté
];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round(
      (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255,
    );
  return [f(0), f(8), f(4)];
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  // Session
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [validatedSteps, setValidatedSteps] = useState<Set<number>>(new Set());
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  // Modale de retour, accessible depuis l'écran de fin de séance.
  const [isRetourModalOpen, setIsRetourModalOpen] = useState(false);
  // Phase de clôture : "none" tant que les 5 étapes ne sont pas validées,
  // "awaiting-reply" entre le message de validation et le miroir,
  // "closed" une fois le miroir envoyé.
  const [closingPhase, setClosingPhase] = useState<
    "none" | "awaiting-reply" | "closed"
  >("none");
  // Verrou anti-doublon de génération de la carte (voir startCardGeneration).
  const cardGenStarted = useRef(false);
  // Vrai quand la personne a atteint son plafond de conversations du jour.
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  // Vrai tant que la vérification du plafond au chargement n'a pas répondu :
  // on n'affiche aucun bouton avant de savoir, pour ne jamais proposer
  // « Commencer » à quelqu'un qui a déjà atteint sa limite.
  const [limitChecking, setLimitChecking] = useState(true);
  // Échanges écoulés depuis la dernière étape validée (pour le nudge doux).
  const [exchangesSinceProgress, setExchangesSinceProgress] = useState(0);
  // Révélation de la Clé-LCLG sur l'écran de fin (à la première conversation).
  const [keyJustRevealed, setKeyJustRevealed] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [diffractionSansPartage, setDiffractionSansPartage] = useState(false);
  const [motsCles, setMotsCles] = useState<string[]>([]);
  const [reflectionCard, setReflectionCard] = useState<ReflectionCard | null>(
    null,
  );
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [pastReflections, setPastReflections] = useState<ReflectionCard[]>([]);
  const [hasDictatedCurrentMessage, setHasDictatedCurrentMessage] =
    useState(false);

  // Reprise session
  const [resumeCardToOffer, setResumeCardToOffer] =
    useState<ReflectionCard | null>(null);
  const [activeResumeContext, setActiveResumeContext] = useState<string | null>(
    null,
  );

  // Identité
  const [personalId, setPersonalId] = useState<string>(
    () => localStorage.getItem("collegue_personal_id") || "",
  );
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  // Code d'accès à 6 chiffres (choisi à la création de la clé).
  const [accessCode, setAccessCode] = useState("");
  const [codeCreated, setCodeCreated] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const currentSessionId = useRef<string | null>(null);

  // Voix
  const [isListening, setIsListening] = useState(false);
  const recognition = useRef<any>(null);

  // Recentrage
  const [isRecentrage, setIsRecentrage] = useState(false);
  const [recentrageStep, setRecentrageStep] = useState(0);
  // Rupture de cadre (charge max) montrée une fois par session.
  const ruptureShown = useRef(false);
  // Mode du recentrage : "crise" (charge max, filet de contenance) ou
  // "sceau" (clôture, dernière prise de hauteur sur l'arc avant la carte).
  const [recentrageMode, setRecentrageMode] = useState<"crise" | "sceau">(
    "crise",
  );
  const sealInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const sealPlayed = useRef(false);
  const RECENTRAGE_PROMPTS = [
    "Considérez la masse de ce qui vous occupe en ce moment.",
    "Inutile de chercher une logique immédiate. Laissez-la au repos.",
    "Observez le mouvement de vos pensées, comme un écho lointain.",
    "Certains nœuds ne se défont pas en tirant dessus.",
    "Ressentez la charge émotionnelle. Elle contient sa propre vérité.",
    "Laissez l'équilibre stable se manifester, au-delà des mots.",
    "Revenez doucement, avec un regard légèrement décentré.",
  ];

  // Prompts effectivement affichés pendant le recentrage : par défaut les
  // statiques (repli), remplacés par des paradoxes générés à la volée,
  // accrochés à ce qui vient d'être dit.
  const [activeRecentragePrompts, setActiveRecentragePrompts] =
    useState<string[]>(RECENTRAGE_PROMPTS);

  // Eval
  const lastEvalAt = useRef<number>(0);
  const evalInProgress = useRef(false);
  const pendingValidateTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Serpentin
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flowRef = useRef({
    current: { ...FLOW_LEVELS[0] } as FlowLevel,
    target: { ...FLOW_LEVELS[0] } as FlowLevel,
    phase: 0,
    color2: [...POSTURE_COLORS[0]] as number[],
    color2Target: [...POSTURE_COLORS[0]] as number[],
    phaseOffset2: 0,
    phaseOffset2Target: 0,
    sawtoothLevel: 0,
    sawtoothTarget: 0,
    bounceLevel: 0,
    bounceTarget: 0,
    dampExtra: 0,
    cometX: 0,
    cometX2: 0,
    cometVx1: 1,
    cometVx2: -1,
    isRainbow: false,
    rainbowHue: 0,
    isChaos: false,
    chaosPhase: 0,
    isCalming: false,
    emotionalLevel: 0,
    isLoading: false,
  });
  const rafRef = useRef<number | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Persistence ───────────────────────────────────────────
  const saveState = useCallback(() => {
    const state = {
      messages,
      validatedSteps: Array.from(validatedSteps),
      pendingStep,
      sessionActive,
      showEnded,
      closingPhase,
      crisisDetected,
      diffractionSansPartage,
      motsCles,
      reflectionCard,
      sessionId: currentSessionId.current,
      lastActivity,
    };
    localStorage.setItem("collegue_chat_state", JSON.stringify(state));
  }, [
    messages,
    validatedSteps,
    pendingStep,
    sessionActive,
    showEnded,
    closingPhase,
    crisisDetected,
    diffractionSansPartage,
    motsCles,
    reflectionCard,
    lastActivity,
  ]);

  useEffect(() => {
    // Le fragment de reprise arrive soit par location.state (navigation
    // directe), soit par localStorage (canal qui survit à un reload ou à un
    // re-render). On lit les deux, localStorage en filet de sécurité.
    let resumeFragment = location.state?.resumeFragment as
      | ReflectionCard
      | undefined;
    if (!resumeFragment) {
      try {
        const stored = localStorage.getItem("collegue_resume_fragment");
        if (stored) resumeFragment = JSON.parse(stored) as ReflectionCard;
      } catch (e) {
        console.warn("resume fragment read failed", e);
      }
    }
    if (resumeFragment) {
      // Reprise consommée : on retire la clé pour qu'elle ne se rejoue pas
      // au prochain passage sur /chat.
      localStorage.removeItem("collegue_resume_fragment");
      const { fragment, deplacement, direction } = resumeFragment;
      const resumeCtx = `Note de contexte — session en reprise : La personne revient et choisit de reprendre une réflexion restée ouverte — Fragment : ${fragment}, Déplacement : ${deplacement}, Direction : ${direction}. Ouvre en accueillant son retour, et propose-lui ce fil comme point de départ : touche-le légèrement — une image, un mot — juste assez pour qu'elle s'y retrouve et ait par où entrer. Laisse l'ouverture : elle peut repartir de là, ou d'ailleurs si autre chose l'occupe.`;
      setActiveResumeContext(resumeCtx);
      localStorage.removeItem("collegue_chat_state");
      const storedId = localStorage.getItem("collegue_personal_id");
      // resumeCtx passé explicitement : le state n'est pas encore propagé.
      if (storedId) {
        confirmStart(storedId, resumeCtx);
      } else {
        confirmStart(generateNewKey(), resumeCtx);
      }
    } else {
      const saved = localStorage.getItem("collegue_chat_state");
      if (saved) {
        try {
          const state = JSON.parse(saved);
          setMessages(state.messages || []);
          setValidatedSteps(new Set(state.validatedSteps || []));
          setPendingStep(state.pendingStep ?? null);
          setSessionActive(state.sessionActive ?? false);
          setShowEnded(state.showEnded ?? false);
          setClosingPhase(state.closingPhase ?? "none");
          setCrisisDetected(state.crisisDetected ?? false);
          setDiffractionSansPartage(state.diffractionSansPartage ?? false);
          setMotsCles(state.motsCles || []);
          setReflectionCard(state.reflectionCard || null);
          currentSessionId.current = state.sessionId || null;
          setLastActivity(state.lastActivity || Date.now());
        } catch (e) {
          console.error("Failed to restore chat state", e);
        }
      }
    }

    // Initialize serpentin intensity from persistent carnet state
    const initSerpentin = async () => {
      const pid = localStorage.getItem("collegue_personal_id");
      if (!pid) return;
      try {
        const res = await sbGet("carnet", `personal_id=eq.${pid}`);
        if (res && res.length > 0 && res[0].serpentin_state) {
          const s = res[0].serpentin_state;
          let lvl = 0;
          if (s.chat_level !== undefined) lvl = s.chat_level;
          else {
            // Map from SerpentinEmotion (from ClarteSection)
            const map: Record<string, number> = {
              calm: 0,
              bright: 1,
              mysterious: 2,
              agitated: 3,
              heavy: 0,
            };
            lvl = map[s.emotion] || 0;
          }
          setFlowIntensity(lvl);
        }
      } catch (e) {}
    };
    initSerpentin();
  }, []);

  useEffect(() => {
    if (sessionActive) {
      saveState();
    }
  }, [saveState, sessionActive]);

  // ── Marquage des sessions abandonnées ─────────────────────
  // Quand la fenêtre se ferme en pleine conversation (ni clôture propre, ni
  // miroir), la ligne `sessions` resterait orpheline en base. On la marque
  // `status: "abandoned"` via sendBeacon. On ne touche PAS `ended_at` : le
  // plafond compte `ended_at=not.is.null`, donc une session abandonnée ne
  // doit pas consommer de crédit quotidien.
  // Un ref tient toujours le dernier état utile — le handler `pagehide` doit
  // rester synchrone (sendBeacon est fire-and-forget), il n'attend rien.
  const abandonRef = useRef<{
    sessionActive: boolean;
    showEnded: boolean;
    closingPhase: string;
    sessionId: string | null;
    personalId: string;
    stepCount: number;
    userMessageCount: number;
  }>({
    sessionActive: false,
    showEnded: false,
    closingPhase: "none",
    sessionId: null,
    personalId: "",
    stepCount: 0,
    userMessageCount: 0,
  });

  useEffect(() => {
    abandonRef.current = {
      sessionActive,
      showEnded,
      closingPhase,
      sessionId: currentSessionId.current,
      personalId,
      stepCount: validatedSteps.size,
      userMessageCount: messages.filter((m) => m.role === "user").length,
    };
  }, [
    sessionActive,
    showEnded,
    closingPhase,
    personalId,
    validatedSteps,
    messages,
  ]);

  useEffect(() => {
    const markAbandoned = () => {
      const s = abandonRef.current;
      // Rien à marquer si la session n'a jamais été insérée en base : pas de
      // sessionId, ou pas de personal_id (ex. plafond atteint avant l'insert).
      if (!s.sessionId || !s.personalId) return;
      // Ne pas re-marquer une session inactive ou déjà clôturée proprement.
      if (!s.sessionActive || s.showEnded || s.closingPhase === "closed")
        return;

      const payload = {
        type: "sb_update",
        data: {
          table: "sessions",
          id: s.sessionId,
          // personal_id : borne la mise à jour côté serveur (sécurité).
          payload: {
            personal_id: s.personalId,
            status: "abandoned",
            step_reached: s.stepCount,
            user_message_count: s.userMessageCount,
          },
        },
      };
      // sendBeacon ne peut pas poser d'en-tête Content-Type : on type le Blob
      // pour qu'`express.json()` parse bien le corps côté serveur.
      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/worker", blob);
      } catch (e) {
        // Fire-and-forget : un échec ici ne doit jamais gêner la fermeture.
      }
    };

    // `pagehide` se déclenche aussi sur mobile (onglet tué, mise en
    // arrière-plan), contrairement à `beforeunload`.
    window.addEventListener("pagehide", markAbandoned);
    return () => window.removeEventListener("pagehide", markAbandoned);
  }, []);

  const clearChatState = () => {
    localStorage.removeItem("collegue_chat_state");
    window.location.reload();
  };

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("collegue_personal_id");
    if (stored) {
      setHasStoredKey(true);
      setPersonalId(stored);
    }

    // Vérification du plafond AU CHARGEMENT : si la limite est déjà atteinte,
    // l'écran d'accueil doit montrer « revenez demain » d'emblée, sans jamais
    // afficher un bouton « Commencer » trompeur. Tant que la réponse n'est
    // pas là, limitChecking masque les boutons (le logo reste seul).
    const checkDailyLimit = async () => {
      // Pas de clé → premier passage, aucun plafond possible.
      if (!stored) {
        setLimitChecking(false);
        return;
      }
      try {
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        const todays = await sbGet(
          "sessions",
          `personal_id=eq.${stored}&started_at=gte.${dayStart.toISOString()}&ended_at=not.is.null`,
        );
        if (
          Array.isArray(todays) &&
          todays.length >= MAX_CONVERSATIONS_PER_DAY
        ) {
          setDailyLimitReached(true);
        }
      } catch (e) {
        // Contrôle indisponible : on n'enferme personne — confirmStart
        // refera la vérification au clic, le serveur tranche en dernier.
        console.warn("daily limit check (mount) failed", e);
      } finally {
        setLimitChecking(false);
      }
    };
    checkDailyLimit();
  }, []);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SR) {
      recognition.current = new SR();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = "fr-FR";
      recognition.current.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            setInputText((p) => p + e.results[i][0].transcript);
            setHasDictatedCurrentMessage(true);
          }
        }
      };
      recognition.current.onend = () => setIsListening(false);
    }
  }, []);

  // ── Scroll ────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // ── Silence → calming ─────────────────────────────────────
  useEffect(() => {
    if (!sessionActive || showEnded) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 45000 && !flowRef.current.isCalming) {
        flowRef.current.isCalming = true;
        flowRef.current.target = {
          amplitude: 1.0,
          speed: 0.003,
          opacity: 0.12,
          color: [120, 140, 130],
          thickness: 0.8,
        };
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastActivity, sessionActive, showEnded]);

  // ── Serpentin canvas ──────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = 44;
      flowRef.current.cometX = canvas.width / 2;
      flowRef.current.cometX2 = canvas.width / 2;
    };
    if (resizeHandlerRef.current)
      window.removeEventListener("resize", resizeHandlerRef.current);
    resizeHandlerRef.current = resize;
    resize();
    window.addEventListener("resize", resize);

    const LERP = 0.035;

    function sineY(
      x: number,
      amp: number,
      phase: number,
      H: number,
      W: number,
    ): number {
      const safeAmp = Math.min(amp, (H / 2 - 2) / 1.4);
      const f = (1 / W) * Math.PI * 2;
      const breathe = 1 + 0.22 * Math.sin(phase * 0.13 + 1.7);
      const a = safeAmp * breathe;
      return (
        H / 2 +
        a * 0.5 * Math.sin(x * f * 4.0 + phase * 1.0) +
        a * 0.28 * Math.sin(x * f * 6.47 + phase * 1.414) +
        a * 0.18 * Math.sin(x * f * 10.47 + phase * 0.618) +
        a * 0.11 * Math.sin(x * f * 16.18 + phase * 2.178) +
        a * 0.07 * Math.sin(x * f * 26.18 + phase * 0.414)
      );
    }

    function sawY(
      x: number,
      amp: number,
      phase: number,
      H: number,
      W: number,
    ): number {
      const safeAmp = Math.min(amp, (H / 2 - 2) / 1.1);
      const f = (1 / W) * Math.PI * 2;
      const angle = x * f * 5.0 + phase * 1.2;
      return (
        H / 2 +
        safeAmp *
          (Math.sin(angle) * 0.637 -
            Math.sin(angle * 2) * 0.318 +
            Math.sin(angle * 3) * 0.212 -
            Math.sin(angle * 4) * 0.159 +
            Math.sin(angle * 5) * 0.127)
      );
    }

    function waveY(
      x: number,
      amp: number,
      phase: number,
      H: number,
      W: number,
    ): number {
      const s = sineY(x, amp, phase, H, W);
      if (flowRef.current.sawtoothLevel < 0.01) return s;
      const sw = sawY(x, amp, phase, H, W);
      return (
        s * (1 - flowRef.current.sawtoothLevel) +
        sw * flowRef.current.sawtoothLevel
      );
    }

    function waveY2(
      x: number,
      amp: number,
      phase: number,
      H: number,
      W: number,
    ): number {
      const phase2 = phase + flowRef.current.phaseOffset2;
      const safeAmp = amp * 0.75;
      const s = sineY(x, safeAmp, phase2, H, W);
      if (flowRef.current.sawtoothLevel < 0.01) return s;
      const sw = sawY(x, safeAmp, phase2, H, W);
      return (
        s * (1 - flowRef.current.sawtoothLevel) +
        sw * flowRef.current.sawtoothLevel
      );
    }

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      if (!W) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const f = flowRef.current;

      const lerpK = f.isCalming ? 0.015 : LERP;
      f.current.amplitude += (f.target.amplitude - f.current.amplitude) * lerpK;
      f.current.speed += (f.target.speed - f.current.speed) * lerpK;
      f.current.opacity += (f.target.opacity - f.current.opacity) * lerpK;
      f.current.thickness +=
        ((f.target.thickness || 1) - (f.current.thickness || 1)) * lerpK;

      f.sawtoothLevel += (f.sawtoothTarget - f.sawtoothLevel) * 0.018;
      f.bounceLevel += (f.bounceTarget - f.bounceLevel) * 0.025;
      f.phaseOffset2 += (f.phaseOffset2Target - f.phaseOffset2) * 0.006;
      f.dampExtra *= 0.94;

      // Couleur
      if (f.isChaos) {
        f.chaosPhase += 0.18;
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(f.chaosPhase));
        f.current.color[0] +=
          (Math.round(180 + pulse * 40) - f.current.color[0]) * 0.08;
        f.current.color[1] +=
          (Math.round(pulse * 20) - f.current.color[1]) * 0.08;
        f.current.color[2] +=
          (Math.round(pulse * 20) - f.current.color[2]) * 0.08;
        f.color2[0] = f.current.color[0];
        f.color2[1] = f.current.color[1];
        f.color2[2] = f.current.color[2];
      } else if (f.isRainbow) {
        f.rainbowHue = (f.rainbowHue + 0.6) % 360;
        const [rr, gg, bb] = hslToRgb(f.rainbowHue, 75, 72);
        f.current.color[0] = rr;
        f.current.color[1] = gg;
        f.current.color[2] = bb;
      } else {
        f.current.color[0] += (f.target.color[0] - f.current.color[0]) * LERP;
        f.current.color[1] += (f.target.color[1] - f.current.color[1]) * LERP;
        f.current.color[2] += (f.target.color[2] - f.current.color[2]) * LERP;
        if (!f.isChaos) {
          f.color2[0] += (f.color2Target[0] - f.color2[0]) * LERP;
          f.color2[1] += (f.color2Target[1] - f.color2[1]) * LERP;
          f.color2[2] += (f.color2Target[2] - f.color2[2]) * LERP;
        }
      }

      f.phase += f.current.speed;

      // Déplacement comètes
      const baseCometSpeed = 1.8 + f.current.speed * 80;
      const chaosJitter = f.isChaos
        ? baseCometSpeed * (0.4 + 1.6 * Math.abs(Math.sin(f.chaosPhase * 3.7)))
        : 0;
      const cometSpeed = baseCometSpeed + chaosJitter;

      if (f.isChaos) {
        if (Math.abs(Math.sin(f.chaosPhase * 11.3)) > 0.97) f.cometVx1 *= -1;
        if (Math.abs(Math.sin(f.chaosPhase * 7.9 + 1.4)) > 0.97)
          f.cometVx2 *= -1;
      }

      if (f.bounceLevel > 0.5) {
        const margin = 8;
        f.cometX += cometSpeed * f.cometVx1;
        f.cometX2 += cometSpeed * 0.85 * f.cometVx2;
        if (f.cometX >= W - margin) {
          f.cometX = W - margin;
          f.cometVx1 = -1;
          f.dampExtra = Math.max(f.dampExtra, 4);
        }
        if (f.cometX <= margin) {
          f.cometX = margin;
          f.cometVx1 = 1;
          f.dampExtra = Math.max(f.dampExtra, 4);
        }
        if (f.cometX2 >= W - margin) {
          f.cometX2 = W - margin;
          f.cometVx2 = -1;
        }
        if (f.cometX2 <= margin) {
          f.cometX2 = margin;
          f.cometVx2 = 1;
        }
      } else {
        f.cometX += cometSpeed;
        f.cometX2 -= cometSpeed * 0.85;
        if (f.cometX > W + 80) {
          f.cometX = -80;
          f.cometVx1 = 1;
        }
        if (f.cometX2 < -80) {
          f.cometX2 = W + 80;
          f.cometVx2 = -1;
        }
      }

      ctx.clearRect(0, 0, W, H);
      const [r, g, b] = f.current.color.map(Math.round);
      const amp = f.current.amplitude + f.dampExtra;
      const thickness = f.current.thickness || 1;

      // Rail
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.10)`;
      ctx.lineWidth = thickness * 0.6;
      for (let x = 0; x <= W; x++) {
        const y = waveY(x, amp, f.phase, H, W);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Onde 2
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.16)`;
      ctx.lineWidth = thickness * 0.5;
      for (let x = 0; x <= W; x++) {
        const y = waveY2(x, amp, f.phase, H, W);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Comète 1 — traîne
      const trailLen = Math.round(70 + amp * 5);
      const trailStart = Math.max(0, Math.round(f.cometX - trailLen));
      const trailEnd = Math.min(W, Math.round(f.cometX));
      if (trailEnd > trailStart) {
        const grad = ctx.createLinearGradient(trailStart, 0, trailEnd, 0);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(
          1,
          `rgba(${r},${g},${b},${(f.current.opacity * 0.85).toFixed(2)})`,
        );
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = thickness;
        for (let x = trailStart; x <= trailEnd; x++) {
          const y = waveY(x, amp, f.phase, H, W);
          if (x === trailStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Tête 1
      if (f.cometX >= 0 && f.cometX <= W) {
        const headY = waveY(f.cometX, amp, f.phase, H, W);
        const glowR = 2.5 + amp * 0.25;
        const halo = ctx.createRadialGradient(
          f.cometX,
          headY,
          0,
          f.cometX,
          headY,
          glowR * 3.5,
        );
        halo.addColorStop(
          0,
          `rgba(${r},${g},${b},${(f.current.opacity * 0.55).toFixed(2)})`,
        );
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.fillStyle = halo;
        ctx.arc(f.cometX, headY, glowR * 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${f.current.opacity.toFixed(2)})`;
        ctx.arc(f.cometX, headY, glowR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // Comète 2 — traîne (vers la droite)
      const [r2, g2, b2] = f.color2.map(Math.round);
      const op2 = f.current.opacity * 0.38;
      const trail2Start = Math.min(W, Math.round(f.cometX2));
      const trail2End = Math.min(W, Math.round(f.cometX2 + trailLen));
      if (trail2End > trail2Start) {
        const grad2 = ctx.createLinearGradient(trail2Start, 0, trail2End, 0);
        grad2.addColorStop(
          0,
          `rgba(${r2},${g2},${b2},${(op2 * 0.85).toFixed(2)})`,
        );
        grad2.addColorStop(1, `rgba(${r2},${g2},${b2},0)`);
        ctx.beginPath();
        ctx.strokeStyle = grad2;
        ctx.lineWidth = thickness * 0.8;
        for (let x = trail2Start; x <= trail2End; x++) {
          const y = waveY2(x, amp, f.phase, H, W);
          if (x === trail2Start) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Tête 2
      if (f.cometX2 >= 0 && f.cometX2 <= W) {
        const headY2 = waveY2(f.cometX2, amp, f.phase, H, W);
        const glowR2 = 1.8 + amp * 0.15;
        const halo2 = ctx.createRadialGradient(
          f.cometX2,
          headY2,
          0,
          f.cometX2,
          headY2,
          glowR2 * 3,
        );
        halo2.addColorStop(
          0,
          `rgba(${r2},${g2},${b2},${(op2 * 0.5).toFixed(2)})`,
        );
        halo2.addColorStop(1, `rgba(${r2},${g2},${b2},0)`);
        ctx.beginPath();
        ctx.fillStyle = halo2;
        ctx.arc(f.cometX2, headY2, glowR2 * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r2},${g2},${b2},${op2.toFixed(2)})`;
        ctx.arc(f.cometX2, headY2, glowR2 * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flash croisement
      const dist = Math.abs(f.cometX - f.cometX2);
      if (
        dist < 30 &&
        f.cometX >= 0 &&
        f.cometX <= W &&
        f.cometX2 >= 0 &&
        f.cometX2 <= W
      ) {
        const cx = (f.cometX + f.cometX2) / 2;
        const cy =
          (waveY(cx, amp, f.phase, H, W) + waveY2(cx, amp, f.phase, H, W)) / 2;
        const flashAlpha = (1 - dist / 30) * f.current.opacity * 0.7;
        const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
        flash.addColorStop(0, `rgba(${r},${g},${b},${flashAlpha.toFixed(2)})`);
        flash.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.fillStyle = flash;
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeHandlerRef.current)
        window.removeEventListener("resize", resizeHandlerRef.current);
    };
  }, [sessionActive, showEnded]);


  // ── setFlowIntensity ──────────────────────────────────────
  const setFlowIntensity = useCallback(
    (
      level: number | "loading" | "unlock" | "validate" | "rainbow" | "chaos",
    ) => {
      const f = flowRef.current;
      if (level === "loading") {
        f.isLoading = true;
        f.isRainbow = false;
        f.isChaos = false;
        f.target = { ...FLOW_LOADING };
      } else if (level === "unlock") {
        f.isRainbow = false;
        f.isChaos = false;
        f.dampExtra = 6;
        f.target = { ...FLOW_UNLOCK };
      } else if (level === "validate") {
        f.isRainbow = false;
        f.isChaos = false;
        f.dampExtra = 10;
        f.target = { ...FLOW_VALIDATE };
        setTimeout(() => {
          const lvl = Math.max(0, Math.min(3, f.emotionalLevel));
          f.target = { ...FLOW_LEVELS[lvl] };
        }, 700);
      } else if (level === "rainbow") {
        f.isRainbow = true;
        f.isChaos = false;
        f.target = {
          amplitude: 14.0,
          speed: 0.038,
          opacity: 0.88,
          color: [232, 213, 176],
          thickness: 2.0,
        };
      } else if (level === "chaos") {
        f.isChaos = true;
        f.isRainbow = false;
        f.bounceTarget = 1.0;
        f.sawtoothTarget = 1.0;
        f.target = { ...FLOW_CHAOS };
      } else {
        f.isLoading = false;
        f.isChaos = false;
        f.isRainbow = false;
        f.isCalming = false;
        f.emotionalLevel = Math.max(0, Math.min(3, level));
        f.target = { ...FLOW_LEVELS[f.emotionalLevel] };
      }
    },
    [],
  );

  // ── Génération de clé personnelle ─────────────────────────
  const generateNewKey = () => {
    const adj = ["libre", "calme", "vif", "ample", "juste", "sobre", "vrai"];
    const noun = [
      "horizon",
      "souffle",
      "chemin",
      "miroir",
      "accord",
      "echo",
      "geste",
    ];
    const key = `${adj[Math.floor(Math.random() * adj.length)]}-${noun[Math.floor(Math.random() * noun.length)]}-${Math.floor(100 + Math.random() * 899)}`;
    setPersonalId(key);
    return key;
  };

  // ── Création du compte : associe un code à 6 chiffres à la clé ──────
  const createAccount = async () => {
    if (!/^\d{6}$/.test(accessCode)) {
      setCodeError("Le code doit comporter exactement 6 chiffres.");
      return;
    }
    setCodeSubmitting(true);
    setCodeError(null);
    try {
      let pid = personalId;
      const send = (id: string) =>
        fetch("/api/worker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "account_create",
            data: { personal_id: id, code: accessCode },
          }),
        });
      let res = await send(pid);
      // Collision improbable de clé : on en régénère une et on réessaie une fois.
      if (res.status === 409) {
        pid = generateNewKey();
        res = await send(pid);
      }
      if (!res.ok) {
        setCodeError("Impossible d'enregistrer le code. Réessayez.");
        setCodeSubmitting(false);
        return;
      }
      localStorage.setItem("collegue_personal_id", pid);
      localStorage.setItem("collegue_access_code", accessCode);
      setCodeCreated(true);
    } catch (e) {
      setCodeError("Erreur réseau. Réessayez.");
    }
    setCodeSubmitting(false);
  };

  // ── Démarrage de session ──────────────────────────────────
  const startSessionFlow = (dayStateKey?: string) => {
    const localCardsStr = localStorage.getItem("collegue_cards");
    if (localCardsStr) {
      try {
        const cards: ReflectionCard[] = JSON.parse(localCardsStr);
        if (cards.length > 0 && !cards[0].prisme) {
          setResumeCardToOffer(cards[0]);
          return;
        }
      } catch (e) {}
    }

    if (hasStoredKey && personalId) {
      confirmStart(personalId, null, dayStateKey);
    } else {
      confirmStart(generateNewKey(), null, dayStateKey);
    }
  };

  const handleResumeChoice = (choice: "reprendre" | "nouvelle") => {
    let resumeCtx: string | null = null;
    if (choice === "reprendre" && resumeCardToOffer) {
      const { fragment, deplacement, direction } = resumeCardToOffer;
      resumeCtx = `Note de contexte — session en reprise : La personne revient. Sa dernière réflexion est restée ouverte — Fragment : ${fragment}, Déplacement : ${deplacement}, Direction : ${direction}. Ouvre en accueillant son retour, et propose-lui ce fil comme point de départ : touche-le légèrement — une image, un mot — juste assez pour qu'elle s'y retrouve et ait par où entrer. Laisse l'ouverture : elle peut repartir de là, ou d'ailleurs si autre chose l'occupe.`;
    }
    setActiveResumeContext(resumeCtx);
    setResumeCardToOffer(null);

    // resumeCtx est passé explicitement : setActiveResumeContext ne sera pas
    // encore propagé quand confirmStart lira le contexte.
    if (hasStoredKey && personalId) {
      confirmStart(personalId, resumeCtx);
    } else {
      confirmStart(generateNewKey(), resumeCtx);
    }
  };

  const confirmStart = async (
    providedId?: string,
    resumeContextArg?: string | null,
    dayStateKey?: string,
  ) => {
    const finalId = providedId || personalId;
    // Le contexte de reprise est passé en argument quand l'appelant vient de
    // le poser via setState : à ce moment le state `activeResumeContext` n'est
    // pas encore à jour (re-render non encore effectué). L'argument prime ;
    // sinon on retombe sur le state (cas d'un démarrage normal).
    const resumeContext =
      resumeContextArg !== undefined ? resumeContextArg : activeResumeContext;

    // Plafond : pré-vérification du nombre de conversations du jour. Le serveur
    // reste le garde-fou dur ; ceci sert à afficher un message clair plutôt que
    // de laisser échouer l'insertion silencieusement.
    if (finalId) {
      try {
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        const todays = await sbGet(
          "sessions",
          `personal_id=eq.${finalId}&started_at=gte.${dayStart.toISOString()}&ended_at=not.is.null`,
        );
        if (
          Array.isArray(todays) &&
          todays.length >= MAX_CONVERSATIONS_PER_DAY
        ) {
          setShowIdentityModal(false);
          setDailyLimitReached(true);
          return;
        }
      } catch (e) {
        // Contrôle indisponible : on laisse démarrer, le serveur tranchera.
        console.warn("daily limit pre-check failed", e);
      }
    }

    setShowIdentityModal(false);
    setLoading(true);
    setSessionActive(true);
    setMessages([]);
    setLastActivity(Date.now());
    setRecentrageMode("crise");
    sealPlayed.current = false;
    ruptureShown.current = false;

    let pastCards: any[] = [];
    if (finalId) {
      localStorage.setItem("collegue_personal_id", finalId);
      setHasStoredKey(true);

      try {
        const result = await sbInsert("sessions", {
          started_at: new Date().toISOString(),
          step_reached: 0,
          messages: [],
          personal_id: finalId,
        });
        // Le serveur renvoie { row: {...} } pour sb_insert — l'id est dans row.
        const insertedId = (result as any)?.row?.id;
        if (insertedId) currentSessionId.current = insertedId;

        // Fetch past reflections to seed context (Piste 4)
        const past = await sbGet(
          "sessions",
          `personal_id=eq.${finalId}&limit=5&order=started_at.desc`,
        );
        if (past && Array.isArray(past)) {
          pastCards = past.map((s: any) => s.reflection_card).filter(Boolean);
          setPastReflections(pastCards);
        }
      } catch (e) {
        console.error("Session cloud failed", e);
      }
    } else {
      const sessionId = Date.now().toString();
      currentSessionId.current = sessionId;
    }

    if (resumeContext) {
      setMessages([
        { role: "assistant", content: "", ts: new Date().toISOString() },
      ]);
      try {
        let accumulated = "";
        await streamChat(
          [
            {
              role: "user",
              content: `${resumeContext}\n\n(La personne s'assoit, prête à reprendre ce fil. Ouvre toi-même la conversation : accueille son retour et nomme franchement ce qui était resté ouvert — reprends le fragment, le déplacement et la direction ci-dessus dans tes mots, pour qu'elle retrouve où elle en était. Termine en lui laissant l'espace de continuer ou de bifurquer.)`,
              ts: new Date().toISOString(),
            },
          ],
          700,
          (chunk) => {
            accumulated += chunk;
            setMessages((prev) => {
              const next = [...prev];
              if (
                next.length > 0 &&
                next[next.length - 1].role === "assistant"
              ) {
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: accumulated,
                };
              }
              return next;
            });
          },
        );
      } catch (e) {
        setMessages([
          {
            role: "assistant",
            content: COLD_OPENER,
            ts: new Date().toISOString(),
          },
        ]);
      }
    } else {
      // Opener à froid : si la personne a indiqué un état du jour, l'ouverture
      // le rencontre ; sinon, le COLD_OPENER neutre.
      const dayState = DAY_STATES.find((s) => s.key === dayStateKey);
      const coldText = dayState ? dayState.opener : COLD_OPENER;

      // Pas de reprise de fil ouvert. Si la personne a un historique suffisant,
      // on génère un opener tissé (écho sobre à son cheminement) ; sinon, le
      // coldText instantané (primo-visite ou trop peu de matière).
      const woven =
        pastCards.length >= WOVEN_THRESHOLD
          ? buildWovenContext(pastCards)
          : null;
      if (woven) {
        const stateNote = dayState
          ? ` Elle vient d'indiquer qu'elle arrive aujourd'hui plutôt « ${dayState.label} » : accorde ton ouverture à cet état, sans le répéter mécaniquement.`
          : " Ne présume pas de son état du jour : invite-la à dire d'où elle arrive aujourd'hui.";
        setMessages([
          { role: "assistant", content: "", ts: new Date().toISOString() },
        ]);
        try {
          let accumulated = "";
          await streamChat(
            [
              {
                role: "user",
                content: `${woven}\n\n(La personne revient — ce n'est PAS la reprise d'un fil resté ouvert. Ouvre toi-même la conversation : accueille son retour et glisse un écho sobre à ce qui précède — une image, un mot — sans tout dérouler ni laisser entendre que tu « sais tout » d'elle.${stateNote} Deux ou trois phrases.)`,
                ts: new Date().toISOString(),
              },
            ],
            700,
            (chunk) => {
              accumulated += chunk;
              setMessages((prev) => {
                const next = [...prev];
                if (
                  next.length > 0 &&
                  next[next.length - 1].role === "assistant"
                ) {
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    content: accumulated,
                  };
                }
                return next;
              });
            },
            true,
          );
        } catch (e) {
          setMessages([
            {
              role: "assistant",
              content: coldText,
              ts: new Date().toISOString(),
            },
          ]);
        }
      } else {
        setMessages([
          {
            role: "assistant",
            content: coldText,
            ts: new Date().toISOString(),
          },
        ]);
      }
    }

    setLoading(false);

    // Réinitialiser le serpentin
    const f = flowRef.current;
    f.emotionalLevel = 0;
    f.isRainbow = false;
    f.isChaos = false;
    f.isCalming = false;
    f.sawtoothLevel = 0;
    f.sawtoothTarget = 0;
    f.bounceLevel = 0;
    f.bounceTarget = 0;
    f.phaseOffset2 = 0;
    f.phaseOffset2Target = 0;
    f.target = { ...FLOW_LEVELS[0] };
  };

  // ── Sauvegarde session ────────────────────────────────────
  // `ended_at` n'est posé qu'une fois la personne au-delà du seuil
  // d'engagement : c'est ce champ que le plafond compte, donc une
  // conversation de 3 messages ou moins ne décompte aucun crédit.
  // `step_reached` est toujours écrit (info admin, sans effet sur le plafond).
  const saveSession = useCallback(
    async (convo?: Message[]) => {
      if (!currentSessionId.current || !personalId) return;
      const list = convo ?? messages;
      const userMessages = list.filter((m) => m.role === "user").length;
      const payload: Record<string, unknown> = {
        step_reached: validatedSteps.size,
        user_message_count: userMessages,
      };
      if (userMessages > ENGAGEMENT_MIN_USER_MESSAGES) {
        payload.ended_at = new Date().toISOString();
      }
      try {
        await sbUpdate("sessions", currentSessionId.current, payload);
      } catch (e) {
        console.error("saveSession failed", e);
      }
    },
    [validatedSteps.size, personalId, messages],
  );

  // ── Streaming chat via Worker ─────────────────────────────
  const streamChat = useCallback(
    async (
      payload: Message[],
      maxTokens: number,
      onChunk: (chunk: string) => void,
      noInjection = false,
    ): Promise<string> => {
      // Injection mémoire de résonance en phase Équilibre
      const inEquilibre = validatedSteps.size >= 4 && !validatedSteps.has(4);

      let contextNote = "";
      if (activeResumeContext) {
        contextNote += `${activeResumeContext} `;
      }

      if (!noInjection && inEquilibre && motsCles.length > 0) {
        contextNote += `Note interne (ne pas citer explicitement) : la personne a utilisé ces mots : ${motsCles.map((m) => `"${m}"`).join(", ")}. Réutilise l'un d'eux sobrement si l'occasion s'y prête. `;
      }

      if (!noInjection && pastReflections.length > 0) {
        const pastSummary = pastReflections
          .map((r) => `[${r.sphere}] "${r.fragment}"`)
          .join(" ; ");
        contextNote += `Mémoire de résonance (Piste 4) : Dans ses sessions précédentes, les thèmes suivants ont émergé : ${pastSummary}. Si tu perçois un écho avec la situation actuelle, propose une mise en lien très subtile pour approfondir le trajet, sans forcer.`;
      }

      let finalMessages = [...payload];
      if (contextNote) {
        finalMessages[finalMessages.length - 1] = {
          ...finalMessages[finalMessages.length - 1],
          content:
            finalMessages[finalMessages.length - 1].content +
            `\n\n[INSN: ${contextNote}]`,
        };
      }

      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          messages: toWorkerMessages(finalMessages),
          max_tokens: maxTokens,
        }),
      });

      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.delta?.text || "";
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
          } catch {}
        }
      }
      return fullText;
    },
    [validatedSteps, motsCles, activeResumeContext, pastReflections],
  );

  // ── Recentrage ───────────────────────────────────────
  // Génère des paradoxes de recentrage accrochés à la conversation : des
  // retournements doux qui desserrent la prise, dans la voix du collègue.
  // Repli silencieux sur les prompts statiques si la génération échoue.
  const generateRecentragePrompts = useCallback(
    async (resolved: boolean): Promise<string[]> => {
    const recent = messages
      .filter((m) => m.content && m.content.trim().length > 0)
      .slice(-12)
      .map(
        (m) => `${m.role === "user" ? "Personne" : "Collègue"} : ${m.content}`,
      )
      .join("\n");
    const motsLine =
      motsCles.length > 0
        ? `\nMots qui sont revenus : ${motsCles.join(", ")}.`
        : "";
    const cadre = resolved
      ? "L'échange se referme, et les cinq dimensions ont été traversées : le nœud se défait. Écris 4 phrases brèves — des paradoxes, des retournements doux — qui accompagnent ce dénouement sur l'ensemble de l'arc parcouru. Pas un résumé : une image qui reste et continue de travailler en elle après la fermeture."
      : "L'échange se referme sans que tout ait été dénoué : le nœud tient encore, peut-être plus serré qu'au début. Écris 4 phrases brèves — des paradoxes, des retournements doux — qui nomment cela avec justesse et douceur, sans le moindre reproche ni constat d'échec : un nœud qu'on voit déjà mieux. Une image qui reste et continue de travailler en elle.";
    const instruction = `Voici un extrait de la conversation que tu viens d'avoir avec cette personne :\n\n${recent}\n${motsLine}\n\n[CONSIGNE INTERNE — ne réponds qu'avec le résultat, rien d'autre.]\n${cadre}\n\nRègle absolue : AUCUNE sagesse générique. Aucun proverbe, aucun aphorisme, aucune formule de méditation, de pleine conscience ou de développement personnel, rien qui pourrait s'écrire sans l'avoir écoutée. Chaque phrase doit être impossible à formuler pour quelqu'un qui n'aurait pas lu CETTE conversation : ancre-la dans sa situation précise, reprends ses propres mots et ses images, retourne-les.\n\nReste dans ta voix — celle de tout ce que tu viens de lui dire, pas une voix de méditation. Pas de conseil, pas de question, pas d'injonction. Une phrase par ligne, rien d'autre — aucun numéro, aucun tiret, aucun préambule.`;

    const raw = await streamChat(
      [{ role: "user", content: instruction, ts: new Date().toISOString() }],
      400,
      () => {},
      true,
    );
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-•*–]|\d+[.)])\s*/, "").trim())
      .filter((l) => l.length >= 10 && l.length < 200 && !l.endsWith(":"));
    return lines.slice(0, 7);
  }, [messages, motsCles, streamChat]);


  // ── Eval via Worker ───────────────────────────────────────
  const evalSteps = useCallback(
    async (currentMessages: Message[]) => {
      if (evalInProgress.current) return;
      if (validatedSteps.size >= 5) return;
      if (pendingStep !== null) return;

      const realUserMsgs = currentMessages.filter(
        (m) =>
          m.role === "user" &&
          m.content !== "Bonjour, j'ai une situation à vous soumettre.",
      );
      if (realUserMsgs.length < 1) return;

      const lastUserMsg = realUserMsgs[realUserMsgs.length - 1];
      const msgsSinceLastEval = currentMessages.length - lastEvalAt.current;
      if (lastUserMsg.content.length <= 20 && msgsSinceLastEval < 2) return;
      lastEvalAt.current = currentMessages.length;

      evalInProgress.current = true;
      try {
        // Insights multi-sessions — si une clé existe, récupérer les sessions passées
        let multiSessionNote = "";
        if (personalId) {
          if (pastReflections.length > 0) {
            const pastSummary = pastReflections
              .map((r) => r.fragment)
              .join(", ");
            multiSessionNote = `\n\nNote contextuelle (Mémoire de résonance - Piste 4) : cette personne a déjà eu des sessions précédentes où les images fortes étaient : ${pastSummary}. Si la situation actuelle fait écho à ces patterns récurrents, propose un déplacement de perspective qui tient compte de cette continuité.`;
          } else {
            multiSessionNote =
              "\n\nNote contextuelle : cette personne commence son parcours. Sois attentif aux premiers fragments qui émergent.";
          }
        }
        const evalMessages = [
          ...currentMessages,
          {
            role: "user" as Role,
            content:
              multiSessionNote ||
              "Analyse la conversation selon tes instructions système.",
          },
        ];

        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "eval",
            messages: toWorkerMessages(evalMessages),
            max_tokens: 1000,
          }),
        });
        const data = await res.json();
        // Un échec côté worker (erreur Anthropic, 5xx, etc.) renvoie un objet
        // sans `content`. Sans ce garde-fou, `raw` retombait sur "{}" et toutes
        // les étapes passaient silencieusement à false — indiscernable d'une
        // vraie éval « rien n'a encore émergé ». On le rend visible et on sort.
        if (!data || !data.content || !data.content[0]?.text) {
          console.warn(
            "eval: réponse worker sans contenu exploitable — étapes non réévaluées",
            data?.error || data,
          );
          return;
        }
        const raw = data.content[0].text
          .replace(/```json|```/g, "")
          .trim();
        const result: EvalResult = JSON.parse(raw);

        // Crise
        if (result.crisis === true && !crisisDetected) {
          setCrisisDetected(true);
          setFlowIntensity("chaos");
        }

        // Charge émotionnelle maximale : pas de mode contemplatif (le
        // recentrage est réservé à la clôture). On invite à une vraie rupture
        // de cadre, une seule fois par session.
        if (result.emotional_charge >= 3 && !ruptureShown.current) {
          ruptureShown.current = true;
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "L'intensité dépasse ce que cet espace peut sereinement contenir en ce moment. Ma suggestion la plus juste serait de fermer cet écran, d'aller passer de l'eau sur votre visage, et de laisser la place au silence physique. Je reste là, mais le rythme demande maintenant une vraie rupture de cadre.",
                ts: new Date().toISOString(),
              },
            ]);
          }, 2000);
        }

        // Diffraction sans partage
        setDiffractionSansPartage(result.diffraction_sans_partage === true);

        // Mots-clés
        if (Array.isArray(result.mots_cles) && result.mots_cles.length > 0) {
          setMotsCles((prev) =>
            prev.length >= result.mots_cles.length ? prev : result.mots_cles,
          );
        }

        // Serpentin
        if (
          !flowRef.current.isLoading &&
          !flowRef.current.isChaos &&
          !flowRef.current.isRainbow
        ) {
          const userCharge = Math.max(
            0,
            Math.min(3, result.emotional_charge || 0),
          );
          const aiPosture = Math.max(
            0,
            Math.min(3, result.collegue_posture || 0),
          );
          const tension = Math.max(0, Math.min(3, result.tension || 0));
          const alliance = Math.max(0, Math.min(3, result.alliance || 0));

          flowRef.current.emotionalLevel = userCharge;
          flowRef.current.color2Target = [...POSTURE_COLORS[aiPosture]];
          flowRef.current.target = {
            amplitude: FLOW_LEVELS[userCharge].amplitude,
            speed: FLOW_LEVELS[aiPosture].speed,
            opacity:
              (FLOW_LEVELS[userCharge].opacity +
                FLOW_LEVELS[aiPosture].opacity) /
              2,
            color: [...FLOW_LEVELS[0].color],
            thickness: FLOW_LEVELS[userCharge].thickness,
          };
          flowRef.current.sawtoothTarget = [0, 0.3, 0.65, 1.0][tension];
          flowRef.current.bounceTarget =
            tension >= 2 ? (tension === 3 ? 1.0 : 0.6) : 0.0;
          if (tension === 3 && !flowRef.current.isChaos)
            setFlowIntensity("chaos");
          if (tension < 3 && flowRef.current.isChaos && !crisisDetected) {
            flowRef.current.isChaos = false;
            flowRef.current.bounceTarget = tension >= 2 ? 0.6 : 0.0;
          }
          flowRef.current.phaseOffset2Target = Math.PI * (1 - alliance / 3);

          // Save persistent state
          if (personalId) {
            sbGet("carnet", `personal_id=eq.${personalId}`).then((res) => {
              if (res && res.length > 0) {
                const mapLvlToEmotion = [
                  "calm",
                  "bright",
                  "mysterious",
                  "agitated",
                ];
                sbUpdate("carnet", res[0].id, {
                  serpentin_state: {
                    chat_level: userCharge,
                    emotion: mapLvlToEmotion[userCharge] || "calm",
                    intensity: userCharge / 3,
                  },
                });
              }
            });
          }
        }

        // Débloquer étape
        const keys = [
          "situation",
          "ressenti",
          "demande",
          "diffraction",
          "equilibre",
        ];
        const nextToUnlock = keys.findIndex((k, i) => {
          if (validatedSteps.has(i)) return false;
          if (k === "diffraction")
            return (
              result.diffraction === true ||
              result.diffraction_sans_partage === true
            );
          return (result as any)[k] === true;
        });

        if (nextToUnlock !== -1) {
          if (pendingValidateTimeout.current)
            clearTimeout(pendingValidateTimeout.current);
          pendingValidateTimeout.current = setTimeout(() => {
            pendingValidateTimeout.current = null;
            setPendingStep(nextToUnlock);
            setFlowIntensity("unlock");
          }, 600);
        }

        // Arc-en-ciel si toutes les étapes validées
        if (result.equilibre && validatedSteps.size === 4) {
          setFlowIntensity("rainbow");
        }
      } catch (e) {
        console.error("eval failed", e);
      } finally {
        evalInProgress.current = false;
      }
    },
    [validatedSteps, pendingStep, crisisDetected, setFlowIntensity],
  );

  // ── Envoi message ─────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || loading) return;
    const text = inputText;
    setInputText("");
    setLastActivity(Date.now());
    flowRef.current.isCalming = false;

    if (pendingValidateTimeout.current) {
      clearTimeout(pendingValidateTimeout.current);
      pendingValidateTimeout.current = null;
    }

    const newMsg: Message = {
      role: "user",
      content: text,
      ts: new Date().toISOString(),
      isDictated: hasDictatedCurrentMessage,
    };
    setHasDictatedCurrentMessage(false);
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);

    // Phase de clôture : la réponse de la personne déclenche le miroir,
    // puis la conversation se referme.
    if (closingPhase === "awaiting-reply") {
      await triggerMirror(updatedMessages);
      return;
    }

    // Seuil dur : la conversation se referme par le miroir, que l'équilibre
    // soit validé ou non. Une conversation se termine TOUJOURS par le miroir.
    if (updatedMessages.length >= HARD_MESSAGE_LIMIT) {
      await triggerMirror(updatedMessages);
      return;
    }

    setLoading(true);
    setFlowIntensity("loading");

    // Tronquer le contexte
    const MAX_CONTEXT = 40;
    let payload = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    if (payload.length > MAX_CONTEXT + 1) {
      payload = [payload[0], ...payload.slice(-MAX_CONTEXT)];
    }

    // Compteur de non-progrès : un échange de plus sans nouvelle étape
    // validée (il se remet à zéro à chaque validation d'étape).
    const exchangesNow = exchangesSinceProgress + 1;
    setExchangesSinceProgress(exchangesNow);

    // Atterrissage. Déclencheur principal : le NON-PROGRÈS soutenu — une
    // conversation qui tourne en boucle (la frontière réflexion/rumination).
    // Déclencheur secondaire : la longueur, simple garde-fou pour un
    // cheminement qui avance mais s'éternise. Dans les deux cas, seulement si
    // l'Équilibre (étape 4) n'est pas validé et hors crise (la crise prime).
    const inLanding =
      (exchangesNow >= STUCK_LANDING_THRESHOLD ||
        updatedMessages.length >= LANDING_THRESHOLD) &&
      !validatedSteps.has(4) &&
      !crisisDetected;
    if (inLanding && payload.length > 0) {
      const lastIdx = payload.length - 1;
      payload[lastIdx] = {
        ...payload[lastIdx],
        content: payload[lastIdx].content + "\n\n" + LANDING_NOTE,
      };
    }

    // Nudge doux (une seule fois) : premier signal de non-progrès, avant
    // d'en arriver à l'atterrissage. On ne l'ajoute pas si on atterrit déjà.
    if (!inLanding && exchangesNow === NUDGE_THRESHOLD && payload.length > 0) {
      const lastIdx = payload.length - 1;
      payload[lastIdx] = {
        ...payload[lastIdx],
        content: payload[lastIdx].content + "\n\n" + NUDGE_NOTE,
      };
    }

    // Bulle de streaming
    const bubbleId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", ts: new Date().toISOString() },
    ]);

    try {
      let accumulated = "";
      const fullText = await streamChat(payload, 1000, (chunk) => {
        accumulated += chunk;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.role === "assistant")
            next[next.length - 1] = { ...last, content: accumulated };
          return next;
        });
        scrollToBottom();
      });

      if (fullText) {
        const ts = new Date().toISOString();
        const finalMessages: Message[] = [
          ...updatedMessages,
          { role: "assistant", content: fullText, ts },
        ];
        setMessages(finalMessages);
        setFlowIntensity(flowRef.current.emotionalLevel);
        evalSteps(finalMessages);
        saveSession(finalMessages);
      }
    } catch (e) {
      console.error("streamChat error:", e);
      setMessages((prev) => {
        const next = [...prev];
        if (next[next.length - 1].role === "assistant")
          next[next.length - 1].content = "Erreur de connexion.";
        return next;
      });
    } finally {
      setLoading(false);
      flowRef.current.isLoading = false;
    }
  };

  // ── Validation d'étape ────────────────────────────────────
  const validateStep = (index: number) => {
    const next = new Set<number>(validatedSteps);
    next.add(index);
    setValidatedSteps(next);
    setPendingStep(null);
    setExchangesSinceProgress(0);
    setFlowIntensity("validate");

    // Confetti effect
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#E8D5B0", "#6BA368", "#f5f5f4"],
    });

    if (next.size === 5) {
      setClosingPhase("awaiting-reply");
      setTimeout(() => setFlowIntensity("rainbow"), 800);
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ["#E8D5B0", "#6BA368", "#f5f5f4", "#EA580C"],
      });
    }

    // Synthèse
    triggerSynthese(next);
  };

  // ── Nudge vers une étape — clic sur le label ─────────────
  const handleStepClick = async (index: number) => {
    if (validatedSteps.has(index) || loading) return;
    const stepName = STEP_NAMES_FR[index];
    setLoading(true);
    setFlowIntensity("loading");

    const nudgeContent = `[Note interne : l'utilisateur souhaite explorer la dimension "${stepName}". Amène délicatement le dialogue vers ce point sans le nommer explicitement, sans briser le flux de la conversation.]`;

    const MAX_CONTEXT = 40;
    let payload = [
      ...messages,
      { role: "user" as Role, content: nudgeContent },
    ].map((m) => ({ role: m.role, content: m.content }));
    if (payload.length > MAX_CONTEXT + 1) {
      payload = [payload[0], ...payload.slice(-MAX_CONTEXT)];
    }

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", ts: new Date().toISOString() },
    ]);

    try {
      let accumulated = "";
      const fullText = await streamChat(
        payload,
        700,
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === "assistant")
              next[next.length - 1] = { ...last, content: accumulated };
            return next;
          });
          scrollToBottom();
        },
        true,
      );

      if (fullText) {
        const finalMessages: Message[] = [
          ...messages,
          {
            role: "assistant",
            content: fullText,
            ts: new Date().toISOString(),
          },
        ];
        setMessages(finalMessages);
        evalSteps(finalMessages);
      }
    } catch (e) {
      console.error("nudge failed", e);
    } finally {
      setLoading(false);
      flowRef.current.isLoading = false;
    }
  };
  const triggerSynthese = async (validated: Set<number>) => {
    if (messages.length < 2) return;
    setLoading(true);

    const summary = messages
      .filter(
        (m) => m.content !== "Bonjour, j'ai une situation à vous soumettre.",
      )
      .map(
        (m) => `${m.role === "user" ? "Personne" : "Collègue"} : ${m.content}`,
      )
      .join("\n");

    const validatedNames = Array.from(validated).map((i) => STEP_NAMES_FR[i]);
    const nextStep =
      STEP_NAMES_FR[[0, 1, 2, 3, 4].find((i) => !validated.has(i)) ?? 4];
    const echoInstruction =
      motsCles.length > 0
        ? `\n\nNote : la personne a utilisé ces images fortes : ${motsCles.join(", ")}. Inclus l'une d'entre elles dans ta synthèse comme un écho naturel.`
        : "";

    const isFinal = validated.size === 5;
    const prompt = isFinal
      ? `Voici la conversation jusqu'ici :
${summary}

Toutes les dimensions de la réflexion ont été traversées. Valide ce moment en un seul temps : une image juste, tirée directement de ce qui a été dit — deux ou trois phrases — qui reconnaît le chemin parcouru. Ne rouvre pas l'exploration et n'annonce pas d'étape suivante. Mais termine en tendant la main : invite simplement la personne à dire un dernier mot avant que l'échange se referme.${echoInstruction}`
      : `Voici la conversation jusqu'ici :
${summary}

Étapes validées : ${validatedNames.join(", ") || "aucune"}. Prochaine étape pressentie : ${nextStep}.

Fais un point en deux temps. Premier temps : une image tirée directement de ce qui a été dit — deux ou trois phrases. Deuxième temps : une direction naturelle vers la prochaine étape, sans la nommer. Une phrase, une ouverture.${echoInstruction}`;

    try {
      let accumulated = "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", ts: new Date().toISOString() },
      ]);
      const fullText = await streamChat(
        [{ role: "user", content: prompt }],
        500,
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === "assistant")
              next[next.length - 1] = { ...last, content: accumulated };
            return next;
          });
          scrollToBottom();
        },
        true, // noInjection
      );
      if (fullText) {
        const finalMessages: Message[] = [
          ...messages,
          {
            role: "assistant",
            content: fullText,
            ts: new Date().toISOString(),
          },
        ];
        setMessages(finalMessages);
        evalSteps(finalMessages);
      }
    } catch (e) {
      console.error("synthèse failed", e);
    } finally {
      setLoading(false);
    }
  };

  // Garantit que la carte n'est générée qu'une seule fois, quel que soit le
  // chemin de clôture (avec miroir : lancée dès la fin du reflet ; sans
  // miroir : lancée par finalizeClose). Le ref rend l'appel idempotent.
  const startCardGeneration = (convo?: Message[]) => {
    if (cardGenStarted.current) return;
    cardGenStarted.current = true;
    saveSession(convo);
    generateReflectionCard(convo);
  };

  // ── Clôture effective — verrouillage + fragment ───────────
  const finalizeClose = () => {
    setShowEnded(true);
    // Si un miroir a joué, la carte est déjà lancée (le garde rend ceci
    // inopérant). Sinon — clôture directe sans miroir — elle démarre ici.
    startCardGeneration();
    // Révélation de la clé : une seule fois, à la première conversation close.
    const firstTime = !localStorage.getItem("collegue_key_revealed");
    setKeyJustRevealed(firstTime);
    if (firstTime) localStorage.setItem("collegue_key_revealed", "1");
  };

  // ── Miroir réfléchissant — dernier message de la conversation ──
  const triggerMirror = async (convo: Message[]) => {
    setLoading(true);
    setFlowIntensity("loading");

    // Garde-fou : si le miroir n'aboutit pas (flux qui traîne, réseau,
    // worker qui ne ferme pas le SSE), on bascule quand même en "closed"
    // pour que l'utilisateur ne reste jamais prisonnier de la fin.
    let closed = false;
    const forceClose = () => {
      if (closed) return;
      closed = true;
      setClosingPhase("closed");
      setLoading(false);
      flowRef.current.isLoading = false;
    };
    const safetyTimer = setTimeout(forceClose, 35000);

    // Conversation finale pour la carte : la conversation reçue, complétée du
    // texte du miroir si le flux aboutit.
    let convoForCard: Message[] = convo;

    const summary = convo
      .filter(
        (m) => m.content !== "Bonjour, j'ai une situation à vous soumettre.",
      )
      .map(
        (m) => `${m.role === "user" ? "Personne" : "Collègue"} : ${m.content}`,
      )
      .join("\n");

    const echoInstruction =
      motsCles.length > 0
        ? `\n\nNote : la personne a utilisé ces images fortes : ${motsCles.join(", ")}. Fais résonner l'une d'elles dans le reflet.`
        : "";

    const prompt = `Voici la conversation complète, jusqu'à la dernière parole de la personne :
${summary}

C'est la fin de cet échange. Renvoie un dernier message, un seul : un miroir de toute la traversée. Ne résume pas — fais surgir une image qui attrape la lumière de ce qui s'est dit, ce qui a vraiment compté. Accueille la dernière parole de la personne et replie-la dans ce reflet. Termine sur une ouverture : une phrase qui reste, qui continue de travailler en elle après la fermeture. Ne pose aucune question, ne propose aucune suite. Trois à cinq phrases.${echoInstruction}`;

    try {
      let accumulated = "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", ts: new Date().toISOString() },
      ]);
      const fullText = await streamChat(
        [{ role: "user", content: prompt }],
        700,
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === "assistant")
              next[next.length - 1] = { ...last, content: accumulated };
            return next;
          });
          scrollToBottom();
        },
        true, // noInjection
      );
      if (fullText) {
        const finalMessages: Message[] = [
          ...convo,
          {
            role: "assistant",
            content: fullText,
            ts: new Date().toISOString(),
          },
        ];
        setMessages(finalMessages);
        convoForCard = finalMessages;
      }
    } catch (e) {
      console.error("miroir failed", e);
    } finally {
      // On NE ferme PAS l'écran automatiquement : le miroir reste affiché,
      // la saisie se verrouille, et c'est la personne qui clôt via
      // « Voir ma carte ». forceClose() est idempotent : si le garde-fou a
      // déjà tiré, ceci ne fait rien.
      clearTimeout(safetyTimer);
      forceClose();
      // La carte se génère et se persiste DÈS MAINTENANT, en arrière-plan,
      // pendant que la personne lit le reflet. Fermer l'onglet sans cliquer
      // « Voir ma carte » ne perd donc plus la carte ni la session.
      startCardGeneration(convoForCard);
    }
  };

  // ── Terminer session ──────────────────────────────────────
  // ── Sceau de clôture ──────────────────────────────────────
  // Au moment de révéler la carte (arc complet, Équilibre atteint), un dernier
  // temps de hauteur : l'overlay joue quelques paradoxes sur tout l'arc, puis
  // la carte se révèle. Passable d'un tap — on ne retient jamais la personne.
  const triggerSeal = async () => {
    setRecentrageMode("sceau");
    setIsRecentrage(true);
    setRecentrageStep(0);
    flowRef.current.isCalming = true;
    flowRef.current.target = {
      amplitude: 0.1,
      speed: 0.001,
      opacity: 0.05,
      color: [80, 80, 80],
      thickness: 0.8,
    };

    const resolved = validatedSteps.size === 5;
    let prompts = RECENTRAGE_PROMPTS.slice(0, 4);
    try {
      const generated = await generateRecentragePrompts(resolved);
      if (generated && generated.length >= 3) prompts = generated.slice(0, 4);
    } catch (e) {}
    setActiveRecentragePrompts(prompts);

    let current = 0;
    sealInterval.current = setInterval(() => {
      current++;
      if (current >= prompts.length) {
        if (sealInterval.current) clearInterval(sealInterval.current);
        setTimeout(() => {
          setIsRecentrage(false);
          flowRef.current.isCalming = false;
          finalizeClose();
        }, 3000);
      } else {
        setRecentrageStep(current);
        flowRef.current.dampExtra = 1.0;
      }
    }, 5000);
  };

  // Passer le sceau : la carte se révèle tout de suite.
  const skipSeal = () => {
    if (sealInterval.current) clearInterval(sealInterval.current);
    setIsRecentrage(false);
    flowRef.current.isCalming = false;
    finalizeClose();
  };

  const endSession = async () => {
    // On bloque le double-clic en cours de conversation — mais PAS en phase
    // de clôture : si "loading" est resté coincé (miroir qui traîne), le
    // bouton « Terminer » doit malgré tout fonctionner, jamais piéger.
    if (loading && closingPhase === "none") return;

    // Si la personne termine sans avoir répondu au message de validation,
    // on joue quand même le miroir avant de clore.
    if (closingPhase === "awaiting-reply") {
      await triggerMirror(messages);
      return;
    }
    // Sceau de clôture : à chaque fin (une fois), tant qu'il y a de la matière.
    // Son contenu reflète l'état du nœud — défait si les 5 étapes sont
    // validées, encore noué sinon.
    const realMsgs = messages.filter(
      (m) =>
        m.role === "user" &&
        m.content !== "Bonjour, j'ai une situation à vous soumettre.",
    ).length;
    if (!sealPlayed.current && realMsgs >= 2) {
      sealPlayed.current = true;
      await triggerSeal();
      return;
    }
    finalizeClose();
  };

  // ── Carte de réflexion via Worker ─────────────────────────
  const generateReflectionCard = async (convo?: Message[]) => {
    const realMessages = (convo ?? messages).filter((m, i) => {
      if (m.content === "Bonjour, j'ai une situation à vous soumettre.")
        return false;
      if (m.role === "assistant" && i <= 1) return false;
      return true;
    });
    // Une vraie conversation, même courte, mérite son fragment.
    // Un seul message de la personne suffit ; en deçà, c'est une
    // conversation ouverte puis refermée sans rien déposer.
    if (realMessages.filter((m) => m.role === "user").length < 1) return;

    const summary = realMessages
      .slice(-30)
      .map(
        (m) => `${m.role === "user" ? "Personne" : "Collègue"} : ${m.content}`,
      )
      .join("\n")
      .slice(0, 5000);

    const motsSection =
      motsCles.length > 0
        ? `\n\nMots utilisés par la personne : ${motsCles.map((m) => `"${m}"`).join(", ")}. Le fragment doit résonner avec l'un d'eux si possible.`
        : "";

    const isEquilibreReached = validatedSteps.has(4);
    const prismeInstruction = isEquilibreReached
      ? `6. Une emotion : Le signal affectif dominant détecté. Choisis UNIQUEMENT parmi : "joie", "tristesse", "colere", "peur", "degout", "surprise", "confiance", "anticipation", "honte", "melancolie".
7. Un prisme : Répète la même valeur que l'emotion ici, car l'état d'équilibre est atteint.`
      : `6. Une emotion : Le signal affectif dominant détecté. Choisis UNIQUEMENT parmi : "joie", "tristesse", "colere", "peur", "degout", "surprise", "confiance", "anticipation", "honte", "melancolie".
7. Un prisme : Laisse ce champ vide ("") car l'état d'équilibre n'a pas été pleinement stabilisé.`;

    const prompt = `Voici la conversation qui vient de s'achever :
${summary}${motsSection}

Génère une "carte de réflexion" selon la philosophie de "Mise en lien du vécu".

Cette approche vise à ne pas expliquer ("pourquoi"), mais à déplier comment le vécu s'articule, se déplace et s'inscrit dans une dimension de vie.

Cinq éléments courts et denses :
1. Un fragment : un mot, une image ou une expression brute tirée directement des propos de la personne. Pas de reformulation propre. Doit être le point de pivot sensoriel de l'échange.
2. Un déplacement : ce qui a bougé ou ce qui a été décentré pendant l'échange. Une phrase sobre, sans jargon théorique.
3. Une direction : une petite fenêtre ouverte, une question ou une vigilance courte à emmener avec soi.
4. Une texture_relationnelle : Qualité de la rencontre (climat, rythme, engagement). 3-4 mots évocateurs.
5. Une sphere : La dimension de vie majoritairement porteuse de la réflexion. Choisis UNIQUEMENT parmi : "Familiale", "Sociale", "Amoureuse", "Professionnelle".
${prismeInstruction}

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown :
{"fragment": "...", "deplacement": "...", "direction": "...", "texture_relationnelle": "...", "sphere": "...", "emotion": "...", "prisme": "..."}`;

    try {
      const res = await fetch(`${API_BASE}/reflection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = (data.text || "{}").replace(/```json|```/g, "").trim();
      const card: ReflectionCard = JSON.parse(raw);

      // Ensure emotion is set from prisme if AI returned old format, and handle unlocking
      if (!card.emotion && card.prisme) card.emotion = card.prisme;
      if (!isEquilibreReached) {
        card.prisme = "";
      }

      if (card.fragment) {
        // Eval Emotion/Prisme - refine the emotion detected even if not unlocked
        try {
          const prismeRes = await fetch(`${API_BASE}/worker`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "eval_prisme", data: { card } }),
          });
          const prismeData = await prismeRes.json();
          if (prismeData.prisme) {
            card.emotion = prismeData.prisme;
            if (isEquilibreReached) {
              card.prisme = prismeData.prisme;
            }
          }
        } catch (e) {
          console.error("Prisme eval failed", e);
        }

        // Normalise prisme et émotion vers la forme canonique (clé de EMOTIONS :
        // minuscule, sans accent). La base stocke "colere", jamais "Colère".
        const canon = (v?: string) =>
          (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        card.emotion = canon(card.emotion);
        card.prisme = canon(card.prisme);

        // Identité et date de la carte
        const existingLocal = JSON.parse(
          localStorage.getItem("collegue_cards") || "[]",
        );
        const cardId = crypto.randomUUID();
        const newCard = { ...card, id: cardId, date: new Date().toISOString() };

        setReflectionCard(newCard);

        // Sauvegarde locale systématique
        localStorage.setItem(
          "collegue_cards",
          JSON.stringify([newCard, ...existingLocal]),
        );

        // Sauvegarder la carte en base (table dédiée 'cartes' comme demandé)
        if (personalId) {
          try {
            await sbInsert("cartes", { ...newCard, personal_id: personalId });
          } catch (e) {
            console.error("cartes insert failed", e);
          }
        }

        // Sauvegarder dans sessions pour compatibilité admin
        if (personalId && currentSessionId.current) {
          try {
            await sbUpdate("sessions", currentSessionId.current, {
              reflection_card: newCard,
              personal_id: personalId,
              step_reached: validatedSteps.size,
              ended_at: new Date().toISOString(),
            });
          } catch (e) {
            console.error("session save failed", e);
          }
        }

        // IA générative d'images de "Texture" (Piste 6) — en arrière-plan.
        // La génération prend plusieurs secondes : on ne bloque pas la
        // création de la carte. L'image arrive ensuite et est enregistrée
        // dans `cartes`, puis affichée.
        generateTexture(newCard, cardId, personalId);
      }
    } catch (e) {
      console.error("carte failed", e);
    }
  };

  const generateTexture = async (
    card: ReflectionCard,
    cardId: string,
    personalId: string | null,
  ) => {
    try {
      const res = await fetch(`${API_BASE}/generate-texture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prisme: card.emotion || card.prisme || "Neutre",
          sphere: card.sphere || "Sociale",
          texture: card.texture_relationnelle,
        }),
      });
      const data = await res.json();
      if (!data.imageUrl) return;

      // Persiste l'image dans la table `cartes` (ligne déjà insérée plus haut).
      if (personalId) {
        try {
          await sbUpdate("cartes", cardId, {
            image_url: data.imageUrl,
            personal_id: personalId,
          });
        } catch (e) {
          console.error("cartes image update failed", e);
        }
      }

      // Fait apparaître l'image sur la carte affichée, si c'est encore elle.
      setReflectionCard((prev) =>
        prev && prev.id === cardId
          ? { ...prev, image_url: data.imageUrl }
          : prev,
      );

      // Met à jour le stockage local.
      const local = JSON.parse(localStorage.getItem("collegue_cards") || "[]");
      const idx = local.findIndex((c: any) => c.id === cardId);
      if (idx !== -1) {
        local[idx] = { ...local[idx], image_url: data.imageUrl };
        localStorage.setItem("collegue_cards", JSON.stringify(local));
      }
    } catch (e) {
      console.error("Texture generation failed", e);
    }
  };

  // ── Transcript ────────────────────────────────────────────
  const downloadTranscript = () => {
    const date = new Date();
    let content = "Le collègue — Transcript de session\n";
    content += `Date : ${date.toLocaleString("fr-FR")}\n`;
    content += `Étapes validées : ${validatedSteps.size}/5\n\n`;
    content +=
      "------------------------------------------------------------\n\n";
    messages.forEach((m) => {
      content += `[${m.role === "user" ? "Vous" : "Le collègue"}]\n${m.content}\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collegue-${date.toLocaleDateString("fr-FR").replace(/\//g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Voix ──────────────────────────────────────────────────
  const toggleListening = () => {
    if (isListening) {
      recognition.current?.stop();
    } else {
      recognition.current?.start();
      setIsListening(true);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex flex-col bg-bg font-serif h-[100dvh] overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 border-b border-border bg-bg z-[9999]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 text-beige-faint" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/climat"
              className={`transition-colors flex items-center p-1.5 ${location.pathname === "/climat" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Climat collectif"
            >
              <Cloud size={13} strokeWidth={1.5} />
            </Link>
            <Link
              to="/chat"
              className={`transition-colors flex items-center p-1.5 ${location.pathname === "/chat" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Penser"
            >
              <Brain size={13} strokeWidth={1.5} />
            </Link>
            <Link
              to="/carnet"
              className={`transition-colors flex items-center p-1.5 ${location.pathname === "/carnet" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Carnet"
            >
              <BookOpen size={13} strokeWidth={1.5} />
            </Link>
            {sessionActive && !showEnded && (
              <button
                onClick={endSession}
                className="font-mono text-[9px] tracking-widest uppercase text-green hover:text-green-dim transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ring-1 ring-green/20 hover:bg-green/5"
              >
                <X size={10} strokeWidth={1.5} />
                <span>Terminer</span>
              </button>
            )}

          </div>
        </div>

        {sessionActive && !showEnded && (
          <div className="px-4 py-2 border-t border-border overflow-hidden">
            <div className="flex items-center justify-between w-full max-w-xl mx-auto overflow-x-auto gap-1 md:gap-4 no-scrollbar pb-1">
              {STEP_NAMES_FR.map((name, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 md:gap-2 shrink-0"
                >
                  <div
                    className={`w-4 h-4 md:w-[22px] md:h-[22px] rounded-full border flex items-center justify-center transition-all duration-500
                      ${
                        validatedSteps.has(i)
                          ? "border-green bg-green-dim cursor-default"
                          : pendingStep === i
                            ? "border-green cursor-pointer shadow-[0_0_10px_#6ba36830] animate-pulse"
                            : "border-[#2a2820] bg-bg opacity-40 cursor-pointer hover:opacity-70"
                      }`}
                    onClick={() =>
                      pendingStep === i ? validateStep(i) : handleStepClick(i)
                    }
                    title={
                      !validatedSteps.has(i)
                        ? `Orienter vers : ${name}`
                        : undefined
                    }
                  >
                    {validatedSteps.has(i) ? (
                      <Check className="w-2 h-2 md:w-3 md:h-3 text-green" />
                    ) : (
                      <div
                        className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${pendingStep === i ? "bg-green" : "bg-[#2a2820]"}`}
                      />
                    )}
                  </div>
                  <span
                    className={`font-mono text-[7px] md:text-[8px] tracking-tight md:tracking-wider uppercase transition-colors duration-500 cursor-pointer
                      ${validatedSteps.has(i) || pendingStep === i ? "text-green" : "text-beige-faint hover:text-beige-dim"}`}
                    onClick={() => !validatedSteps.has(i) && handleStepClick(i)}
                  >
                    {name}
                  </span>
                  {i < STEP_NAMES_FR.length - 1 && (
                    <div
                      className={`w-2 md:w-6 h-[1px] ${validatedSteps.has(i) ? "bg-green/40" : "bg-border"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Spacer for fixed header */}
      <div
        className="shrink-0"
        style={{ height: sessionActive && !showEnded ? "100px" : "52px" }}
      />

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 md:px-7 py-8 scroll-smooth">
        <div className="max-w-[620px] mx-auto">
          {!showEnded && <ClarteSection section="chat" forceClose={messages.some(m => m.role === 'user')} />}

          {!sessionActive ? (
            // ── Écran d'accueil ──
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <div className="relative w-28 h-28 md:w-32 md:h-32 flex items-center justify-center mb-8 transition-opacity duration-700 opacity-80 hover:opacity-100">
                <LogoEmber className="w-full h-full" />
              </div>
              {limitChecking ? (
                // Vérification du plafond en cours : le logo reste seul une
                // fraction de seconde, le temps de savoir quoi afficher.
                <div className="h-12" />
              ) : dailyLimitReached ? (
                <>
                  <p className="italic text-sm text-beige leading-relaxed max-w-xs mb-6">
                    Laissez ce qui a émergé travailler en vous, et{" "}
                    <style>{`
                      @keyframes demain-shimmer {
                        0%, 100% { opacity: 0.3; }
                        50% { opacity: 1; }
                      }
                    `}</style>
                    <span
                      style={{
                        animation: "demain-shimmer 3.2s ease-in-out infinite",
                      }}
                    >
                      revenez demain
                    </span>
                    . Votre carnet reste ouvert.
                  </p>
                  <Link
                    to="/carnet"
                    className="inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-bg bg-beige px-8 py-3.5 rounded-sm hover:opacity-85 transition-opacity"
                  >
                    <BookOpen size={12} strokeWidth={1.5} />
                    Aller au carnet
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-beige text-xl md:text-2xl font-medium mb-4 max-w-sm">
                    Prenez le temps.
                  </h2>
                  <p className="italic text-sm text-beige-faint mb-10 max-w-xs leading-relaxed">
                    On en parle. Pas pour trouver la bonne réponse — pour
                    mettre des mots sur ce que vous traversez.
                  </p>
                  {resumeCardToOffer ? (
                    <>
                      <div className="w-full max-w-xs mb-8 border border-beige-faint/15 rounded-md p-4 text-left">
                        <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-beige-faint mb-2">
                          Là où vous en étiez
                        </div>
                        <p className="text-[13px] italic text-beige-dim leading-relaxed">
                          {resumeCardToOffer.fragment}
                        </p>
                      </div>
                      <div className="flex flex-col gap-4 w-full max-w-xs">
                        <button
                          onClick={() => handleResumeChoice("reprendre")}
                          className="bg-beige text-bg font-mono text-xs tracking-widest uppercase px-8 py-3.5 rounded-sm hover:opacity-85 transition-opacity"
                        >
                          Reprendre
                        </button>
                        <button
                          onClick={() => handleResumeChoice("nouvelle")}
                          className="bg-transparent text-beige border border-beige/20 font-mono text-xs tracking-widest uppercase px-8 py-3.5 rounded-sm hover:bg-beige/5 transition-colors"
                        >
                          Nouvelle situation
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-beige-faint">
                        {DAY_PROMPT}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {DAY_STATES.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => startSessionFlow(s.key)}
                            className="bg-transparent text-beige border border-beige/20 font-mono text-[11px] tracking-wide px-4 py-2.5 rounded-sm hover:bg-beige hover:text-bg transition-colors"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <p className="mt-12 text-[13px] text-beige-faint italic">
                Le contenu des conversations n'est pas enregistré.
              </p>
            </motion.div>
          ) : showEnded ? (
            // ── Écran de fin ──
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-12 gap-8"
            >
              {/* Clairière — chapeau du fragment */}
              <div className="font-serif italic text-lg text-green text-center max-w-[560px]">
                Il y a eu une clairière ici.
              </div>

              {/* Carte de réflexion */}
              {reflectionCard ? (
                (() => {
                  const emotionKey = (
                    reflectionCard.emotion ||
                    reflectionCard.prisme ||
                    ""
                  ).toLowerCase() as keyof typeof EMOTIONS;
                  const emotionData = EMOTIONS[emotionKey] || null;
                  const isLocked = !reflectionCard.prisme;

                  return (
                    <div
                      className={`w-full max-w-[560px] bg-[#0e0d08] ${emotionData ? emotionData.border : "border-[#3a3420]"} border rounded-lg p-7 text-left animate-fade-up`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="font-mono text-[8px] tracking-[0.16em] uppercase text-[#4a4028]">
                          Carte de réflexion
                        </div>
                        {reflectionCard.sphere && (
                          <div className="font-mono text-[8px] tracking-[0.16em] uppercase text-beige-faint/30">
                            {reflectionCard.sphere}
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {[
                          reflectionCard.fragment,
                          reflectionCard.deplacement,
                          reflectionCard.direction,
                        ]
                          .filter(Boolean)
                          .map((line, i) => (
                            <div
                              key={i}
                              className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 font-serif text-[15px] leading-loose text-[#9a8a68]`}
                            >
                              {line}
                            </div>
                          ))}
                        {reflectionCard.texture_relationnelle && (
                          <div className="pt-4 border-t border-[#3a3420]/30 mt-4 flex items-center gap-2">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${emotionData ? "" : "bg-green/40 shadow-[0_0_8px_rgba(107,163,104,0.3)]"}`}
                              style={
                                emotionData
                                  ? {
                                      backgroundColor: emotionData.color,
                                      boxShadow: `0 0 8px ${emotionData.color}66`,
                                    }
                                  : {}
                              }
                            />
                            <span
                              className="font-mono text-[8px] uppercase tracking-widest opacity-60"
                              style={
                                emotionData
                                  ? { color: emotionData.color }
                                  : { color: "#6BA368" }
                              }
                            >
                              Résonance · {reflectionCard.texture_relationnelle}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-end mt-8">
                        <div className="flex flex-col gap-1.5">
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#4a4028]">
                            Signal affectif :
                          </div>
                          {emotionData && (
                            <div
                              className={`px-2 py-1 rounded-sm text-[7px] font-mono uppercase tracking-tighter transition-all border ${emotionData.bg} ${emotionData.border} text-beige w-fit flex items-center gap-2`}
                            >
                              {!isLocked && (
                                <Gem className="w-2.5 h-2.5 text-yellow-500/60" />
                              )}
                              {isLocked
                                ? "Résonance identifiée"
                                : emotionData.label}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const text = [
                              reflectionCard.fragment,
                              reflectionCard.deplacement,
                              reflectionCard.direction,
                            ].join("\n");
                            navigator.clipboard.writeText(text);
                          }}
                          className="font-mono text-[8px] tracking-widest uppercase text-[#4a4028] border border-[#3a3420] px-4 py-2 hover:text-[#9a8a68] transition-colors"
                        >
                          ↗ Copier
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="font-mono text-[9px] tracking-widest uppercase text-[#3a3420] animate-pulse">
                  Génération de la carte…
                </div>
              )}

              {keyJustRevealed && personalId && (
                <div className="w-full max-w-[560px] border border-[#4a4028] bg-[#0e0d08] rounded-lg p-7 text-left space-y-4">
                  <div className="font-serif text-lg text-beige">
                    Ce carnet est désormais le vôtre.
                  </div>
                  <p className="text-[13px] leading-relaxed text-beige-faint">
                    Voici votre Clé-LCLG — enregistrez-la : c'est le seul moyen
                    de retrouver votre carnet, ici ou sur un autre appareil.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <code className="flex-1 font-mono text-[15px] tracking-wide text-beige bg-[#161512] border border-[#3a3420] rounded px-4 py-3 select-all break-all">
                      {personalId}
                    </code>
                    <button
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(personalId);
                        } catch (e) {
                          console.warn("copy failed", e);
                        }
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
                      className="font-mono text-[9px] tracking-widest uppercase text-beige-faint border border-[#3a3420] px-4 py-3 rounded hover:text-beige hover:border-beige-faint transition-colors shrink-0"
                    >
                      {keyCopied ? "Copié" : "Copier"}
                    </button>
                  </div>

                  <div className="h-px bg-[#3a3420]" />

                  <p className="text-[13px] leading-relaxed text-beige-faint">
                    Votre carnet garde la trace de vos cheminements — leur
                    continuité, leur cohérence d'une session à l'autre. Cette
                    clé en est la porte.
                  </p>
                  {!codeCreated ? (
                    <div className="space-y-3">
                      <p className="text-[13px] leading-relaxed text-beige-faint">
                        Choisissez un code à 6 chiffres. Avec votre clé, il
                        protège l'accès à votre carnet. Gardez-le précieusement —
                        il vous sera demandé pour vous reconnecter.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={6}
                          value={accessCode}
                          onChange={(e) =>
                            setAccessCode(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          placeholder="••••••"
                          className="flex-1 font-mono text-[15px] tracking-[0.4em] text-beige bg-[#161512] border border-[#3a3420] rounded px-4 py-3 placeholder:text-beige-faint focus:outline-none focus:border-beige-faint"
                        />
                        <button
                          onClick={createAccount}
                          disabled={codeSubmitting || accessCode.length !== 6}
                          className="font-mono text-[9px] tracking-widest uppercase text-bg bg-beige px-5 py-3 rounded hover:opacity-90 transition-opacity shrink-0 disabled:opacity-40"
                        >
                          {codeSubmitting ? "..." : "Valider"}
                        </button>
                      </div>
                      {codeError && (
                        <p className="text-[12px] text-red-400/80">{codeError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[13px] leading-relaxed text-beige-faint">
                        Code enregistré. Votre clé et votre code ouvrent
                        désormais votre carnet.
                      </p>
                      <Link
                        to="/carnet"
                        className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-bg bg-beige px-5 py-2.5 rounded hover:opacity-90 transition-opacity"
                      >
                        <BookOpen size={12} strokeWidth={1.5} />
                        Aller au carnet
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Session terminée */}
              <div className="flex flex-col items-center gap-4 w-full max-w-[560px]">
                <div className="text-center">
                  <div className="font-serif text-lg text-beige">
                    Session terminée.
                  </div>
                </div>
                {/* Action principale : rejoindre le carnet où le fragment se
                    dépose. Masquée quand l'encadré de révélation de la clé
                    affiche déjà son propre « Aller au carnet ». */}
                {!keyJustRevealed && (
                  <Link
                    to="/carnet"
                    className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-bg bg-beige px-6 py-3 rounded hover:opacity-90 transition-opacity"
                  >
                    <BookOpen size={12} strokeWidth={1.5} />
                    Aller au carnet
                  </Link>
                )}
                <button
                  onClick={downloadTranscript}
                  className="flex items-center gap-2 border border-border text-beige-faint font-mono text-[9px] tracking-widest uppercase px-6 py-2.5 rounded-sm hover:text-beige hover:border-beige-faint transition-all"
                >
                  <Download className="w-3 h-3" /> Télécharger le transcript
                </button>
                {/* Reset de l'état de chat — discret : disponible sans pousser
                    à réenchaîner une situation. */}
                <button
                  onClick={clearChatState}
                  className="font-mono text-[9px] tracking-widest uppercase text-beige-faint/50 hover:text-beige-faint transition-colors mt-1"
                >
                  Nouvelle situation
                </button>
              </div>

              {/* Un mot sur l'outil — discret, après les actions de séance. */}
              <button
                onClick={() => setIsRetourModalOpen(true)}
                className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-beige-faint/50 hover:text-beige-faint transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                Faire un retour
              </button>

              {/* Mentions — pied de page */}
              <div className="w-full max-w-[560px] border-t border-border/30 pt-6 space-y-3 text-left">
                <p className="text-[12px] leading-relaxed text-beige-faint italic">
                  Le collègue n'est pas un outil de soin, un thérapeute, ni un
                  service d'urgence. Si vous traversez une crise, le{" "}
                  <strong className="font-normal text-beige/70">3114</strong>{" "}
                  est disponible 24h/24.
                </p>
                <p className="text-[12px] leading-relaxed text-beige-faint italic">
                  Le contenu de votre conversation n'est jamais enregistré.
                  Seules des métadonnées anonymes sont conservées : date,
                  étapes traversées, feedback.
                </p>
              </div>
            </motion.div>
          ) : (
            // ── Conversation ──
            <div className="space-y-8 pb-32">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start items-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-bg border border-beige-faint flex items-center justify-center mr-3 mt-1 shrink-0 overflow-hidden">
                      <img
                        src="/logo.png"
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] text-sm leading-[1.85] relative
                    ${
                      m.role === "user"
                        ? "bg-[#161512] border border-[#2a2820] rounded-[16px_16px_4px_16px] px-4 py-2.5 text-green italic"
                        : "text-beige-dim"
                    }`}
                  >
                    {m.isDictated && (
                      <div className="absolute -top-3 -right-2 bg-[#161512] px-1.5 py-0.5 rounded-full border border-green/20 flex items-center gap-1 z-10 shadow-sm">
                        <Lips className="w-2.5 h-2.5 text-green" />
                        <span className="font-mono text-[6px] uppercase tracking-widest text-green/60">
                          Dictée clinique
                        </span>
                      </div>
                    )}
                    {m.content ||
                      (loading && i === messages.length - 1 ? (
                        <span className="flex gap-1.5 h-5 items-center">
                          {[0, 1, 2].map((j) => (
                            <span
                              key={j}
                              className="w-1.5 h-1.5 bg-[#6a6258] rounded-full animate-pulse"
                              style={{ animationDelay: `${j * 0.2}s` }}
                            />
                          ))}
                        </span>
                      ) : (
                        ""
                      ))}
                  </div>
                </motion.div>
              ))}

              {/* Carte de validation — Émergence identifiée */}
              {pendingStep !== null && !loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center my-6"
                >
                  <div className="bg-[#0e0d08]/90 backdrop-blur-sm border border-green/30 p-7 rounded-lg max-w-sm text-center">
                    <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-green mb-3">
                      Émergence identifiée
                    </div>
                    <p className="text-[15px] text-beige-faint italic mb-6 leading-relaxed">
                      L'étape{" "}
                      <span className="text-beige not-italic">
                        "{STEP_NAMES_FR[pendingStep]}"
                      </span>{" "}
                      semble avoir été conscientisée. Souhaitez-vous l'ancrer
                      pour continuer ?
                    </p>
                    <button
                      onClick={() => validateStep(pendingStep)}
                      className="px-8 py-2.5 bg-green-dim/10 border border-green/40 text-green rounded-full font-mono text-[9px] tracking-widest uppercase hover:bg-green/20 transition-all"
                    >
                      Valider l'étape
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Bannière crise */}
              {crisisDetected && (
                <div className="max-w-[560px] mx-auto flex items-center justify-between gap-4 px-4 py-3 border border-[#5a2a2a40] bg-[#0f0a0a] rounded-sm">
                  <span className="font-mono text-[9px] tracking-widest uppercase text-[#7a4a4a]">
                    Si vous traversez une crise
                  </span>
                  <a
                    href="tel:3114"
                    className="font-mono text-[13px] tracking-widest text-[#c87a7a] font-medium"
                  >
                    3114
                  </a>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 bg-bg border-t border-border relative z-10">
        <div className="absolute top-[-48px] inset-x-0 h-12 bg-gradient-to-b from-transparent to-bg pointer-events-none" />

        {/* Serpentin */}
        {sessionActive && !showEnded && (
          <div className="border-b border-border py-1 px-8">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[620px] mx-auto h-11 block"
            />
          </div>
        )}

        {/* Zone de saisie */}
        {sessionActive && !showEnded && closingPhase === "closed" && (
          <div className="p-4 md:p-6">
            <div className="max-w-[620px] mx-auto flex flex-col items-center gap-4 text-center">
              <p className="font-serif italic text-[15px] text-beige-faint leading-relaxed text-pretty">
                La conversation se referme ici. Prenez le temps de lire ce
                dernier reflet — il continuera de travailler en vous.
              </p>
              <button
                onClick={endSession}
                className="px-6 py-3 rounded-lg bg-beige text-bg font-mono text-xs tracking-widest uppercase transition-all hover:opacity-90"
              >
                Voir ma carte
              </button>
            </div>
          </div>
        )}

        {/* Zone de saisie */}
        {sessionActive && !showEnded && closingPhase !== "closed" && (
          <div className="p-4 md:p-6">
            <div className="max-w-[620px] mx-auto flex gap-3 items-stretch">
              {/* Input */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={loading || isRecentrage}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isRecentrage ? "Phase de recentrage…" : "..."}
                rows={Math.min(15, Math.max(3, inputText.split("\n").length))}
                className={`flex-1 bg-[#161512] border border-[#2a2820] rounded-lg px-4 py-3 font-serif text-[16px] text-beige leading-relaxed focus:border-beige-faint outline-none transition-all resize-none ${isRecentrage ? "opacity-20" : ""}`}
              />

              {/* Actions Column */}
              <div className="flex flex-col gap-2 w-11 flex-shrink-0">
                {/* Voix */}
                <button
                  onClick={toggleListening}
                  title={isListening ? "Arrêter" : "Dicter"}
                  className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 font-mono text-xs
                    ${
                      isListening
                        ? "bg-red-dim border-red text-red"
                        : "border-[#2a2820] text-beige-faint hover:text-beige hover:border-beige-faint"
                    }`}
                >
                  <motion.span
                    animate={isListening ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    {isListening ? "●" : <Lips className="w-5 h-5" />}
                  </motion.span>
                </button>

                {/* Envoyer */}
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || loading}
                  className={`w-11 flex-1 rounded-lg flex items-center justify-center transition-all
                    ${inputText.trim() && !loading ? "bg-beige text-bg" : "bg-[#161512] border border-[#2a2820] text-beige-faint"}`}
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="max-w-[620px] mx-auto mt-2 pl-1 font-mono text-[8px] text-beige-faint tracking-widest">
              ⌘ + Entrée pour envoyer
            </div>
          </div>
        )}
      </footer>

      {/* ── Overlay recentrage ── */}
      <AnimatePresence>
        {isRecentrage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-bg/80 backdrop-blur-[35px] flex items-center justify-center p-12 text-center"
          >
            <div className="max-w-md">
              <AnimatePresence mode="wait">
                <motion.div
                  key={recentrageStep}
                  initial={{ opacity: 0, y: 20, filter: "blur(15px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -20, filter: "blur(15px)" }}
                  transition={{ duration: 2.5, ease: "easeInOut" }}
                  className="text-beige md:text-lg font-serif italic leading-relaxed"
                >
                  {activeRecentragePrompts[recentrageStep]}
                </motion.div>
              </AnimatePresence>
              <div className="mt-20 flex justify-center gap-2">
                {activeRecentragePrompts.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: i === recentrageStep ? [1, 1.4, 1] : 1,
                      opacity: i <= recentrageStep ? 0.7 : 0.1,
                    }}
                    transition={{
                      repeat: i === recentrageStep ? Infinity : 0,
                      duration: 4,
                    }}
                    className="w-1 h-1 rounded-full bg-beige"
                  />
                ))}
              </div>
              {recentrageMode === "sceau" && (
                <button
                  onClick={skipSeal}
                  className="mt-12 font-mono text-[9px] tracking-[0.2em] uppercase text-beige-faint/50 hover:text-beige-faint transition-colors"
                >
                  Voir ma carte
                </button>
              )}
            </div>
          </motion.div>
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