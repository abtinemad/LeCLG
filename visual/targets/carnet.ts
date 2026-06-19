import type { Page } from "@playwright/test";
import type { Target } from "../lib/harness";

// ---------------------------------------------------------------------------
// Fixtures for the Carnet page.
//
// All data is seeded into localStorage so the page renders rich, non-empty
// content with the backend fully blocked. Dates are fixed in the past with
// comfortable margins so every section unlocks regardless of the wall-clock
// time the harness runs (gating thresholds: matrice = 21d + 5 cards + 2
// prismes; lueurs = matrice + 30d; elan = 7d + 3 cards).
// ---------------------------------------------------------------------------

const SPHERES = ["Familiale", "Sociale", "Amoureuse", "Professionnelle"];

// 8 cards, oldest -> newest, fixed ISO dates (well over a year of span).
const CARD_DATES = [
  "2025-04-12T09:15:00.000Z",
  "2025-06-03T18:40:00.000Z",
  "2025-08-21T07:30:00.000Z",
  "2025-10-09T21:05:00.000Z",
  "2025-12-15T12:20:00.000Z",
  "2026-02-02T08:00:00.000Z",
  "2026-04-18T19:45:00.000Z",
  "2026-06-10T14:10:00.000Z",
];

const PRISMES = [
  "joie",
  "colere",
  "tristesse",
  "confiance",
  "peur",
  "gratitude",
  "anticipation",
  "amour",
];

const TEXTURES = [
  "soutenante",
  "conflictuelle",
  "distante",
  "fusionnelle",
  "ambivalente",
  "réparatrice",
  "tendue",
  "complice",
];

const cards = CARD_DATES.map((date, i) => ({
  id: `fixture-card-${i + 1}`,
  date,
  sphere: SPHERES[i % SPHERES.length],
  prisme: PRISMES[i],
  texture_relationnelle: TEXTURES[i],
  fragment: `Fragment ${i + 1} — un moment de bascule où quelque chose s'est dit autrement.`,
  deplacement: `Un déplacement du regard : de l'urgence vers une attention plus posée (${i + 1}).`,
  direction: `Chercher l'équilibre et poser une limite claire, sans rompre le lien (${i + 1}).`,
  user_note:
    i % 2 === 0
      ? `Songe ${i + 1} : je remarque une tension récurrente que je commence à nommer plus précisément.`
      : "",
  miroir:
    i === 0
      ? "Ce que vous décrivez touche à un besoin de reconnaissance ancien — il revient sous des formes différentes."
      : "",
}));

// One "locked" fragment (no prisme) — renders the locked card style and the
// "Reprendre cette réflexion" control, which only appears on prisme-less cards.
cards.push({
  id: "fixture-card-locked",
  date: "2026-06-14T11:00:00.000Z",
  sphere: "Sociale",
  prisme: "",
  texture_relationnelle: "",
  fragment:
    "Fragment en attente — une réflexion entamée mais pas encore reprise.",
  deplacement: "",
  direction: "",
  user_note: "",
  miroir: "",
});

const cardCount = cards.length;

// --- Analysis results (offline fixtures, stamped fresh by the harness) ---

const lien = {
  Familiale: {
    intensite: 72,
    teinte: "Confiance",
    fragments: ["un appel rassurant", "une dispute vite réparée"],
  },
  Sociale: {
    intensite: 54,
    teinte: "Joie",
    fragments: ["un projet collectif", "un retrait choisi"],
  },
  Amoureuse: {
    intensite: 81,
    teinte: "Amour",
    fragments: ["une conversation tard le soir", "un silence partagé"],
  },
  Professionnelle: {
    intensite: 63,
    teinte: "Anticipation",
    fragments: ["une décision reportée", "une reconnaissance attendue"],
  },
  relief:
    "Le relief de vos liens dessine une structure où l'amoureux porte le plus d'intensité, tandis que le professionnel reste en tension d'attente.",
};

const network = {
  Familiale: "5 personnes",
  Sociale: "8 personnes",
  Amoureuse: "1 personne",
  Professionnelle: "6 personnes",
};

const affect = {
  active: ["élan", "curiosité", "tendresse"],
  inhibe: ["fatigue", "retrait"],
  emerge: ["apaisement", "clarté"],
  texture_semaine:
    "La semaine a oscillé entre une vigilance soutenue et de courtes éclaircies de soulagement.",
  lecture_croisee_affect_prismes: [
    "La confiance apparaît surtout dans la sphère familiale.",
    "La peur reste corrélée aux échéances professionnelles.",
    "La joie émerge dans les moments sociaux non planifiés.",
  ],
};

const elan = {
  mouvement:
    "Un mouvement de consolidation : ce qui était subi se transforme lentement en direction choisie.",
  direction:
    "Vers une affirmation plus tranquille de vos limites, sans rupture brutale.",
  question:
    "Qu'est-ce qui, aujourd'hui, mérite d'être protégé plutôt que prouvé ?",
};

const matrice = {
  angoisses: [
    {
      label: "Abandon",
      intensite: 68,
      manifestations: ["sur-vérification", "anticipation du rejet"],
    },
    {
      label: "Insuffisance",
      intensite: 55,
      manifestations: ["perfectionnisme", "difficulté à déléguer"],
    },
    {
      label: "Perte de contrôle",
      intensite: 47,
      manifestations: ["planification excessive"],
    },
  ],
  valeurs: [
    { label: "Loyauté", proximite: ["fidélité", "constance"] },
    { label: "Clarté", proximite: ["honnêteté", "justesse"] },
  ],
  schema_central:
    "Un schéma central de don conditionnel : se rendre indispensable pour s'assurer de garder le lien.",
  coherence_elan_matrice:
    "L'élan vers la limite vient précisément desserrer ce schéma de don conditionnel.",
  defenses: [
    {
      label: "Sur-adaptation",
      declencheur: "conflit latent",
      direction: "vers l'autre",
    },
  ],
};

const enrich = {
  collegue_enrich_fragments: {
    mots_recurrents: ["limite", "lien", "fatigue", "clarté"],
    pattern_arret:
      "Vos réflexions se referment souvent sur une décision reportée plutôt que tranchée.",
    reformulations: {
      "fixture-card-1": "convergent",
      "fixture-card-2": "divergent",
      "fixture-card-3": "neutral",
    },
  },
  collegue_enrich_lien: {
    recurrences: "Le motif de la réparation rapide revient dans la sphère familiale.",
    tension: "Une tension non dite persiste côté professionnel.",
    echo: "L'amoureux fait écho au familial : même besoin de sécurité.",
  },
  collegue_enrich_affect: {
    rythme:
      "La sédimentation affective suit un rythme lent, avec des reprises tous les deux mois environ.",
  },
  collegue_enrich_elan: {
    clusters_recurrents:
      "Trois clusters reviennent : la limite, le soin de soi, et la quête de sens au travail.",
  },
  collegue_enrich_matrice: {
    evolution:
      "Le socle évolue d'une logique de preuve vers une logique de présence.",
    validation_songes:
      "Vos songes confirment l'hypothèse du don conditionnel à plusieurs reprises.",
    mouvement_cognitif:
      "La dynamique cognitive privilégie la délibération et le questionnement ouvert.",
  },
};

const lueurs = [
  {
    title: "La limite comme soin",
    text: "Poser une limite n'est pas rompre le lien : c'est le rendre vivable. Ce mois-ci, vous l'avez expérimenté concrètement.",
    date: "2026-06-01T10:00:00.000Z",
    context: "Issue de la Matrice et de vos songes du printemps.",
  },
  {
    title: "Le don sans facture",
    text: "Donner sans tenir de comptes ouvre un espace où la reconnaissance n'a plus à être négociée.",
    date: "2026-05-01T10:00:00.000Z",
    context: "Croisement de l'Élan et de l'Affect.",
  },
];

const sessions = [
  {
    id: "sess-1",
    started_at: "2026-04-18T19:40:00.000Z",
    step_reached: 5,
    reflection_card: { id: "fixture-card-7", date: CARD_DATES[6] },
  },
  {
    id: "sess-2",
    started_at: "2026-06-10T14:05:00.000Z",
    step_reached: 4,
    reflection_card: { id: "fixture-card-8", date: CARD_DATES[7] },
  },
  {
    id: "sess-3",
    started_at: "2026-02-02T07:55:00.000Z",
    step_reached: 3,
    reflection_card: { id: "fixture-card-6", date: CARD_DATES[5] },
  },
];

const sphereSonges = {
  Familiale:
    "Je sens que je porte beaucoup, et que je n'ose pas toujours le dire clairement à ma famille.",
  Sociale: "Les rapports sociaux me ressourcent quand ils ne sont pas planifiés.",
  Amoureuse:
    "Il y a une sécurité profonde ici, mais aussi la peur de trop en demander.",
  Professionnelle:
    "La pression est constante ; j'attends une reconnaissance qui tarde à venir.",
};

// The Clé-LCLG identity. Any value satisfies the gate offline — using a clearly
// synthetic id keeps the harness independent of any real test account.
const IDENTITY = {
  collegue_personal_id: "vrt-fixture-cle-lclg-0001",
  collegue_access_code: "000000",
};

const seed: Record<string, unknown> = {
  ...IDENTITY,
  collegue_cards: cards,
  collegue_lien: lien,
  collegue_network: network,
  collegue_affect: affect,
  collegue_elan_eval: elan,
  collegue_matrice_eval: matrice,
  ...enrich,
  collegue_lueurs: lueurs,
  collegue_sessions: sessions,
  collegue_sphere_songes: sphereSonges,
  collegue_eclats: [], // empty -> the "Invoquer un Éclat" CTA is shown
  collegue_sound: "false",
  // Suppress the first-visit "Clarté" onboarding guide (z-10000 overlay) on
  // every view. It is shared chrome, untouched by the refactor, and would
  // otherwise intercept all clicks and pop up over each screen.
  "collegue_clarte_seen_carnet-fragments": "1",
  "collegue_clarte_seen_carnet-lien": "1",
  "collegue_clarte_seen_carnet-affect": "1",
  "collegue_clarte_seen_carnet-elan": "1",
  "collegue_clarte_seen_carnet-matrice": "1",
};

// Keys the app checks for freshness (_n === cardCount, recent _t). Stamping
// them keeps the analysis chain from firing its (blocked) network requests.
const freshKeys = [
  "collegue_lien",
  "collegue_network",
  "collegue_affect",
  "collegue_elan_eval",
  "collegue_matrice_eval",
  "collegue_enrich_fragments",
  "collegue_enrich_lien",
  "collegue_enrich_affect",
  "collegue_enrich_elan",
  "collegue_enrich_matrice",
];

async function openLueursModal(page: Page) {
  await page.getByTitle("Lueurs", { exact: true }).click();
  await page.getByText("Lueurs & Éclats").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
}

async function switchView(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(500);
}

export const carnetTarget: Target = {
  name: "carnet",
  path: "/carnet",
  seed,
  freshKeys,
  freshCount: cardCount,
  blockRoutes: ["**/api/**"],

  ready: async (page: Page) => {
    await page
      .getByRole("button", { name: "Fragments", exact: true })
      .waitFor({ state: "visible" });
    await page.evaluate(() => (document as any).fonts?.ready);
    // Let loadCards() settle (its cloud attempt is aborted -> local fallback)
    // and the initial entrance render finish.
    await page.waitForTimeout(700);
  },

  screens: [
    {
      name: "shell-toolbar",
      description: "Shell — barre du haut + navigation (état par défaut)",
      clip: { x: 0, y: 0, width: 1280, height: 360 },
    },
    {
      name: "view-fragments",
      description: "Vue Fragments (vue par défaut)",
    },
    {
      name: "view-lien",
      description: "Vue Lien",
      action: (p) => switchView(p, "Lien"),
    },
    {
      name: "view-affect",
      description: "Vue Affect",
      action: (p) => switchView(p, "Affect"),
    },
    {
      name: "view-elan",
      description: "Vue Élan",
      action: (p) => switchView(p, "Élan"),
    },
    {
      name: "view-matrice",
      description: "Vue Matrice",
      action: (p) => switchView(p, "Matrice"),
    },
    {
      name: "modal-prismes",
      description: "Modale — Prismes collectés",
      action: async (p) => {
        await p.getByTitle("Prismes", { exact: true }).click();
        await p.waitForTimeout(500);
      },
    },
    {
      name: "modal-lueurs-eclats",
      description: "Modale — Lueurs & Éclats",
      action: async (p) => {
        await openLueursModal(p);
      },
    },
    {
      name: "modal-eclat",
      description: "Modale — Éclat (invoquer un Éclat)",
      action: async (p) => {
        await openLueursModal(p);
        await p
          .getByRole("button", { name: "Invoquer un Éclat" })
          .first()
          .click();
        await p.waitForTimeout(500);
      },
    },
    {
      name: "modal-lueur-reader",
      description: "Modale — Lecture d'une Lueur",
      action: async (p) => {
        await openLueursModal(p);
        await p
          .getByRole("button", { name: /Lire en entier/ })
          .first()
          .click();
        await p.waitForTimeout(500);
      },
    },
    {
      name: "modal-resume",
      description: "Modale — Reprendre la réflexion",
      action: async (p) => {
        await p
          .getByTitle("Reprendre cette réflexion")
          .first()
          .click();
        await p.waitForTimeout(500);
      },
    },
  ],
};

export default carnetTarget;
