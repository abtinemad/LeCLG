import type { Page } from "@playwright/test";
import type { Target } from "../lib/harness";

// ---------------------------------------------------------------------------
// Fixtures for the Chat page (src/pages/Chat.tsx).
//
// Filet de sécurité AVANT refactor : on photographie les états visibles clés
// de /chat, atteints UNIQUEMENT par seed localStorage + réseau coupé (aucune
// modification de src/). On reproduit le patron de ../targets/carnet.ts.
//
// Pourquoi PLUSIEURS Targets et pas un seul ?
//   Chat relit tout son état depuis UNE seule clé localStorage
//   ("collegue_chat_state", forme exacte = applyChatState à Chat.tsx:833) et le
//   harnais ré-applique le seed à CHAQUE navigation (harness.ts:77, localStorage
//   .clear() puis ré-écriture). Un écran est donc entièrement déterminé par le
//   blob seedé ; deux états distincts (accueil sans état ; conversation avec
//   pendingStep null ; carte de validation avec pendingStep entier) exigent
//   chacun leur propre seed. On expose donc une cible par état, toutes dans le
//   même fichier, partageant le même builder.
//
// Restauration directe (sans la carte « reprendre / laisser de côté ») :
//   au montage, Chat.tsx:917 bascule sur l'écran « conversation laissée
//   ouverte » si (userMsgs >= 1 && idleFor > 30 s). On neutralise ce chemin en
//   seedant `lastActivity` DANS LE FUTUR (idleFor < 0) → la session est
//   restaurée directement via resumeWithCodeGuard (purement local, aucun
//   réseau), et l'effet « silence → apaisement » (Chat.tsx:1141) ne se
//   déclenche jamais. Valeur fixe → déterministe quelle que soit l'heure du run.
//
// Écran de fin / clôture (showEnded:true) — NON ATTEIGNABLE PAR SEED SEUL :
//   le garde de restauration (Chat.tsx:899-904) jette tout état persistant dont
//   `showEnded === true` (ou `closingPhase === "closed"`) : isOpen devient
//   false → l'état est effacé et l'on retombe sur l'accueil. Par ailleurs
//   `setShowEnded(true)` ne passe QUE par finalizeClose, lui-même atteint via
//   triggerMirror / synthèse — tous des appels réseau (coupés). L'écran de fin
//   est donc inaccessible hors-ligne, par seed comme par clics. On le signale
//   explicitement (report.md) sans contourner en modifiant l'app.
// ---------------------------------------------------------------------------

// La Clé-LCLG + le code d'accès : au-delà de l'accueil (identité posée). Valeurs
// clairement synthétiques — toute valeur satisfait le gate hors-ligne, ce qui
// garde le harnais indépendant de tout vrai compte de test.
const IDENTITY = {
  collegue_personal_id: "vrt-fixture-cle-lclg-chat-0001",
  collegue_access_code: "000000",
};

// Suppression du didacticiel « Clarté » de section chat (SerpentinGuide.tsx:429
// ouvre la boîte à la première venue) : chrome partagé, intact par le refactor,
// qui sinon s'ouvrirait par-dessus chaque écran.
const CLARTE_SEEN = {
  collegue_clarte_seen_chat: "1",
};

// `lastActivity` placé dans le futur (≈ an 2100) : voir l'en-tête de fichier —
// force la restauration directe et gèle l'effet d'apaisement.
const FUTURE_TS = 4102444800000;

// Un fil de conversation court, fixe et lisible. Le dernier message est du
// collègue (l'œil LogoEmber s'y ancre — masqué pour le rendu, cf. STABILIZE).
const MESSAGES = [
  {
    role: "assistant",
    content:
      "Bonjour. Posez ce qui vous occupe — on regardera ensemble, sans se presser.",
    ts: "2026-06-20T10:00:00.000Z",
  },
  {
    role: "user",
    content:
      "Je crois que je n'arrive plus à dire non au travail, et ça déborde sur le reste.",
    ts: "2026-06-20T10:01:00.000Z",
  },
  {
    role: "assistant",
    content:
      "Vous sentez que la limite cède surtout au travail, et que le débordement gagne ensuite le reste. Qu'est-ce qui rend le « non » si difficile, là précisément ?",
    ts: "2026-06-20T10:02:00.000Z",
  },
  {
    role: "user",
    content: "J'ai peur de décevoir, alors j'accepte tout — et après je m'en veux.",
    ts: "2026-06-20T10:03:00.000Z",
  },
  {
    role: "assistant",
    content:
      "La peur de décevoir prend les commandes, et le « oui » automatique vous coûte ensuite. On peut regarder ce que ce « non » protégerait, plutôt que ce qu'il romprait.",
    ts: "2026-06-20T10:04:00.000Z",
  },
];

// Construit un `collegue_chat_state` conforme à applyChatState (Chat.tsx:833) /
// saveState (Chat.tsx:793). Session ouverte, non terminée, restaurée direct.
function chatState(pendingStep: number | null) {
  return {
    messages: MESSAGES,
    validatedSteps: [0, 1], // Situation + Ressenti ancrées → progrès dans le rail
    pendingStep,
    sessionActive: true,
    showEnded: false,
    closingPhase: "none",
    crisisDetected: false,
    routageSante: false,
    projectionDetected: false,
    patternRecognized: false,
    alliance: 2,
    diffractionSansPartage: false,
    motsCles: ["limite", "peur de décevoir", "travail"],
    reflectionCard: null,
    sessionId: "vrt-chat-session-0001",
    lastActivity: FUTURE_TS,
  };
}

// Deux éléments intrinsèquement non déterministes, impossibles à figer par CSS :
//   1. le serpentin de pied de page (<canvas>, requestAnimationFrame continu) ;
//   2. l'œil LogoEmber (regard/clignement/dérive pilotés par Math.random() +
//      setTimeout — voir LogoEmber.tsx), svg[aria-label="L'Œil Conscient"].
// On les masque (visibility:hidden → layout préservé) au moment de la capture,
// exactement comme FREEZE_CSS neutralise les transitions. Injection symétrique
// (même spec pour baseline et current) → aucun écart introduit.
async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      canvas { visibility: hidden !important; }
      svg[aria-label="L'Œil Conscient"] { visibility: hidden !important; }
    `,
  });
}

// ── (a) Accueil / pastilles — SANS collegue_chat_state ────────────────────
export const chatAccueilTarget: Target = {
  name: "chat-accueil",
  path: "/chat",
  seed: { ...IDENTITY, ...CLARTE_SEEN },
  blockRoutes: ["**/api/**"],

  ready: async (page: Page) => {
    // Le sélecteur de l'état du jour (day-picker) s'affiche une fois la
    // vérification du plafond retombée (sbGet coupé → catch → limitChecking
    // false), sans chat_state à restaurer.
    await page
      .getByText("C'est quoi, là, maintenant ?", { exact: false })
      .waitFor({ state: "visible" });
    await page.evaluate(() => (document as any).fonts?.ready);
    await stabilize(page);
    await page.waitForTimeout(700);
  },

  screens: [
    {
      name: "accueil-pastilles",
      description:
        "(a) Accueil — sélecteur d'état du jour (pastilles), état de départ " +
        "sans collegue_chat_state. Logo (œil) masqué pour déterminisme.",
    },
  ],
};

// ── (b) Conversation en cours — chat_state, pendingStep null ──────────────
export const chatConversationTarget: Target = {
  name: "chat-conversation",
  path: "/chat",
  seed: {
    ...IDENTITY,
    ...CLARTE_SEEN,
    collegue_chat_state: chatState(null),
  },
  blockRoutes: ["**/api/**"],

  ready: async (page: Page) => {
    // sessionActive devient true à la restauration → le bouton « Déposer »
    // (présent uniquement en session) apparaît : signal stable de l'écran.
    await page
      .getByRole("button", { name: "Déposer" })
      .waitFor({ state: "visible" });
    await page.evaluate(() => (document as any).fonts?.ready);
    await stabilize(page);
    // Laisse les entrées framer-motion (settle sous reducedMotion) se poser.
    await page.waitForTimeout(900);
  },

  screens: [
    {
      name: "conversation",
      description:
        "(b) Conversation en cours — sessionActive:true, showEnded:false, " +
        "closingPhase:\"none\", quelques messages, rail d'étapes (Situation + " +
        "Ressenti ancrées). Serpentin et œil masqués pour déterminisme.",
    },
  ],
};

// ── (c) Carte de validation — chat_state, pendingStep entier ──────────────
export const chatValidationTarget: Target = {
  name: "chat-validation",
  path: "/chat",
  seed: {
    ...IDENTITY,
    ...CLARTE_SEEN,
    // pendingStep = 2 (« Demande ») → la carte « Émergence identifiée »
    // s'affiche (Chat.tsx:4489 : pendingStep !== null && !loading).
    collegue_chat_state: chatState(2),
  },
  blockRoutes: ["**/api/**"],

  ready: async (page: Page) => {
    await page
      .getByText("Émergence identifiée", { exact: false })
      .waitFor({ state: "visible" });
    await page.evaluate(() => (document as any).fonts?.ready);
    await stabilize(page);
    await page.waitForTimeout(900);
  },

  screens: [
    {
      name: "validation-card",
      description:
        "(c) Carte de validation — pendingStep:2 (« Demande »), pas de " +
        "chargement (loading:false). Carte « Émergence identifiée » + bouton " +
        "« Valider l'étape ». Serpentin et œil masqués pour déterminisme.",
    },
  ],
};

// (d) Écran de fin / clôture (showEnded:true) : VOLONTAIREMENT ABSENT —
// inatteignable par seed seul (garde Chat.tsx:899-904) ni hors-ligne (clôture =
// réseau). Détaillé dans l'en-tête de fichier et report.md.

export const chatTargets: Target[] = [
  chatAccueilTarget,
  chatConversationTarget,
  chatValidationTarget,
];

export default chatTargets;
