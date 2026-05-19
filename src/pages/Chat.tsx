import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  ArrowUp,
  Check,
  ArrowLeft,
  Brain,
  BookOpen,
  X,
  Mic,
  Loader2,
  Volume2,
  VolumeX,
  Network,
  Gem,
  Feather,
} from "lucide-react";
import confetti from "canvas-confetti";
import { sbInsert, sbUpdate, sbGet } from "../lib/worker";
import { ClarteSection } from "../components/SerpentinGuide";

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
const WORKER_URL = "https://internal-worker.example";

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

const STEP_IDS = [
  "situation",
  "ressenti",
  "demande",
  "diffraction",
  "equilibre",
] as const;
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
  // Session
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [validatedSteps, setValidatedSteps] = useState<Set<number>>(new Set());
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
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
  const [storageMode, setStorageMode] = useState<"local" | "cloud" | null>(
    null,
  );
  const [personalId, setPersonalId] = useState<string>(
    () => localStorage.getItem("collegue_personal_id") || "",
  );
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const currentSessionId = useRef<string | null>(null);

  // Voix
  const [isListening, setIsListening] = useState(false);
  const recognition = useRef<any>(null);

  // Mode hypnotique
  const [isHypnotic, setIsHypnotic] = useState(false);
  const [showHypnoticSuggestion, setShowHypnoticSuggestion] = useState(false);
  const [hypnoticStep, setHypnoticStep] = useState(0);
  const [surchargeCount, setSurchargeCount] = useState(0);
  const [subliminal, setSubliminal] = useState<{
    content: string;
    type: "symbol" | "phrase";
  } | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(
    localStorage.getItem("collegue_sound") !== "false",
  );

  const playResonance = useCallback(() => {
    if (localStorage.getItem("collegue_sound") === "false") return;
    try {
      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        110 + Math.random() * 50,
        audioCtx.currentTime,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        55,
        audioCtx.currentTime + 1.5,
      );

      gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 1.5,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1.5);
    } catch (e) {}
  }, []);

  const toggleSound = () => {
    const newVal = !isSoundEnabled;
    setIsSoundEnabled(newVal);
    localStorage.setItem("collegue_sound", String(newVal));
  };

  const HYPNOTIC_PROMPTS = [
    "Considérez la masse de ce qui vous occupe en ce moment.",
    "Inutile de chercher une logique immédiate. Laissez-la au repos.",
    "Observez le mouvement de vos pensées, comme un écho lointain.",
    "Certains nœuds ne se défont pas en tirant dessus.",
    "Ressentez la charge émotionnelle. Elle contient sa propre vérité.",
    "Laissez l'équilibre stable se manifester, au-delà des mots.",
    "Revenez doucement, avec un regard légèrement décentré.",
  ];

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
    crisisDetected,
    diffractionSansPartage,
    motsCles,
    reflectionCard,
    lastActivity,
  ]);

  useEffect(() => {
    const resumeFragment = location.state?.resumeFragment as
      | ReflectionCard
      | undefined;
    if (resumeFragment && !sessionActive) {
      const { fragment, deplacement, direction } = resumeFragment;
      setActiveResumeContext(
        `Note de contexte — session en reprise : La personne revient sur une situation. Fragment : ${fragment}, Déplacement : ${deplacement}, Direction : ${direction}. Ne reformule pas ce contexte explicitement. Pars de là avec douceur.`,
      );
      localStorage.removeItem("collegue_chat_state");
      const storedId = localStorage.getItem("collegue_personal_id");
      if (storedId) {
        confirmStart("cloud", storedId);
      } else {
        setShowIdentityModal(true);
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

  // ── Mode hypnotique ───────────────────────────────────────
  const triggerHypnoticBreak = useCallback(() => {
    setIsHypnotic(true);
    setShowHypnoticSuggestion(false);
    setSurchargeCount((prev) => prev + 1);
    setHypnoticStep(0);

    // Subliminal — tiré des mots-clés ou des derniers mots de la personne
    const symbol = motsCles[0] || "ψ";
    const phrase =
      motsCles[1] ||
      messages
        .slice(-2)
        .find((m) => m.role === "user")
        ?.content.split(" ")
        .slice(0, 3)
        .join(" ") ||
      "Lâcher prise";

    // Serpentin : quasi-plat, apaisant
    flowRef.current.isCalming = true;
    flowRef.current.target = {
      amplitude: 0.1,
      speed: 0.001,
      opacity: 0.05,
      color: [80, 80, 80],
      thickness: 0.8,
    };

    // Flash subliminal d'ouverture
    setTimeout(() => {
      setSubliminal({ content: symbol, type: "symbol" });
      setTimeout(() => setSubliminal(null), 180);
    }, 1200);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      if (current >= HYPNOTIC_PROMPTS.length) {
        clearInterval(interval);
        // Flash subliminal de clôture
        setTimeout(() => {
          setSubliminal({ content: phrase, type: "phrase" });
          setTimeout(() => setSubliminal(null), 350);
        }, 1000);
        setTimeout(() => {
          setIsHypnotic(false);
          flowRef.current.isCalming = false;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Nous revenons ici. Maintenant que cette sensation a une forme et une place… qu'avez-vous envie d'en faire ? Comment voulez-vous vous positionner face à elle ?",
              ts: new Date().toISOString(),
            },
          ]);
        }, 5000);
      } else {
        setHypnoticStep(current);
        flowRef.current.dampExtra = 1.0;
      }
    }, 6000);
  }, [motsCles, messages, HYPNOTIC_PROMPTS]);

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

  // ── Démarrage de session ──────────────────────────────────
  const startSessionFlow = () => {
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
      confirmStart("cloud", personalId);
    } else {
      setShowIdentityModal(true);
    }
  };

  const handleResumeChoice = (choice: "reprendre" | "nouvelle") => {
    if (choice === "reprendre" && resumeCardToOffer) {
      const { fragment, deplacement, direction } = resumeCardToOffer;
      setActiveResumeContext(
        `Note de contexte — session en reprise : La personne revient sur une situation non résolue. Son dernier fragment était — Fragment : ${fragment}, Déplacement : ${deplacement}, Direction : ${direction}. Ne reformule pas ce contexte explicitement. Pars de là avec douceur. Si la personne préfère partir sur autre chose, suis-la sans retenir le fil précédent.`,
      );
    } else {
      setActiveResumeContext(null);
    }
    setResumeCardToOffer(null);
    
    if (hasStoredKey && personalId) {
      confirmStart("cloud", personalId);
    } else {
      setShowIdentityModal(true);
    }
  };

  const confirmStart = async (mode: "local" | "cloud", providedId?: string) => {
    const finalId = providedId || personalId;
    setStorageMode(mode);
    setShowIdentityModal(false);
    setLoading(true);
    setSessionActive(true);
    setMessages([]);
    setLastActivity(Date.now());

    if (mode === "cloud" && finalId) {
      const wasAlreadyStored = hasStoredKey;
      localStorage.setItem("collegue_personal_id", finalId);
      setHasStoredKey(true);

      // Auto-copy and download only if it's a new or newly entered key
      if (!wasAlreadyStored) {
        try {
          navigator.clipboard.writeText(finalId);

          const blob = new Blob(
            [
              `IDENTIFIANT COLLÈGUE\n\nVotre clé : ${finalId}\n\nCette clé vous permet de retrouver vos sessions de réflexion sur tous vos appareils.\nElle est strictement personnelle.`,
            ],
            { type: "text/plain" },
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `cle-lclg-${finalId}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn("Clip/Download failed", e);
        }
      }

      try {
        const result = await sbInsert("sessions", {
          started_at: new Date().toISOString(),
          step_reached: 0,
          messages: [],
          personal_id: finalId,
        });
        if (result && (result as any).id)
          currentSessionId.current = (result as any).id;

        // Fetch past reflections to seed context (Piste 4)
        const past = await sbGet(
          "sessions",
          `personal_id=eq.${finalId}&limit=5&order=started_at.desc`,
        );
        if (past && Array.isArray(past)) {
          const cards = past.map((s: any) => s.reflection_card).filter(Boolean);
          setPastReflections(cards);
        }
      } catch (e) {
        console.error("Session cloud failed", e);
      }
    } else {
      const sessionId = Date.now().toString();
      currentSessionId.current = sessionId;
    }

    if (activeResumeContext) {
      setMessages([
        { role: "assistant", content: "", ts: new Date().toISOString() },
      ]);
      try {
        let accumulated = "";
        await streamChat(
          [
            {
              role: "user",
              content: "(La personne s'assoit en silence, prête à reprendre)",
              ts: new Date().toISOString(),
            },
          ],
          400,
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
            content: "Bonjour. Je suis là.",
            ts: new Date().toISOString(),
          },
        ]);
      }
    } else {
      setMessages([
        {
          role: "assistant",
          content: "Bonjour. Je suis là.",
          ts: new Date().toISOString(),
        },
      ]);
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
  const saveSession = useCallback(async () => {
    if (!currentSessionId.current || storageMode !== "cloud") return;
    try {
      await sbUpdate("sessions", currentSessionId.current, {
        step_reached: validatedSteps.size,
        ended_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("saveSession failed", e);
    }
  }, [validatedSteps.size, storageMode]);

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
          max_tokens: 1000,
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
        // Insights multi-sessions — si mode cloud, récupérer les sessions passées
        let multiSessionNote = "";
        if (storageMode === "cloud" && personalId) {
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
        const raw = ((data.content && data.content[0]?.text) || "{}")
          .replace(/```json|```/g, "")
          .trim();
        const result: EvalResult = JSON.parse(raw);

        // Crise
        if (result.crisis === true && !crisisDetected) {
          setCrisisDetected(true);
          setFlowIntensity("chaos");
        }

        // Mode hypnotique — se déclenche à la 2ème surcharge émotionnelle max (3)
        if (result.emotional_charge >= 3) {
          if (surchargeCount === 0) {
            setShowHypnoticSuggestion(true);
            setSurchargeCount(1);
          } else if (surchargeCount === 1) {
            setSurchargeCount(2);
            // 2ème surcharge : message de rupture de cadre
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
    playResonance();

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
        playResonance();
        const ts = new Date().toISOString();
        const finalMessages: Message[] = [
          ...updatedMessages,
          { role: "assistant", content: fullText, ts },
        ];
        setMessages(finalMessages);
        setFlowIntensity(flowRef.current.emotionalLevel);
        evalSteps(finalMessages);
        saveSession();
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
    setFlowIntensity("validate");

    // Confetti effect
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#E8D5B0", "#6BA368", "#f5f5f4"],
    });

    if (next.size === 5) {
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
        400,
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

    const prompt = `Voici la conversation jusqu'ici :
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
        300,
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

  // ── Terminer session ──────────────────────────────────────
  const endSession = async () => {
    setShowEnded(true);
    saveSession();
    generateReflectionCard();
  };

  // ── Carte de réflexion via Worker ─────────────────────────
  const generateReflectionCard = async () => {
    const realMessages = messages.filter((m, i) => {
      if (m.content === "Bonjour, j'ai une situation à vous soumettre.")
        return false;
      if (m.role === "assistant" && i <= 1) return false;
      return true;
    });
    if (realMessages.filter((m) => m.role === "user").length < 2) return;

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

        setReflectionCard(card);

        // IA Générative d'images de "Texture" (Piste 6)
        generateTexture(card);

        // Sauvegarde locale systématique
        const existingLocal = JSON.parse(
          localStorage.getItem("collegue_cards") || "[]",
        );
        const cardId = crypto.randomUUID();
        const newCard = { ...card, id: cardId, date: new Date().toISOString() };
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
        if (storageMode === "cloud" && currentSessionId.current) {
          try {
            await sbUpdate("sessions", currentSessionId.current, {
              reflection_card: { ...card, date: newCard.date },
              personal_id: personalId,
              step_reached: validatedSteps.size,
              ended_at: new Date().toISOString(),
            });
          } catch (e) {
            console.error("session save failed", e);
          }
        }
      }
    } catch (e) {
      console.error("carte failed", e);
    }
  };

  const generateTexture = async (card: ReflectionCard) => {
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
      if (data.imageUrl) {
        setReflectionCard((prev) => {
          if (!prev) return null;
          const updated = { ...prev, image_url: data.imageUrl };

          // Mettre à jour en base aussi
          if (storageMode === "cloud" && currentSessionId.current) {
            sbUpdate("sessions", currentSessionId.current, {
              reflection_card: updated,
            });
          }

          // Mettre à jour en local
          const local = JSON.parse(
            localStorage.getItem("collegue_cards") || "[]",
          );
          if (local.length > 0) {
            local[0] = { ...local[0], image_url: data.imageUrl };
            localStorage.setItem("collegue_cards", JSON.stringify(local));
          }

          return updated;
        });
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
            <Link
              to="/"
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 text-beige-faint" />
            </Link>
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
            {sessionActive && !showEnded && (
              <button
                onClick={endSession}
                className="font-mono text-[9px] tracking-widest uppercase text-green hover:text-green-dim transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ring-1 ring-green/20 hover:bg-green/5"
              >
                <X size={10} strokeWidth={1.5} />
                <span>Terminer</span>
              </button>
            )}
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
              <div className="w-14 h-14 bg-bg border border-beige-faint rounded-full flex items-center justify-center mb-6 overflow-hidden opacity-20 hover:opacity-100 transition-all duration-700 grayscale hover:grayscale-0">
                <img
                  src="/logo.png"
                  alt="Le collègue"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="text-beige text-xl md:text-2xl font-medium mb-4 max-w-sm">
                Quelque chose à démêler ?
              </h2>
              <p className="italic text-sm text-beige-faint mb-10 max-w-xs leading-relaxed">
                On en parle. Pas pour trouver la bonne réponse — pour mettre des
                mots sur ce que vous traversez.
              </p>
              {resumeCardToOffer ? (
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
              ) : (
                <button
                  onClick={startSessionFlow}
                  className="bg-beige text-bg font-mono text-xs tracking-widest uppercase px-8 py-3.5 rounded-sm hover:opacity-85 transition-opacity"
                >
                  Commencer
                </button>
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

              {/* Bloc clairière */}
              <div className="w-full max-w-[560px] border border-green-dim/30 bg-[#0d110d] rounded-lg p-8 text-left space-y-4 text-xs leading-relaxed text-[#7a7268]">
                <div className="font-serif italic text-green">
                  Il y a eu une clairière ici.
                </div>
                <p>
                  Le collègue est un outil de réflexion personnelle. Derrière
                  lui, une philosophie et une expérience clinique qui
                  s'enrichissent chaque jour. Pas un protocole figé.
                </p>
                <p className="italic">
                  L'IA comme vecteur. L'expérience humaine comme boussole.
                </p>
                <div className="h-px bg-green-dim/20 my-2" />
                <p className="font-mono text-[8px] uppercase tracking-widest text-[#2a3a2a]">
                  Ce que cet outil n'est pas
                </p>
                <p className="italic text-[13px] text-[#5a6858]">
                  Le collègue n'est pas un outil de soin, un thérapeute, ni un
                  service d'urgence. Si vous traversez une crise, le{" "}
                  <strong className="font-normal text-beige/70">3114</strong>{" "}
                  est disponible 24h/24.
                </p>
                <div className="h-px bg-green-dim/20 my-2" />
                <p className="font-mono text-[8px] uppercase tracking-widest text-[#2a3a2a]">
                  Données et confidentialité
                </p>
                <p className="italic text-[13px] text-[#5a6858]">
                  Le contenu de votre conversation n'est jamais enregistré.
                  Seules des métadonnées anonymes sont conservées : date, étapes
                  traversées, feedback.
                </p>
                <div className="flex justify-end pt-2">
                  <span className="font-mono text-[8px] tracking-widest text-[#2a2820] opacity-50">
                    Interface de réflexion éphémère
                  </span>
                </div>
              </div>

              {/* Session terminée */}
              <div className="flex flex-col items-center gap-4 w-full max-w-[560px]">
                <div className="text-center">
                  <div className="font-serif text-lg text-beige mb-2">
                    Session terminée.
                  </div>
                  <div className="italic text-sm text-beige-faint">
                    La conversation n'est pas enregistrée.
                  </div>
                </div>
                <button
                  onClick={downloadTranscript}
                  className="flex items-center gap-2 border border-border text-beige-faint font-mono text-[9px] tracking-widest uppercase px-6 py-2.5 rounded-sm hover:text-beige hover:border-beige-faint transition-all"
                >
                  <Download className="w-3 h-3" /> Télécharger le transcript
                </button>
                <button
                  onClick={clearChatState}
                  className="font-mono text-[11px] tracking-widest uppercase text-beige-faint border border-border px-8 py-3.5 rounded-sm hover:text-beige-dim transition-colors"
                >
                  Nouvelle situation
                </button>
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
        {sessionActive && !showEnded && (
          <div className="p-4 md:p-6">
            <div className="max-w-[620px] mx-auto flex gap-3 items-stretch">
              {/* Input */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={loading || isHypnotic}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isHypnotic ? "Phase de recentrage…" : "..."}
                rows={Math.min(15, Math.max(3, inputText.split("\n").length))}
                className={`flex-1 bg-[#161512] border border-[#2a2820] rounded-lg px-4 py-3 font-serif text-[16px] text-beige leading-relaxed focus:border-beige-faint outline-none transition-all resize-none ${isHypnotic ? "opacity-20" : ""}`}
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

                {/* Suggestion hypnotique (if active) */}
                {showHypnoticSuggestion && (
                  <button
                    onClick={triggerHypnoticBreak}
                    title="Phase de recentrage suggérée"
                    className="w-11 h-11 rounded-lg border border-green-dim/40 bg-green-dim/10 flex items-center justify-center text-green font-mono text-sm animate-pulse flex-shrink-0"
                  >
                    ...
                  </button>
                )}

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

      {/* ── Overlay hypnotique ── */}
      <AnimatePresence>
        {isHypnotic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-bg/80 backdrop-blur-[35px] flex items-center justify-center p-12 text-center"
          >
            {/* Flash subliminal */}
            <AnimatePresence>
              {subliminal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                  animate={{ opacity: 0.8, scale: 1.1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.2, filter: "blur(5px)" }}
                  transition={{ duration: 0.1 }}
                  className="fixed inset-0 flex items-center justify-center z-[400] pointer-events-none"
                >
                  {subliminal.type === "symbol" ? (
                    <div className="text-[120px] font-serif italic text-beige/40 mix-blend-overlay">
                      {subliminal.content}
                    </div>
                  ) : (
                    <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-beige/50 bg-bg/40 px-8 py-4 backdrop-blur-sm">
                      {subliminal.content}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-md">
              <AnimatePresence mode="wait">
                <motion.div
                  key={hypnoticStep}
                  initial={{ opacity: 0, y: 20, filter: "blur(15px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -20, filter: "blur(15px)" }}
                  transition={{ duration: 2.5, ease: "easeInOut" }}
                  className="text-beige md:text-lg font-serif italic leading-relaxed"
                >
                  {HYPNOTIC_PROMPTS[hypnoticStep]}
                </motion.div>
              </AnimatePresence>
              <div className="mt-20 flex justify-center gap-2">
                {HYPNOTIC_PROMPTS.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: i === hypnoticStep ? [1, 1.4, 1] : 1,
                      opacity: i <= hypnoticStep ? 0.7 : 0.1,
                    }}
                    transition={{
                      repeat: i === hypnoticStep ? Infinity : 0,
                      duration: 4,
                    }}
                    className="w-1 h-1 rounded-full bg-beige"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}

      {/* Confirmer reset */}
      <AnimatePresence>
        {showConfirmReset && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
              onClick={() => setShowConfirmReset(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-bg-alt border border-border rounded-lg p-8 max-w-sm w-full relative z-10 text-center"
            >
              <p className="italic text-sm text-beige-faint mb-8 leading-loose">
                Voulez-vous recommencer une nouvelle session ? La conversation
                actuelle sera effacée.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={clearChatState}
                  className="w-full py-2.5 font-mono text-[9px] tracking-widest uppercase text-red border border-red-dim/40 rounded-sm hover:bg-red-dim/10"
                >
                  Nouvelle session (Effacer)
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="flex-1 py-2.5 font-mono text-[9px] tracking-widest uppercase text-beige-faint border border-border rounded-sm hover:text-beige-dim"
                  >
                    Annuler
                  </button>
                  <Link
                    to="/"
                    className="flex-1 py-2.5 font-mono text-[9px] tracking-widest uppercase text-beige-dim border border-border rounded-sm hover:bg-beige-faint/5 flex items-center justify-center"
                  >
                    Quitter sans effacer
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal identité */}
      <AnimatePresence>
        {showIdentityModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-alt border border-border rounded-lg p-10 max-w-md w-full relative z-10"
            >
              <h2 className="font-serif text-xl text-beige mb-2 text-center">
                Comment voulez-vous commencer ?
              </h2>
              <p className="text-[13px] text-beige-faint italic text-center mb-8">
                Votre clé mémorise votre progression.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => confirmStart("local")}
                  className="w-full text-left p-5 border border-border rounded-md hover:bg-[#161512] transition-colors group"
                >
                  <div className="font-mono text-[9px] tracking-widest uppercase text-beige-faint group-hover:text-beige mb-2">
                    Mode éphémère
                  </div>
                  <div className="text-[13px] text-beige-faint leading-relaxed">
                    Session locale, rien n'est conservé.
                  </div>
                </button>

                <div className="p-5 border border-border rounded-md bg-[#0d0c0a]">
                  <div className="font-mono text-[9px] tracking-widest uppercase text-beige mb-2">
                    Mode évolution
                  </div>
                  <div className="text-[13px] text-beige-faint leading-relaxed mb-4">
                    Une clé mémorable pour retrouver vos sessions.
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="ex: calme-horizon-402"
                      value={personalId}
                      onChange={(e) => {
                        setPersonalId(e.target.value);
                        setKeySaved(false);
                      }}
                      className="flex-1 bg-[#161512] border border-[#2a2820] rounded px-3 py-2.5 text-[16px] text-beige-dim outline-none focus:border-beige-faint"
                    />
                    {!personalId && (
                      <button
                        onClick={generateNewKey}
                        className="px-4 bg-[#1a1918] border border-[#2a2820] text-beige-faint rounded text-[9px] uppercase tracking-widest hover:bg-[#252320]"
                      >
                        Générer
                      </button>
                    )}
                  </div>

                  {personalId && (
                    <div className="flex items-start gap-3 mb-4 p-3 bg-[#161512] rounded border border-[#2a2820]">
                      <input
                        type="checkbox"
                        id="key-saved-cb"
                        checked={keySaved}
                        onChange={(e) => setKeySaved(e.target.checked)}
                        className="mt-0.5 accent-beige w-4 h-4"
                      />
                      <label
                        htmlFor="key-saved-cb"
                        className="text-[10px] text-beige-faint leading-relaxed cursor-pointer select-none"
                      >
                        J'ai sauvegardé cette clé de manière sécurisée en dehors
                        de ce navigateur. En cas de perte, l'accès à ma
                        sédimentation (Carnet) sera irrémédiablement perdu.
                      </label>
                    </div>
                  )}

                  <button
                    onClick={() => confirmStart("cloud")}
                    disabled={!personalId.trim() || !keySaved}
                    className="w-full bg-beige text-bg py-2.5 rounded-sm font-mono text-[9px] tracking-widest uppercase disabled:opacity-30 hover:opacity-90 transition-opacity"
                  >
                    Commencer avec cette clé
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowIdentityModal(false)}
                className="mt-8 w-full font-mono text-[8px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors"
              >
                Annuler
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
